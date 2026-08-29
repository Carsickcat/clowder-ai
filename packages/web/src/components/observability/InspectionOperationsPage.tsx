'use client';

import type {
  InspectionAssessmentItem,
  InspectionCandidate,
  InspectionCandidateSet,
  InspectionCase,
  InspectionJob,
  InspectionJobRevision,
  InspectionRunPurpose,
} from '@cat-cafe/shared';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createInspectionCase,
  fetchInspectionCase,
  fetchInspectionJob,
  generateInspectionCandidateSet,
  InspectionApiError,
  type InspectionSourceMetadata,
  type InspectionWorkspace,
  isInspectionAvailabilityError,
  listInspectionCandidateSets,
  listInspectionCases,
  listInspectionJobs,
  listInspectionSources,
  materializeInspectionCandidateSet,
  recordInspectionDecision,
  startInspectionRun,
} from '@/utils/inspection-api';
import styles from './InspectionOperationsPage.module.css';
import { InspectionReportIntelligencePanel } from './InspectionReportIntelligencePanel';

function runKey(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `inspection-${Date.now()}-${random}`;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    blocked: '已阻断',
    completed: '已完成',
    failed: '采集失败',
    passed: '通过',
    ready: '待执行',
    risk: '有风险',
    running: '执行中',
    unknown: '未知',
  };
  return labels[status] ?? status;
}

function sourceLabel(source: InspectionSourceMetadata): string {
  return source.kind === 'replay' ? '验收回放 · 服务端回放数据' : source.label;
}

function planningDriftMessage(error: unknown): string | null {
  if (!(error instanceof InspectionApiError) || error.status !== 409) return null;
  if (!error.details || typeof error.details !== 'object') return null;
  const details = error.details as { code?: unknown; differences?: unknown };
  if (details.code !== 'INSPECTION_PLANNING_DRIFT' || !Array.isArray(details.differences)) return null;

  const labels: Record<string, string> = {
    catalog: '检查规则目录',
    change: '变更事实',
    integrity: '规划完整性',
    topology: '服务拓扑',
  };
  const changed = Array.from(
    new Set(
      details.differences
        .map((difference) =>
          difference && typeof difference === 'object'
            ? labels[String((difference as { source?: unknown }).source)]
            : undefined,
        )
        .filter((label): label is string => Boolean(label)),
    ),
  );
  const scope = changed.length > 0 ? changed.join('、') : '规划事实';
  return `巡检依据已变化：${scope}与已固化方案不一致。未创建新的执行记录，请重新生成并确认方案。`;
}

function environmentLabel(environment: string): string {
  const labels: Record<string, string> = {
    acceptance: '验收环境',
    development: '开发环境',
    staging: '预发布环境',
  };
  return labels[environment] ?? environment;
}

function candidateLabel(candidate: InspectionCandidate): string {
  const labels: Record<string, string> = {
    availability: '服务可用性',
    latency: '请求延迟',
    error_rate: '服务错误率',
    'error-rate': '服务错误率',
    server_error_rate: '服务错误率',
    payment_success_rate: '支付成功率',
    downstream_failure_rate: '下游依赖失败率',
  };
  return labels[candidate.id] ?? labels[candidate.check.id] ?? candidate.name;
}

function metricLabel(checkId: string): string {
  const labels: Record<string, string> = {
    availability: '服务可用性',
    latency: '请求延迟',
    'error-rate': '服务错误率',
    error_rate: '服务错误率',
    server_error_rate: '服务错误率',
    payment_success_rate: '支付成功率',
    downstream_failure_rate: '下游依赖失败率',
  };
  return labels[checkId] ?? checkId;
}

function candidateReason(candidate: InspectionCandidate): string {
  const reasons: Record<string, string> = {
    availability: '确认成功请求的可用性没有下降。',
    latency: '确认路由变化没有引入下游争用或额外跳转。',
    error_rate: '确认变更后服务端错误没有增加。',
    'error-rate': '确认变更后服务端错误没有增加。',
    server_error_rate: '确认变更后服务端错误没有增加。',
    payment_success_rate: '确认支付成功率保持稳定。',
    downstream_failure_rate: '确认下游依赖没有出现新增失败。',
  };
  return reasons[candidate.id] ?? reasons[candidate.check.id] ?? '根据变更上下文与服务拓扑生成。';
}

function operatorLabel(operator: InspectionCandidate['check']['operator']): string {
  return operator.startsWith('lt') || operator === 'relative_lte' ? '≤' : '≥';
}

function jobLabel(jobItem: InspectionJob): string {
  return /[\u3400-\u9fff]/u.test(jobItem.name) ? jobItem.name : jobItem.service + ' 变更巡检';
}

