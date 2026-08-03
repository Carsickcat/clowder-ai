import { inspectionJobTemplates } from "../../lib/change-inspection-jobs.mjs";

const resultLabel = {
  passed: "最近通过",
  risk: "曾有风险",
  unknown: "结果未知",
};

export function InspectionTaskHistory({ state, onNew, onSelect }) {
  const switchLocked = !["draft", "completed"].includes(state.stage);

  return (
    <aside
      className="ci-job-platform ci-task-history"
      aria-label="历史巡检任务"
    >
      <header>
        <div>
          <span className="ci-eyebrow">Inspection history</span>
          <h2>巡检任务</h2>
        </div>
        <button
          className="ci-new-job-button"
          disabled={switchLocked}
          onClick={onNew}
          type="button"
        >
          ＋ 新建巡检
        </button>
      </header>

      <div className="ci-history-summary">
        <div>
          <strong>{inspectionJobTemplates.length}</strong>
          <span>历史任务</span>
        </div>
        <div>
          <strong>92</strong>
          <span>平均报告评分</span>
        </div>
      </div>

      <p className="ci-job-intro">
        沉淀已验证的巡检范围、知识来源和报告；每次执行仍生成独立证据。
      </p>

      <div className="ci-job-list">
        {inspectionJobTemplates.map((job) => {
          const active = state.sourceJob?.id === job.id;
          return (
            <button
              aria-pressed={active}
              className={`ci-job-card${active ? " ci-job-card-active" : ""}`}
              data-job-id={job.id}
              disabled={switchLocked}
              key={job.id}
              onClick={() => onSelect(job.id)}
              type="button"
            >
              <span className="ci-job-card-topline">
                <span
                  className={`ci-job-result ci-job-result-${job.lastRun.result}`}
                >
                  {resultLabel[job.lastRun.result]}
                </span>
                <time>{job.lastRun.finishedAt}</time>
              </span>
              <strong>{job.name}</strong>
              <small>{job.summary}</small>
              <span className="ci-task-score">
                <span>报告评分</span>
                <strong>{job.lastRun.score}</strong>
              </span>
              <code>
                {job.service} {job.version}
              </code>
            </button>
          );
        })}
      </div>

      <footer className={switchLocked ? "ci-job-lock-active" : ""}>
        <span aria-hidden="true">{switchLocked ? "●" : "○"}</span>
        <p>
          {switchLocked
            ? "当前巡检执行中，完成或重新开始后可切换任务。"
            : "选择历史任务只载入方案，不会自动执行生产动作。"}
        </p>
      </footer>
    </aside>
  );
}
