import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findMissingF010ServeMappings } from '../../scripts/lib/f010-tailscale-serve-status.mjs';

const ROOT_8443 = `https://desktop.example.ts.net:8443 (tailnet only)
|-- / proxy http://127.0.0.1:4310`;

describe('F010 Tailscale serve status parsing', () => {
  it('does not borrow required routes from a different HTTPS listener', () => {
    const status = `${ROOT_8443}

https://desktop.example.ts.net:8444 (tailnet only)
|-- /api proxy http://127.0.0.1:4311/api
|-- /socket.io proxy http://127.0.0.1:4311/socket.io
`;

    assert.deepEqual(
      findMissingF010ServeMappings(status).map((entry) => entry.path),
      ['/api', '/socket.io'],
    );
  });

  it('accepts all three routes when they live inside the 8443 block', () => {
    const status = `${ROOT_8443}
|-- /api proxy http://127.0.0.1:4311/api
|-- /socket.io proxy http://127.0.0.1:4311/socket.io

https://desktop.example.ts.net:8444 (tailnet only)
|-- / proxy http://127.0.0.1:4311
`;

    assert.deepEqual(findMissingF010ServeMappings(status), []);
  });
});
