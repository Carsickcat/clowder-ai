import { randomBytes } from 'node:crypto';
import type {} from '@fastify/cookie';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { isLoopbackAddress, isTrustedLocalApiRequest } from '../utils/loopback-request.js';

export const SESSION_COOKIE_NAME = 'cat_cafe_session';
const TOKEN_BYTES = 32;
const DATA_USER_ID = 'default-user';

export type SessionRole = 'owner';
export type SessionAuthMethod = 'local' | 'tailscale-serve';

/**
 * Authentication identity is deliberately separate from the persisted data
 * partition. Existing Clowder installs store threads/messages/tasks under
 * `default-user`; changing that key during remote access would hide history and
 * split connector traffic into a second tenant.
 */
export interface SessionPrincipal {
  dataUserId: string;
  authSubject: string;
  authMethod: SessionAuthMethod;
  roles: SessionRole[];
}

declare module 'fastify' {
  interface FastifyRequest {
    sessionUserId?: string;
    sessionPrincipal?: SessionPrincipal;
  }
}

const DEFAULT_MAX_SESSIONS = 10_000;

export class SessionStore {
  private sessions = new Map<string, SessionPrincipal>();
  private maxSessions: number;

  constructor(opts?: { maxSessions?: number }) {
    this.maxSessions = opts?.maxSessions ?? DEFAULT_MAX_SESSIONS;
  }

  create(userId: string): string {
    return this.createPrincipal({
      dataUserId: userId,
      authSubject: `local:${userId}`,
      authMethod: 'local',
      roles: ['owner'],
    });
  }

  createPrincipal(principal: SessionPrincipal): string {
    if (this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (oldest !== undefined) this.sessions.delete(oldest);
    }
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    this.sessions.set(token, {
      ...principal,
      roles: [...principal.roles],
    });
    return token;
  }

  validate(token: string): string | null {
    return this.validatePrincipal(token)?.dataUserId ?? null;
  }

  validatePrincipal(token: string): SessionPrincipal | null {
    if (!token) return null;
    const principal = this.sessions.get(token);
    return principal ? { ...principal, roles: [...principal.roles] } : null;
  }
}

const globalStore = new SessionStore();

export function validateSessionToken(token: string): SessionPrincipal | null {
  return globalStore.validatePrincipal(token);
}

/** Parse only our hex session token from a raw Cookie header. */
export function readSessionTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = pair.slice(separator + 1).trim();
    return /^[a-f0-9]{64}$/i.test(value) ? value : null;
  }
  return null;
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw?.split(',')[0]?.trim();
  return first || null;
}

function isEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

function isLoopbackListenerHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1' || normalized === '[::1]';
}

function isExactHttpsOrigin(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.pathname === '/' &&
      parsed.search === '' &&
      parsed.hash === ''
    );
  } catch {
    return false;
  }
}

/**
 * Trusted Tailscale identity headers are safe only when Tailscale Serve is the
 * sole network-facing listener. Fail startup instead of silently accepting a
 * deployment where clients can bypass the proxy and forge identity headers.
 */
export function assertTrustedTailscaleServeConfig(env: NodeJS.ProcessEnv): void {
  if (!isEnabled(env.CAT_CAFE_TRUST_TAILSCALE_HEADERS)) return;

  const apiHost = env.API_SERVER_HOST?.trim() || '127.0.0.1';
  if (!isLoopbackListenerHost(apiHost)) {
    throw new Error(
      'CAT_CAFE_TRUST_TAILSCALE_HEADERS requires API_SERVER_HOST to be a loopback listener (127.0.0.1, localhost, or ::1)',
    );
  }

  const frontendUrl = env.FRONTEND_URL?.trim();
  if (!frontendUrl) {
    throw new Error(
      'CAT_CAFE_TRUST_TAILSCALE_HEADERS requires FRONTEND_URL to be the exact Tailscale Serve HTTPS origin',
    );
  }
  if (!isExactHttpsOrigin(frontendUrl)) {
    throw new Error('FRONTEND_URL must be an exact HTTPS origin without credentials, path, query, or fragment');
  }

  if (!env.CAT_CAFE_REMOTE_OWNER_LOGIN?.trim()) {
    throw new Error('CAT_CAFE_TRUST_TAILSCALE_HEADERS requires CAT_CAFE_REMOTE_OWNER_LOGIN');
  }
}

