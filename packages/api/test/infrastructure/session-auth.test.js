/**
 * F156 Phase D-1: HTTP Session Authentication
 *
 * P1-1 fix: session plugin only validates existing cookies, never auto-mints.
 * Session establishment happens exclusively via GET /api/session.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';

const { SessionStore: LocalSessionStore } = await import('../../dist/infrastructure/session-auth.js');
const { assertTrustedTailscaleServeConfig, sessionAuthPlugin, sessionRoute } = await import(
  '../../dist/infrastructure/session-auth.js'
);

describe('trusted Tailscale Serve deployment invariants', () => {
  it('rejects trusted proxy headers when the API listens beyond loopback', () => {
    assert.throws(
      () =>
        assertTrustedTailscaleServeConfig({
          CAT_CAFE_TRUST_TAILSCALE_HEADERS: '1',
          CAT_CAFE_REMOTE_OWNER_LOGIN: 'owner@example.com',
          FRONTEND_URL: 'https://ragdoll.example.ts.net',
          API_SERVER_HOST: '0.0.0.0',
        }),
      /loopback/i,
    );
  });

  it('requires the exact HTTPS frontend origin and remote owner login', () => {
    const base = {
      CAT_CAFE_TRUST_TAILSCALE_HEADERS: 'true',
      API_SERVER_HOST: '127.0.0.1',
      CAT_CAFE_REMOTE_OWNER_LOGIN: 'owner@example.com',
    };
    assert.throws(() => assertTrustedTailscaleServeConfig(base), /FRONTEND_URL/);
    assert.throws(
      () => assertTrustedTailscaleServeConfig({ ...base, FRONTEND_URL: 'http://ragdoll.example.ts.net' }),
      /HTTPS origin/,
    );
    assert.throws(
      () =>
        assertTrustedTailscaleServeConfig({
          ...base,
          FRONTEND_URL: 'https://ragdoll.example.ts.net/path',
        }),
      /HTTPS origin/,
    );
    assert.throws(
      () =>
        assertTrustedTailscaleServeConfig({
          ...base,
          FRONTEND_URL: 'https://ragdoll.example.ts.net',
          CAT_CAFE_REMOTE_OWNER_LOGIN: '',
        }),
      /OWNER_LOGIN/,
    );
  });

  it('accepts a loopback API listener with an exact HTTPS frontend origin', () => {
    assert.doesNotThrow(() =>
      assertTrustedTailscaleServeConfig({
        CAT_CAFE_TRUST_TAILSCALE_HEADERS: '1',
        CAT_CAFE_REMOTE_OWNER_LOGIN: 'owner@example.com',
        FRONTEND_URL: 'https://ragdoll.example.ts.net/',
        API_SERVER_HOST: '::1',
      }),
    );
  });
});

describe('F156 D-1: LocalSessionStore', () => {
  it('create returns a token and stores userId', () => {
    const store = new LocalSessionStore();
    const token = store.create('alice');
    assert.ok(typeof token === 'string');
    assert.ok(token.length >= 32, 'token must be at least 32 chars');
    assert.equal(store.validate(token), 'alice');
  });

  it('validate returns null for unknown token', () => {
    const store = new LocalSessionStore();
    assert.equal(store.validate('bogus'), null);
  });

  it('validate returns null for empty string', () => {
    const store = new LocalSessionStore();
    assert.equal(store.validate(''), null);
  });

  it('stores authentication principal separately from the persisted data user', () => {
    const store = new LocalSessionStore();
    const principal = {
      dataUserId: 'default-user',
      authSubject: 'tailscale:owner@example.com',
      authMethod: 'tailscale-serve',
      roles: ['owner'],
    };
    const token = store.createPrincipal(principal);

    assert.equal(store.validate(token), 'default-user', 'legacy data lookup must keep using default-user');
    assert.deepEqual(store.validatePrincipal(token), principal);
  });
});

describe('F156 D-1: Session Auth Plugin — no auto-mint', () => {
  let app;

  before(async () => {
    app = Fastify();
    await app.register(cookie);
    await app.register(sessionAuthPlugin);
    await app.register(sessionRoute);
    app.get('/api/test', async (request) => ({
      sessionUserId: request.sessionUserId ?? null,
      sessionPrincipal: request.sessionPrincipal ?? null,
    }));
    await app.ready();
  });

  after(async () => {
    if (app) await app.close();
  });

  it('request without cookie gets NO sessionUserId (trust boundary)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/test' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.sessionUserId, null, 'anonymous request must not auto-get identity');
    assert.ok(!res.headers['set-cookie'], 'must NOT auto-issue cookie on business route');
  });

  it('invalid cookie gets NO sessionUserId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/test',
      headers: { cookie: 'cat_cafe_session=invalid-garbage' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.sessionUserId, null, 'invalid cookie must not produce identity');
  });
});

describe('F156 D-1: SessionStore eviction', () => {
  it('evicts oldest token when capacity is exceeded', () => {
    const store = new LocalSessionStore({ maxSessions: 3 });
    const t1 = store.create('user-1');
    const t2 = store.create('user-2');
    const t3 = store.create('user-3');
    assert.equal(store.validate(t1), 'user-1');

    const t4 = store.create('user-4');
    assert.equal(store.validate(t1), null, 'oldest token should be evicted');
    assert.equal(store.validate(t2), 'user-2');
    assert.equal(store.validate(t3), 'user-3');
    assert.equal(store.validate(t4), 'user-4');
  });
});

describe('F156 D-1: GET /api/session — session establishment', () => {
  let app;

  before(async () => {
    app = Fastify();
    await app.register(cookie);
    await app.register(sessionAuthPlugin);
    await app.register(sessionRoute);
    app.get('/api/test', async (request) => ({
      sessionUserId: request.sessionUserId ?? null,
      sessionPrincipal: request.sessionPrincipal ?? null,
    }));
    await app.ready();
  });

  after(async () => {
    if (app) await app.close();
  });

  it('creates session and sets HttpOnly/SameSite=Strict cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/session' });
    assert.equal(res.statusCode, 200);
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'must set cookie on session establishment');
    assert.ok(setCookie.includes('cat_cafe_session='), 'cookie name');
    assert.ok(setCookie.includes('HttpOnly'), 'must be HttpOnly');
    assert.ok(setCookie.includes('SameSite=Strict'), 'must be SameSite=Strict');
    assert.ok(setCookie.includes('Path=/'), 'must have Path=/');
    const body = JSON.parse(res.body);
    assert.equal(body.userId, 'default-user');
  });

  it('sets Secure flag when request has X-Forwarded-Proto: https', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { 'x-forwarded-proto': 'https' },
    });
    assert.equal(res.statusCode, 200);
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'must set cookie');
    assert.ok(setCookie.includes('Secure'), 'must have Secure flag behind HTTPS proxy');
  });

  it('sets Secure flag for chained proxy header "https, http"', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { 'x-forwarded-proto': 'https, http' },
    });
    assert.equal(res.statusCode, 200);
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'must set cookie');
    assert.ok(setCookie.includes('Secure'), 'chained proxy starting with https must set Secure');
  });

  it('handles array-valued X-Forwarded-Proto without crashing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { 'x-forwarded-proto': ['https', 'http'] },
    });
    assert.equal(res.statusCode, 200);
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'must set cookie');
    assert.ok(setCookie.includes('Secure'), 'array starting with https must set Secure');
  });

  it('omits Secure flag on plain HTTP localhost (dev mode)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/session' });
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'must set cookie');
    assert.ok(!setCookie.includes('Secure'), 'must NOT have Secure on plain HTTP');
  });

  it('subsequent request with established cookie gets sessionUserId', async () => {
    const pair = await app.inject({ method: 'GET', url: '/api/session' });
    const cookieHeader = pair.headers['set-cookie'];
    const token = cookieHeader.match(/cat_cafe_session=([^;]+)/)?.[1];
    assert.ok(token);

    const res = await app.inject({
      method: 'GET',
      url: '/api/test',
      headers: { cookie: `cat_cafe_session=${token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.sessionUserId, 'default-user');
  });

  it('returns existing session if cookie already valid', async () => {
    const pair = await app.inject({ method: 'GET', url: '/api/session' });
    const token = pair.headers['set-cookie'].match(/cat_cafe_session=([^;]+)/)?.[1];

    const res = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: `cat_cafe_session=${token}` },
    });
    assert.equal(res.statusCode, 200);
    assert.ok(!res.headers['set-cookie'], 'should not re-issue cookie for valid session');
    const body = JSON.parse(res.body);
    assert.equal(body.userId, 'default-user');
  });

  it('mints a remote owner session without changing the persisted data user', async () => {
    const previousTrust = process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS;
    const previousOwner = process.env.CAT_CAFE_REMOTE_OWNER_LOGIN;
    process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS = '1';
    process.env.CAT_CAFE_REMOTE_OWNER_LOGIN = 'owner@example.com';
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/session',
        headers: {
          host: 'ragdoll.tailnet.ts.net',
          origin: 'https://ragdoll.tailnet.ts.net',
          'x-forwarded-proto': 'https',
          'tailscale-user-login': 'OWNER@example.com',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.userId, 'default-user');
      assert.equal(body.principal.authSubject, 'tailscale:owner@example.com');
      assert.equal(body.principal.authMethod, 'tailscale-serve');
      assert.deepEqual(body.principal.roles, ['owner']);

      const token = res.headers['set-cookie'].match(/cat_cafe_session=([^;]+)/)?.[1];
      const authenticated = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { cookie: `cat_cafe_session=${token}` },
      });
      const authenticatedBody = JSON.parse(authenticated.body);
      assert.equal(authenticatedBody.sessionUserId, 'default-user');
      assert.equal(authenticatedBody.sessionPrincipal.authSubject, 'tailscale:owner@example.com');
    } finally {
      if (previousTrust === undefined) delete process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS;
      else process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS = previousTrust;
      if (previousOwner === undefined) delete process.env.CAT_CAFE_REMOTE_OWNER_LOGIN;
      else process.env.CAT_CAFE_REMOTE_OWNER_LOGIN = previousOwner;
    }
  });

  it('rejects an untrusted or unexpected remote identity instead of falling back to local owner', async () => {
    const previousTrust = process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS;
    const previousOwner = process.env.CAT_CAFE_REMOTE_OWNER_LOGIN;
    process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS = '1';
    process.env.CAT_CAFE_REMOTE_OWNER_LOGIN = 'owner@example.com';
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/session',
        headers: {
          host: 'ragdoll.tailnet.ts.net',
          origin: 'https://ragdoll.tailnet.ts.net',
          'x-forwarded-proto': 'https',
          'tailscale-user-login': 'attacker@example.com',
        },
      });
      assert.equal(res.statusCode, 403);
      assert.ok(!res.headers['set-cookie']);
    } finally {
      if (previousTrust === undefined) delete process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS;
      else process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS = previousTrust;
      if (previousOwner === undefined) delete process.env.CAT_CAFE_REMOTE_OWNER_LOGIN;
      else process.env.CAT_CAFE_REMOTE_OWNER_LOGIN = previousOwner;
    }
  });

  it('rejects forged trusted proxy headers from a non-loopback peer', async () => {
    const previousTrust = process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS;
    const previousOwner = process.env.CAT_CAFE_REMOTE_OWNER_LOGIN;
    process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS = '1';
    process.env.CAT_CAFE_REMOTE_OWNER_LOGIN = 'owner@example.com';
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/session',
        remoteAddress: '100.64.0.42',
        headers: {
          host: 'ragdoll.example.ts.net',
          origin: 'https://ragdoll.example.ts.net',
          'x-forwarded-proto': 'https',
          'tailscale-user-login': 'owner@example.com',
        },
      });
      assert.equal(res.statusCode, 403);
      assert.ok(!res.headers['set-cookie']);
    } finally {
      if (previousTrust === undefined) delete process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS;
      else process.env.CAT_CAFE_TRUST_TAILSCALE_HEADERS = previousTrust;
      if (previousOwner === undefined) delete process.env.CAT_CAFE_REMOTE_OWNER_LOGIN;
      else process.env.CAT_CAFE_REMOTE_OWNER_LOGIN = previousOwner;
    }
  });

  it('rejects non-local session establishment when the trusted identity header is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        host: 'ragdoll.tailnet.ts.net',
        origin: 'https://ragdoll.tailnet.ts.net',
        'x-forwarded-proto': 'https',
      },
    });
    assert.equal(res.statusCode, 403);
    assert.ok(!res.headers['set-cookie']);
  });
});
