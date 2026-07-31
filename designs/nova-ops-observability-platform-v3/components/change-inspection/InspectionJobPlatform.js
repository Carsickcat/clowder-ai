import { inspectionJobTemplates } from "../../lib/change-inspection-jobs.mjs";

const resultLabel = {
  passed: "最近通过",
  risk: "曾有风险",
  unknown: "结果未知",
};

export function InspectionJobPlatform({ state, onNew, onSelect }) {
  const switchLocked = !["draft", "completed"].includes(state.stage);

  return (
    <aside className="ci-job-platform" aria-label="作业平台">
      <header>
        <div>
          <span className="ci-eyebrow">Reusable jobs</span>
          <h2>作业平台</h2>
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

      <p className="ci-job-intro">
        复用已经验证过的检查范围和门禁；每次执行仍会生成独立证据。
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
            ? "当前巡检执行中，完成或重新开始后可切换作业。"
            : "选择作业只载入方案，不会自动执行生产动作。"}
        </p>
      </footer>
    </aside>
  );
}
