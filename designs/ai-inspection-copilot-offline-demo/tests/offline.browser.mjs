import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { launchOfflineChrome } from './cdp-client.mjs';

const rootDirectory = path.resolve(import.meta.dirname, '..');
const artifactPath = path.join(rootDirectory, 'index.html');
const evidenceDirectory = path.join(rootDirectory, 'evidence');
const recordEvidence = process.argv.includes('--evidence');

async function click(session, selector) {
  const clicked = await session.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || element.disabled) return false;
    element.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Expected clickable element ${selector}`);
}

async function bodyText(session) {
  return session.evaluate('document.body.innerText');
}

async function waitForPaint(session) {
  await session.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}

async function submitRequest(session, request) {
  const submitted = await session.evaluate(`(() => {
    const form = document.querySelector("[data-intent-form]");
    if (!form) return false;
    form.elements.namedItem("inspection-intent").value = ${JSON.stringify(request.prompt)};
    form.elements.namedItem("target-service").value = ${JSON.stringify(request.targetService ?? '')};
    form.elements.namedItem("context-reference").value = ${JSON.stringify(request.contextReference ?? '')};
    form.requestSubmit();
    return true;
  })()`);
  assert.equal(submitted, true, 'Expected user request form to submit');
}

async function screenshot(session, fileName, { captureBeyondViewport = true } = {}) {
  if (!recordEvidence) return;
  await mkdir(evidenceDirectory, { recursive: true });
  const image = await session.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport,
  });
  await writeFile(path.join(evidenceDirectory, fileName), Buffer.from(image.data, 'base64'));
}

async function advanceExecution(session) {
  for (let index = 0; index < 4; index += 1) {
    await click(session, '[data-action="EXECUTION_ADVANCED"]');
  }
}

async function main() {
  await readFile(artifactPath);
  const browser = await launchOfflineChrome();
  const { session } = browser;
  const networkRequests = [];
  const browserErrors = [];

  try {
    session.on('Network.requestWillBeSent', ({ request }) => {
      if (/^https?:/i.test(request.url)) networkRequests.push(request.url);
    });
    session.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      browserErrors.push(exceptionDetails.exception?.description ?? exceptionDetails.text);
    });
    session.on('Log.entryAdded', ({ entry }) => {
      if (entry.level === 'error') browserErrors.push(entry.text);
    });
    await Promise.all([
      session.send('Page.enable'),
      session.send('Runtime.enable'),
      session.send('Network.enable'),
      session.send('Log.enable'),
      session.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      }),
    ]);

    const loaded = session.once('Page.loadEventFired');
    await session.send('Page.navigate', {
      url: pathToFileURL(artifactPath).href,
    });
    await loaded;

    let text = await bodyText(session);
    assert.match(text, /已保存巡检/);
    assert.match(text, /还没有保存的巡检，从右侧对话开始/);
    assert.deepEqual(
      await session.evaluate(`(() => {
        const title = document.querySelector('[data-stage-title]');
        return { text: title.textContent.trim(), fontSize: getComputedStyle(title).fontSize };
      })()`),
      { text: '已保存巡检', fontSize: '18px' },
    );
    assert.equal(await session.evaluate('document.querySelectorAll("[data-scenario-id]").length'), 0);
    await screenshot(session, '00-user-defined-intake.png');

    await submitRequest(session, {
      prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
      targetService: 'fulfillment-service',
      contextReference: 'REL-FUL-72',
    });
    text = await bodyText(session);
    assert.match(text, /确认巡检信息/);
    assert.match(text, /近期变更/);
    assert.match(text, /关联服务与依赖/);
    assert.match(text, /可用信号/);
    await screenshot(session, '11-dual-entry-context-selection.png');

    const deselectedSignalId = await session.evaluate(`(() => {
      const signal = document.querySelector('[data-context-id^="signal:"]');
      const contextId = signal.dataset.contextId;
      signal.click();
      return contextId;
    })()`);
    assert.match(deselectedSignalId, /^signal:/);
    assert.equal(
      await session.evaluate(
        `document.querySelector('[data-context-id="${deselectedSignalId}"]').getAttribute('aria-pressed')`,
      ),
      'false',
    );

    await click(session, '[data-action="INPUT_CONFIRMED"]');
    text = await bodyText(session);
    assert.match(text, /本次将执行 3 项检查，另有 1 项 AI 可选建议/);
    assert.match(text, /可选建议[\s\S]*将执行的检查[\s\S]*确认并开始巡检/);
    assert.doesNotMatch(text, /需要你确认|有建议待确认|请先处理上方的建议项/);
    assert.doesNotMatch(text, /fulfillment\.service\.success_rate/);
    assert.doesNotMatch(text, /http\.error_rate/);
    const genericPlanText = await session.evaluate(`(() => {
      document.querySelectorAll(".check-card").forEach((check) => {
        check.open = true;
      });
      return document.querySelector(".check-stack").innerText;
    })()`);
    assert.doesNotMatch(genericPlanText, /order|payment|订单|支付/i);
    assert.match(genericPlanText, /fulfillment-service/);
    assert.match(genericPlanText, /http\.error_rate/);
    await screenshot(session, '11-draft-optional-suggestion.png');
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    await advanceExecution(session);
    assert.deepEqual(browserErrors, [], 'generic report renders without browser errors');
    text = await bodyText(session);
    assert.match(text, /Proceed/);
    assert.match(text, /Verified/);
    assert.match(text, /已执行检查未发现关键违例/);
    assert.match(text, /本次选择的巡检结果/);
    assert.match(text, /fulfillment-service 巡检 · .*窗口 .*实例 INS-/);
    assert.match(text, /证据仪表盘/);
    assert.match(text, /检查结果/);
    assert.match(text, /AI 解读/);
    assert.doesNotMatch(
      await session.evaluate('document.querySelector("[data-testid=ai-interpretation]").innerText'),
      /核心业务成功率/,
      'AI interpretation cannot retain a claim whose evidence was deselected',
    );
    assert.match(await session.evaluate('document.querySelector(".report-summary").innerText'), /锁定计划内的 3 项检查/);
    assert.doesNotMatch(await session.evaluate('document.querySelector(".report-summary").innerText'), /核心业务结果/);
    assert.equal(await session.evaluate('document.querySelectorAll("[data-testid=report-check-result]").length'), 3);
    assert.equal(
      await session.evaluate(
        'getComputedStyle(document.querySelector(".evidence-grid")).gridTemplateColumns.split(" ").length',
      ),
      2,
      'desktop evidence dashboard uses two readable columns',
    );
    const firstRunSnapshot = await session.evaluate(
      'JSON.parse(localStorage.getItem("nova.inspection-library.v1")).runs[0]',
    );
    assert.equal(firstRunSnapshot.inspectionPlan.checkIds.includes(deselectedSignalId.slice('signal:'.length)), false);
    assert.equal(
      await session.evaluate(`(() => {
        const form = document.querySelector('[data-save-inspection-form]');
        form.elements.namedItem('saved-inspection-name').value = '履约发布后巡检';
        form.requestSubmit();
        return true;
      })()`),
      true,
    );
    assert.match(await bodyText(session), /已保存，下次可从首页直接执行/);
    await screenshot(session, '01-user-defined-proceed.png');

    await click(session, '[data-action="RESET"]');
    text = await bodyText(session);
    assert.match(text, /履约发布后巡检/);
    assert.match(text, /直跑/);
    await screenshot(session, '12-saved-inspection-home.png');
    const persistedLoaded = session.once('Page.loadEventFired');
    await session.send('Page.reload');
    await persistedLoaded;
    assert.match(await bodyText(session), /履约发布后巡检/);
    await click(session, '[data-action="SAVED_INSPECTION_RUN_REQUESTED"]');
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'execution');
    assert.equal(await session.evaluate('document.querySelectorAll("[data-testid=inspection-plan]").length'), 0);
    assert.match(await bodyText(session), /一致，已直接执行/);
    await screenshot(session, '13-saved-direct-run.png');
    await advanceExecution(session);
    const persistedAfterDirectRun = await session.evaluate(
      'JSON.parse(localStorage.getItem("nova.inspection-library.v1"))',
    );
    assert.equal(persistedAfterDirectRun.runs.length, 2);
    assert.equal(new Set(persistedAfterDirectRun.runs.map((run) => run.id)).size, 2);
    assert.deepEqual(persistedAfterDirectRun.runs[0], firstRunSnapshot);
    text = await bodyText(session);
    assert.match(text, /与上次相比/);
    assert.match(text, /与上次结论一致/);
    assert.equal(await session.evaluate('document.querySelectorAll("[data-share-action]").length'), 2);
    await session.evaluate(`(() => {
      document.execCommand = (command) => {
        if (command !== 'copy') return false;
        const textareas = document.querySelectorAll('textarea');
        window.__copiedReportText = textareas[textareas.length - 1]?.value ?? '';
        return true;
      };
    })()`);
    await click(session, '[data-share-action="copy"]');
    await waitForPaint(session);
    assert.match(await bodyText(session), /摘要已复制/);
    assert.equal(
      await session.evaluate('window.__copiedReportText.split("\\n").length'),
      5,
      'copy action sends the five-line summary to the clipboard boundary',
    );
    await click(session, '[data-share-action="export"]');
    await waitForPaint(session);
    assert.match(await bodyText(session), /离线报告已导出/);
    await screenshot(session, '16-run-comparison-and-share.png');
    await click(session, '[data-action="RESET"]');

    await click(session, '[data-action="SAVED_INSPECTION_HISTORY_OPENED"]');
    text = await bodyText(session);
    assert.match(text, /运行历史/);
    assert.match(text, /共执行 2 次/);
    assert.equal(await session.evaluate('document.querySelectorAll(".saved-history-entry").length'), 2);
    assert.equal(await session.evaluate('document.querySelectorAll("[data-share-action]").length'), 0);
    await click(session, '.saved-history-entry summary');
    assert.match(await bodyText(session), /历史快照/);
    assert.match(await bodyText(session), /不可修改/);
    assert.equal(
      await session.evaluate(
        'document.querySelectorAll(".saved-history-entry[open] [data-testid=evidence-dashboard]").length',
      ),
      1,
    );
    assert.equal(
      await session.evaluate('document.querySelectorAll(".saved-history-entry[open] [data-testid=report-checks]").length'),
      1,
    );
    assert.equal(
      await session.evaluate(
        'document.querySelectorAll(".saved-history-entry[open] [data-testid=ai-interpretation]").length',
      ),
      1,
    );
    await screenshot(session, '17-saved-inspection-history.png');
    await click(session, '[data-action="SAVED_INSPECTION_HISTORY_CLOSED"]');

    const cleanLibrary = await session.evaluate('localStorage.getItem("nova.inspection-library.v1")');
    const corruptLoaded = session.once('Page.loadEventFired');
    await session.evaluate(`(() => {
      const library = JSON.parse(localStorage.getItem('nova.inspection-library.v1'));
      library.runs = [library.runs[0]];
      library.runs[0].report = {};
      localStorage.setItem('nova.inspection-library.v1', JSON.stringify(library));
    })()`);
    await session.send('Page.reload');
    await corruptLoaded;
    assert.match(await bodyText(session), /历史暂不可用/);
    assert.ok(
      await session.evaluate('Boolean(document.querySelector("[data-action=SAVED_INSPECTION_RUN_REQUESTED]"))'),
    );
    await click(session, '[data-action="SAVED_INSPECTION_HISTORY_OPENED"]');
    assert.match(await bodyText(session), /还没有执行记录/);
    assert.match(await bodyText(session), /仍可直跑/);
    await click(session, '[data-action="SAVED_INSPECTION_RUN_REQUESTED"]');
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'execution');
    const restoredLoaded = session.once('Page.loadEventFired');
    await session.evaluate(`localStorage.setItem('nova.inspection-library.v1', ${JSON.stringify(cleanLibrary)})`);
    await session.send('Page.reload');
    await restoredLoaded;

    const malformedStorageEventPayload = await session.evaluate(`(() => {
      const library = JSON.parse(localStorage.getItem('nova.inspection-library.v1'));
      library.runs = [library.runs[0]];
      library.runs[0].report = {};
      return JSON.stringify(library);
    })()`);
    await session.evaluate(`window.dispatchEvent(new StorageEvent('storage', {
      key: 'nova.inspection-library.v1',
      newValue: ${JSON.stringify(malformedStorageEventPayload)}
    }))`);
    assert.match(await bodyText(session), /历史暂不可用/);
    assert.ok(
      await session.evaluate('Boolean(document.querySelector("[data-action=SAVED_INSPECTION_RUN_REQUESTED]"))'),
      'cross-tab corruption must not block a direct run',
    );
    const cleanAfterStorageEventLoaded = session.once('Page.loadEventFired');
    await session.evaluate(`localStorage.setItem('nova.inspection-library.v1', ${JSON.stringify(cleanLibrary)})`);
    await session.send('Page.reload');
    await cleanAfterStorageEventLoaded;

    await click(session, '[data-example-id="order-upgrade"]');
    await session.evaluate('document.querySelector("[data-intent-form]").requestSubmit()');
    await click(session, '[data-action="INPUT_CONFIRMED"]');
    assert.equal(
      await session.evaluate('document.querySelector("[data-testid=playbook-match]").dataset.matchStatus'),
      'exact',
    );
    assert.match(await bodyText(session), /订单发布后验证 · v4/);
    assert.equal(await session.evaluate('document.querySelectorAll(".playbook-primary").length'), 1);
    await screenshot(session, '06-playbook-exact-match.png');
    await click(session, '[data-action="PLAYBOOK_EXECUTION_STARTED"]');
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'execution');
    await advanceExecution(session);
    text = await bodyText(session);
    assert.match(text, /历史实例不受影响/);
    assert.match(text, /提交方案更新 → v5/);
    await click(session, '[data-action="PLAYBOOK_PROPOSAL_SUBMITTED"]');
    assert.match(await bodyText(session), /方案更新 v5 · 待审批/);
    await screenshot(session, '07-playbook-exact-report.png');

    await click(session, '[data-action="RESET"]');
    await click(session, '[data-example-id="payment-config"]');
    assert.match(await session.evaluate('document.querySelector("[name=inspection-intent]").value'), /payment-api/);
    assert.equal(await session.evaluate('document.querySelector("[data-intent-form]").requestSubmit(); true'), true);
    await click(session, '[data-action="INPUT_CONFIRMED"]');
    text = await bodyText(session);
    assert.match(text, /支付确认 → 账单异步/);
    assert.match(text, /payment\.confirm\.success_rate/);
    assert.match(text, /payment-api → settlement-db/);
    assert.match(text, /settlement-db · Redis · invoice queue/);
    assert.match(text, /支付配置变更巡检 · v3/);
    assert.match(text, /2 项当前差异需要确认/);
    await screenshot(session, '04-impact-dimensions.png');
    await click(session, '[data-action="PLAYBOOK_DIFF_CONFIRMED"]');
    text = await bodyText(session);
    assert.match(text, /Observed-Superset/);
    assert.match(text, /invoice-worker/);
    assert.match(text, /settlement-db/);
    assert.match(
      await session.evaluate('document.querySelector(\'[data-testid="plan-summary"]\').textContent'),
      /本次将执行 3 项检查，另有 1 项 AI 建议需要你确认/,
    );
    assert.equal(
      await session.evaluate(`(() => {
        const confirmation = document.querySelector('#pending-title');
        const checks = document.querySelector('#formal-title');
        return Boolean(confirmation && checks && confirmation.compareDocumentPosition(checks) & Node.DOCUMENT_POSITION_FOLLOWING);
      })()`),
      true,
    );
    assert.equal(await session.evaluate('document.querySelector(\'[data-action="PLAN_CONFIRMED"]\').disabled'), true);
    assert.match(
      await session.evaluate('document.querySelector(\'[data-action="PLAN_CONFIRMED"]\').textContent'),
      /请先处理上方的建议项/,
    );
    await screenshot(session, '05-draft-action-first.png');

    await click(session, '[data-action="CANDIDATE_DISPOSED"][data-disposition="accepted"]');
    assert.equal(await session.evaluate('document.querySelector(\'[data-action="PLAN_CONFIRMED"]\').disabled'), false);
    assert.match(
      await session.evaluate('document.querySelector(\'[data-testid="plan-summary"]\').textContent'),
      /本次将执行 4 项检查，无需额外确认/,
    );
    assert.match(await bodyText(session), /✓ 已加查/);
    await click(session, '[data-action="CANDIDATE_DISPOSED"][data-disposition="rejected"]');
    assert.match(await bodyText(session), /— 不查/);
    assert.match(
      await session.evaluate('document.querySelector(\'[data-testid="plan-summary"]\').textContent'),
      /本次将执行 3 项检查，无需额外确认/,
    );
    assert.equal(await session.evaluate('document.querySelectorAll(".check-card.is-candidate-check").length'), 0);
    await click(session, '[data-action="CANDIDATE_DISPOSED"][data-disposition="accepted"]');
    assert.match(await bodyText(session), /✓ 已加查/);
    assert.equal(await session.evaluate('document.querySelectorAll(".check-card.is-candidate-check").length'), 1);
    await click(session, '.check-card summary');
    const sourceDetail = await session.evaluate("document.querySelector('.check-card[open] .check-sources').innerText");
    assert.match(sourceDetail, /电子流/);
    assert.match(sourceDetail, /CHG-84217/);
    await screenshot(session, '05-plan-contract-expanded.png');
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    await advanceExecution(session);
    text = await bodyText(session);
    assert.match(text, /建议暂停在 25% 灰度/);
    assert.match(text, /Violated/);
    assert.match(text, /Pause/);
    assert.equal(
      await session.evaluate('document.querySelector(".evidence-card").classList.contains("is-violated")'),
      true,
      'violated evidence is promoted to the first dashboard card',
    );
    assert.equal(
      await session.evaluate('document.querySelectorAll("[data-testid=report-check-result]").length'),
      4,
      'the report preserves every executed check',
    );
    await click(session, '[data-evidence-target="settlement-pool-utilization"]');
    await waitForPaint(session);
    const highlightedEvidence = await session.evaluate(`(() => {
      const card = document.querySelector('[data-evidence-id="settlement-pool-utilization"]');
      return {
        highlighted: card.classList.contains('is-highlighted'),
        outline: getComputedStyle(card).outlineStyle,
      };
    })()`);
    assert.equal(highlightedEvidence.highlighted, true, 'AI evidence anchors focus the matching evidence card');
    assert.notEqual(highlightedEvidence.outline, 'none', 'the focused evidence card is visibly highlighted');
    await click(session, '[data-action="RC_TOGGLED"]');
    text = await bodyText(session);
    assert.match(text, /共享配置包将 DB 连接池上限从 120 降为 60/);
    await screenshot(session, '02-electronic-flow-pause.png');

    await click(session, '[data-action="RESET"]');
    await submitRequest(session, {
      prompt: 'payment-api 拆分出 risk-api，重新验证支付确认链路。',
      targetService: 'payment-api',
      contextReference: 'CHG-84501',
    });
    await click(session, '[data-action="INPUT_CONFIRMED"]');
    assert.equal(
      await session.evaluate('document.querySelector("[data-testid=playbook-match]").dataset.matchStatus'),
      'major-drift',
    );
    await screenshot(session, '09-playbook-major-desktop.png');

    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const mobileLoaded = session.once('Page.loadEventFired');
    await session.send('Page.reload');
    await mobileLoaded;
    assert.match(await bodyText(session), /履约发布后巡检/);
    const mobileComposer = await session.evaluate(`(() => {
        const panel = document.querySelector('.copilot-panel');
        const composer = document.querySelector('.conversation-form textarea');
        const stage = document.querySelector('.stage-panel');
        const savedCard = document.querySelector('[data-testid="saved-inspection-card"]');
        return {
          position: getComputedStyle(panel).position,
          panelTop: Math.round(panel.getBoundingClientRect().top),
          panelHeight: Math.round(panel.getBoundingClientRect().height),
          viewportHeight: window.innerHeight,
          composerHeight: Math.round(composer.getBoundingClientRect().height),
          stageWidth: Math.round(stage.getBoundingClientRect().width),
          savedCardWidth: Math.round(savedCard.getBoundingClientRect().width),
          noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        };
      })()`);
    assert.equal(mobileComposer.position, 'fixed');
    assert.equal(mobileComposer.noOverflow, true);
    assert.ok(mobileComposer.stageWidth >= 360, 'mobile saved-inspection stage uses the available width');
    assert.ok(mobileComposer.savedCardWidth >= 320, 'mobile saved-inspection card remains readable');
    assert.ok(
      mobileComposer.panelHeight < 100,
      `mobile composer stays a compact bottom bar (received ${mobileComposer.panelHeight}px)`,
    );
    assert.ok(
      mobileComposer.panelTop > mobileComposer.viewportHeight - 120,
      'mobile composer leaves the saved-inspection first screen visible',
    );
    assert.ok(mobileComposer.composerHeight >= 44, 'mobile composer keeps a touch-safe hit target');
    await screenshot(session, '14-mobile-saved-home.png', { captureBeyondViewport: false });
    await click(session, '[data-action="SAVED_INSPECTION_RUN_REQUESTED"]');
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'execution');
    await advanceExecution(session);
    assert.match(await bodyText(session), /本次选择的巡检结果/);
    assert.match(await bodyText(session), /与上次相比/);
    const mobileReport = await session.evaluate(`(() => {
      const viewport = window.innerWidth;
      const withinViewport = (node) => node.getBoundingClientRect().right <= viewport + 1;
      return {
        noOverflow: document.documentElement.scrollWidth <= viewport + 1,
        evidenceColumns: getComputedStyle(document.querySelector('.evidence-grid')).gridTemplateColumns.split(' ').length,
        interpretationColumns: getComputedStyle(document.querySelector('.interpretation-list')).gridTemplateColumns.split(' ').length,
        trackWidth: Math.round(document.querySelector('.evidence-track').getBoundingClientRect().width),
        checksFit: [...document.querySelectorAll('.report-check-result')].every(withinViewport),
      };
    })()`);
    assert.equal(mobileReport.noOverflow, true, 'mobile report v2 must not overflow horizontally');
    assert.equal(mobileReport.evidenceColumns, 1, 'mobile evidence cards use one column');
    assert.equal(mobileReport.interpretationColumns, 1, 'mobile AI interpretation uses one column');
    assert.ok(mobileReport.trackWidth >= 120, 'mobile evidence tracks remain readable');
    assert.equal(mobileReport.checksFit, true, 'mobile check results remain inside the viewport');
    await session.evaluate(
      'document.querySelector("[data-testid=evidence-dashboard]").scrollIntoView({ block: "start" })',
    );
    await waitForPaint(session);
    await screenshot(session, '19-mobile-report-v2.png');
    await click(session, '[data-action="RESET"]');
    await click(session, '[data-action="SAVED_INSPECTION_HISTORY_OPENED"]');
    assert.equal(
      await session.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),
      true,
      'mobile history must not overflow horizontally',
    );
    assert.equal(await session.evaluate('document.querySelectorAll(".saved-history-entry").length >= 3'), true);
    await screenshot(session, '18-mobile-run-history.png', { captureBeyondViewport: false });
    await click(session, '[data-action="SAVED_INSPECTION_HISTORY_CLOSED"]');

    await submitRequest(session, {
      prompt: 'payment-api 拆分出 risk-api，重新验证支付确认链路。',
      targetService: 'payment-api',
      contextReference: 'CHG-84501',
    });
    assert.equal(
      await session.evaluate(
        'getComputedStyle(document.querySelector(".context-option-list")).gridTemplateColumns.split(" ").length',
      ),
      1,
    );
    await click(session, '[data-action="INPUT_CONFIRMED"]');
    assert.equal(
      await session.evaluate('document.querySelector("[data-testid=playbook-match]").dataset.matchStatus'),
      'major-drift',
    );
    assert.equal(await session.evaluate('document.querySelector("[data-action=PLAYBOOK_REGENERATED]").disabled'), true);
    await session.evaluate(`(() => {
      const drawer = document.querySelector('.playbook-drawer');
      drawer.open = true;
      const body = drawer.querySelector('.playbook-drawer-body');
      body.scrollTop = body.scrollHeight;
    })()`);
    await waitForPaint(session);
    await screenshot(session, '10-playbook-major-mobile-drawer.png');
    await click(session, '.playbook-drawer [data-action="PLAYBOOK_DRIFT_REVIEWED"]');
    assert.equal(
      await session.evaluate('document.querySelector("[data-action=PLAYBOOK_REGENERATED]").disabled'),
      false,
    );
    await click(session, '[data-action="PLAYBOOK_REGENERATED"]');
    assert.match(await bodyText(session), /旧方案仅作参考/);
    const mobilePlan = await session.evaluate(`(() => {
      const action = document.querySelector('[data-action="PLAN_CONFIRMED"]');
      return {
        noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        actionInDraft: Boolean(action.closest('[data-testid="inspection-plan"]')),
        actionLabel: action.textContent.trim(),
      };
    })()`);
    assert.equal(mobilePlan.noOverflow, true, 'mobile draft must not overflow horizontally');
    assert.equal(mobilePlan.actionInDraft, true, 'mobile draft action stays above the conversation composer');
    assert.match(mobilePlan.actionLabel, /确认并开始巡检/);
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    await advanceExecution(session);
    await waitForPaint(session);
    assert.equal(
      await session.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),
      true,
      'mobile layout must not overflow horizontally',
    );
    assert.equal(
      await session.evaluate(
        "document.querySelector('[data-testid=final-report]').getBoundingClientRect().height > 500",
      ),
      true,
      'mobile report must remain visibly laid out after viewport change',
    );
    assert.equal(
      await session.evaluate(`(() => [...document.querySelectorAll('.single-line-note')].every((node) => {
        const style = getComputedStyle(node);
        return style.whiteSpace === 'nowrap' && node.scrollHeight <= Math.ceil(parseFloat(style.lineHeight)) + 1;
      }))()`),
      true,
      'concise card notes must remain single-line at 390px',
    );
    assert.equal(
      await session.evaluate(
        "parseFloat(getComputedStyle(document.querySelector('.decision-hero h2')).fontSize) >= 26",
      ),
      true,
      'the final action remains the only report hero',
    );
    await screenshot(session, '08-playbook-major-mobile-report.png');

    assert.deepEqual(networkRequests, []);
    assert.deepEqual(browserErrors, []);
    process.stdout.write(
      'Offline browser acceptance passed: history, comparison, sharing, corrupt-history recovery, unmatched, exact, minor-drift, and major-drift journeys; 0 network requests, 0 browser errors.\n',
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
