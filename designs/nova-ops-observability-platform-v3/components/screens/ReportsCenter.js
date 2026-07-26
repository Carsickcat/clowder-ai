"use client";

import { useState } from "react";
import { useOps } from "../OpsContext";
import { Metric, PageHeading, Panel, Status } from "../ui";

export function ReportsCenter() {
  const { state, dispatch } = useOps();
  const [selectedId, setSelectedId] = useState(state.reports[0].id);
  const report =
    state.reports.find((item) => item.id === selectedId) ?? state.reports[0];
  const reportFindings = state.findings.filter((finding) =>
    report.id.includes("CHG") ? finding.source === state.change.id : true,
  );

  return (
    <div data-screen="ReportsCenter">
      <PageHeading
        eyebrow="Inspection artifacts · versioned projection"
        title="报告中心"
        description="报告只投影 Run、Assessment、Finding、Action 和 Verification；点击可回到真实对象。"
        meta={<Status state={report.status}>{report.status}</Status>}
        actions={[
          <button
            key="verify"
            type="button"
            className="button button-primary"
            data-domain-action="report.verification.requested"
            onClick={() =>
              dispatch({
                type: "REPORT_VERIFICATION_REQUESTED",
                reportId: report.id,
              })
            }
          >
            请求复验
          </button>,
        ]}
      />

      <div className="reports-layout">
        <aside className="report-index">
          <div className="report-index-head">
            <span className="eyebrow">Mission / Change reports</span>
            <strong>{state.reports.length} reports</strong>
          </div>
          {state.reports.map((item) => (
            <button
              type="button"
              key={item.id}
              className={
                item.id === report.id
                  ? "report-index-item active"
                  : "report-index-item"
              }
              onClick={() => setSelectedId(item.id)}
            >
              <div>
                <strong>{item.title}</strong>
                <span>
                  {item.id} · {item.generatedAt}
                </span>
              </div>
              <Status state={item.verification}>{item.verification}</Status>
            </button>
          ))}
        </aside>

        <article className="report-document">
          <header className="report-cover">
            <div>
              <span className="eyebrow">
                {report.id} · generated {report.generatedAt}
              </span>
              <h1>{report.title}</h1>
              <p>
                Scope：全球购核心链路 / payments-router / cn-east + cn-south /
                19:45–20:30
              </p>
            </div>
            <div className="report-stamp">
              <span>Verification</span>
              <Status state={report.verification}>{report.verification}</Status>
            </div>
          </header>

          <div className="report-metrics">
            <Metric
              label="健康可判定覆盖"
              value={`${report.coverage}%`}
              detail="coverage gate"
              tone={report.coverage > 95 ? "good" : "warning"}
            />
            <Metric
              label="Findings"
              value={report.findings}
              detail={`${reportFindings.filter((finding) => finding.status !== "closed").length} open`}
              tone="danger"
            />
            <Metric
              label="Open Actions"
              value={report.openActions}
              detail="Owner + due time"
              tone="warning"
            />
            <Metric
              label="Freshness gaps"
              value={report.verification === "passed" ? "0" : "1"}
              detail="cn-south synthetic"
              tone={report.verification === "passed" ? "good" : "unknown"}
            />
          </div>

          <section className="report-section">
            <div className="section-number">01</div>
            <div>
              <h2>执行范围与门禁</h2>
              <div className="report-gate-grid">
                {Object.entries(state.change.verification.gates).map(
                  ([gate, status]) => (
                    <div key={gate}>
                      <span>{gate}</span>
                      <Status state={status}>{status}</Status>
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>

          <section className="report-section">
            <div className="section-number">02</div>
            <div>
              <h2>业务健康结论</h2>
              <p className="report-conclusion">
                支付链路在 20:03 灰度后出现 p95
                回归；华南拨测数据过期使地域恢复不可判定。
                当前建议保持暂停扩流，完成回滚并由原 Guard 复验。
              </p>
              <div className="report-journeys">
                {state.journeys.map((journey) => (
                  <div key={journey.id}>
                    <strong>{journey.name}</strong>
                    <Status state={journey.health}>{journey.health}</Status>
                    <span>
                      {journey.success} · {journey.p95}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="report-section">
            <div className="section-number">03</div>
            <div>
              <h2>Finding → Owner → Verification</h2>
              <div className="report-finding-table">
                {reportFindings.map((finding) => (
                  <button
                    type="button"
                    key={finding.id}
                    onClick={() =>
                      dispatch({
                        type: "NAVIGATE",
                        screen:
                          finding.source === state.change.id
                            ? "change"
                            : "mission",
                      })
                    }
                  >
                    <span>{finding.id}</span>
                    <strong>{finding.title}</strong>
                    <small>
                      {finding.owner} · due {finding.dueAt}
                    </small>
                    <Status state={finding.status}>{finding.status}</Status>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="report-section">
            <div className="section-number">04</div>
            <div>
              <h2>分享与审计</h2>
              <p>
                该快照固定引用 Mission v12、Plan Draft v2、Change CHG-23841 和
                Investigation Revision {state.investigation.revision}。
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="button button-secondary"
                  disabled
                  title="原型不连接真实 IM"
                >
                  生成只读分享链接
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled
                  title="原型不生成真实文件"
                >
                  导出 PDF
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  data-domain-action="report.verification.requested"
                  onClick={() =>
                    dispatch({
                      type: "REPORT_VERIFICATION_REQUESTED",
                      reportId: report.id,
                    })
                  }
                >
                  将 Open Finding 送入复验队列
                </button>
              </div>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
