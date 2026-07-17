import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { requirePrivilegedRouteOwner } from '../dist/utils/privileged-route-guard.js';

const savedOwner = process.env.DEFAULT_OWNER_USER_ID;

function createReply() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

describe('privileged route SessionPrincipal authorization', () => {
  afterEach(() => {
    if (savedOwner === undefined) delete process.env.DEFAULT_OWNER_USER_ID;
    else process.env.DEFAULT_OWNER_USER_ID = savedOwner;
  });

  it('authorizes a remote owner role without changing default-user data ownership', () => {
    process.env.DEFAULT_OWNER_USER_ID = 'legacy-owner-id';
    const request = {
      ip: '100.64.0.10',
      headers: { 'x-forwarded-for': '100.64.0.10' },
      sessionUserId: 'default-user',
      sessionPrincipal: {
        dataUserId: 'default-user',
        authSubject: 'tailscale:owner@example.com',
        authMethod: 'tailscale-serve',
        roles: ['owner'],
      },
    };
    const reply = createReply();

    const result = requirePrivilegedRouteOwner(request, reply, { surface: 'Remote ops' });

    assert.deepEqual(result, { ok: true, userId: 'default-user' });
    assert.equal(reply.statusCode, 200);
  });

  it('rejects an authenticated principal without the owner role', () => {
    const request = {
      ip: '100.64.0.11',
      headers: { 'x-forwarded-for': '100.64.0.11' },
      sessionUserId: 'default-user',
      sessionPrincipal: {
        dataUserId: 'default-user',
        authSubject: 'tailscale:viewer@example.com',
        authMethod: 'tailscale-serve',
        roles: [],
      },
    };
    const reply = createReply();

    const result = requirePrivilegedRouteOwner(request, reply, { surface: 'Remote ops' });

    assert.equal(result.ok, false);
    assert.equal(reply.statusCode, 403);
  });
});
