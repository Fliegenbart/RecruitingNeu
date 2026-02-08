import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../src/server.mjs';

class MockRes {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = '';
  }
  writeHead(code, headers = {}) {
    this.statusCode = code;
    for (const [k, v] of Object.entries(headers)) this.headers[k.toLowerCase()] = v;
  }
  end(chunk = '') {
    this.body += chunk;
  }
}

test('Dashboard KPI Endpoint liefert success=true', async () => {
  const req = { method: 'GET', url: '/api/dashboard/kpis/r1', headers: { host: '127.0.0.1' } };
  const res = new MockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'application/json');

  const json = JSON.parse(res.body);
  assert.equal(json.success, true);
});