function assessmentLabel(item: InspectionAssessmentItem): string {
  const labels: Record<string, string> = {
    CHANGE_CONTENTION_HYPOTHESIS: '延迟变化可能来自本次变更引发的下游资源争用。',
    COVERAGE_OMISSION: '存在尚未接入机器检查的依赖，需要人工复核。',
    REVIEW_COVERAGE_OMISSION: '接受范围内的通过结论前，请将未覆盖依赖确认为一项未关闭风险。',
    RESTORE_EVIDENCE: '请恢复完整、时效合格的证据，再执行一次巡检后作出变更决策。',
  };
  if (labels[item.code]) return labels[item.code];
  const metricLabels: Record<string, string> = {
    availability: '服务可用性',
    latency: '请求延迟',
    'error-rate': '服务错误率',
  };
  const metric = Object.keys(metricLabels).find((name) => item.statement.startsWith(name));
  if (item.code === 'CHECK_PASSED' && metric) {
    const value = item.statement.match(/ at ([^.]*)\.?$/u)?.[1] ?? '已记录';
    return metricLabels[metric] + '保持在配置阈值内，观测值为 ' + value + '。';
  }
  if (item.code === 'EVIDENCE_UNKNOWN' && metric) {
    return metricLabels[metric] + '的证据不满足时效或完整性要求，当前不可判定。';
  }
  return item.statement;
}

const PURPOSE_LABELS: Readonly<Record<InspectionRunPurpose, string>> = {
  admission: '变更前准入',
  canary: '灰度持续验证',
  verification: '风险复验',
  post_change: '变更后验收',
};

function journeyStage(workspace: InspectionWorkspace | null): number {
  if (!workspace || workspace.runs.length === 0) return 0;
  const latestPurpose = workspace.runs.at(-1)?.purpose;
  if (workspace.case.status === 'completed' || latestPurpose === 'post_change') return 2;
  if (latestPurpose === 'canary' || latestPurpose === 'verification') return 1;
  return 0;
}

function suggestedPurpose(workspace: InspectionWorkspace | null): InspectionRunPurpose {
  const latest = workspace?.runs.at(-1);
  if (!latest) return 'admission';
  if (latest.verdict !== 'passed') return latest.purpose === 'admission' ? 'admission' : 'verification';
  if (latest.purpose === 'admission') return 'canary';
  if (latest.purpose === 'canary' || latest.purpose === 'verification') return 'post_change';
  return 'post_change';
}

function decisionCopy(
  workspace: InspectionWorkspace | null,
  candidateSet: InspectionCandidateSet | null,
): { readonly title: string; readonly summary: string; readonly tone: string } {
  if (!workspace) {
    return candidateSet
      ? {
          title: '巡检方案等待确认',
          summary: '请审阅检查范围、阈值和覆盖缺口；确认后才会创建独立巡检记录。',
          tone: 'ready',
        }
      : {
          title: '从一句变更意图开始',
          summary: 'CLAW 会结合变更上下文和拓扑生成候选巡检项，先解释、再由你确认。',
          tone: 'neutral',
        };
  }
  if (workspace.report) {
    return {
      title: workspace.report.verdict === 'passed' ? '本次变更未发现异常退化' : '最终报告保留风险结论',
      summary: '最终报告已经固化，关联的运行证据与人工决策不可原地修改。',
      tone: workspace.report.verdict,
    };
  }
  const latest = workspace.runs.at(-1);
  if (!latest) {
    return {
      title: '方案已固化，等待首次巡检',
      summary: '执行后由服务端采集只读证据并生成机器判定，浏览器不会填写观测值。',
      tone: 'ready',
    };
  }
  if (latest.status === 'running') {
    return { title: '正在采集巡检证据', summary: '请等待服务端完成本阶段观测。', tone: 'running' };
  }
  if (latest.verdict === 'risk') {
    return {
      title: '发现风险，暂停推进',
      summary: '风险证据不会被平均分掩盖；处理后需要产生新的复验记录。',
      tone: 'risk',
    };
  }
  if (latest.verdict === 'unknown') {
    return {
      title: '当前证据不足，暂不可判定',
      summary: '请先恢复数据源或补齐缺失证据，再重新执行本阶段巡检。',
      tone: 'unknown',
    };
  }
  return {
    title: latest.purpose === 'post_change' ? '变更后指标未发现异常退化' : '当前阶段检查通过',
    summary:
      workspace.assessment?.coverageStatus === 'omission'
        ? '机器检查通过，但仍有未覆盖依赖，需要人工复核。'
        : '证据完整，可进入下一阶段或固化本次报告。',
    tone: 'passed',
  };
}

