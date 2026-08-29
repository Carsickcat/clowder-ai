import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInspectionCase,
  fetchInspectionCase,
  fetchInspectionJob,
  generateInspectionCandidateSet,
  listInspectionCandidateSets,
  listInspectionJobs,
  materializeInspectionCandidateSet,
  startInspectionRun,
} from '../inspection-api';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mocks.apiFetch(...args),
}));

describe('inspection-api', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it('loads only server-persisted jobs', async () => {
    const jobs = [{ id: 'job-1', name: 'Persisted inspection' }];
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(jobs),
    });

    await expect(listInspectionJobs()).resolves.toEqual(jobs);
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/observability/inspection-jobs');
  });

  it('generates and reopens persisted candidate sets without browser-authored evidence', async () => {
    const input = {
      changeRef: 'CHG-23841',
      intent: 'inspect payments-router after CHG-23841',
    };
    mocks.apiFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'candidates-1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ id: 'candidates-1' }]) });

    await generateInspectionCandidateSet(input);
    await listInspectionCandidateSets();

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(1, '/api/observability/inspection-candidate-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(2, '/api/observability/inspection-candidate-sets');
    expect(JSON.stringify(mocks.apiFetch.mock.calls[0])).not.toMatch(
      /service|environment|connectorRef|changeId|version|observation|verdict|sourceUrl/,
    );
  });

  it('materializes a candidate selection and explicit required waivers', async () => {
    const input = {
      name: 'Payments route verification',
      selectedCandidateIds: ['latency'],
      waivers: [{ candidateId: 'availability', reason: 'Covered by external synthetic checks.' }],
    };
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ job: { id: 'job-1' }, revision: { id: 'revision-1' } }),
    });

    await materializeInspectionCandidateSet('candidate/set 1', input);

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/observability/inspection-candidate-sets/candidate%2Fset%201/materialize',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  });

  it('creates a case from server-owned job lineage only', async () => {
    const input = { jobId: 'job-1' };
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'case-1', jobId: 'job-1' }),
    });

    await createInspectionCase(input);

    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/observability/inspection-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    expect(JSON.stringify(mocks.apiFetch.mock.calls[0])).not.toMatch(/changeId|version/);
  });

  it('starts a run with purpose and idempotency only', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'run-1', verdict: 'passed' }),
    });

    await startInspectionRun('case-1', 'verification', 'stable-key-1');

    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/observability/inspection-cases/case-1/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'stable-key-1',
      },
      body: JSON.stringify({ purpose: 'verification' }),
    });
    expect(JSON.stringify(mocks.apiFetch.mock.calls[0])).not.toMatch(/verdict|observation|sourceUrl/);
  });

  it('loads the current immutable revision detail for a persisted job', async () => {
    const detail = {
      job: { id: 'job-1', currentRevision: 2 },
      revision: { id: 'revision-2', revision: 2 },
    };
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(detail),
    });

    await expect(fetchInspectionJob('job/with space')).resolves.toEqual(detail);
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/observability/inspection-jobs/job%2Fwith%20space');
  });

  it('surfaces API failure and never returns fixture fallback data', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'Inspection source unavailable' }),
    });

    await expect(fetchInspectionCase('case-1')).rejects.toMatchObject({
      name: 'InspectionApiError',
      message: 'Inspection source unavailable',
      status: 503,
    });
  });

  it('preserves bounded drift differences for an actionable conflict state', async () => {
    const details = {
      code: 'INSPECTION_PLANNING_DRIFT',
      differences: [{ source: 'topology', expectedHash: 'sha256:old', actualHash: 'sha256:new' }],
    };
    mocks.apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'Inspection planning facts changed', details }),
    });

    await expect(startInspectionRun('case-1', 'verification', 'stable-key-2')).rejects.toMatchObject({
      name: 'InspectionApiError',
      status: 409,
      details,
    });
  });
});
