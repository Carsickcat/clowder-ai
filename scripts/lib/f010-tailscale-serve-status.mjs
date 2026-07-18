export const F010_REQUIRED_SERVE_MAPPINGS = [
  {
    path: '/',
    match: /^\|-- \/ +proxy http:\/\/127\.0\.0\.1:4310\r?$/m,
    repair: ['serve', '--bg', '--https=8443', 'http://127.0.0.1:4310'],
  },
  {
    path: '/api',
    match: /^\|-- \/api +proxy http:\/\/127\.0\.0\.1:4311\/api\r?$/m,
    repair: ['serve', '--bg', '--https=8443/api', 'http://127.0.0.1:4311/api'],
  },
  {
    path: '/socket.io',
    match: /^\|-- \/socket\.io +proxy http:\/\/127\.0\.0\.1:4311\/socket\.io\r?$/m,
    repair: ['serve', '--bg', '--https=8443/socket.io', 'http://127.0.0.1:4311/socket.io'],
  },
];

function findHttpsPortBlock(status, port) {
  const headers = [...status.matchAll(/^https:\/\/[^\r\n]+ \(tailnet only\)\r?$/gm)];
  for (const [index, header] of headers.entries()) {
    const origin = header[0].replace(/ \(tailnet only\)\r?$/, '');
    if (new URL(origin).port !== String(port)) continue;
    const start = header.index ?? 0;
    const end = headers[index + 1]?.index ?? status.length;
    return status.slice(start, end);
  }
  return '';
}

export function findMissingF010ServeMappings(status) {
  const block8443 = findHttpsPortBlock(status, 8443);
  return F010_REQUIRED_SERVE_MAPPINGS.filter((entry) => !entry.match.test(block8443));
}
