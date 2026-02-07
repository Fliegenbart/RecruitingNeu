import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreDealProbability, ghostRisk } from '../src/server.mjs';

test('Deal-Score liegt im Bereich 0-100', () => {
  const entry = { candidate_id: 'cand1', job_id: 'job1', avg_response_time_hours: 12 };
  const result = scoreDealProbability(entry);
  assert.ok(result.score >= 0 && result.score <= 100);
});

test('Ghosting-Risk liegt im Bereich 0-100', () => {
  const risk = ghostRisk({ candidate_id: 'cand1', job_id: 'job1', last_response_at: new Date().toISOString(), avg_response_time_hours: 10 });
  assert.ok(risk >= 0 && risk <= 100);
});
