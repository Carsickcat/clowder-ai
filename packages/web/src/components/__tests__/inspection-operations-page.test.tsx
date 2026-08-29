import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionApiError } from '@/utils/inspection-api';

const mocks = vi.hoisted(() => ({
  createInspectionCase: vi.fn(),
  generateInspectionCandidateSet: vi.fn(),
  fetchInspectionCase: vi.fn(),
  fetchInspectionJob: vi.fn(),
  listInspectionCases: vi.fn(),
  listInspectionCandidateSets: vi.fn(),
  listInspectionJobs: vi.fn(),
  listInspectionSources: vi.fn(),
  materializeInspectionCandidateSet: vi.fn(),
  recordInspectionDecision: vi.fn(),
  startInspectionRun: vi.fn(),
}));

vi.mock('@/utils/inspection-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/inspection-api')>()),
  ...mocks,
}));

const source = {
  id: 'replay-acceptance',
  kind: 'replay',
  label: 'Local acceptance replay',
  scope: 'acceptance',
};

const job = {
  id: 'job-1',
  userId: 'user-a',
  name: 'Payments release inspection',
  service: 'payments-router',
  environment: 'acceptance',
  connectorRef: source.id,
  currentRevision: 1,
  archivedAt: null,
  createdAt: '2026-07-31T08:00:00.000Z',
  updatedAt: '2026-07-31T08:00:00.000Z',
};

const inspectionCase = {
  id: 'case-1',
  userId: 'user-a',
  jobId: job.id,
  jobRevisionId: 'revision-1',
  changeId: 'CHG-42',
  version: 'v3.18.0',
  status: 'completed',
  createdAt: '2026-07-31T08:01:00.000Z',
  updatedAt: '2026-07-31T08:02:00.000Z',
};

const candidateSet = {
  id: 'candidates-1',
  userId: 'user-a',
  changeContext: {
    intent: '帮我巡检 payments-router 的支付路由配置变更',
    service: 'payments-router',
    environment: 'acceptance',
    connectorRef: source.id,
    changeId: 'CHG-23841',
    version: 'v3.18.0',
  },
  topologySnapshot: {
    catalogVersion: 'nova-mvp-1',
    rootService: 'payments-router',
    capturedAt: '2026-08-02T01:00:00.000Z',
    dependencies: [
      {
        ref: 'baas:payments-connection-pool',
        kind: 'baas',
        direction: 'downstream',
        criticality: 'critical',
        signalMapped: false,
      },
    ],
  },
  candidates: [
    {
      id: 'availability',
      name: 'Service availability',
      priority: 'required',
      readiness: 'ready',
      stages: ['admission', 'canary', 'verification', 'post_change'],
      check: {
        id: 'availability',
        name: 'Service availability',
        query: 'safe_availability_metric',
        operator: 'gte',
        threshold: 0.995,
        unit: 'ratio',
        maxAgeMs: 120_000,
      },
      reason: 'Preserve successful request availability.',
      evidenceRefs: [{ kind: 'rule', ref: 'rule:availability', label: 'availability rule' }],
    },
    {
      id: 'latency',
      name: 'p95 request latency',
      priority: 'required',
      readiness: 'ready',
      stages: ['admission', 'canary', 'verification', 'post_change'],
      check: {
        id: 'latency',
        name: 'p95 request latency',
        query: 'safe_metric',
        operator: 'lte',
        threshold: 250,
        unit: 'ms',
        maxAgeMs: 120_000,
      },
      reason: 'Routing changes can add downstream contention.',
      evidenceRefs: [{ kind: 'rule', ref: 'rule:latency', label: 'latency rule' }],
    },
  ],
  coverageOmissions: [
    {
      id: 'coverage-pool',
      code: 'COVERAGE_OMISSION',
      dependencyRef: 'baas:payments-connection-pool',
      reason: 'No approved signal mapping.',
      risk: 'Pool saturation remains outside machine coverage.',
      evidenceRefs: [{ kind: 'topology', ref: 'baas:payments-connection-pool', label: 'pool dependency' }],
    },
  ],
  generatedAt: '2026-08-02T01:00:00.000Z',
};

