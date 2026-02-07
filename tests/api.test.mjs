import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.mjs';

const start = () => new Promise(resolve => {
  const s = server.listen(0, () => resolve(s));
});

test('Dashboard KPI Endpoint liefert success=true', async () => {
  const s = await start();
  const port = s.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/dashboard/kpis/r1`);
  const body = await res.json();
  assert.equal(body.success, true);
  s.close();
});
