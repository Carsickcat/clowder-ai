import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createGitHubRepositoryValidator,
  GitHubRepositoryValidationUnavailableError,
} from '../dist/infrastructure/github/GitHubRepositoryValidator.js';

function response(status, statusText = 'mock status') {
  return { status, statusText, ok: status >= 200 && status < 300 };
}

describe('GitHubRepositoryValidator', () => {
  test('validates an accessible repository through GitHub REST without gh CLI', async () => {
    let received;
    const validateRepository = createGitHubRepositoryValidator({
      token: 'test-token',
      fetchImpl: async (url, init) => {
        received = { url, init };
        return response(200, 'OK');
      },
    });

    assert.equal(await validateRepository('octo-org/hello-world'), true);
    assert.equal(received.url, 'https://api.github.com/repos/octo-org/hello-world');
    assert.equal(received.init.headers.Accept, 'application/vnd.github+json');
    assert.equal(received.init.headers.Authorization, 'Bearer test-token');
    assert.equal(received.init.headers['User-Agent'], 'CatCafe-PR-Tracking/1.0');
    assert.ok(received.init.signal instanceof AbortSignal);
  });

  test('returns false only when GitHub reports the repository is not found', async () => {
    const validateRepository = createGitHubRepositoryValidator({
      fetchImpl: async () => response(404, 'Not Found'),
    });

    assert.equal(await validateRepository('missing-owner/missing-repo'), false);
  });

  test('fails closed for authentication and rate-limit responses', async () => {
    for (const status of [401, 403, 429]) {
      const validateRepository = createGitHubRepositoryValidator({
        fetchImpl: async () => response(status, 'unavailable'),
      });

      await assert.rejects(
        validateRepository('octo-org/private-repo'),
        (error) =>
          error instanceof GitHubRepositoryValidationUnavailableError &&
          error.message === `GitHub repository validation failed with HTTP ${status}`,
      );
    }
  });

  test('propagates transport failures as unavailable instead of treating them as missing repositories', async () => {
    const validateRepository = createGitHubRepositoryValidator({
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    });

    await assert.rejects(validateRepository('octo-org/hello-world'), /connect ECONNREFUSED/);
  });
});
