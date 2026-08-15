import { inspectionExamples } from '../lib/compiler.mjs';
import { escapeHtml } from './view-utils.mjs';

function renderExamples() {
  return inspectionExamples
    .map(
      (example) => `
        <button class="example-fill" data-example-id="${example.id}" type="button">
          <span>填入示例</span>
          <strong>${escapeHtml(example.label)}</strong>
          <small>${escapeHtml(example.prompt)}</small>
        </button>`,
    )
    .join('');
}

function renderComposer() {
  return `
    <div class="product-intake">
      <h2 data-stage-title>创建巡检</h2>
      <p class="intake-lead">描述对象和验证目标；发布单可选。</p>
      <form class="intent-form" data-intent-form>
        <label class="intent-main">
          <span>你想验证什么？</span>
          <textarea name="inspection-intent" rows="4" required placeholder="例如：升级 inventory-api v2.3.1，验证库存锁定和下游调用是否正常。"></textarea>
        </label>
        <div class="intent-fields">
          <label>
            <span>目标服务（可选）</span>
            <input name="target-service" placeholder="无法唯一解析时补充" />
          </label>
          <label>
            <span>电子流 / 发布单（可选）</span>
            <input name="context-reference" placeholder="CHG / REL / 发布批次" />
          </label>
        </div>
        <button class="compile-button" type="submit"><span>生成工作区</span><b>→</b></button>
      </form>
      <div class="example-area">
        <div><strong>示例</strong><span>填入后可修改</span></div>
        <div class="example-grid">${renderExamples()}</div>
      </div>
    </div>`;
}

function renderUnderstanding(vm) {
  const workspace = vm.workspace;
  return `
    <div class="stage-empty compiled-intake">
      <h2 data-stage-title>确认变更信息</h2>
      <div class="understanding-grid">
        <div><span>服务 / 版本</span><strong>${escapeHtml(workspace.declaredChange.entities[0])} · ${escapeHtml(workspace.declaredChange.version)}</strong></div>
        <div><span>可靠性目标</span><strong>${escapeHtml(workspace.hypotheses[0])}</strong></div>
        <div><span>上下文组合</span><strong>${workspace.entryKind === 'combined-context' ? '用户意图 + 电子流补全' : '用户意图'}</strong></div>
      </div>
      <button class="edit-intent" data-action="RESET" type="button">修改输入</button>
    </div>`;
}

export function renderIntake(vm) {
  return vm.workspace ? renderUnderstanding(vm) : renderComposer();
}
