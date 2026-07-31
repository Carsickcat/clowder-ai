"use client";

import { Status } from "./ui";

const objects = [
  {
    title: "Incident",
    identity: "INC-7719 · ALERT-CLUSTER-204",
    path: "事件簇 → 影响确认 → Observation → Hypothesis → ActionProposal",
    value: "调查可以提出动作，但不能越权宣布源对象恢复。",
  },
  {
    title: "Change",
    identity: "CHG-23841 · 10% canary",
    path: "Canary / Control → Decision Record → ActionRun → Verification",
    value: "unknown 会阻断放量；恢复由 Change 的复验 Gate 判定。",
  },
  {
    title: "Mission",
    identity: "MIS-61801 · 峰值阶段",
    path: "业务与容量 → Risk Signal → 调频 / 冻结 → 阶段快照",
    value: "把人工盯图变为可追责、可复验的持续健康任务。",
  },
  {
    title: "Inspection",
    identity: "PLAN-312 · Draft v2",
    path: "意图 → 结构化 Plan → 权限 / 基线 → Replay → First Run",
    value: "AI 降低定义成本，权限、基线和审批守住生产安全。",
  },
];

export function UserGuide({ onClose }) {
  return (
    <>
      <div className="drawer-head">
        <div>
          <div className="eyebrow">Operator manual · V5</div>
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
        <div className="eyebrow">四类 SRE 运行对象</div>
        <div className="guide-journeys">
          {objects.map((object, index) => (
            <article key={object.title}>
              <span>0{index + 1}</span>
              <div>
                <h3>{object.title}</h3>
                <small>{object.identity}</small>
                <p>{object.path}</p>
                <strong>{object.value}</strong>
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
            打开即在 SRE 值班现场；首屏先处理当前决策，并同时看见现场证据缺口与
            Agent Run。四类对象使用不同构图，不再套同一三栏模板。
          </li>
          <li>
            顶部 Scope 显示来自 Mission、Change、Alert Cluster 或 Service
            Catalog 的继承来源，扩展范围必须创建显式分支。
          </li>
          <li>
            监控、告警、日志、Trace、拨测与巡检是对象内专业证据面；跨源 Evidence
            工作台只用于 Investigation。
          </li>
          <li>主按钮改变领域状态；置灰按钮会说明未满足的前置条件。</li>
          <li>
            Change 的 ActionProposal 必须返回 Change Guard；Mission / Inspection
            回写源 Finding 后还要提交绑定证据的整改回执，才可由源对象
            Verification 给出终态。
          </li>
          <li>
            报告保留生成时快照，但复验按当前源 Finding 判定；已关闭 Finding
            不会被历史报告重复排队。
          </li>
          <li>页面使用固定 Mock 数据，不连接生产系统、不执行生产变更。</li>
        </ul>
      </section>
    </>
  );
}
