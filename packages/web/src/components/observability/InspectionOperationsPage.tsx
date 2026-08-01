'use client';

import type {
  InspectionCandidateSet,
  InspectionCase,
  InspectionJob,
  InspectionJobRevision,
  InspectionRunPurpose,
} from '@cat-cafe/shared';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createInspectionCase,
  createInspectionJob,
  fetchInspectionCase,
  fetchInspectionJob,
  generateInspectionCandidateSet,
  type InspectionSourceMetadata,
  type InspectionWorkspace,
  isInspectionAvailabilityError,
  listInspectionCandidateSets,
  listInspectionCases,
  listInspectionJobs,
  listInspectionSources,
  materializeInspectionCandidateSet,
  recordInspectionDecision,
  reviseInspectionJob,
  startInspectionRun,
} from '@/utils/inspection-api';
import styles from './InspectionOperationsPage.module.css';

const PURPOSES: readonly { value: InspectionRunPurpose; label: string }[] = [
  { value: 'admission', label: '准入巡检' },
  { value: 'canary', label: '灰度巡检' },
  { value: 'verification', label: '验证巡检' },
  { value: 'post_change', label: '变更后巡检' },
];

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
  const [name, setName] = useState('');
  const [service, setService] = useState('');
  const [connectorRef, setConnectorRef] = useState('');
  const [query, setQuery] = useState('safe_metric');
  const [threshold, setThreshold] = useState('250');
  const [changeId, setChangeId] = useState('');
  const [version, setVersion] = useState('');
  const [purpose, setPurpose] = useState<InspectionRunPurpose>('admission');
  const [editableRevision, setEditableRevision] = useState<InspectionJobRevision | null>(null);
  const [revisionQuery, setRevisionQuery] = useState('');
  const [revisionThreshold, setRevisionThreshold] = useState('');
  const [intent, setIntent] = useState('帮我巡检 payments-router 的支付路由配置变更');
  const [candidateService, setCandidateService] = useState('payments-router');
  const [candidateChangeId, setCandidateChangeId] = useState('CHG-23841');
  const [candidateVersion, setCandidateVersion] = useState('v3.18.0');

  const applyCandidateSet = useCallback((next: InspectionCandidateSet | null) => {
    setCandidateSet(next);
    setSelectedCandidateIds(
      next?.candidates.filter((candidate) => candidate.priority !== 'optional').map((candidate) => candidate.id) ?? [],
    );
    setCandidateWaivers({});
  }, []);

  function applyRevisionDraft(revision: InspectionJobRevision | null) {
    setEditableRevision(revision);
    setRevisionQuery(revision?.checks[0]?.query ?? '');
    setRevisionThreshold(revision?.checks[0] ? String(revision.checks[0].threshold) : '');
  }

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
        setConnectorRef(loadedSources[0]?.id ?? '');
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
          setEditableRevision(currentJob.revision);
          setRevisionQuery(currentJob.revision.checks[0]?.query ?? '');
          setRevisionThreshold(currentJob.revision.checks[0] ? String(currentJob.revision.checks[0].threshold) : '');
          const firstCase = loadedCases[0];
          if (firstCase) {
            setSelectedCaseId(firstCase.id);
            const loadedWorkspace = await fetchInspectionCase(firstCase.id);
            setWorkspace(loadedWorkspace);
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
  }, [applyCandidateSet]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === connectorRef) ?? null,
    [connectorRef, sources],
  );
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
      const message = error instanceof Error ? error.message : 'Connected API 请求失败';
      if (isInspectionAvailabilityError(error)) setConnectionError(message);
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
      }
    });
  }

  async function chooseCase(caseId: string) {
    setSelectedCaseId(caseId);
    await withCommand(async () => {
      const loadedWorkspace = await fetchInspectionCase(caseId);
      setWorkspace(loadedWorkspace);
    });
  }

  async function handleGenerateCandidates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource) return;
    await withCommand(async () => {
      const generated = await generateInspectionCandidateSet({
        intent: intent.trim(),
        service: candidateService.trim(),
        environment: selectedSource.scope,
        connectorRef: selectedSource.id,
        changeId: candidateChangeId.trim(),
        version: candidateVersion.trim(),
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
        changeId: candidateSet.changeContext.changeId,
        version: candidateSet.changeContext.version,
      });
      setJobs((current) => [created.job, ...current.filter((item) => item.id !== created.job.id)]);
      setSelectedJobId(created.job.id);
      setCases([createdCase]);
      setSelectedCaseId(createdCase.id);
      applyRevisionDraft(created.revision);
      setWorkspace(await fetchInspectionCase(createdCase.id));
    });
  }

  async function handleCreateJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource) return;
    await withCommand(async () => {
      const created = await createInspectionJob({
        name: name.trim(),
        service: service.trim(),
        environment: selectedSource.scope,
        connectorRef: selectedSource.id,
        checks: [
          {
            id: 'latency',
            name: 'p95 latency',
            query: query.trim(),
            operator: 'lte',
            threshold: Number(threshold),
            unit: 'ms',
            maxAgeMs: 15 * 60 * 1_000,
          },
        ],
      });
      setJobs((current) => [created.job, ...current]);
      setSelectedJobId(created.job.id);
      setCases([]);
      setSelectedCaseId(null);
      setWorkspace(null);
      applyRevisionDraft(created.revision);
      setName('');
      setService('');
    });
  }

  async function handleCreateCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId) return;
    await withCommand(async () => {
      const created = await createInspectionCase({
        jobId: selectedJobId,
        changeId: changeId.trim(),
        version: version.trim(),
      });
      setCases((current) => [created, ...current]);
      setSelectedCaseId(created.id);
      const loadedWorkspace = await fetchInspectionCase(created.id);
      setWorkspace(loadedWorkspace);
      setChangeId('');
      setVersion('');
    });
  }

  async function handleReviseJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selectedJob ||
      !editableRevision ||
      editableRevision.jobId !== selectedJob.id ||
      editableRevision.revision !== selectedJob.currentRevision
    ) {
      return;
    }
    const nextThreshold = Number(revisionThreshold);
    if (!revisionQuery.trim() || !Number.isFinite(nextThreshold)) return;

    await withCommand(async () => {
      const revised = await reviseInspectionJob(selectedJob.id, {
        expectedRevision: selectedJob.currentRevision,
        checks: editableRevision.checks.map((check, index) =>
          index === 0
            ? {
                ...check,
                query: revisionQuery.trim(),
                threshold: nextThreshold,
              }
            : check,
        ),
      });
      setJobs((current) => current.map((job) => (job.id === revised.job.id ? revised.job : job)));
      applyRevisionDraft(revised.revision);
    });
  }

  async function handleRun() {
    if (!selectedCaseId) return;
    await withCommand(async () => {
      await startInspectionRun(selectedCaseId, purpose, runKey());
      setWorkspace(await fetchInspectionCase(selectedCaseId));
      const refreshedCases = await listInspectionCases(selectedJobId ?? undefined);
      setCases(refreshedCases);
    });
  }

  async function handleAccept() {
    if (!selectedCaseId || !workspace) return;
    const latestRun = workspace.runs.at(-1);
    if (!latestRun || latestRun.status === 'running') return;
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
  const missingRequiredWaiver =
    candidateSet?.candidates.some(
      (candidate) =>
        candidate.priority === 'required' &&
        !selectedCandidateIds.includes(candidate.id) &&
        !candidateWaivers[candidate.id]?.trim(),
    ) ?? false;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>NOVA · CONNECTED SANDBOX</p>
          <h1>变更巡检决策工作台</h1>
          <p className={styles.lead}>
            作业、版本、执行证据与报告持久化到服务端。这里只读观测，不执行发布、放量或回滚。
          </p>
        </div>
        <div className={styles.connection} data-state={connectionState}>
          <span className={styles.connectionDot} aria-hidden="true" />
          <div>
            <strong>
              {connectionState === 'booting'
                ? '正在连接 connected API'
                : connectionState === 'degraded'
                  ? '连接中断'
                  : connectionState === 'misconfigured'
                    ? '未配置数据源'
                    : connectionState === 'running'
                      ? '命令执行中'
                      : connectionState === 'completed'
                        ? '证据已固化'
                        : '已连接'}
            </strong>
            <span>
              {sources
                .map((source) => `${sourceLabel(source)} · kind: ${source.kind} · scope: ${source.scope}`)
                .join(' · ') || '无可用 source'}
            </span>
          </div>
        </div>
      </header>

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

      <section className={styles.journey} aria-label="变更巡检时序">
        <div className={styles.journeyHeader}>
          <div>
            <p className={styles.eyebrow}>CHANGE INSPECTION JOURNEY</p>
            <h2>从变更意图到可审计决策</h2>
          </div>
          <div className={styles.stageRail}>
            <span data-active={!workspace || purpose === 'admission'}>01 变更前 · 准入</span>
            <span data-active={purpose === 'canary' || purpose === 'verification'}>02 变更中 · 灰度</span>
            <span data-active={purpose === 'post_change'}>03 变更后 · 对比</span>
          </div>
        </div>

        <div className={styles.atomicGrid}>
          <form className={styles.intentPanel} onSubmit={handleGenerateCandidates}>
            <div className={styles.panelTitle}>
              <span>原子能力 01</span>
              <strong>巡检项生成</strong>
            </div>
            <label>
              变更意图
              <textarea
                data-testid="candidate-intent"
                value={intent}
                onChange={(event) => setIntent(event.target.value)}
                placeholder="帮我巡检 payments-router 的路由配置变更"
                required
              />
            </label>
            <div className={styles.compactFields}>
              <label>
                服务
                <input
                  data-testid="candidate-service"
                  value={candidateService}
                  onChange={(event) => setCandidateService(event.target.value)}
                  required
                />
              </label>
              <label>
                变更号
                <input
                  data-testid="candidate-change-id"
                  value={candidateChangeId}
                  onChange={(event) => setCandidateChangeId(event.target.value)}
                  required
                />
              </label>
              <label>
                版本
                <input
                  data-testid="candidate-version"
                  value={candidateVersion}
                  onChange={(event) => setCandidateVersion(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className={styles.sourceContract}>
              <span>确认范围</span>
              <strong>{selectedSource ? `${selectedSource.scope} · ${selectedSource.id}` : '等待服务端数据源'}</strong>
            </div>
            <button
              data-testid="generate-candidates"
              className={styles.primaryButton}
              type="submit"
              disabled={
                formDisabled ||
                !intent.trim() ||
                !candidateService.trim() ||
                !candidateChangeId.trim() ||
                !candidateVersion.trim()
              }
            >
              {busy ? '生成中…' : '生成候选巡检项'}
            </button>
          </form>

          <section className={styles.candidatePanel}>
            <div className={styles.panelTitle}>
              <span>原子能力 02</span>
              <strong>候选包 → Playbook Revision</strong>
            </div>
            {candidateSet ? (
              <>
                <div className={styles.candidateMeta}>
                  <span>{candidateSet.changeContext.changeId}</span>
                  <span>{candidateSet.topologySnapshot.catalogVersion}</span>
                  <span>{candidateSet.candidates.length} 项候选</span>
                </div>
                <div className={styles.candidateList}>
                  {candidateSet.candidates.map((candidate) => {
                    const selected = selectedCandidateIds.includes(candidate.id);
                    return (
                      <article key={candidate.id} className={styles.candidateCard} data-priority={candidate.priority}>
                        <label className={styles.candidateChoice}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleCandidate(candidate.id)}
                            disabled={busy}
                          />
                          <span>
                            <strong>{candidate.name}</strong>
                            <small>{candidate.priority}</small>
                          </span>
                        </label>
                        <p>{candidate.reason}</p>
                        <code>{candidate.check.query}</code>
                        {!selected && candidate.priority === 'required' && (
                          <label className={styles.waiverField}>
                            Required waiver
                            <input
                              value={candidateWaivers[candidate.id] ?? ''}
                              onChange={(event) =>
                                setCandidateWaivers((current) => ({ ...current, [candidate.id]: event.target.value }))
                              }
                              placeholder="说明由什么外部门禁覆盖"
                            />
                          </label>
                        )}
                      </article>
                    );
                  })}
                </div>
                {candidateSet.coverageOmissions.map((omission) => (
                  <article key={omission.id} className={styles.omissionCard}>
                    <div>
                      <strong>{omission.code}</strong>
                      <span>{omission.dependencyRef}</span>
                    </div>
                    <p>{omission.risk}</p>
                    <small>{omission.reason}</small>
                  </article>
                ))}
                <button
                  data-testid="materialize-candidates"
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => void handleMaterializeCandidates()}
                  disabled={formDisabled || selectedCandidateIds.length === 0 || missingRequiredWaiver}
                >
                  固化 Revision 并创建 Case
                </button>
              </>
            ) : (
              <div className={styles.blankSlate}>
                <strong>等待候选巡检项</strong>
                <span>系统会解释每一项来自哪段变更、哪条规则和哪条依赖。</span>
              </div>
            )}
          </section>

          <section className={styles.assessmentPanel}>
            <div className={styles.panelTitle}>
              <span>原子能力 03—05</span>
              <strong>执行 · 报告 · AI 解读</strong>
            </div>
            {workspace?.abReport && (
              <article className={styles.abReportCard} data-testid="inspection-ab-report">
                <div>
                  <strong>FINAL A/B</strong>
                  <span>{workspace.abReport.comparability}</span>
                </div>
                <small>
                  {workspace.abReport.baselineRunId} → {workspace.abReport.currentRunId}
                </small>
                {workspace.abReport.checks.map((check) => (
                  <p key={check.checkId}>
                    <b>{check.checkId}</b>{' '}
                    {check.comparable
                      ? `${check.baselineValue} → ${check.currentValue} · Δ ${check.absoluteDelta}`
                      : `不可比 · ${check.reason}`}
                  </p>
                ))}
              </article>
            )}
            {workspace?.assessment ? (
              <div data-testid="inspection-assessment">
                <div className={styles.assessmentGate} data-verdict={workspace.assessment.machineVerdict}>
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
                    <strong>{workspace.assessment.decisionReadiness}</strong>
                  </div>
                </div>
                {[
                  ...workspace.assessment.facts,
                  ...workspace.assessment.unknowns,
                  ...workspace.assessment.recommendations,
                ].map((item) => (
                  <article key={`${item.code}-${item.statement}`} className={styles.assessmentItem}>
                    <strong>{item.code}</strong>
                    <p>{item.statement}</p>
                    <small>{item.evidenceRefs.map((ref) => ref.ref).join(' · ')}</small>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.blankSlate}>
                <strong>{workspace ? `Case ${workspace.case.id}` : '等待一次服务端 Run'}</strong>
                <span>规则先生成 verdict；解读只基于 EvidenceRef 说明事实、假设与未决风险。</span>
              </div>
            )}
          </section>
        </div>
      </section>

      <section className={styles.grid}>
        <aside className={styles.sidebar}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>JOB LIBRARY</p>
              <h2>持久作业</h2>
            </div>
            <span>{jobs.length}</span>
          </div>
          {loading ? (
            <p className={styles.muted}>正在读取服务端作业…</p>
          ) : jobs.length === 0 ? (
            <p className={styles.empty}>还没有持久作业。右侧保存后，刷新页面仍可复用。</p>
          ) : (
            <div className={styles.stack}>
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className={job.id === selectedJobId ? styles.selectedCard : styles.cardButton}
                  onClick={() => void chooseJob(job.id)}
                  disabled={busy}
                >
                  <strong>{job.name}</strong>
                  <span>
                    {job.service} · {job.environment}
                  </span>
                  <small>
                    rev {job.currentRevision} · {job.connectorRef}
                  </small>
                </button>
              ))}
            </div>
          )}

          <form className={styles.form} onSubmit={handleCreateJob}>
            <h3>保存为可复用作业</h3>
            <label>
              作业名
              <input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              服务标识
              <input
                name="service"
                value={service}
                onChange={(event) => setService(event.target.value)}
                pattern="[A-Za-z0-9._\-]+"
                required
              />
            </label>
            <div className={styles.twoColumns}>
              <label>
                环境
                <input name="environment" value={selectedSource?.scope ?? ''} readOnly required />
              </label>
              <label>
                数据源
                <select value={connectorRef} onChange={(event) => setConnectorRef(event.target.value)} required>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {sourceLabel(source)} · {source.kind} · {source.scope}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              精确只读查询
              <textarea name="query" value={query} onChange={(event) => setQuery(event.target.value)} required />
            </label>
            <label>
              p95 上限（ms）
              <input
                name="threshold"
                type="number"
                min="0"
                step="0.01"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                required
              />
            </label>
            <button
              data-testid="create-job-submit"
              className={styles.primaryButton}
              type="submit"
              disabled={formDisabled || !name.trim() || !service.trim() || !query.trim()}
            >
              {busy ? '保存中…' : '保存作业与 revision 1'}
            </button>
          </form>
        </aside>

        <section className={styles.workspace}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>EXECUTION CASES</p>
              <h2>{selectedJob?.name ?? '选择一个持久作业'}</h2>
            </div>
            {selectedJob && <span>rev {selectedJob.currentRevision}</span>}
          </div>

          {selectedJob ? (
            <>
              {editableRevision?.jobId === selectedJob.id &&
              editableRevision.revision === selectedJob.currentRevision ? (
                <form className={styles.form} onSubmit={handleReviseJob}>
                  <h3>创建 revision {selectedJob.currentRevision + 1}</h3>
                  <p className={styles.muted}>
                    当前 rev {selectedJob.currentRevision}。更新只会生成新 revision，已有 Case 继续绑定原 revision。
                  </p>
                  <label>
                    Check query
                    <textarea
                      data-testid="revision-query"
                      value={revisionQuery}
                      onChange={(event) => setRevisionQuery(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Check threshold
                    <input
                      data-testid="revision-threshold"
                      type="number"
                      step="0.01"
                      value={revisionThreshold}
                      onChange={(event) => setRevisionThreshold(event.target.value)}
                      required
                    />
                  </label>
                  <button
                    data-testid="revise-job-submit"
                    className={styles.secondaryButton}
                    type="submit"
                    disabled={formDisabled || !revisionQuery.trim() || !revisionThreshold.trim()}
                  >
                    {busy ? '创建中…' : `保存 revision ${selectedJob.currentRevision + 1}`}
                  </button>
                </form>
              ) : (
                <p className={styles.muted}>
                  当前 rev {selectedJob.currentRevision}。选择绑定当前 revision 的 Case 后可编辑检查条件。
                </p>
              )}
              <form className={styles.caseForm} onSubmit={handleCreateCase}>
                <label>
                  变更编号
                  <input
                    data-testid="change-id"
                    value={changeId}
                    onChange={(event) => setChangeId(event.target.value)}
                    placeholder="CHG-42"
                    required
                  />
                </label>
                <label>
                  版本
                  <input
                    data-testid="change-version"
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    placeholder="v3.18.0"
                    required
                  />
                </label>
                <button
                  data-testid="create-case-submit"
                  className={styles.secondaryButton}
                  type="submit"
                  disabled={formDisabled || !changeId.trim() || !version.trim()}
                >
                  新建独立 Case
                </button>
              </form>

              <div className={styles.caseRail}>
                {cases.map((inspectionCase) => (
                  <button
                    key={inspectionCase.id}
                    type="button"
                    data-testid="case-pill"
                    data-case-id={inspectionCase.id}
                    className={inspectionCase.id === selectedCaseId ? styles.activePill : styles.pill}
                    onClick={() => void chooseCase(inspectionCase.id)}
                    disabled={busy}
                  >
                    {inspectionCase.changeId} · {inspectionCase.version} · {statusLabel(inspectionCase.status)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.blankSlate}>
              <strong>先保存或选择作业</strong>
              <span>一个 Job 可以反复创建 Case；每个 Case 都绑定创建时的不可变 revision。</span>
            </div>
          )}

          {workspace && (
            <>
              <div className={styles.commandBar}>
                <label>
                  执行阶段
                  <select value={purpose} onChange={(event) => setPurpose(event.target.value as InspectionRunPurpose)}>
                    {PURPOSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  data-testid="start-run"
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => void handleRun()}
                  disabled={formDisabled || workspace.case.status === 'completed'}
                >
                  {busy
                    ? selectedSource?.kind === 'replay'
                      ? '正在读取服务端回放数据…'
                      : '正在读取服务端观测…'
                    : '执行只读巡检'}
                </button>
                <span>
                  Case {workspace.case.id} · Case 绑定 rev {workspace.revision.revision}
                </span>
              </div>

              {latestRun ? (
                <article className={styles.runPanel}>
                  <div className={styles.runHeader}>
                    <div>
                      <p className={styles.eyebrow}>AUTHORITATIVE RUN</p>
                      <h3>
                        {statusLabel(latestRun.verdict)} · {statusLabel(latestRun.status)}
                      </h3>
                    </div>
                    <span>{latestRun.purpose}</span>
                  </div>
                  {latestRun.errorSummary && <p className={styles.errorText}>{latestRun.errorSummary}</p>}
                  {latestRun.sourceSnapshot && (
                    <dl className={styles.provenance}>
                      <div>
                        <dt>connectorRef</dt>
                        <dd>{latestRun.sourceSnapshot.connectorRef}</dd>
                      </div>
                      <div>
                        <dt>source kind</dt>
                        <dd>{latestRun.sourceSnapshot.sourceKind}</dd>
                      </div>
                      <div>
                        <dt>observedAt</dt>
                        <dd>{latestRun.sourceSnapshot.observedAt}</dd>
                      </div>
                      <div>
                        <dt>window</dt>
                        <dd>
                          {latestRun.sourceSnapshot.window.from} → {latestRun.sourceSnapshot.window.to}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <div className={styles.resultList}>
                    {latestRun.checkResults.map((result) => (
                      <div key={result.id} className={styles.resultCard}>
                        <div>
                          <strong>{result.checkId}</strong>
                          <span>
                            {statusLabel(result.status)} · {result.value ?? '无数据'}
                          </span>
                        </div>
                        <code>{result.queryDigest}</code>
                        <small>{result.observedAt ?? result.reason ?? '无观测时间'}</small>
                      </div>
                    ))}
                  </div>
                  {!workspace.report && latestRun.status !== 'running' && (
                    <button
                      data-testid="accept-report"
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => void handleAccept()}
                      disabled={formDisabled || latestRun.status !== 'completed' || latestRun.verdict !== 'passed'}
                      title={
                        latestRun.status !== 'completed' || latestRun.verdict !== 'passed'
                          ? '只有最新的已完成通过 Run 可以接受。'
                          : undefined
                      }
                    >
                      记录人工接受并固化报告
                    </button>
                  )}
                </article>
              ) : (
                <div className={styles.blankSlate}>
                  <strong>这个 Case 还没有 Run</strong>
                  <span>执行时浏览器只提交阶段和幂等键；观测、时间与结论均由服务端生成。</span>
                </div>
              )}

              {workspace.report && (
                <article className={styles.report} data-testid="immutable-report">
                  <div>
                    <p className={styles.eyebrow}>IMMUTABLE REPORT</p>
                    <h3>不可变报告 · {statusLabel(workspace.report.verdict)}</h3>
                  </div>
                  <dl className={styles.provenance}>
                    <div>
                      <dt>report</dt>
                      <dd>{workspace.report.id}</dd>
                    </div>
                    <div>
                      <dt>revision</dt>
                      <dd>{workspace.report.jobRevisionId}</dd>
                    </div>
                    <div>
                      <dt>runs</dt>
                      <dd>{workspace.report.runIds.join(', ')}</dd>
                    </div>
                    <div>
                      <dt>decisions</dt>
                      <dd>{workspace.report.decisionIds.join(', ')}</dd>
                    </div>
                  </dl>
                </article>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
