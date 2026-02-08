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

test('Serverless Triage Demo liefert Job-Familien', async () => {
  const req = new MockReq('GET', '/api/triage/demo');
  const res = new MockRes();

  await handler(req, res);
  const json = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.data.jobFamilies));
  assert.ok(json.data.jobFamilies.some((j) => j.id === 'software'));
  assert.ok(Array.isArray(json.data.applications));
});

test('Serverless Triage Analyze liefert Scores + Must-have', async () => {
  const req = new MockReq('POST', '/api/triage/analyze', {
    jobFamily: 'sales',
    applicationText: 'Ich arbeite in Salesforce. Quota 120% (1.2M EUR ARR). Pipeline via Outbound.'
  });
  const res = new MockRes();

  await handler(req, res);
  const json = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(json.success, true);
  assert.ok(typeof json.data.scores.overall === 'number');
  assert.ok(typeof json.data.mustHave.passed === 'boolean');
  assert.ok(Array.isArray(json.data.followUps));
  assert.ok(Array.isArray(json.data.claims));
});

test('Serverless Triage Cluster erkennt Duplikate', async () => {
  const apps = [
    { id: 'a1', text: 'Hiermit bewerbe ich mich. Ich bin motiviert und teamplayer.' },
    { id: 'a2', text: 'Hiermit bewerbe ich mich. Ich bin motiviert und teamplayer.' },
    { id: 'a3', text: 'TypeScript Node.js React Postgres. 2024: Latenz 400ms -> 180ms.' }
  ];
  const req = new MockReq('POST', '/api/triage/cluster', { applications: apps, threshold: 0.8, shingleSize: 3 });
  const res = new MockRes();

  await handler(req, res);
  const json = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.data.clusters));
  assert.ok(json.data.clusters.some((c) => c.items.length >= 2));
});

test('Serverless Pilot Context liefert Tenants/Teams/Jobs', async () => {
  const req = new MockReq('GET', '/api/pilot/context');
  const res = new MockRes();

  await handler(req, res);
  const json = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.data.tenants));
  assert.ok(Array.isArray(json.data.teams));
  assert.ok(Array.isArray(json.data.jobs));
  assert.ok(json.data.tenants.length >= 1);
  assert.ok(json.data.jobs.length >= 1);
});

test('Serverless Pilot Seed erzeugt Bewerbungen und listet sie', async () => {
  const ctxReq = new MockReq('GET', '/api/pilot/context');
  const ctxRes = new MockRes();
  await handler(ctxReq, ctxRes);
  const ctx = JSON.parse(ctxRes.body).data;

  const tenantId = ctx.tenants[0].id;
  const jobId = ctx.jobs.find((j) => j.tenantId === tenantId)?.id;
  assert.ok(jobId);

  const seedReq = new MockReq('POST', '/api/pilot/seed', { tenantId, jobId, count: 5 });
  const seedRes = new MockRes();
  await handler(seedReq, seedRes);
  const seed = JSON.parse(seedRes.body);
  assert.equal(seedRes.statusCode, 200);
  assert.equal(seed.success, true);
  assert.equal(seed.data.created, 5);

  // Note: clustering can collapse duplicates; use collapsedClusters=0 to assert raw total.
  const listReq = new MockReq('GET', `/api/pilot/applications?tenantId=${tenantId}&jobId=${jobId}&limit=10&page=1&collapsedClusters=0`);
  const listRes = new MockRes();
  await handler(listReq, listRes);
  const list = JSON.parse(listRes.body);

  assert.equal(listRes.statusCode, 200);
  assert.equal(list.success, true);
  assert.ok(typeof list.data.total === 'number');
  assert.ok(Array.isArray(list.data.items));
  assert.ok(list.data.total >= 5);
});