const workspace = {
  case: inspectionCase,
  job,
  revision: {
    id: 'revision-1',
    jobId: job.id,
    revision: 1,
    checks: [
      {
        id: 'latency',
        name: 'p95 latency',
        query: 'safe_metric',
        operator: 'lte',
        threshold: 250,
        unit: 'ms',
        maxAgeMs: 120_000,
      },
    ],
    createdBy: 'user-a',
    createdAt: '2026-07-31T08:00:00.000Z',
  },
  runs: [
    {
      id: 'run-1',
      caseId: inspectionCase.id,
      purpose: 'post_change',
      status: 'completed',
      verdict: 'passed',
      sourceSnapshot: {
        connectorRef: source.id,
        sourceKind: 'replay',
        scope: 'acceptance',
        snapshotHash: 'sha256:connected-replay-snapshot',
        fixtureCapturedAt: '2026-07-30T08:00:00.000Z',
        observedAt: '2026-07-31T08:01:30.000Z',
        window: {
          from: '2026-07-31T07:56:30.000Z',
          to: '2026-07-31T08:01:30.000Z',
        },
      },
      checkResults: [
        {
          id: 'result-1',
          runId: 'run-1',
          checkId: 'latency',
          status: 'passed',
          value: 184,
          baselineValue: null,
          observedAt: '2026-07-31T08:01:20.000Z',
          queryDigest: `sha256:${'a'.repeat(64)}`,
          reason: null,
        },
      ],
      errorSummary: null,
      startedAt: '2026-07-31T08:01:00.000Z',
      finishedAt: '2026-07-31T08:02:00.000Z',
    },
  ],
  abReport: {
    baselineRunId: 'run-before',
    currentRunId: 'run-1',
    comparability: 'valid',
    reason: null,
    generatedAt: '2026-07-31T08:02:00.000Z',
    checks: [
      {
        checkId: 'latency',
        comparable: true,
        baselineValue: 180,
        currentValue: 184,
        absoluteDelta: 4,
        relativeDeltaPercent: 2.222,
        reason: null,
        evidenceRefs: [],
      },
    ],
  },
  assessment: {
    runId: 'run-1',
    generatedAt: '2026-07-31T08:02:00.000Z',
    machineVerdict: 'passed',
    coverageStatus: 'complete',
    decisionReadiness: 'ready',
    facts: [],
    hypotheses: [],
    unknowns: [],
    recommendations: [],
  },
  report: {
    id: 'report-1',
    caseId: inspectionCase.id,
    jobRevisionId: 'revision-1',
    runIds: ['run-1'],
    decisionIds: ['decision-1'],
    verdict: 'passed',
    intelligence: {
      assessmentBasis: {
        candidateSetId: 'candidates-1',
        coverageOmissionIds: [],
        comparability: 'valid',
        runIds: ['run-1'],
        decisionIds: ['decision-1'],
        sourceSnapshotHashes: ['sha256:connected-replay-snapshot'],
      },
      score: {
        overall: 98,
        grade: 'A',
        modelVersion: 'nova-report-score-v2',
        dimensions: [
          ['coverage', '方案覆盖诚实度', 100, 25],
          ['integrity', '证据可信度', 98, 25],
          ['comparability', '基线可比性', 96, 20],
          ['freshness', '证据新鲜度', 100, 15],
          ['risk_closure', '风险闭环度', 92, 15],
        ].map(([id, label, score, weight]) => ({
          id,
          label,
          score,
          weight,
          explanation: `${label}可重建`,
          evidenceRefs: ['run-1'],
        })),
        deductions: [
          {
            id: 'integrity-deduction',
            points: 0.5,
            reason: '本地 replay 没有外部签名。',
            evidenceRefs: ['run-1'],
          },
          {
            id: 'comparability-deduction',
            points: 0.8,
            reason: '本地 replay 保留审慎折减。',
            evidenceRefs: ['run-1'],
          },
          {
            id: 'risk-closure-deduction',
            points: 1.2,
            reason: '历史风险仍需持续观察。',
            evidenceRefs: ['run-1'],
          },
        ],
      },
      interpretation: {
        executiveSummary: '本次变更综合评分 98 分。',
        keyEvidence: [{ statement: '证据链完整。', evidenceRefs: ['run-1'] }],
        residualRisks: [{ statement: '继续观察连接池容量。', evidenceRefs: ['run-1'] }],
        recommendation: '可接受本地巡检结论；生产动作仍不可用。',
        confidence: 0.98,
        citations: ['run-1', 'decision-1'],
        clawExplanation: '报告评分 98 分，五个维度均可追溯。',
      },
    },
    generatedAt: '2026-07-31T08:03:00.000Z',
  },
};

