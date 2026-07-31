import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createInspectionCase: vi.fn(),
  createInspectionJob: vi.fn(),
  fetchInspectionCase: vi.fn(),
  fetchInspectionJob: vi.fn(),
  listInspectionCases: vi.fn(),
  listInspectionJobs: vi.fn(),
  listInspectionSources: vi.fn(),
  recordInspectionDecision: vi.fn(),
  reviseInspectionJob: vi.fn(),
  startInspectionRun: vi.fn(),
}));

vi.mock('@/utils/inspection-api', () => mocks);

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

  it('fails closed when the connected API is unavailable', async () => {
    mocks.listInspectionSources.mockRejectedValueOnce(new Error('offline'));
    mocks.listInspectionJobs.mockRejectedValueOnce(new Error('offline'));

    await renderPage();

    expect(container.textContent).toContain('连接中断');
    expect(container.textContent).not.toContain('Payments release inspection');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="create-job-submit"]')?.disabled).toBe(true);
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
    expect(container.textContent).toContain('kind: replay');
    expect(container.textContent).toContain('scope: acceptance');
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
    expect(container.textContent).toContain('当前 rev 2');
    expect(container.textContent).toContain('Case 绑定 rev 1');
    expect(container.querySelector('[data-testid="case-pill"]')?.textContent).toContain('CHG-42');
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
    expect(container.textContent).toContain('当前 rev 3');
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
    expect(container.textContent).toContain('当前 rev 2');
    expect(container.textContent).toContain('Case 绑定 rev 1');
  });

  it('renders persisted run provenance verbatim after reload', async () => {
    mocks.listInspectionJobs.mockResolvedValueOnce([job]);
    mocks.listInspectionCases.mockResolvedValueOnce([inspectionCase]);
    mocks.fetchInspectionCase.mockResolvedValueOnce(workspace);

    await renderPage();

    expect(container.textContent).toContain('Payments release inspection');
    expect(container.textContent).toContain('replay-acceptance');
    expect(container.textContent).toContain('2026-07-31T08:01:30.000Z');
    expect(container.textContent).toContain(`sha256:${'a'.repeat(64)}`);
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
});