function resolveSessionEstablishmentPrincipal(
  request: FastifyRequest,
): { ok: true; principal: SessionPrincipal } | { ok: false; error: string } {
  const tailscaleLogin = firstHeaderValue(request.headers['tailscale-user-login']);
  if (tailscaleLogin) {
    if (!isEnabled(process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS)) {
      return { ok: false, error: 'Tailscale identity headers are not enabled for this deployment' };
    }
    if (!isLoopbackAddress(request.ip)) {
      return { ok: false, error: 'Trusted identity proxy must connect over loopback' };
    }
    const forwardedProto = firstHeaderValue(request.headers['x-forwarded-proto'])?.toLowerCase();
    if (forwardedProto !== 'https') {
      return { ok: false, error: 'Trusted remote sessions require an HTTPS proxy' };
    }
    const configuredOwner = process.env.CAT_CAFE_REMOTE_OWNER_LOGIN?.trim().toLowerCase();
    if (!configuredOwner) {
      return { ok: false, error: 'Remote owner login is not configured' };
    }
    const normalizedLogin = tailscaleLogin.toLowerCase();
    if (normalizedLogin !== configuredOwner) {
      return { ok: false, error: 'Remote identity is not the configured owner' };
    }
    return {
      ok: true,
      principal: {
        dataUserId: DATA_USER_ID,
        authSubject: `tailscale:${normalizedLogin}`,
        authMethod: 'tailscale-serve',
        roles: ['owner'],
      },
    };
  }

  if (!isTrustedLocalApiRequest(request)) {
    return { ok: false, error: 'Session establishment requires localhost or a trusted identity proxy' };
  }

  return {
    ok: true,
    principal: {
      dataUserId: DATA_USER_ID,
      authSubject: `local:${DATA_USER_ID}`,
      authMethod: 'local',
      roles: ['owner'],
    },
  };
}

function publicPrincipal(principal: SessionPrincipal): SessionPrincipal {
  return { ...principal, roles: [...principal.roles] };
}

function sessionAuth(app: FastifyInstance, _opts: Record<string, never>, done: () => void) {
  app.decorateRequest('sessionUserId', undefined);
  app.decorateRequest('sessionPrincipal', undefined);

  app.addHook('onRequest', (request, _reply, next) => {
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (token) {
      const principal = globalStore.validatePrincipal(token);
      if (principal) {
        request.sessionPrincipal = principal;
        request.sessionUserId = principal.dataUserId;
      }
    }
    next();
  });

  done();
}

export const sessionAuthPlugin = fp(sessionAuth, {
  name: 'session-auth',
  dependencies: ['@fastify/cookie'],
});

function sessionRoutePlugin(app: FastifyInstance, _opts: Record<string, never>, done: () => void) {
  app.get('/api/session', async (request, reply) => {
    if (request.sessionPrincipal) {
      return {
        userId: request.sessionPrincipal.dataUserId,
        principal: publicPrincipal(request.sessionPrincipal),
      };
    }

    const establishment = resolveSessionEstablishmentPrincipal(request);
    if (!establishment.ok) {
      reply.code(403);
      return { error: establishment.error };
    }

    const fwdProto = firstHeaderValue(request.headers['x-forwarded-proto'])?.toLowerCase();
    const isSecure = request.protocol === 'https' || fwdProto === 'https';

    const token = globalStore.createPrincipal(establishment.principal);
    reply.setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      ...(isSecure ? { secure: true } : {}),
    });
    return {
      userId: establishment.principal.dataUserId,
      principal: publicPrincipal(establishment.principal),
    };
  });

  done();
}

export const sessionRoute = fp(sessionRoutePlugin, {
  name: 'session-route',
  dependencies: ['session-auth'],
});
