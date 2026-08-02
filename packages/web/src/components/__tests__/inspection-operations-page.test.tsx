import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionApiError } from '@/utils/inspection-api';

const mocks = vi.hoisted(() => ({
  createInspectionCase: vi.fn(),
  createInspectionJob: vi.fn(),
  generateInspectionCandidateSet: vi.fn(),
  fetchInspectionCase: vi.fn(),
  fetchInspectionJob: vi.fn(),
  listInspectionCases: vi.fn(),
  listInspectionCandidateSets: vi.fn(),
  listInspectionJobs: vi.fn(),
  listInspectionSources: vi.fn(),
  materializeInspectionCandidateSet: vi.fn(),
  recordInspectionDecision: vi.fn(),
  reviseInspectionJob: vi.fn(),
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

  async function changeInput(element: HTMLInputElement, value: string) {
    await act(async () => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
      descriptor?.set?.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function changeTextArea(element: HTMLTextAreaElement, value: string) {
    await act(async () => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
      descriptor?.set?.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
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

  it('fails closed when the connected API is unavailable', async () => {
    mocks.listInspectionSources.mockRejectedValueOnce(new Error('offline'));
    mocks.listInspectionJobs.mockRejectedValueOnce(new Error('offline'));

    await renderPage();

    expect(container.textContent).toContain('连接中断');
    expect(container.textContent).not.toContain('Payments release inspection');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="create-job-submit"]')?.disabled).toBe(true);
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

    expect(mocks.generateInspectionCandidateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: expect.stringContaining('payments-router'),
        service: 'payments-router',
        connectorRef: source.id,
        changeId: 'CHG-23841',
        version: 'v3.18.0',
      }),
    );
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
    expect(mocks.createInspectionCase).toHaveBeenCalledWith({
      jobId: job.id,
      changeId: 'CHG-23841',
      version: 'v3.18.0',
    });
    expect(container.textContent).toContain('巡检编号 case-1');
  });

  it('saves an exact check definition as a reusable server job', async () => {
    mocks.createInspectionJob.mockResolvedValueOnce({
      job,
      revision: workspace.revision,
    });

    await renderPage();
    const name = container.querySelector<HTMLInputElement>('[name="name"]');
    const service = container.querySelector<HTMLInputElement>('[name="service"]');
    const submit = container.querySelector<HTMLButtonElement>('[data-testid="create-job-submit"]');

    if (!name || !service) throw new Error('expected create job fields');
    await changeInput(name, 'Payments release inspection');
    await changeInput(service, 'payments-router');
    await act(async () => {
      submit?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mocks.createInspectionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Payments release inspection',
        service: 'payments-router',
        connectorRef: source.id,
        checks: [expect.objectContaining({ id: 'latency', query: 'safe_metric' })],
      }),
    );
  });

  it('derives the job environment from the selected server source scope', async () => {
    const stagingSource = {
      id: 'prometheus-staging',
      kind: 'prometheus' as const,
      label: 'Staging Prometheus',
      scope: 'staging',
    };
    mocks.listInspectionSources.mockResolvedValueOnce([stagingSource]);
    mocks.createInspectionJob.mockResolvedValueOnce({
      job: { ...job, connectorRef: stagingSource.id, environment: stagingSource.scope },
      revision: workspace.revision,
    });

    await renderPage();
    const name = container.querySelector<HTMLInputElement>('[name="name"]');
    const service = container.querySelector<HTMLInputElement>('[name="service"]');
    const submit = container.querySelector<HTMLButtonElement>('[data-testid="create-job-submit"]');

    if (!name || !service) throw new Error('expected create job fields');
    await changeInput(name, 'Staging payments inspection');
    await changeInput(service, 'payments-router');
    await act(async () => {
      submit?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mocks.createInspectionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorRef: stagingSource.id,
        environment: 'staging',
      }),
    );
    expect(container.querySelector<HTMLInputElement>('[name="environment"]')?.readOnly).toBe(true);
  });

  it('identifies replay sources as server replay data with explicit kind and scope', async () => {
    await renderPage();

    expect(container.textContent).toContain('验收回放');
    expect(container.textContent).toContain('服务端回放数据');
    expect(container.textContent).toContain('类型: replay');
    expect(container.textContent).toContain('范围: acceptance');
    expect(container.textContent).not.toContain('真实观测');
  });

  it('revises the current job to N+1 while preserving the existing Case revision', async () => {
    const revisionTwo = {
      ...workspace.revision,
      id: 'revision-2',
      revision: 2,
      checks: [{ ...workspace.revision.checks[0], query: 'updated_metric', threshold: 220 }],
    };
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([inspectionCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce({ ...workspace, report: null });
    mocks.reviseInspectionJob.mockResolvedValueOnce({
      job: { ...job, currentRevision: 2 },
      revision: revisionTwo,
    });

    await renderPage();
    const queryInput = container.querySelector<HTMLTextAreaElement>('[data-testid="revision-query"]');
    const thresholdInput = container.querySelector<HTMLInputElement>('[data-testid="revision-threshold"]');
    if (!queryInput || !thresholdInput) throw new Error('expected revision editor fields');

    await changeTextArea(queryInput, 'updated_metric');
    await changeInput(thresholdInput, '220');
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="revise-job-submit"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mocks.reviseInspectionJob).toHaveBeenCalledWith(job.id, {
      expectedRevision: 1,
      checks: [{ ...workspace.revision.checks[0], query: 'updated_metric', threshold: 220 }],
    });
    expect(container.textContent).toContain('当前版本 2');
    expect(container.textContent).toContain('当前巡检绑定版本 1');
    expect(container.querySelector('[data-testid="case-pill"]')?.textContent).toContain('CHG-42');
  });

  it('keeps the connected page operable after a revision conflict and allows retry', async () => {
    const revisionTwo = {
      ...workspace.revision,
      id: 'revision-2',
      revision: 2,
      checks: [{ ...workspace.revision.checks[0], query: 'updated_metric', threshold: 220 }],
    };
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([]);
    mocks.reviseInspectionJob
      .mockRejectedValueOnce(new InspectionApiError('Inspection state conflict', 409))
      .mockResolvedValueOnce({
        job: { ...job, currentRevision: 2 },
        revision: revisionTwo,
      });

    await renderPage();
    const queryInput = container.querySelector<HTMLTextAreaElement>('[data-testid="revision-query"]');
    const thresholdInput = container.querySelector<HTMLInputElement>('[data-testid="revision-threshold"]');
    const submit = container.querySelector<HTMLButtonElement>('[data-testid="revise-job-submit"]');
    if (!queryInput || !thresholdInput || !submit) throw new Error('expected revision editor fields');

    await changeTextArea(queryInput, 'updated_metric');
    await changeInput(thresholdInput, '220');
    await act(async () => {
      submit.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.textContent).toContain('Inspection state conflict');
    expect(container.textContent).not.toContain('连接中断');
    expect(submit.disabled).toBe(false);

    await act(async () => {
      submit.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mocks.reviseInspectionJob).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('当前版本 2');
    expect(container.textContent).not.toContain('Inspection state conflict');
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

  it('loads current revision detail so a persisted Job without Cases can be revised', async () => {
    const revisionTwo = {
      ...workspace.revision,
      id: 'revision-2',
      revision: 2,
      checks: [{ ...workspace.revision.checks[0], query: 'current_metric', threshold: 230 }],
    };
    const jobAtRevisionTwo = { ...job, currentRevision: 2 };
    mocks.listInspectionJobs.mockResolvedValueOnce([jobAtRevisionTwo]);
    mocks.listInspectionCases.mockResolvedValueOnce([]);
    mocks.fetchInspectionJob.mockResolvedValueOnce({ job: jobAtRevisionTwo, revision: revisionTwo });
    mocks.reviseInspectionJob.mockResolvedValueOnce({
      job: { ...jobAtRevisionTwo, currentRevision: 3 },
      revision: { ...revisionTwo, id: 'revision-3', revision: 3 },
    });

    await renderPage();
    const queryInput = container.querySelector<HTMLTextAreaElement>('[data-testid="revision-query"]');
    const thresholdInput = container.querySelector<HTMLInputElement>('[data-testid="revision-threshold"]');
    if (!queryInput || !thresholdInput) throw new Error('expected revision editor fields without a Case');
    expect(queryInput.value).toBe('current_metric');
    expect(thresholdInput.value).toBe('230');

    await changeTextArea(queryInput, 'next_metric');
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="revise-job-submit"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mocks.reviseInspectionJob).toHaveBeenCalledWith(job.id, {
      expectedRevision: 2,
      checks: [{ ...revisionTwo.checks[0], query: 'next_metric' }],
    });
    expect(container.textContent).toContain('当前版本 3');
  });

  it('edits the current Job revision without replacing an old Case workspace revision', async () => {
    const revisionTwo = {
      ...workspace.revision,
      id: 'revision-2',
      revision: 2,
      checks: [{ ...workspace.revision.checks[0], query: 'current_metric', threshold: 230 }],
    };
    const jobAtRevisionTwo = { ...job, currentRevision: 2 };
    mocks.listInspectionJobs.mockResolvedValueOnce([jobAtRevisionTwo]);
    mocks.listInspectionCases.mockResolvedValueOnce([inspectionCase]);
    mocks.fetchInspectionJob.mockResolvedValueOnce({ job: jobAtRevisionTwo, revision: revisionTwo });
    mocks.fetchInspectionCase.mockResolvedValueOnce({
      ...workspace,
      job: jobAtRevisionTwo,
      report: null,
    });

    await renderPage();

    expect(container.querySelector<HTMLTextAreaElement>('[data-testid="revision-query"]')?.value).toBe(
      'current_metric',
    );
    expect(container.textContent).toContain('当前版本 2');
    expect(container.textContent).toContain('当前巡检绑定版本 1');
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
