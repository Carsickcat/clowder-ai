"use client";

import { Status } from "./ui";

const journeys = [
  {
    title: "大促保障",
    role: "保障负责人 / 值班 SRE",
    path: "角色入口 → 保障阶段 → 风险窗口 → 人工调频 / 冻结 → 复验",
    value: "把人工盯图变为可追责、可复验的持续健康任务。",
  },
  {
    title: "变更诊断与复验",
    role: "发布负责人 / 服务 Owner",
    path: "角色入口 → Canary / Control → 调查 → 人工决策 → Verification",
    value: "只有原巡检 Run 的 Gate 全部通过，系统才宣布恢复。",
  },
  {
    title: "独立故障诊断",
    role: "值班 SRE / 专家",
    path: "告警归并 / 人工建案 → 影响 → Observation → Hypothesis → 回写复验",
    value: "诊断形成可复核 ActionProposal，但不越权宣布业务恢复。",
  },
  {
    title: "NL2巡检",
    role: "平台工程师 / SRE 负责人",
    path: "角色入口 → 覆盖缺口 → 结构化 Plan → 回放审批 → First Run",
    value: "AI 降低定义成本，权限、基线和审批守住生产安全。",
  },
];

export function UserGuide({ onClose }) {
  return (
    <>
      <div className="drawer-head">
        <div>
          <div className="eyebrow">Operator manual · V4</div>
          <h2>如何使用这套 AI 运维平台</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      <div className="guide-callout">
        <Status state="unknown">先看 unknown</Status>
        <p>
          unknown、stale、baseline drift 与 blocker
          均不得折算为健康；复验完成前不会提前标绿。
        </p>
      </div>

      <section className="guide-section">
        <div className="eyebrow">三个角色 · 四条核心旅程</div>
        <div className="guide-journeys">
          {journeys.map((journey, index) => (
            <article key={journey.title}>
              <span>0{index + 1}</span>
              <div>
                <h3>{journey.title}</h3>
                <small>{journey.role}</small>
                <p>{journey.path}</p>
                <strong>{journey.value}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-section">
        <div className="eyebrow">双 Agent 边界</div>
        <div className="guide-agent-grid">
          <article>
            <strong>智能巡检 Agent</strong>
            <p>
              Mission → Plan → Run → Assessment → Finding → Verification →
              Report
            </p>
          </article>
          <article>
            <strong>故障诊断 Agent</strong>
            <p>
              Investigation → Observation → Hypothesis → Revision →
              ActionProposal
            </p>
          </article>
        </div>
        <p className="muted-copy">
          诊断 Agent 可以建议动作，但不能宣布恢复；恢复结论必须回到原巡检 Plan
          复验。
        </p>
      </section>

      <section className="guide-section">
        <div className="eyebrow">操作规则</div>
        <ul className="guide-rules">
          <li>
            首屏先选择角色与场景；进入后按左侧任务进度、中间专业工作面、右侧 AI
            / 人工决策完成旅程。
          </li>
          <li>
            顶部 Scope 显示来自 Mission、Change、Alert 或 Service Catalog
            的继承来源，扩展范围必须创建显式分支。
          </li>
          <li>
            监控、告警、日志、Trace、拨测与巡检是中栏专业标签；跨源 Evidence
            抽屉只用于 Investigation。
          </li>
          <li>主按钮改变领域状态；置灰按钮会说明未满足的前置条件。</li>
          <li>页面使用固定 Mock 数据，不连接生产系统、不执行生产变更。</li>
        </ul>
      </section>
    </>
  );
}