describe('InspectionOperationsPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.listInspectionSources.mockResolvedValue([source]);
    mocks.listInspectionJobs.mockResolvedValue([]);
    mocks.listInspectionCases.mockResolvedValue([]);
    mocks.listInspectionCandidateSets.mockResolvedValue([]);
    mocks.fetchInspectionJob.mockResolvedValue({ job, revision: workspace.revision });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderPage() {
    const { InspectionOperationsPage } = await import('../observability/InspectionOperationsPage');
    await act(async () => {
      root.render(<InspectionOperationsPage />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  it('keeps the approved 7d991e single-screen product anatomy and Chinese decision language', async () => {
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([inspectionCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce(workspace);

    await renderPage();

    expect(container.querySelector('[data-testid="inspection-context"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="inspection-journey"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="inspection-job-platform"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="inspection-decision-surface"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="inspection-claw-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="inspection-timeline"]')).not.toBeNull();
    expect(container.textContent).toContain('当前结论');
    expect(container.textContent).toContain('下一步');
    expect(container.textContent).toContain('CLAW 巡检搭档');
    expect(container.textContent).not.toContain('CONNECTED SANDBOX');
    expect(container.textContent).not.toContain('JOB LIBRARY');
    expect(container.textContent).not.toContain('EXECUTION CASES');
    expect(container.textContent).not.toContain('AUTHORITATIVE RUN');
    expect(container.textContent).not.toContain('IMMUTABLE REPORT');
  });

  it('labels the connected runtime honestly and renders immutable report intelligence', async () => {
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([inspectionCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce(workspace);

    await renderPage();

    expect(container.querySelector('[data-testid="runtime-environment-banner"]')?.textContent).toContain(
      'CONNECTED SYSTEM · server-authoritative facts',
    );
    expect(container.textContent).toContain('变更、拓扑与指标事实只由服务端只读数据源提供');
    expect(container.textContent).toContain('acceptance');
    expect(container.textContent).toContain('sha256:connected-replay-snapshot');
    expect(container.textContent).toContain('Fixture 固化时间');
    expect(container.textContent).toContain('2026-07-30T08:00:00.000Z');

    const intelligence = container.querySelector('[data-testid="report-intelligence"]');
    expect(intelligence?.textContent).toContain('98');
    expect(intelligence?.textContent).toContain('nova-report-score-v2');
    expect(intelligence?.textContent).toContain('方案覆盖诚实度');
    expect(intelligence?.textContent).toContain('证据可信度');
    expect(intelligence?.textContent).toContain('基线可比性');
    expect(intelligence?.textContent).toContain('证据新鲜度');
    expect(intelligence?.textContent).toContain('风险闭环度');
    expect(intelligence?.textContent).toContain('加权扣分 2.5');
    expect(intelligence?.textContent).toContain('继续观察连接池容量');
  });

  it('states the no-fallback contract while the connected API is loading', async () => {
    const pending = new Promise<never>(() => {});
    mocks.listInspectionSources.mockReturnValueOnce(pending);
    mocks.listInspectionJobs.mockReturnValueOnce(pending);
    mocks.listInspectionCandidateSets.mockReturnValueOnce(pending);

    await renderPage();

    expect(container.textContent).toContain('正在连接巡检服务，不会加载演示数据。');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="generate-candidates"]')?.disabled).toBe(true);
  });

  it('fails closed when the connected API is unavailable', async () => {
    mocks.listInspectionSources.mockRejectedValueOnce(new Error('offline'));
    mocks.listInspectionJobs.mockRejectedValueOnce(new Error('offline'));

    await renderPage();

    expect(container.textContent).toContain('连接中断');
    expect(container.textContent).not.toContain('Payments release inspection');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="generate-candidates"]')?.disabled).toBe(true);
  });

  it('turns change intent into a candidate package, revision and ready Case on one screen', async () => {
    const readyCase = { ...inspectionCase, changeId: 'CHG-23841', status: 'ready' };
    const readyWorkspace = {
      ...workspace,
      case: readyCase,
      candidateSet,
      stageReports: [],
      assessment: null,
      runs: [],
      report: null,
    };
    mocks.generateInspectionCandidateSet.mockResolvedValueOnce(candidateSet);
    mocks.materializeInspectionCandidateSet.mockResolvedValueOnce({ job, revision: workspace.revision });
    mocks.createInspectionCase.mockResolvedValueOnce(readyCase);
    mocks.fetchInspectionCase.mockResolvedValueOnce(readyWorkspace);

    await renderPage();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="generate-candidates"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mocks.generateInspectionCandidateSet).toHaveBeenCalledWith({
      changeRef: 'CHG-23841',
      intent: expect.stringContaining('payments-router'),
    });
    expect(container.textContent).toContain('服务可用性');
    expect(container.textContent).toContain('未覆盖依赖');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="materialize-candidates"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mocks.materializeInspectionCandidateSet).toHaveBeenCalledWith(candidateSet.id, {
      name: 'payments-router · CHG-23841',
      selectedCandidateIds: ['availability', 'latency'],
      waivers: [],
    });
    expect(mocks.createInspectionCase).toHaveBeenCalledWith({ jobId: job.id });
    expect(container.textContent).toContain('巡检编号 case-1');
  });

  it('exposes no browser mutation surface for authoritative jobs, revisions or case facts', async () => {
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([inspectionCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce({ ...workspace, report: null });

    await renderPage();

    expect(container.querySelector('[data-testid="create-job-submit"]')).toBeNull();
    expect(container.querySelector('[data-testid="revise-job-submit"]')).toBeNull();
    expect(container.querySelector('[data-testid="create-case-submit"]')).toBeNull();
    expect(container.querySelector('[data-testid="candidate-service"]')).toBeNull();
    expect(container.querySelector('[data-testid="candidate-version"]')).toBeNull();
    expect(container.querySelector('[data-testid="candidate-change-ref"]')).not.toBeNull();
    expect(container.textContent).toContain('作业与版本只由已确认的服务端方案生成');
  });

  it('identifies replay sources as server replay data with explicit kind and scope', async () => {
    await renderPage();

    expect(container.textContent).toContain('验收回放');
    expect(container.textContent).toContain('服务端回放数据');
    expect(container.textContent).toContain('类型: replay');
    expect(container.textContent).toContain('范围: acceptance');
    expect(container.textContent).not.toContain('真实观测');
  });

  it.each([
    ['network failure', new TypeError('Failed to fetch')],
    ['503 response', new InspectionApiError('Inspection source unavailable', 503)],
  ])('degrades and disables execution after a ready-state %s', async (_label, failure) => {
    const readyCase = { ...inspectionCase, status: 'ready' };
    const readyWorkspace = {
      ...workspace,
      case: readyCase,
      runs: [],
      report: null,
    };
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([readyCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce(readyWorkspace);
    mocks.startInspectionRun.mockRejectedValueOnce(failure);

    await renderPage();
    const startRun = container.querySelector<HTMLButtonElement>('[data-testid="start-run"]');
    if (!startRun) throw new Error('expected start Run action');
    expect(startRun.disabled).toBe(false);

    await act(async () => {
      startRun.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.querySelector('[data-state="degraded"]')).not.toBeNull();
    expect(container.textContent).toContain('连接中断');
    expect(startRun.disabled).toBe(true);
  });

  it('renders planning drift as a bounded replan action without pretending the API disconnected', async () => {
    const readyCase = { ...inspectionCase, status: 'ready' };
    const readyWorkspace = { ...workspace, case: readyCase, runs: [], report: null };
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([readyCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce(readyWorkspace);
    mocks.startInspectionRun.mockRejectedValueOnce(
      new InspectionApiError('Inspection planning facts changed', 409, {
        code: 'INSPECTION_PLANNING_DRIFT',
        differences: [{ source: 'topology', expectedHash: 'sha256:old', actualHash: 'sha256:new' }],
      }),
    );

    await renderPage();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-run"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.textContent).toContain('巡检依据已变化');
    expect(container.textContent).toContain('服务拓扑');
    expect(container.textContent).toContain('请重新生成并确认方案');
    expect(container.textContent).not.toContain('连接中断');
  });

  it('renders persisted run provenance verbatim after reload', async () => {
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([inspectionCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce(workspace);

    await renderPage();

    expect(container.textContent).toContain('payments-router 变更巡检');
    expect(container.textContent).toContain('replay-acceptance');
    expect(container.textContent).toContain('2026-07-31T08:01:30.000Z');
    expect(container.textContent).toContain(`sha256:${'a'.repeat(64)}`);
    expect(container.querySelector('[data-testid="inspection-ab-report"]')?.textContent).toContain('180 → 184');
    expect(container.querySelector('[data-testid="inspection-ab-report"]')?.textContent).toContain('请求延迟');
    expect(container.querySelector('[data-testid="inspection-ab-report"]')?.textContent).not.toContain('latency');
    expect(container.textContent).toContain('不可变报告');
  });

  it('projects the completed case state immediately after report acceptance', async () => {
    const runningCase = { ...inspectionCase, status: 'running' };
    const pendingWorkspace = {
      ...workspace,
      case: runningCase,
      report: null,
    };
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([runningCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce(pendingWorkspace).mockResolvedValueOnce(workspace);
    mocks.recordInspectionDecision.mockResolvedValueOnce({
      decision: { id: 'decision-1' },
      report: workspace.report,
    });

    await renderPage();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="accept-report"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.querySelector('[data-testid="case-pill"]')?.textContent).toContain('已完成');
  });

  it('fails closed in the UI when the latest run is not passed', async () => {
    const riskCase = { ...inspectionCase, status: 'blocked' };
    const riskWorkspace = {
      ...workspace,
      case: riskCase,
      report: null,
      runs: [{ ...workspace.runs[0], verdict: 'risk' }],
    };
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([riskCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce(riskWorkspace);

    await renderPage();

    expect(container.querySelector<HTMLButtonElement>('[data-testid="accept-report"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="accept-report"]')?.title).toBe(
      '只有最新的已完成通过 Run 可以接受。',
    );
  });

  it('renders grounded hypotheses and blocks post-change acceptance when A/B is unavailable', async () => {
    const blockedWorkspace = {
      ...workspace,
      report: null,
      abReport: {
        ...workspace.abReport,
        baselineRunId: null,
        comparability: 'unavailable',
        reason: 'missing_baseline_run',
      },
      assessment: {
        runId: 'run-1',
        generatedAt: '2026-07-31T08:02:00.000Z',
        machineVerdict: 'passed',
        coverageStatus: 'complete',
        decisionReadiness: 'blocked',
        facts: [],
        hypotheses: [
          {
            code: 'CHANGE_CONTENTION_HYPOTHESIS',
            statement: 'Latency may reflect change-related downstream contention.',
            evidenceRefs: [],
          },
        ],
        unknowns: [],
        recommendations: [],
      },
    };
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([inspectionCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce(blockedWorkspace);

    await renderPage();

    expect(container.textContent).toContain('延迟变化可能来自本次变更引发的下游资源争用。');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="accept-report"]')?.disabled).toBe(true);
  });
});
