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
  assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'report');
  assert.equal(await session.evaluate('document.querySelectorAll("[data-action=EXECUTION_ADVANCED]").length'), 0);
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
    assert.match(text, /还没有保存的巡检，从上方变更单开始/);
    assert.deepEqual(
      await session.evaluate(`(() => {
        const title = document.querySelector('[data-stage-title]');
        return { text: title.textContent.trim(), fontSize: getComputedStyle(title).fontSize };
      })()`),
      { text: '从变更开始生成巡检计划', fontSize: '17px' },
    );
    assert.equal(await session.evaluate('document.querySelectorAll("[data-scenario-id]").length'), 0);
    assert.match(text, /变更单 \/ 发布单号/);
    assert.match(text, /补充说明（可选）/);
    assert.equal(await session.evaluate('Boolean(document.querySelector("[name=inspection-intent]"))'), true);
    assert.match(text, /生成巡检计划/);
    await screenshot(session, '00-user-defined-intake.png');

    await submitRequest(session, {
      prompt: '关注扣款成功和 Redis 客户端',
      contextReference: 'CHG-84501',
    });
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'plan');
    text = await bodyText(session);
    assert.match(text, /影响面缺口/);
    assert.match(text, /settlement-db/);
    assert.match(text, /invoice-worker/);
    assert.doesNotMatch(text, /已扩大巡检范围/);
    assert.equal(await session.evaluate('document.querySelectorAll("[data-action=PLAN_CONFIRMED]").length'), 1);
    assert.equal(
      await session.evaluate(
        'document.querySelectorAll("[data-action=INPUT_CONFIRMED], [data-action=SCOPE_ACCEPTED]").length',
      ),
      0,
    );
    await click(session, '[data-action="CANDIDATE_INCLUDED"][data-candidate-id="candidate-db-wait"]');
    await screenshot(session, '22-release-candidate-plan.png');
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    await advanceExecution(session);
    text = await bodyText(session);
    assert.match(text, /建议暂停在 25% 灰度/);
    assert.match(text, /覆盖：3 项已验证 · 1 项未覆盖/);
    assert.match(text, /未覆盖：invoice-worker/);
    await screenshot(session, '23-release-coverage-honest-report.png');
    await click(session, '[data-action="RESET"]');
    const cleanJourneyLoaded = session.once('Page.loadEventFired');
    await session.evaluate('localStorage.clear()');
    await session.send('Page.reload');
    await cleanJourneyLoaded;

    await submitRequest(session, {
      prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
      targetService: 'fulfillment-service',
      contextReference: 'REL-FUL-72',
    });
    text = await bodyText(session);
    assert.match(text, /REL-FUL-72/);
    assert.match(text, /4 项阻断/);
    assert.match(text, /可选观察[\s\S]*将执行的检查[\s\S]*确认并开始巡检/);
    assert.doesNotMatch(text, /需要你确认|有建议待确认|请先处理上方的建议项/);
    const genericPlanText = await session.evaluate(`(() => {
      document.querySelectorAll(".check-card").forEach((check) => {
        check.open = true;
      });
      return document.querySelector(".check-stack").innerText;
    })()`);
    assert.doesNotMatch(genericPlanText, /order|payment|订单|支付/i);
    assert.match(genericPlanText, /fulfillment-service/);
    assert.match(genericPlanText, /http\.error_rate/);
    assert.equal(
      await session.evaluate(`(() => {
        const form = document.querySelector('[data-rule-id="http.duration.p95.change_rate"]');
        if (!form) return false;
        form.elements.namedItem('rule-threshold').value = '5';
        form.requestSubmit();
        return true;
      })()`),
      true,
    );
    assert.equal(
      await session.evaluate(
        'document.querySelector(\'[data-rule-id="http.duration.p95.change_rate"] [name="rule-threshold"]\').value',
      ),
      '5',
    );
    await screenshot(session, '11-draft-optional-suggestion.png');
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    await advanceExecution(session);
    assert.deepEqual(browserErrors, [], 'generic report renders without browser errors');
    text = await bodyText(session);
    assert.match(text, /Proceed/);
    assert.match(text, /Verified/);
    assert.match(text, /声明范围内未发现异常退化/);
    assert.match(text, /本次使用的上下文/);
    assert.match(text, /fulfillment-service 巡检 · .*窗口 .*实例 INS-/);
    assert.match(text, /证据仪表盘/);
    assert.match(text, /检查结果/);
    assert.match(text, /AI 解读/);
    assert.equal(await session.evaluate('document.querySelectorAll(".trend-chart").length > 0'), true);
    assert.equal(
      await session.evaluate(
        'Boolean(document.querySelector(\'[data-trend-metric-id="http.duration.p95.change_rate"]\'))',
      ),
      true,
    );
    assert.match(
      await session.evaluate('document.querySelector(".report-summary").innerText'),
      /核心业务结果、服务黄金信号、下游依赖与缓存均通过/,
    );
    assert.equal(await session.evaluate('document.querySelectorAll("[data-testid=report-check-result]").length'), 4);
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
    assert.deepEqual(firstRunSnapshot.inspectionPlan.checkIds, [
      'business-outcome',
      'service-golden-signals',
      'downstream-dependency',
      'middleware-health',
    ]);
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
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'report');
    assert.equal(await session.evaluate('document.querySelectorAll("[data-testid=inspection-plan]").length'), 0);
    assert.match(await bodyText(session), /与上次相比/);
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
      await session.evaluate(
        'document.querySelectorAll(".saved-history-entry[open] [data-testid=report-checks]").length',
      ),
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
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'report');
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
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'plan');
    assert.equal(await session.evaluate('document.querySelectorAll("[data-action=PLAN_CONFIRMED]").length'), 1);
    assert.equal(await session.evaluate('document.querySelectorAll("[data-testid=playbook-match]").length'), 0);
    assert.match(await bodyText(session), /保护订单提交业务结果/);
    await screenshot(session, '06-playbook-exact-match.png');
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'report');
    await advanceExecution(session);
    text = await bodyText(session);
    assert.match(text, /历史实例不受影响/);
    assert.match(text, /提交方案更新 → v5/);
    await click(session, '[data-action="PLAYBOOK_PROPOSAL_SUBMITTED"]');
    assert.match(await bodyText(session), /方案更新 v5 · 待审批/);
    await screenshot(session, '07-playbook-exact-report.png');

    await click(session, '[data-action="RESET"]');
    await click(session, '[data-example-id="payment-config"]');
    assert.equal(await session.evaluate('document.querySelector("[name=context-reference]").value'), 'CHG-84501');
    assert.equal(await session.evaluate('document.querySelector("[data-intent-form]").requestSubmit(); true'), true);
    text = await bodyText(session);
    assert.match(text, /CandidateSet/);
    assert.match(text, /保护支付确认业务结果/);
    assert.match(text, /影响面缺口/);
    assert.match(text, /2 项阻断/);
    assert.equal(await session.evaluate('document.querySelector(\'[data-action="PLAN_CONFIRMED"]\').disabled'), false);
    await screenshot(session, '04-impact-dimensions.png');
    await click(session, '[data-action="CANDIDATE_INCLUDED"][data-candidate-id="candidate-db-wait"]');
    assert.match(
      await session.evaluate('document.querySelector(\'[data-testid="plan-summary"]\').textContent'),
      /3 项阻断[\s\S]*1 项影响未覆盖/,
    );
    assert.match(await bodyText(session), /已加入锁定计划/);
    assert.equal(await session.evaluate('document.querySelectorAll(".check-card.is-candidate-check").length'), 1);
    await click(session, '.check-card summary');
    const sourceDetail = await session.evaluate("document.querySelector('.check-card[open] .check-sources').innerText");
    assert.match(sourceDetail, /电子流/);
    assert.match(sourceDetail, /CHG-84501/);
    assert.equal(
      await session.evaluate(`(() => {
        const card = document.querySelector('.check-card[open]');
        return [...card.querySelectorAll('.rule-editor')].every((editor) =>
          [...editor.children].every((child) => child.getBoundingClientRect().right <= card.getBoundingClientRect().right + 1)
        );
      })()`),
      true,
      'expanded desktop rule editors remain inside the check card',
    );
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
      3,
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
    await screenshot(session, '09-release-first-desktop.png');

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
    const mobileHome = await session.evaluate(`(() => {
        const panel = document.querySelector('.copilot-panel');
        const stage = document.querySelector('.stage-panel');
        const savedCard = document.querySelector('[data-testid="saved-inspection-card"]');
        const reference = document.querySelector('[name="context-reference"]');
        return {
          panelPosition: getComputedStyle(panel).position,
          hasComposer: Boolean(document.querySelector('.conversation-form')),
          referenceHeight: Math.round(reference.getBoundingClientRect().height),
          stageWidth: Math.round(stage.getBoundingClientRect().width),
          savedCardWidth: Math.round(savedCard.getBoundingClientRect().width),
          noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        };
      })()`);
    assert.notEqual(mobileHome.panelPosition, 'fixed');
    assert.equal(mobileHome.hasComposer, false);
    assert.equal(mobileHome.noOverflow, true);
    assert.ok(mobileHome.stageWidth >= 360, 'mobile saved-inspection stage uses the available width');
    assert.ok(mobileHome.savedCardWidth >= 320, 'mobile saved-inspection card remains readable');
    assert.ok(mobileHome.referenceHeight >= 44, 'mobile release reference keeps a touch-safe hit target');
    await screenshot(session, '14-mobile-saved-home.png', { captureBeyondViewport: false });
    await click(session, '[data-action="SAVED_INSPECTION_RUN_REQUESTED"]');
    assert.equal(await session.evaluate('document.querySelector("[data-phase]").dataset.phase'), 'report');
    await advanceExecution(session);
    assert.match(await bodyText(session), /本次使用的上下文/);
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
      prompt: '关注扣款成功和 Redis 客户端',
      contextReference: 'CHG-84501',
    });
    const mobilePlan = await session.evaluate(`(() => {
      const action = document.querySelector('[data-action="PLAN_CONFIRMED"]');
      const card = document.querySelector('.check-card');
      const coverageGap = document.querySelector('[data-testid="coverage-gaps"]');
      card.open = true;
      const actionRect = action.getBoundingClientRect();
      const gapRect = coverageGap.getBoundingClientRect();
      return {
        noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        actionInDraft: Boolean(action.closest('[data-testid="inspection-plan"]')),
        actionLabel: action.textContent.trim(),
        actionPosition: getComputedStyle(action).position,
        actionHeight: Math.round(action.getBoundingClientRect().height),
        actionOverlapsGap: actionRect.top < gapRect.bottom && actionRect.bottom > gapRect.top,
        gapColumns: getComputedStyle(document.querySelector('.coverage-gap-stack')).gridTemplateColumns.split(' ').length,
        editorFits: [...card.querySelectorAll('.rule-editor')].every((editor) =>
          editor.getBoundingClientRect().right <= window.innerWidth + 1
        ),
      };
    })()`);
    assert.equal(mobilePlan.noOverflow, true, 'mobile draft must not overflow horizontally');
    assert.equal(mobilePlan.actionInDraft, true, 'mobile draft action stays inside the locked-plan surface');
    assert.equal(mobilePlan.actionPosition, 'static', 'mobile confirmation remains in document flow');
    assert.equal(mobilePlan.actionOverlapsGap, false, 'mobile confirmation cannot obscure a coverage gap');
    assert.ok(mobilePlan.actionHeight >= 44, 'mobile confirmation keeps a touch-safe hit target');
    assert.equal(mobilePlan.gapColumns, 1, 'mobile coverage gaps stack in one column');
    assert.equal(mobilePlan.editorFits, true, 'expanded mobile rule editors stay inside the viewport');
    assert.match(mobilePlan.actionLabel, /确认并开始巡检/);
    await screenshot(session, '10-release-gap-mobile-plan.png');
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
    assert.match(await bodyText(session), /覆盖：2 项已验证 · 2 项未覆盖/);
    assert.match(await bodyText(session), /未覆盖：invoice-worker/);
    const releaseContextSurface = await session.evaluate(
      "document.querySelector('[data-testid=selected-context-results]').innerText",
    );
    assert.match(releaseContextSurface, /本次使用的上下文/);
    assert.match(releaseContextSurface, /invoice-worker[\s\S]*未覆盖/);
    assert.match(releaseContextSurface, /settlement-db[\s\S]*未覆盖/);
    assert.doesNotMatch(releaseContextSurface, /Verified|Violated|Inconclusive|NotEvaluated/);
    await screenshot(session, '08-release-coverage-mobile-report.png');

    await click(session, '[data-action="RESET"]');
    await submitRequest(session, {
      prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
      targetService: 'fulfillment-service',
      contextReference: 'REL-FUL-72',
    });
    assert.equal(
      await session.evaluate(`(() => {
        const form = document.querySelector('[data-rule-id="redis.command_latency"]');
        if (!form) return false;
        form.elements.namedItem('rule-threshold').value = '3';
        form.requestSubmit();
        return true;
      })()`),
      true,
    );
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    await advanceExecution(session);
    text = await bodyText(session);
    assert.match(text, /Violated/);
    assert.match(text, /Pause/);
    assert.match(text, /缓存命令 p99 3\.8ms（门禁 <= 3ms，违例）/);
    assert.equal(
      await session.evaluate(`(() => {
        const run = JSON.parse(localStorage.getItem('nova.inspection-library.v1')).runs.at(-1);
        return !Object.hasOwn(run, 'executionResults') &&
          run.report.checkResults.some((result) =>
            result.checkId === 'middleware-health' &&
            result.status === 'Violated' &&
            result.measurements.some((measurement) =>
              measurement.metricId === 'redis.command_latency' && measurement.gate.value === 3
            )
          );
      })()`),
      true,
      'the locked Run contains the edited Redis gate without a parallel execution truth',
    );
    assert.equal(
      await session.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),
      true,
      'the reviewed edited-rule report remains within the 390px viewport',
    );
    await screenshot(session, '21-mobile-generic-edited-rule-pause.png');

    assert.deepEqual(networkRequests, []);
    assert.deepEqual(browserErrors, []);
    process.stdout.write(
      'Offline browser acceptance passed: release-first gaps, one confirmation, immutable evidence, history, sharing, exact reuse, 390px, and edited-rule fail-closed journeys; 0 network requests, 0 browser errors.\n',
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