export function InspectionOperationsPage() {
  const [sources, setSources] = useState<readonly InspectionSourceMetadata[]>([]);
  const [jobs, setJobs] = useState<readonly InspectionJob[]>([]);
  const [cases, setCases] = useState<readonly InspectionCase[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<InspectionWorkspace | null>(null);
  const [candidateSet, setCandidateSet] = useState<InspectionCandidateSet | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<readonly string[]>([]);
  const [candidateWaivers, setCandidateWaivers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<InspectionRunPurpose>('admission');
  const [editableRevision, setEditableRevision] = useState<InspectionJobRevision | null>(null);
  const [intent, setIntent] = useState('帮我巡检 payments-router 的支付路由配置变更');
  const [changeRef, setChangeRef] = useState('CHG-23841');

  const applyCandidateSet = useCallback((next: InspectionCandidateSet | null) => {
    setCandidateSet(next);
    setSelectedCandidateIds(
      next?.candidates.filter((candidate) => candidate.priority !== 'optional').map((candidate) => candidate.id) ?? [],
    );
    setCandidateWaivers({});
  }, []);

  const applyRevisionDraft = useCallback((revision: InspectionJobRevision | null) => {
    setEditableRevision(revision);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [loadedSources, loadedJobs, loadedCandidateSets] = await Promise.all([
          listInspectionSources(),
          listInspectionJobs(),
          listInspectionCandidateSets(),
        ]);
        if (!active) return;
        setSources(loadedSources);
        setJobs(loadedJobs);
        applyCandidateSet(loadedCandidateSets[0] ?? null);

        const firstJob = loadedJobs[0];
        if (firstJob) {
          setSelectedJobId(firstJob.id);
          const [loadedCases, currentJob] = await Promise.all([
            listInspectionCases(firstJob.id),
            fetchInspectionJob(firstJob.id),
          ]);
          if (!active) return;
          setCases(loadedCases);
          setJobs((current) => current.map((job) => (job.id === currentJob.job.id ? currentJob.job : job)));
          applyRevisionDraft(currentJob.revision);
          const firstCase = loadedCases[0];
          if (firstCase) {
            setSelectedCaseId(firstCase.id);
            const loadedWorkspace = await fetchInspectionCase(firstCase.id);
            setWorkspace(loadedWorkspace);
            setPurpose(suggestedPurpose(loadedWorkspace));
          }
        }
      } catch {
        if (!active) return;
        setConnectionError('连接中断：无法读取 connected API。已禁止执行，不会回退到演示数据。');
        setSources([]);
        setJobs([]);
        setCases([]);
        setWorkspace(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyCandidateSet, applyRevisionDraft]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);
  const selectedSource = sources[0] ?? null;
  const connectionState = loading
    ? 'booting'
    : connectionError
      ? 'degraded'
      : sources.length === 0
        ? 'misconfigured'
        : busy
          ? 'running'
          : workspace?.report
            ? 'completed'
            : 'ready';

  async function withCommand(operation: () => Promise<void>) {
    setBusy(true);
    setCommandError(null);
    try {
      await operation();
    } catch (error) {
      const driftMessage = planningDriftMessage(error);
      const message = driftMessage ?? (error instanceof Error ? error.message : 'Connected API 请求失败');
      if (!driftMessage && isInspectionAvailabilityError(error)) setConnectionError(message);
      else setCommandError(message);
    } finally {
      setBusy(false);
    }
  }

  async function chooseJob(jobId: string) {
    setSelectedJobId(jobId);
    setSelectedCaseId(null);
    setWorkspace(null);
    applyRevisionDraft(null);
    await withCommand(async () => {
      const [loadedCases, currentJob] = await Promise.all([listInspectionCases(jobId), fetchInspectionJob(jobId)]);
      setCases(loadedCases);
      setJobs((current) => current.map((job) => (job.id === currentJob.job.id ? currentJob.job : job)));
      applyRevisionDraft(currentJob.revision);
      const firstCase = loadedCases[0];
      if (firstCase) {
        setSelectedCaseId(firstCase.id);
        const loadedWorkspace = await fetchInspectionCase(firstCase.id);
        setWorkspace(loadedWorkspace);
        setPurpose(suggestedPurpose(loadedWorkspace));
      }
    });
  }

  function startNewInspection() {
    setSelectedJobId(null);
    setSelectedCaseId(null);
    setWorkspace(null);
    setCandidateSet(null);
    setSelectedCandidateIds([]);
    setCandidateWaivers({});
    setIntent('');
    setChangeRef('');
    setPurpose('admission');
    setCommandError(null);
  }

  async function chooseCase(caseId: string) {
    setSelectedCaseId(caseId);
    await withCommand(async () => {
      const loadedWorkspace = await fetchInspectionCase(caseId);
      setWorkspace(loadedWorkspace);
      setPurpose(suggestedPurpose(loadedWorkspace));
    });
  }

  async function handleGenerateCandidates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withCommand(async () => {
      const generated = await generateInspectionCandidateSet({
        changeRef: changeRef.trim(),
        ...(intent.trim() ? { intent: intent.trim() } : {}),
      });
      applyCandidateSet(generated);
    });
  }

  function toggleCandidate(candidateId: string) {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId],
    );
  }

  async function handleMaterializeCandidates() {
    if (!candidateSet) return;
    const requiredWaivers = candidateSet.candidates
      .filter((candidate) => candidate.priority === 'required' && !selectedCandidateIds.includes(candidate.id))
      .map((candidate) => ({ candidateId: candidate.id, reason: candidateWaivers[candidate.id]?.trim() ?? '' }));
    if (requiredWaivers.some((waiver) => !waiver.reason)) return;
    await withCommand(async () => {
      const created = await materializeInspectionCandidateSet(candidateSet.id, {
        name: `${candidateSet.changeContext.service} · ${candidateSet.changeContext.changeId}`,
        selectedCandidateIds,
        waivers: requiredWaivers,
      });
      const createdCase = await createInspectionCase({
        jobId: created.job.id,
      });
      setJobs((current) => [created.job, ...current.filter((item) => item.id !== created.job.id)]);
      setSelectedJobId(created.job.id);
      setCases([createdCase]);
      setSelectedCaseId(createdCase.id);
      applyRevisionDraft(created.revision);
      const loadedWorkspace = await fetchInspectionCase(createdCase.id);
      setWorkspace(loadedWorkspace);
      setPurpose(suggestedPurpose(loadedWorkspace));
    });
  }

  async function handleRun() {
    if (!selectedCaseId) return;
    await withCommand(async () => {
      await startInspectionRun(selectedCaseId, purpose, runKey());
      const refreshedWorkspace = await fetchInspectionCase(selectedCaseId);
      setWorkspace(refreshedWorkspace);
      setPurpose(suggestedPurpose(refreshedWorkspace));
      const refreshedCases = await listInspectionCases(selectedJobId ?? undefined);
      setCases(refreshedCases);
    });
  }

  async function handleAccept() {
    if (!selectedCaseId || !workspace) return;
    const latestRun = workspace.runs.at(-1);
    if (!latestRun || latestRun.status === 'running') return;
    if (
      latestRun.purpose === 'post_change' &&
      workspace.assessment?.decisionReadiness !== 'ready' &&
      workspace.assessment?.decisionReadiness !== 'review_required'
    ) {
      return;
    }
    await withCommand(async () => {
      await recordInspectionDecision(selectedCaseId, {
        runId: latestRun.id,
        kind: 'accept',
        note: 'Operator reviewed the connected evidence.',
      });
      const refreshed = await fetchInspectionCase(selectedCaseId);
      setWorkspace(refreshed);
      setCases((current) =>
        current.map((inspectionCase) => (inspectionCase.id === refreshed.case.id ? refreshed.case : inspectionCase)),
      );
    });
  }

  const formDisabled = loading || busy || Boolean(connectionError) || sources.length === 0;
  const latestRun = workspace?.runs.at(-1) ?? null;
  const postChangeAcceptanceBlocked =
    latestRun?.purpose === 'post_change' &&
    workspace?.assessment?.decisionReadiness !== 'ready' &&
    workspace?.assessment?.decisionReadiness !== 'review_required';
  const missingRequiredWaiver =
    candidateSet?.candidates.some(
      (candidate) =>
        candidate.priority === 'required' &&
        !selectedCandidateIds.includes(candidate.id) &&
        !candidateWaivers[candidate.id]?.trim(),
    ) ?? false;
  const activeJourneyStage = journeyStage(workspace);
  const decision = decisionCopy(workspace, candidateSet);
  const changeContext = candidateSet?.changeContext;
  const displayedService = (workspace?.job.service ?? changeContext?.service) || '等待服务端识别';
  const displayedVersion = (workspace?.case.version ?? changeContext?.version) || '—';
  const displayedChangeId = (workspace?.case.changeId ?? changeContext?.changeId ?? changeRef) || '—';
  const displayedEnvironment = environmentLabel(
    workspace?.job.environment ?? changeContext?.environment ?? selectedSource?.scope ?? '—',
  );
  const visibleJobs = jobs.slice(0, 3);
  const taskSummary = workspace
    ? `巡检 ${workspace.job.service} ${workspace.case.version} 是否具备当前阶段推进条件`
    : (changeContext?.intent ?? (intent.trim() || '用变更引用创建巡检方案'));
  const runtimeUiState = loading
    ? 'loading'
    : connectionError
      ? 'error'
      : busy
        ? 'running'
        : workspace?.report
          ? 'completed'
          : workspace?.case.status === 'blocked'
            ? 'blocked'
            : candidateSet?.coverageOmissions.length
              ? 'partial'
              : jobs.length === 0 && !candidateSet
                ? 'empty'
                : 'ready';

  return (
    <main className={styles.page} data-theme="dark" data-runtime-state={runtimeUiState} aria-busy={busy || loading}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            N
          </span>
          <span>
            <strong>NOVA · 变更巡检</strong>
            <small>从风险问题到可追溯结论</small>
          </span>
        </div>
        <div className={styles.connection} data-state={connectionState}>
          <span className={styles.connectionDot} aria-hidden="true" />
          <span>
            <strong>
              {connectionState === 'booting'
                ? '正在连接巡检服务'
                : connectionState === 'degraded'
                  ? '连接中断'
                  : connectionState === 'misconfigured'
                    ? '数据源未配置'
                    : connectionState === 'running'
                      ? '正在执行'
                      : connectionState === 'completed'
                        ? '报告已固化'
                        : '证据服务已连接'}
            </strong>
            <small>
              {connectionState === 'booting'
                ? '正在连接巡检服务，不会加载演示数据。'
                : '只读观测，不会执行发布、放量或回滚'}
            </small>
          </span>
        </div>
      </header>

      <output className={styles.environmentBanner} data-testid="runtime-environment-banner">
        <strong>CONNECTED SYSTEM · server-authoritative facts</strong>
        <span>变更、拓扑与指标事实只由服务端只读数据源提供；浏览器不能填写或改写权威结果。</span>
      </output>

      {connectionError && (
        <div className={styles.errorBanner} role="alert">
          {connectionError}
        </div>
      )}
      {commandError && (
        <div className={styles.errorBanner} role="alert">
          {commandError}
        </div>
      )}
      {!loading && !connectionError && sources.length === 0 && (
        <div className={styles.errorBanner} role="alert">
          API 已连接，但没有服务端注册的数据源。执行已禁用。
        </div>
      )}

      <section className={styles.caseContext} data-testid="inspection-context">
        <div>
          <p className={styles.eyebrow}>当前变更巡检</p>
          <h1>
            {displayedService} <span>{displayedVersion}</span>
          </h1>
        </div>
        <dl>
          <div>
            <dt>变更编号</dt>
            <dd>{displayedChangeId}</dd>
          </div>
          <div>
            <dt>环境</dt>
            <dd>{displayedEnvironment}</dd>
          </div>
          <div>
            <dt>当前状态</dt>
            <dd>{workspace ? statusLabel(workspace.case.status) : candidateSet ? '方案待确认' : '等待描述'}</dd>
          </div>
          <div>
            <dt>证据范围</dt>
            <dd>{candidateSet ? candidateSet.candidates.length + ' 项检查' : '尚未生成'}</dd>
          </div>
        </dl>
      </section>

      <nav className={styles.journey} aria-label="变更巡检阶段" data-testid="inspection-journey">
        {[
          ['变更前准入', '确认是否具备灰度条件'],
          ['灰度持续验证', '逐阶段比较灰度与稳定版本'],
          ['变更后验收', '对比基线并形成最终结论'],
        ].map(([label, hint], index) => (
          <div
            key={label}
            className={styles.journeyStage}
            data-state={index < activeJourneyStage ? 'completed' : index === activeJourneyStage ? 'active' : 'upcoming'}
          >
            <span>{index < activeJourneyStage ? '✓' : index + 1}</span>
            <span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
          </div>
        ))}
      </nav>

      <section className={styles.workspaceGrid}>
        <aside className={styles.jobPlatform} data-testid="inspection-job-platform">
          <header>
            <span>
              <p className={styles.eyebrow}>可复用巡检作业</p>
              <h2>作业平台</h2>
            </span>
            <button type="button" onClick={startNewInspection} disabled={busy}>
              ＋ 新建巡检
            </button>
          </header>
          <p className={styles.sectionIntro}>复用已验证的检查范围和门槛；每次执行仍会生成独立证据。</p>
          {loading ? (
            <p className={styles.muted}>正在读取服务端作业…</p>
          ) : jobs.length === 0 ? (
            <p className={styles.empty}>还没有已固化作业，可从右侧描述一次变更。</p>
          ) : (
            <div className={styles.jobList}>
              {visibleJobs.map((jobItem) => (
                <button
                  key={jobItem.id}
                  type="button"
                  className={jobItem.id === selectedJobId ? styles.selectedJob : styles.jobCard}
                  onClick={() => void chooseJob(jobItem.id)}
                  disabled={busy || Boolean(workspace && !['ready', 'completed'].includes(workspace.case.status))}
                >
                  <span>
                    <em>{jobItem.id === selectedJobId ? '当前作业' : '已固化'}</em>
                    <small>版本 {jobItem.currentRevision}</small>
                  </span>
                  <strong>{jobLabel(jobItem)}</strong>
                  <span>
                    {jobItem.service} · {environmentLabel(jobItem.environment)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {cases.length > 0 && (
            <div className={styles.caseList}>
              <p className={styles.eyebrow}>本作业的巡检记录</p>
              {cases.map((inspectionCase) => (
                <button
                  key={inspectionCase.id}
                  type="button"
                  data-testid="case-pill"
                  data-case-id={inspectionCase.id}
                  data-active={inspectionCase.id === selectedCaseId}
                  onClick={() => void chooseCase(inspectionCase.id)}
                  disabled={busy}
                >
                  <span>{inspectionCase.changeId}</span>
                  <small>
                    {inspectionCase.version} · {statusLabel(inspectionCase.status)}
                  </small>
                </button>
              ))}
            </div>
          )}
          <footer>选择作业只会载入方案，不会自动执行生产动作。</footer>
        </aside>

        <article className={styles.decisionSurface} data-testid="inspection-decision-surface">
          <header className={styles.decisionHeader}>
            <div>
              <p className={styles.eyebrow}>当前任务</p>
              <strong>{taskSummary}</strong>
            </div>
            <span data-tone={decision.tone}>
              {workspace ? statusLabel(workspace.case.status) : candidateSet ? '方案已生成' : '等待描述'}
            </span>
          </header>
          <section className={styles.currentDecision} data-tone={decision.tone}>
            <p className={styles.eyebrow}>当前结论</p>
            <h2>{decision.title}</h2>
            <p>{decision.summary}</p>
          </section>

          {!workspace && candidateSet && (
            <section className={styles.planView}>
              <div className={styles.sectionHeading}>
                <span>
                  <p className={styles.eyebrow}>巡检方案</p>
                  <h3>系统准备检查什么</h3>
                </span>
                <strong>
                  {selectedCandidateIds.length}/{candidateSet.candidates.length} 项已选择
                </strong>
              </div>
              <div className={styles.planMeta}>
                <div>
                  <span>服务拓扑</span>
                  <strong>{candidateSet.topologySnapshot.rootService}</strong>
                </div>
                <div>
                  <span>环境</span>
                  <strong>{environmentLabel(candidateSet.changeContext.environment)}</strong>
                </div>
                <div>
                  <span>规则目录</span>
                  <strong>{candidateSet.topologySnapshot.catalogVersion}</strong>
                </div>
              </div>
              <div className={styles.checkList}>
                {candidateSet.candidates.map((candidate) => {
                  const selected = selectedCandidateIds.includes(candidate.id);
                  return (
                    <div className={styles.checkItem} key={candidate.id} data-priority={candidate.priority}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCandidate(candidate.id)}
                          disabled={busy}
                        />
                        <span>
                          <strong>{candidateLabel(candidate)}</strong>
                          <small>{candidateReason(candidate)}</small>
                        </span>
                      </label>
                      <span>
                        {operatorLabel(candidate.check.operator)} {candidate.check.threshold} {candidate.check.unit}
                      </span>
                      {!selected && candidate.priority === 'required' && (
                        <label className={styles.waiverField}>
                          必选项豁免理由
                          <input
                            value={candidateWaivers[candidate.id] ?? ''}
                            onChange={(event) =>
                              setCandidateWaivers((current) => ({ ...current, [candidate.id]: event.target.value }))
                            }
                            placeholder="说明由什么外部门禁覆盖"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              {candidateSet.coverageOmissions.map((omission) => (
                <div key={omission.id} className={styles.coverageOmission}>
                  <strong>未覆盖依赖 · {omission.dependencyRef}</strong>
                  <span>该依赖尚未进入机器检查范围，需要人工复核其容量与健康状态。</span>
                  <small>当前规则目录没有已审批的只读信号映射。</small>
                </div>
              ))}
            </section>
          )}

          {workspace && (
            <section className={styles.evidenceView}>
              {latestRun ? (
                <>
                  <div className={styles.sectionHeading}>
                    <span>
                      <p className={styles.eyebrow}>{PURPOSE_LABELS[latestRun.purpose]}</p>
                      <h3>本阶段巡检证据</h3>
                    </span>
                    <strong data-tone={latestRun.verdict}>{statusLabel(latestRun.verdict)}</strong>
                  </div>
                  <div className={styles.metricGrid}>
                    {latestRun.checkResults.map((result) => (
                      <div key={result.id} data-tone={result.status}>
                        <span>{metricLabel(result.checkId)}</span>
                        <strong>{result.value ?? '无数据'}</strong>
                        <small>{statusLabel(result.status)}</small>
                      </div>
                    ))}
                  </div>
                  {latestRun.errorSummary && <p className={styles.errorText}>{latestRun.errorSummary}</p>}
                  <details className={styles.evidenceDetails}>
                    <summary>查看证据来源与完整性</summary>
                    {latestRun.sourceSnapshot && (
                      <dl>
                        <div>
                          <dt>数据连接</dt>
                          <dd>{latestRun.sourceSnapshot.connectorRef}</dd>
                        </div>
                        <div>
                          <dt>来源类型</dt>
                          <dd>{latestRun.sourceSnapshot.sourceKind}</dd>
                        </div>
                        <div>
                          <dt>来源范围</dt>
                          <dd>{latestRun.sourceSnapshot.scope ?? 'legacy-unscoped'}</dd>
                        </div>
                        <div>
                          <dt>快照摘要</dt>
                          <dd>
                            <code>{latestRun.sourceSnapshot.snapshotHash ?? 'legacy-without-snapshot-hash'}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>观测时间</dt>
                          <dd>{latestRun.sourceSnapshot.observedAt}</dd>
                        </div>
                        {latestRun.sourceSnapshot.fixtureCapturedAt ? (
                          <div>
                            <dt>Fixture 固化时间</dt>
                            <dd>{latestRun.sourceSnapshot.fixtureCapturedAt}</dd>
                          </div>
                        ) : null}
                        <div>
                          <dt>观测窗口</dt>
                          <dd>
                            {latestRun.sourceSnapshot.window.from} → {latestRun.sourceSnapshot.window.to}
                          </dd>
                        </div>
                      </dl>
                    )}
                    {latestRun.checkResults.map((result) => (
                      <p key={result.id}>
                        <code>{result.queryDigest}</code>
                        <small>{result.observedAt ?? result.reason ?? '无观测时间'}</small>
                      </p>
                    ))}
                  </details>
                </>
              ) : (
                <div className={styles.blankSlate}>
                  <strong>本次巡检还没有执行记录</strong>
                  <span>
                    巡检编号 {workspace.case.id} · 方案版本 {workspace.revision.revision}
                  </span>
                </div>
              )}

              {workspace.assessment && (
                <details className={styles.assessment} data-testid="inspection-assessment">
                  <summary>查看判断依据与未决风险</summary>
                  <div className={styles.assessmentGate}>
                    <div>
                      <span>机器判定</span>
                      <strong>{statusLabel(workspace.assessment.machineVerdict)}</strong>
                    </div>
                    <div>
                      <span>覆盖状态</span>
                      <strong>{workspace.assessment.coverageStatus === 'omission' ? '存在遗漏' : '完整'}</strong>
                    </div>
                    <div>
                      <span>决策准备度</span>
                      <strong>
                        {workspace.assessment.decisionReadiness === 'ready'
                          ? '可决策'
                          : workspace.assessment.decisionReadiness === 'review_required'
                            ? '需人工复核'
                            : '已阻断'}
                      </strong>
                    </div>
                  </div>
                  {[
                    ...workspace.assessment.facts,
                    ...workspace.assessment.hypotheses,
                    ...workspace.assessment.unknowns,
                    ...workspace.assessment.recommendations,
                  ].map((item) => (
                    <article key={item.code + '-' + item.statement}>
                      <strong>分析依据</strong>
                      <p>{assessmentLabel(item)}</p>
                      <small>{item.evidenceRefs.map((ref) => ref.ref).join(' · ')}</small>
                    </article>
                  ))}
                </details>
              )}

              {workspace.abReport && (
                <section className={styles.abReport} data-testid="inspection-ab-report">
                  <div className={styles.sectionHeading}>
                    <span>
                      <p className={styles.eyebrow}>变更前后对比</p>
                      <h3>关键指标是否发生退化</h3>
                    </span>
                    <strong>{workspace.abReport.comparability === 'valid' ? '可比' : '不可比'}</strong>
                  </div>
                  {workspace.abReport.reason && <p>不可用原因 · {workspace.abReport.reason}</p>}
                  {workspace.abReport.checks.map((check) => (
                    <div key={check.checkId}>
                      <strong>{metricLabel(check.checkId)}</strong>
                      <span>
                        {check.comparable
                          ? String(check.baselineValue) + ' → ' + String(check.currentValue)
                          : '不可比 · ' + check.reason}
                      </span>
                      <small>{check.comparable ? '变化 ' + String(check.absoluteDelta) : '禁止据此形成通过结论'}</small>
                    </div>
                  ))}
                </section>
              )}

              {workspace.report && (
                <article className={styles.report} data-testid="immutable-report">
                  <span>✓</span>
                  <div>
                    <p className={styles.eyebrow}>不可变报告 · {workspace.report.id}</p>
                    <h3>{decision.title}</h3>
                    <p>
                      已固化 {workspace.report.runIds.length} 次执行证据与 {workspace.report.decisionIds.length}{' '}
                      条人工决策。
                    </p>
                    {workspace.report.intelligence && (
                      <InspectionReportIntelligencePanel intelligence={workspace.report.intelligence} />
                    )}
                  </div>
                </article>
              )}
            </section>
          )}

          <footer className={styles.nextAction}>
            <div>
              <p className={styles.eyebrow}>下一步</p>
              <span>
                {candidateSet && !workspace
                  ? '确认范围后才会创建独立巡检记录。'
                  : workspace?.report
                    ? '报告只读，可继续追溯证据。'
                    : '每次执行都会追加新的服务端证据。'}
              </span>
            </div>
            {!workspace && candidateSet && (
              <button
                data-testid="materialize-candidates"
                className={styles.primaryButton}
                type="button"
                onClick={() => void handleMaterializeCandidates()}
                disabled={formDisabled || selectedCandidateIds.length === 0 || missingRequiredWaiver}
              >
                确认方案并创建巡检
              </button>
            )}
            {workspace && !workspace.report && (
              <div className={styles.runAction}>
                <span className={styles.stageHint}>
                  本次阶段<strong>{PURPOSE_LABELS[purpose]}</strong>
                </span>
                <button
                  data-testid="start-run"
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => void handleRun()}
                  disabled={formDisabled || workspace.case.status === 'completed'}
                >
                  {busy ? '正在读取服务端证据…' : '采集本阶段本地只读证据'}
                </button>
                {latestRun?.purpose === 'post_change' && latestRun.status !== 'running' && (
                  <button
                    data-testid="accept-report"
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void handleAccept()}
                    disabled={
                      formDisabled ||
                      latestRun.status !== 'completed' ||
                      latestRun.verdict !== 'passed' ||
                      postChangeAcceptanceBlocked
                    }
                    title={
                      latestRun.status !== 'completed' || latestRun.verdict !== 'passed'
                        ? '只有最新的已完成通过 Run 可以接受。'
                        : postChangeAcceptanceBlocked
                          ? '变更后 Run 缺少可比的 admission 基线，不能接受。'
                          : undefined
                    }
                  >
                    人工接受并固化报告
                  </button>
                )}
              </div>
            )}
          </footer>
        </article>

        <aside className={styles.clawPanel} data-testid="inspection-claw-panel">
          <header>
            <span className={styles.clawMark}>✦</span>
            <span>
              <strong>CLAW 巡检搭档</strong>
              <small>在线 · 解释与编排</small>
            </span>
          </header>
          <p className={styles.safetyNote}>我会生成方案和解释证据，但不会代替你执行生产动作。</p>
          <div className={styles.messages}>
            <p>给我变更引用和你的巡检意图；服务、版本、环境与拓扑由服务端数据源核验。</p>
            {candidateSet && (
              <p data-role="assistant">
                已识别 {candidateSet.changeContext.service} {candidateSet.changeContext.version}，生成{' '}
                {candidateSet.candidates.length} 项检查，并发现 {candidateSet.coverageOmissions.length} 个覆盖缺口。
              </p>
            )}
            {workspace?.assessment && (
              <p data-role="assistant">
                机器判定为“{statusLabel(workspace.assessment.machineVerdict)}”，覆盖状态为“
                {workspace.assessment.coverageStatus === 'omission' ? '存在遗漏' : '完整'}”。
              </p>
            )}
            {workspace?.report?.intelligence && (
              <p data-role="assistant">{workspace.report.intelligence.interpretation.clawExplanation}</p>
            )}
          </div>
          <form className={styles.clawForm} onSubmit={handleGenerateCandidates}>
            <label>
              巡检意图（可选）
              <textarea
                data-testid="candidate-intent"
                value={intent}
                onChange={(event) => setIntent(event.target.value)}
                placeholder="例如：重点关注路由变更后的延迟与可用性"
              />
            </label>
            <div className={styles.confirmedContext}>
              <label>
                变更引用
                <input
                  data-testid="candidate-change-ref"
                  value={changeRef}
                  onChange={(event) => setChangeRef(event.target.value)}
                  placeholder="CHG-23841"
                  required
                />
              </label>
            </div>
            <div className={styles.sourceContract}>
              <span>服务端只读指标源</span>
              <strong>
                {sources.length > 0
                  ? sources
                      .map((source) => `${sourceLabel(source)} · 类型: ${source.kind} · 范围: ${source.scope}`)
                      .join('；')
                  : '等待服务端数据源'}
              </strong>
            </div>
            <button data-testid="generate-candidates" type="submit" disabled={formDisabled || !changeRef.trim()}>
              {busy ? '正在生成…' : '生成巡检方案'} <span>↗</span>
            </button>
          </form>
          {candidateSet && (
            <div className={styles.clawInsight}>
              <strong>CLAW 已完成</strong>
              <span>✓ 识别变更上下文</span>
              <span>✓ 匹配检查规则</span>
              <span>✓ 标记未覆盖依赖</span>
            </div>
          )}
        </aside>
      </section>

      <section className={styles.timeline} data-testid="inspection-timeline">
        <header className={styles.sectionHeading}>
          <span>
            <p className={styles.eyebrow}>执行与决策记录</p>
            <h2>执行计划 · 一条时间线看完整次变更</h2>
          </span>
          <strong>{workspace?.runs.length ?? 0} 次巡检</strong>
        </header>
        {!workspace || workspace.runs.length === 0 ? (
          <div className={styles.timelineEmpty}>确认方案后，每一次执行、风险和人工决定都会留在这里。</div>
        ) : (
          <ol>
            {workspace.runs.map((run) => (
              <li key={run.id} data-tone={run.verdict}>
                <span className={styles.timelineDot} />
                <time>
                  {new Date(run.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </time>
                <div>
                  <span>
                    {PURPOSE_LABELS[run.purpose]} · <code>{run.id}</code>
                  </span>
                  <strong>{statusLabel(run.verdict)}</strong>
                  <p>
                    {run.errorSummary ??
                      (run.verdict === 'passed'
                        ? '本阶段检查通过，证据已写入当前 Case。'
                        : '本阶段存在阻断项，不能自动推进。')}
                  </p>
                </div>
                <em>{statusLabel(run.verdict)}</em>
              </li>
            ))}
          </ol>
        )}
        {workspace?.report && (
          <footer>
            <span>
              <p className={styles.eyebrow}>报告快照</p>
              <strong>{workspace.report.id}</strong>
            </span>
            <p>
              结论：{statusLabel(workspace.report.verdict)} · 已固化 {workspace.report.runIds.length} 次执行证据
            </p>
          </footer>
        )}
      </section>

      <details className={styles.advancedTools}>
        <summary>高级维护 · 只读作业与版本</summary>
        <div className={styles.advancedGrid}>
          <div>
            <h3>服务端权威边界</h3>
            <p>作业与版本只由已确认的服务端方案生成；浏览器不能直建、改写检查或补填变更事实。</p>
            <p>需要调整检查范围时，请用新的变更引用重新生成候选并完成确认。</p>
          </div>
          {selectedJob && editableRevision ? (
            <div data-testid="readonly-job-revision">
              <h3>{jobLabel(selectedJob)}</h3>
              <p>
                当前版本 {selectedJob.currentRevision}
                {workspace ? ' · 当前巡检绑定版本 ' + workspace.revision.revision : ''}
              </p>
              <p>
                服务 {selectedJob.service} · {environmentLabel(selectedJob.environment)} · 数据源{' '}
                {selectedJob.connectorRef}
              </p>
              <ul>
                {editableRevision.checks.map((check) => (
                  <li key={check.id}>
                    <strong>{metricLabel(check.id)}</strong>
                    <span>
                      {operatorLabel(check.operator)} {check.threshold} {check.unit}
                    </span>
                  </li>
                ))}
              </ul>
              <small>
                方案来源 {editableRevision.origin?.candidateSetId ?? 'legacy'} · 规划摘要{' '}
                {editableRevision.origin?.planningDigest ?? 'legacy-without-planning-digest'}
              </small>
            </div>
          ) : (
            <p className={styles.empty}>选择一个已固化作业后，可在这里查看其只读版本与来源。</p>
          )}
        </div>
      </details>
    </main>
  );
}
