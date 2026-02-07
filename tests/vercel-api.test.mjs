import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import handler from '../api/[...route].mjs';

class MockReq extends EventEmitter {
  constructor(method, url, body = null) {
    super();
    this.method = method;
    this.url = url;
    process.nextTick(() => {
      if (body) this.emit('data', Buffer.from(JSON.stringify(body)));
      this.emit('end');
    });
  }
}

class MockRes {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = '';
  }
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  }
  end(chunk = '') {
    this.body += chunk;
  }
}

test('Serverless API liefert KPI-Daten mit success=true', async () => {
  const req = new MockReq('GET', '/api/dashboard/kpis/r1');
  const res = new MockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'application/json');

  const json = JSON.parse(res.body);
  assert.equal(json.success, true);
  assert.ok(typeof json.data.activePipelineHealth === 'number');
});

test('Serverless Copilot endpoint verarbeitet POST Body', async () => {
  const req = new MockReq('POST', '/api/copilot/generate', { candidateId: 'cand1', jobId: 'job1' });
  const res = new MockRes();

  await handler(req, res);
  const json = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(json.success, true);
  assert.ok(json.data.direct.includes('Hallo'));
  assert.ok(typeof json.data.predicted_response_rate.advisory === 'number');
});
