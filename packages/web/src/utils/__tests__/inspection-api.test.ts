import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInspectionJob, fetchInspectionCase, listInspectionJobs, startInspectionRun } from '../inspection-api';

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

  it('creates a reusable versioned job with exact checks', async () => {
    const input = {
      name: 'Payments release',
      service: 'payments-router',
      environment: 'acceptance',
      connectorRef: 'replay-acceptance',
      checks: [
        {
          id: 'latency',
          name: 'p95 latency',
          query: 'safe_metric',
          operator: 'lte' as const,
          threshold: 250,
          unit: 'ms',
          maxAgeMs: 120_000,
        },
      ],
    };
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ job: { id: 'job-1' }, revision: { revision: 1 } }),
    });

    await createInspectionJob(input);

    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/observability/inspection-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
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

  it('surfaces API failure and never returns fixture fallback data', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'Inspection source unavailable' }),
    });

    await expect(fetchInspectionCase('case-1')).rejects.toThrow('Inspection source unavailable');
  });
});
