import { journeyStages } from "../../lib/change-inspection.mjs";

function stageIndex(stage) {
  if (stage === "canary") return 1;
  if (stage === "post-change" || stage === "completed") return 2;
  return 0;
}

export function JourneyHeader({ state }) {
  const activeIndex = stageIndex(state.stage);

  return (
    <>
      <header className="ci-topbar">
        <div className="ci-brand">
          <span className="ci-brand-mark" aria-hidden="true">
            N
          </span>
          <div>
            <strong>NOVA · 变更巡检</strong>
            <span>从风险问题到可追溯结论</span>
          </div>
        </div>
        <div className="ci-topbar-actions">
          <span className="ci-demo-badge">演示数据</span>
          <span className="ci-owner">
            <span className="ci-owner-avatar">林</span>
            发布负责人
          </span>
        </div>
      </header>

      <section className="ci-case-context" aria-label="变更上下文">
        <div>
          <span className="ci-eyebrow">
            {state.sourceJob
              ? `已载入作业 · ${state.sourceJob.name}`
              : "当前变更巡检"}
          </span>
          <h1>
            {state.service} <span>{state.version}</span>
          </h1>
        </div>
        <dl>
          <div>
            <dt>变更编号</dt>
            <dd>{state.changeId}</dd>
          </div>
          <div>
            <dt>环境</dt>
            <dd>{state.environment}</dd>
          </div>
          <div>
            <dt>灰度策略</dt>
            <dd>{state.canary.strategy}</dd>
          </div>
          <div>
            <dt>当前放量</dt>
            <dd>{state.canary.percent}%</dd>
          </div>
        </dl>
      </section>

      <nav className="ci-journey" aria-label="变更巡检阶段">
        {journeyStages.map((item, index) => {
          const stateName =
            index < activeIndex
              ? "completed"
              : index === activeIndex
                ? "active"
                : "upcoming";
          return (
            <div
              className={`ci-stage ci-stage-${stateName}`}
              data-stage={item.id}
              key={item.id}
            >
              <span className="ci-stage-index">
                {stateName === "completed" ? "✓" : index + 1}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </div>
          );
        })}
      </nav>
    </>
  );
}
