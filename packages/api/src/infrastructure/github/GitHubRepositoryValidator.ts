interface GitHubResponse {
  readonly status: number;
  readonly statusText: string;
}

export interface GitHubRepositoryValidatorOptions {
  readonly fetchImpl?: (
    url: string,
    init: { readonly headers: Record<string, string>; readonly signal: AbortSignal },
  ) => Promise<GitHubResponse>;
  readonly token?: string | undefined;
  readonly timeoutMs?: number | undefined;
}

export class GitHubRepositoryValidationUnavailableError extends Error {
  constructor(status: number) {
    super(`GitHub repository validation failed with HTTP ${status}`);
    this.name = 'GitHubRepositoryValidationUnavailableError';
  }
}

function repositoryUrl(repoFullName: string): string {
  const [owner, repository, ...rest] = repoFullName.split('/');
  if (!owner || !repository || rest.length > 0) {
    throw new TypeError('repoFullName must use owner/repository format');
  }
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
}

/**
 * Checks repository reachability without depending on a locally installed GitHub CLI.
 *
 * A GitHub 404 is the only response that becomes `false`; auth, rate-limit, and
 * transport failures remain errors so the callback route can return its 503 boundary.
 */
export function createGitHubRepositoryValidator(options: GitHubRepositoryValidatorOptions = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  return async (repoFullName: string): Promise<boolean> => {
    // GITHUB_MCP_PAT is runtime-editable through the connector secret updater,
    // so resolve it per validation rather than freezing startup credentials.
    const token = options.token ?? process.env.GITHUB_MCP_PAT ?? process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'CatCafe-PR-Tracking/1.0',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetchImpl(repositoryUrl(repoFullName), {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 404) return false;
    if (response.status >= 200 && response.status < 300) return true;
    throw new GitHubRepositoryValidationUnavailableError(response.status);
  };
}
