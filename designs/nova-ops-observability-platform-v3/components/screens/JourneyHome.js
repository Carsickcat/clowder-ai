"use client";

import { useOps } from "../OpsContext";
import { Icon, Status } from "../ui";

const roleJourneys = [
  {
    role: "发布负责人",
    duty: "决定灰度继续、观察还是回滚",
    tone: "release",
    status: "1 个 blocker",
    scenes: [
      {
        journey: "release",
        screen: "change",
        label: "变更验证",
        question: "CHG-23841 是否可以继续放量？",
        meta: "10% canary · p95 +38% · 1 unknown",
      },
    ],
  },
  {
    role: "值班 SRE",
    duty: "控制故障影响并完成证据化处置",
    tone: "oncall",
    status: "2 个待决策",
    scenes: [
      {
        journey: "diagnosis",
        screen: "live",
        label: "故障诊断",
        question: "告警风暴中哪个事件真正影响支付？",
        meta: "17 alerts → 2 clusters · INV-7719",
      },
      {
        journey: "protection",
        screen: "mission",
        label: "大促保障",
        question: "峰值阶段能否继续承载流量增长？",
        meta: "MIS-61801 · 181k RPS · 17.7% headroom",
      },
    ],
  },
  {
    role: "服务 Owner",
    duty: "补齐健康覆盖并安全发布巡检",
    tone: "service",
    status: "7 个覆盖缺口",
    scenes: [
      {
        journey: "service",
        screen: "governance",
        label: "关键服务日巡",
        question: "哪些绿色服务其实仍不可判定？",
        meta: "86% decidable · 9 stale · 4 drifted",
      },
      {
        journey: "service",
        screen: "studio",
        label: "NL2 巡检",
        question: "这段运维意图能否安全编译并发布？",
        meta: "Draft v2 · 4 gates pending · Replay required",
      },
    ],
  },
];

export function JourneyHome() {
  const { dispatch } = useOps();

  return (
    <div className="journey-home" data-screen="JourneyHome">
      <header className="journey-home-hero">
        <div>
          <span className="home-kicker">
            NOVA Ops · 2026 planning prototype
          </span>
          <h1>从你今天必须做出的运维决策开始</h1>
          <p>
            选择当前角色与场景。系统会锁定业务 Scope，带你穿过专业证据、Agent
            调查、人工决策与最终复验；监控、告警、日志和拨测不再是孤立入口。
          </p>
        </div>
        <div className="home-runtime-card">
          <div>
            <span className="live-indicator" />
            <strong>Production · Mock live</strong>
          </div>
          <span>12 Inspection Runs</span>
          <span>2 Diagnosis Investigations</span>
          <Status state="unknown">3 decisions due</Status>
        </div>
      </header>

      <section className="role-entry-grid" aria-label="角色与场景入口">
        {roleJourneys.map((entry) => (
          <article
            className={`role-entry-card role-${entry.tone}`}
            key={entry.role}
          >
            <header>
              <div className="role-avatar" aria-hidden="true">
                {entry.role.slice(0, 1)}
              </div>
              <div>
                <span className="role-label">当前角色</span>
                <h2>{entry.role}</h2>
                <p>{entry.duty}</p>
              </div>
              <span className="role-status">{entry.status}</span>
            </header>

            <div className="role-scene-list">
              {entry.scenes.map((scene) => (
                <button
                  type="button"
                  className="role-scene"
                  data-domain-action="journey.entered"
                  key={`${entry.role}-${scene.label}`}
                  onClick={() =>
                    dispatch({
                      type: "JOURNEY_ENTER",
                      journey: scene.journey,
                      screen: scene.screen,
                    })
                  }
                >
                  <span className="scene-icon">
                    <Icon
                      name={
                        scene.journey === "release"
                          ? "branch"
                          : scene.journey === "service"
                            ? "wand"
                            : scene.journey === "protection"
                              ? "shield"
                              : "search"
                      }
                    />
                  </span>
                  <span className="scene-copy">
                    <strong>{scene.label}</strong>
                    <span>{scene.question}</span>
                    <small>{scene.meta}</small>
                  </span>
                  <span className="scene-arrow">→</span>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="home-decision-strip">
        <div>
          <span className="decision-kicker">最紧急 · 发布决策</span>
          <strong>payments-router v3.18.0 已暂停在 10% 灰度</strong>
          <p>
            两个 Objective 失败，华南拨测数据过期；当前不允许把 unknown
            折算为健康。
          </p>
        </div>
        <div className="home-decision-meta">
          <span>决策人</span>
          <strong>发布负责人</strong>
          <small>剩余 08:12</small>
        </div>
        <button
          type="button"
          className="button button-primary"
          data-domain-action="journey.entered"
          onClick={() =>
            dispatch({
              type: "JOURNEY_ENTER",
              journey: "release",
              screen: "change",
            })
          }
        >
          进入变更验证旅程
        </button>
      </section>
    </div>
  );
}
