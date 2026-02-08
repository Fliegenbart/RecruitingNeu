import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { analyzeApplication, analyzeApplicationWithLLM, clusterApplications, getTriageDemo } from './triage.mjs';
import { getStore, nowISO } from './store.mjs';
import { generateDemoApplication } from './demo.mjs';

const PORT = Number(process.env.PORT || 3000);

const seniorityOrder = ['junior', 'mid', 'senior', 'lead', 'executive'];
const stages = ['sourced', 'contacted', 'responded', 'screening', 'interview', 'offer', 'placed'];

const cities = ['Berlin', 'Hamburg', 'München', 'Frankfurt', 'Köln', 'Stuttgart'];
const roles = ['Software Engineer', 'Product Manager', 'Data Scientist', 'Sales Manager', 'DevOps Engineer'];
const regions = ['Bayern','Berlin','Brandenburg','Bremen','Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen','Sachsen-Anhalt','Schleswig-Holstein','Thüringen','Baden-Württemberg'];

const recruiters = [{ id: 'r1', name: 'Leonie Weber', email: 'leonie@recruiteriq.de', team: 'Tech' }];
const companies = [
  { id: 'c1', name: 'AlpenTech', industry: 'SaaS', size: 'startup', location_city: 'München' },
  { id: 'c2', name: 'RheinData', industry: 'Data', size: 'sme', location_city: 'Köln' },
  { id: 'c3', name: 'NordCloud', industry: 'Cloud', size: 'enterprise', location_city: 'Hamburg' },
  { id: 'c4', name: 'MainFin', industry: 'FinTech', size: 'sme', location_city: 'Frankfurt' },
  { id: 'c5', name: 'SpreeCommerce', industry: 'E-Commerce', size: 'startup', location_city: 'Berlin' }
];

const hiringManagers = Array.from({ length: 8 }, (_, i) => ({
  id: `hm${i + 1}`,
  name: ['Anna Schmitt','Tobias Krüger','Mila Köhler','Jonas Hartmann','Nina Vogt','Lars Winkler','Sofia Braun','David Jäger'][i],
  company_id: companies[i % companies.length].id,
  avg_feedback_speed_hours: 12 + i * 10,
  interview_consistency_score: 0.45 + (i % 5) * 0.1,
  offer_conversion_rate: 0.2 + (i % 4) * 0.15,
  overall_quality_score: 0,
  total_processes: 4 + i
}));

const candidates = Array.from({ length: 30 }, (_, i) => ({
  id: `cand${i + 1}`,
  name: ['Luca Fischer','Emma Richter','Noah Hofmann','Mia Becker','Paul Wagner','Lina Schulz','Elias Neumann','Hannah Wolf','Felix Klein','Clara Schreiber'][i % 10] + ` ${i+1}`,
  current_role: roles[i % roles.length],
  current_company: companies[(i + 2) % companies.length].name,
  seniority_level: seniorityOrder[i % seniorityOrder.length],
  location_city: cities[i % cities.length],
  location_region: regions[i % regions.length],
  salary_current: 45000 + (i % 10) * 7000,
  salary_expectation: 50000 + (i % 10) * 7500,
  notice_period_days: [30,60,90,120][i%4],
  remote_preference: ['onsite','hybrid','remote'][i%3],
  switch_motivation: 4 + (i % 7),
  skills: ['TypeScript','React','Node.js','Python','Salesforce','SQL','AWS'].slice(0, 3 + (i % 4)),
  profile_activity_score: 0.5 + (i % 5) * 0.1
}));

const jobs = Array.from({ length: 10 }, (_, i) => ({
  id: `job${i + 1}`,
  title: roles[i % roles.length],
  company_id: companies[i % companies.length].id,
  hiring_manager_id: hiringManagers[i % hiringManagers.length].id,
  salary_min: 55000 + (i % 5) * 10000,
  salary_max: 75000 + (i % 5) * 12000,
  location_city: cities[i % cities.length],
  remote_allowed: i % 2 === 0,
  required_skills: ['TypeScript','React','SQL'].slice(0, 2 + (i%2)),
  nice_to_have_skills: ['AWS','Kubernetes','Leadership'],
  seniority_level: seniorityOrder[(i + 1) % seniorityOrder.length],
  status: 'open'
}));

const now = Date.now();
const pipelineEntries = Array.from({ length: 50 }, (_, i) => ({
  id: `pe${i + 1}`,
  candidate_id: candidates[i % candidates.length].id,
  job_id: jobs[i % jobs.length].id,
  recruiter_id: recruiters[0].id,
  stage: [...stages, 'rejected', 'ghosted'][i % 9],
  deal_probability_score: 0,
  ghosting_risk_score: 0,
  compensation_fit_score: 0,
  last_message_at: new Date(now - (i % 14) * 86400000).toISOString(),
  last_response_at: new Date(now - (i % 10) * 86400000).toISOString(),
  avg_response_time_hours: 8 + (i % 6) * 7,
  notes: 'Kandidat im laufenden Prozess.'
}));

const tonalities = ['direct','advisory','visionary'];
const messages = Array.from({ length: 40 }, (_, i) => ({
  id: `msg${i + 1}`,
  pipeline_entry_id: pipelineEntries[i % pipelineEntries.length].id,
  direction: i % 3 === 0 ? 'inbound' : 'outbound',
  content: `Nachricht ${i + 1}: Interesse an nächstem Schritt.`,
  tonality: tonalities[i % tonalities.length],
  is_ai_generated: i % 2 === 0,
  response_received: i % 3 === 0,
  response_time_hours: 10 + (i % 8) * 4,
  sent_at: new Date(now - (i % 11) * 86400000).toISOString()
}));

const interviews = Array.from({ length: 15 }, (_, i) => ({
  id: `int${i + 1}`,
  pipeline_entry_id: pipelineEntries[i].id,
  interviewer_name: ['Anna','Ben','Carla','Dilan','Enes'][i % 5],
  interview_date: new Date(now - (i % 20) * 86400000).toISOString(),
  notes_raw: 'Technisch stark, Kommunikation solide, leichte Zweifel bei Leadership.',
  notes_summary: '',
  competency_scores: {},
  sentiment_score: 0,
  red_flags: []
}));

const silverMedals = Array.from({ length: 5 }, (_, i) => ({
  id: `sm${i + 1}`,
  candidate_id: candidates[i].id,
  original_job_id: jobs[i].id,
  rejection_reason: 'Stärkerer Cultural Fit eines anderen Kandidaten',
  shortlist_position: i + 1,
  reactivation_eligible: true,
  last_reactivated_at: null,
  created_at: new Date(now - i * 604800000).toISOString()
}));

const marketData = [];
regions.forEach((region, i) => {
  roles.forEach((role, j) => {
    marketData.push({
      id: `${region}-${role}`,
      role_category: role,
      region,
      city: cities[(i + j) % cities.length],
      talent_density: 30 + ((i + j) % 10) * 12,
      median_salary: 55000 + ((i + j) % 7) * 8000,
      salary_p25: 48000 + ((i + j) % 7) * 7000,
      salary_p75: 65000 + ((i + j) % 7) * 9000,
      open_positions_count: 40 + ((i + j) % 8) * 15,
      competition_index: 0.2 + ((i + j) % 7) * 0.1,
      remote_readiness_pct: 35 + ((i + j) % 6) * 9,
      switch_readiness_index: 0.35 + ((i + j) % 6) * 0.08,
      updated_at: new Date().toISOString()
    });
  });
});

const json = (res, code, payload) => {
  if (typeof res.writeHead === 'function') res.writeHead(code, { 'Content-Type': 'application/json' });
  else {
    res.statusCode = code;
    res.setHeader?.('Content-Type', 'application/json');
  }
  res.end(JSON.stringify(payload));
};

const scoreDealProbability = (entry) => {
  const cand = candidates.find((c) => c.id === entry.candidate_id);
  const job = jobs.find((j) => j.id === entry.job_id);
  if (!cand || !job) return { score: 0, breakdown: {} };
  const responseTimeFactor = Math.max(0, 1 - entry.avg_response_time_hours / 72);
  const switchMotivation = cand.switch_motivation / 10;
  const salaryFit = Math.max(0, Math.min(1, (job.salary_max - cand.salary_expectation + 20000) / 40000));
  const noticePeriodFit = cand.notice_period_days < 30 ? 1 : cand.notice_period_days <= 90 ? 0.6 : 0.3;
  const senGap = Math.abs(seniorityOrder.indexOf(cand.seniority_level) - seniorityOrder.indexOf(job.seniority_level));
  const seniorityMatch = senGap === 0 ? 1 : senGap === 1 ? 0.5 : 0.2;
  const competitionFactor = 1 - Math.min(1, (job.salary_min - cand.salary_current) / 50000 * -1);
  const breakdown = {
    response_time_factor: responseTimeFactor,
    switch_motivation: switchMotivation,
    salary_fit: salaryFit,
    notice_period_fit: noticePeriodFit,
    seniority_match: seniorityMatch,
    competition_factor: competitionFactor
  };
  const weighted = breakdown.response_time_factor * 0.2 + breakdown.switch_motivation * 0.2 + breakdown.salary_fit * 0.2 + breakdown.notice_period_fit * 0.1 + breakdown.seniority_match * 0.15 + breakdown.competition_factor * 0.15;
  return { score: Math.round(weighted * 100), breakdown };
};

const ghostRisk = (entry) => {
  const daysSinceResp = Math.floor((Date.now() - new Date(entry.last_response_at).getTime()) / 86400000);
  const cand = candidates.find(c => c.id === entry.candidate_id);
  const job = jobs.find(j => j.id === entry.job_id);
  const salaryGap = Math.max(0, (cand?.salary_expectation || 0) - (job?.salary_max || 0));
  const risk = Math.min(100, Math.round((Math.min(daysSinceResp, 10) / 10) * 30 + (entry.avg_response_time_hours / 72) * 25 + (salaryGap > 10000 ? 15 : 6) + 15 + ((hiringManagers.find(h => h.id === job?.hiring_manager_id)?.avg_feedback_speed_hours || 24) / 72) * 10));
  return risk;
};

pipelineEntries.forEach((entry) => {
  entry.deal_probability_score = scoreDealProbability(entry).score;
  entry.ghosting_risk_score = ghostRisk(entry);
});

const analytics = { direct: { sent: 9, responses: 4 }, advisory: { sent: 10, responses: 5 }, visionary: { sent: 7, responses: 2 } };

const serveStatic = async (res, path) => {
  try {
    // Keep static assets at repo root so Vercel (@vercel/static) and local server use the same files.
    // Only these 3 are served directly; all other paths fall back to index.html (SPA routing).
    const filePath = path === '/' ? 'index.html' : String(path || '').replace(/^\/+/, '');
    const content = await readFile(join(process.cwd(), filePath));
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
    const ct = types[extname(filePath)] || 'text/plain';
    if (typeof res.writeHead === 'function') res.writeHead(200, { 'Content-Type': ct });
    else {
      res.statusCode = 200;
      res.setHeader?.('Content-Type', ct);
    }
    res.end(content);
  } catch {
    if (typeof res.writeHead === 'function') res.writeHead(404);
    else res.statusCode = 404;
    res.end('Not found');
  }
};

const parseBody = async (req) => {
  // Works for both real IncomingMessage (async iterable) and EventEmitter mocks.
  if (req && typeof req[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
  }
  return await new Promise((resolve) => {
    let b = '';
    req?.on?.('data', (c) => { b += c; });
    req?.on?.('end', () => {
      try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); }
    });
    // If it's neither iterable nor an emitter, treat as empty.
    if (!req?.on) resolve({});
  });
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const getActorUserId = (req, url) => {
  const h = req?.headers || {};
  const fromHeader = h['x-user-id'] || h['X-User-Id'];
  const fromQuery = url?.searchParams?.get?.('userId');
  const id = fromHeader || fromQuery || null;
  return id ? String(id) : null;
};

const getActor = (store, { tenantId, req, url } = {}) => {
  const actorUserId = getActorUserId(req, url);
  if (!actorUserId) return { actorUserId: null, actor: null };
  const u = store?.db?.users?.[actorUserId] || null;
  if (u && tenantId && u.tenantId !== tenantId) return { actorUserId: null, actor: null };
  return { actorUserId, actor: u };
};

const requireRole = (actor, roles = []) => {
  if (!roles?.length) return true;
  if (!actor) return false;
  return roles.includes(String(actor.role));
};

const renderTemplate = (s, vars = {}) => {
  const str = String(s || '');
  return str.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = vars?.[k];
    return v === undefined || v === null ? '' : String(v);
  });
};

const listTenantContext = (store) => {
  const tenants = Object.values(store.db.tenants);
  const teams = Object.values(store.db.teams);
  const users = Object.values(store.db.users || {});
  const templates = Object.values(store.db.templates || {});
  const jobs = Object.values(store.db.jobs).map((j) => {
    const applicationCount = Object.values(store.db.applications).filter((a) => a.jobId === j.id).length;
    return { ...j, applicationCount };
  });
  return { tenants, teams, users, templates, jobs };
};

const parseCsv = (csvText) => {
  const s = String(csvText || '');
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
      continue;
    }
    if (ch === '"') {
      inQ = true;
      continue;
    }
    if (ch === ',') {
      row.push(cur);
      cur = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      continue;
    }
    if (ch === '\r') continue;
    cur += ch;
  }
  row.push(cur);
  rows.push(row);
  // trim empty trailing rows
  while (rows.length && rows[rows.length - 1].every((c) => String(c || '').trim() === '')) rows.pop();
  return rows;
};

const rowsToObjects = (rows) => {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const header = rows[0].map((h) => String(h || '').trim());
  const out = [];
  for (const r of rows.slice(1)) {
    if (!r || r.every((c) => String(c || '').trim() === '')) continue;
    const o = {};
    for (let i = 0; i < header.length; i++) o[header[i]] = r[i];
    out.push(o);
  }
  return out;
};

const analyzeForJob = async ({ job, text, useLLM = false } = {}) => {
  const opts = { jobFamily: job.family, applicationText: text, rubric: job.rubric || {} };
  return useLLM ? await analyzeApplicationWithLLM(opts) : analyzeApplication(opts);
};

const reanalyzeJob = async (store, { tenantId, jobId, useLLM = false } = {}) => {
  const job = store.db.jobs[jobId];
  if (!job || job.tenantId !== tenantId) throw new Error('job_not_found');
  const apps = Object.values(store.db.applications).filter((a) => a.tenantId === tenantId && a.jobId === jobId);
  for (const a of apps) {
    const analysis = await analyzeForJob({ job, text: a.text, useLLM });
    store.updateApplication(a.id, { analysis });
  }
  store.addEvent({ tenantId, jobId, action: 'job_reanalyzed', payload: { count: apps.length } });
  return { count: apps.length };
};

const clusterJob = (store, { tenantId, jobId } = {}) => {
  const job = store.db.jobs[jobId];
  if (!job || job.tenantId !== tenantId) throw new Error('job_not_found');

  const apps = Object.values(store.db.applications).filter((a) => a.tenantId === tenantId && a.jobId === jobId);
  const threshold = Number.isFinite(Number(job?.rubric?.clusterThreshold)) ? Number(job.rubric.clusterThreshold) : 0.82;
  const shingleSize = Number.isFinite(Number(job?.rubric?.shingleSize)) ? Number(job.rubric.shingleSize) : 3;

  const input = apps.map((a) => ({ id: a.id, text: a.text }));
  const clustered = clusterApplications({ applications: input, threshold, shingleSize });

  // Reset
  for (const a of apps) store.updateApplication(a.id, { clusterId: null, isClusterRepresentative: false });

  const clusters = (clustered.clusters || []).map((c) => {
    const cid = `${jobId}_${c.clusterId}`;
    for (const id of c.items) store.updateApplication(id, { clusterId: cid, isClusterRepresentative: id === c.representativeId });
    return { ...c, clusterId: cid };
  });

  const summary = { computedAt: nowISO(), threshold: clustered.threshold, shingleSize: clustered.shingleSize, clusters };
  store.setJobCluster(jobId, summary);
  store.addEvent({ tenantId, jobId, action: 'job_clustered', payload: { clusters: clusters.length } });

  return summary;
};

const handler = async (req, res) => {
  const host = req?.headers?.host || '127.0.0.1';
  const url = new URL(req.url, `http://${host}`);
  const path = url.pathname;

  if (path.startsWith('/api/')) {
    if (req.method === 'GET' && path === '/api/dashboard/kpis/r1') {
      const active = pipelineEntries.filter(p => ['sourced','contacted','responded','screening','interview','offer'].includes(p.stage));
      const health = Math.round(active.reduce((acc, p) => acc + p.deal_probability_score, 0) / active.length);
      const predicted = active.filter(p => p.deal_probability_score > 70 && ['interview','offer'].includes(p.stage)).length;
      const responseQuality = Math.round((messages.filter(m=>m.response_received).length / messages.length) * 50 + 50);
      return json(res, 200, { success: true, data: { activePipelineHealth: health, predictedPlacements30d: predicted, responseQualityIndex: responseQuality, revenueForecast90d: predicted * 18000 } });
    }
    if (req.method === 'GET' && path === '/api/dashboard/funnel/r1') {
      const data = stages.map((stage, i) => ({ stage, count: pipelineEntries.filter(p => p.stage === stage).length, conversion: i === 0 ? 1 : Number((pipelineEntries.filter(p => p.stage === stage).length / Math.max(1, pipelineEntries.filter(p => p.stage === stages[i - 1]).length)).toFixed(2)) }));
      return json(res, 200, { success: true, data });
    }
    if (req.method === 'GET' && path === '/api/dashboard/bottlenecks/r1') {
      const data = stages.map(stage => ({ stage, weeks: [1,2,3,4].map(w => ({ week: w, stuck: pipelineEntries.filter(p => p.stage === stage && Math.random() > 0.5).length })) }));
      return json(res, 200, { success: true, data });
    }
    if (req.method === 'GET' && path.startsWith('/api/pipeline/')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length === 3) {
        const jobId = parts[2];
        const data = pipelineEntries.filter(p => p.job_id === jobId).sort((a,b)=>b.deal_probability_score-a.deal_probability_score);
        return json(res, 200, { success: true, data });
      }
      if (parts.length === 4 && parts[3] === 'score') {
        const entry = pipelineEntries.find(p => p.id === parts[2]);
        if (!entry) return json(res, 404, { success: false, error: 'Eintrag nicht gefunden' });
        return json(res, 200, { success: true, data: scoreDealProbability(entry) });
      }
    }
    if (req.method === 'POST' && path.startsWith('/api/pipeline/') && path.endsWith('/recalc')) {
      const entryId = path.split('/')[3];
      const entry = pipelineEntries.find(p=>p.id===entryId);
      if (!entry) return json(res,404,{success:false,error:'Eintrag nicht gefunden'});
      entry.deal_probability_score = scoreDealProbability(entry).score;
      return json(res,200,{success:true,data:entry});
    }
    if (req.method === 'POST' && path === '/api/copilot/generate') {
      const body = await parseBody(req);
      const cand = candidates.find(c => c.id === body.candidateId) || candidates[0];
      const job = jobs.find(j => j.id === body.jobId) || jobs[0];
      const out = {
        direct: `Hallo ${cand.name}, wir suchen für ${job.title} in ${job.location_city}. Ihr Profil passt sehr gut. Haben Sie diese Woche 15 Minuten Zeit?`,
        advisory: `Hallo ${cand.name}, Ihre Erfahrung als ${cand.current_role} wirkt sehr passend. Bei ${companies.find(c=>c.id===job.company_id)?.name} hätten Sie klaren Impact und Entwicklungsspielraum. Das Team arbeitet modern und flexibel. Darf ich Ihnen die Rolle unverbindlich vorstellen?`,
        visionary: `Hallo ${cand.name}, ${companies.find(c=>c.id===job.company_id)?.name} baut aktuell eine Schlüsselrolle im Bereich ${job.title} auf. Sie könnten die Produkt- und Technologieausrichtung aktiv mitprägen und Sichtbarkeit bis ins Leadership-Team gewinnen. Das Umfeld ist ambitioniert, aber menschlich. Wollen wir dazu kurz sprechen?`,
        predicted_response_rate: { direct: 0.42, advisory: 0.55, visionary: 0.39 }
      };
      return json(res, 200, { success: true, data: out });
    }
    if (req.method === 'POST' && path === '/api/copilot/followup') return json(res,200,{success:true,data:{text:'Kurzes Follow-up: Ich wollte mich erkundigen, ob die Rolle weiterhin spannend für Sie ist. Gerne passe ich die Rahmenbedingungen an Ihre Erwartungen an.'}});
    if (req.method === 'GET' && path === '/api/copilot/analytics') {
      const data = Object.entries(analytics).map(([tone,v])=>({tone,responseRate:Number((v.responses/v.sent).toFixed(2))}));
      return json(res,200,{success:true,data});
    }

    // --- Pilot: Multi-tenant Bewerbungs-Inbox
    if (req.method === 'GET' && path === '/api/pilot/context') {
      const store = await getStore();
      return json(res, 200, { success: true, data: listTenantContext(store) });
    }
    if (req.method === 'GET' && path === '/api/pilot/worklist') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      const userId = url.searchParams.get('userId');
      if (!tenantId) return json(res, 400, { success: false, error: 'tenantId erforderlich' });
      const jobsById = store.db.jobs;

      let apps = Object.values(store.db.applications).filter((a) => a.tenantId === tenantId);
      if (userId) apps = apps.filter((a) => (a.screening?.assignedRecruiterUserId ? a.screening.assignedRecruiterUserId === userId : true));

      const decorate = (a) => ({
        id: a.id,
        jobId: a.jobId,
        jobTitle: jobsById[a.jobId]?.title || '',
        candidateName: a.candidateName,
        submittedAt: a.submittedAt,
        status: a.status,
        overall: a.analysis?.scores?.overall ?? null,
        mustHavePassed: a.analysis?.mustHave?.passed ?? null,
        templateRisk: a.analysis?.scores?.templateRisk ?? null,
        evidence: a.analysis?.scores?.evidence ?? null,
        flags: a.analysis?.flags || [],
        clusterId: a.clusterId,
        isClusterRepresentative: a.isClusterRepresentative
      });

      const sortOverall = (x, y) => (y.analysis?.scores?.overall || 0) - (x.analysis?.scores?.overall || 0);
      const worklist = {
        new: apps.filter((a) => a.status === 'new').sort(sortOverall).slice(0, 50).map(decorate),
        needs_info: apps.filter((a) => a.status === 'needs_info').sort(sortOverall).slice(0, 50).map(decorate),
        waiting_hm: apps
          .filter((a) => a.status === 'reviewing' && a.screening?.hmDecision === null)
          .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
          .slice(0, 50)
          .map(decorate),
        assessment_due: apps
          .filter((a) => a.assessment?.sentAt && !a.assessment?.completedAt)
          .sort((a, b) => String(a.assessment.sentAt).localeCompare(String(b.assessment.sentAt)))
          .slice(0, 50)
          .map(decorate)
      };
      return json(res, 200, { success: true, data: worklist });
    }
    if (req.method === 'GET' && path === '/api/pilot/templates') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      if (!tenantId) return json(res, 400, { success: false, error: 'tenantId erforderlich' });
      const items = Object.values(store.db.templates || {}).filter((t) => t.tenantId === tenantId);
      return json(res, 200, { success: true, data: items });
    }
    if (req.method === 'POST' && path === '/api/pilot/templates') {
      const store = await getStore();
      const body = await parseBody(req);
      try {
        const t = store.createTemplate({ tenantId: body?.tenantId, name: body?.name, channel: body?.channel, subject: body?.subject, body: body?.body });
        return json(res, 200, { success: true, data: t });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'PATCH' && path.startsWith('/api/pilot/templates/')) {
      const store = await getStore();
      const parts = path.split('/').filter(Boolean);
      const templateId = parts[3];
      const body = await parseBody(req);
      try {
        const t = store.db.templates?.[templateId];
        if (!t || t.tenantId !== body?.tenantId) return json(res, 404, { success: false, error: 'template_not_found' });
        const updated = store.updateTemplate(templateId, body);
        return json(res, 200, { success: true, data: updated });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'POST' && path === '/api/pilot/messages/send') {
      const store = await getStore();
      const body = await parseBody(req);
      const tenantId = body?.tenantId;
      const applicationId = body?.applicationId;
      const templateId = body?.templateId;
      const app = store.db.applications?.[applicationId];
      const tpl = store.db.templates?.[templateId];
      if (!tenantId || !applicationId || !templateId) return json(res, 400, { success: false, error: 'tenantId/applicationId/templateId erforderlich' });
      if (!app || app.tenantId !== tenantId) return json(res, 404, { success: false, error: 'application_not_found' });
      if (!tpl || tpl.tenantId !== tenantId) return json(res, 404, { success: false, error: 'template_not_found' });

      const job = store.db.jobs?.[app.jobId];
      const { actorUserId, actor } = getActor(store, { tenantId, req, url });
      const sender = store.db.users?.[body?.senderUserId] || actor || null;
      const vars = {
        candidateName: app.candidateName,
        jobTitle: job?.title || '',
        senderName: sender?.name || 'Recruiting Team',
        ...(body?.variables || {})
      };
      const subject = renderTemplate(tpl.subject, vars);
      const msgBody = renderTemplate(tpl.body, vars);
      const msg = store.createMessage({ tenantId, applicationId, channel: tpl.channel, to: body?.to || app.candidateName, subject, body: msgBody, templateId });
      if (body?.setStatus) store.updateApplication(applicationId, { status: body.setStatus });
      if (actorUserId) store.addEvent({ tenantId, jobId: app.jobId, applicationId, action: 'message_sent_by_user', payload: { messageId: msg.id }, actorUserId });
      return json(res, 200, { success: true, data: msg });
    }
    if (req.method === 'POST' && path === '/api/pilot/batch') {
      const store = await getStore();
      const body = await parseBody(req);
      const tenantId = body?.tenantId;
      const { actorUserId } = getActor(store, { tenantId, req, url });
      const ids = Array.isArray(body?.applicationIds) ? body.applicationIds.map(String) : [];
      if (!tenantId || !ids.length) return json(res, 400, { success: false, error: 'tenantId/applicationIds erforderlich' });
      const updated = [];
      for (const id of ids) {
        const app = store.db.applications?.[id];
        if (!app || app.tenantId !== tenantId) continue;
        const beforeStatus = app.status;
        const u = store.updateApplication(id, { status: body?.status, tags: body?.tags });
        if (body?.status && beforeStatus !== body.status) store.addEvent({ tenantId, jobId: u.jobId, applicationId: id, action: 'status_changed', payload: { from: beforeStatus, to: body.status }, actorUserId });
        updated.push(id);
      }
      return json(res, 200, { success: true, data: { updated: updated.length } });
    }
    if (req.method === 'GET' && path === '/api/pilot/hm/queue') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      const jobId = url.searchParams.get('jobId');
      if (!tenantId || !jobId) return json(res, 400, { success: false, error: 'tenantId/jobId erforderlich' });
      const job = store.db.jobs?.[jobId];
      if (!job || job.tenantId !== tenantId) return json(res, 404, { success: false, error: 'job_not_found' });
      const minOverall = Number(url.searchParams.get('minOverall') || 75);
      const apps = Object.values(store.db.applications)
        .filter((a) => a.tenantId === tenantId && a.jobId === jobId)
        .filter((a) => a.status === 'shortlisted' || (a.analysis?.scores?.overall || 0) >= minOverall)
        .sort((a, b) => (b.analysis?.scores?.overall || 0) - (a.analysis?.scores?.overall || 0))
        .slice(0, 50)
        .map((a) => ({
          id: a.id,
          candidateName: a.candidateName,
          submittedAt: a.submittedAt,
          status: a.status,
          scores: a.analysis?.scores || null,
          evidencePack: a.analysis?.evidencePack || null,
          flags: a.analysis?.flags || [],
          hmDecision: a.screening?.hmDecision ?? null,
          hmNotes: a.screening?.hmNotes || ''
        }));
      return json(res, 200, { success: true, data: { job: { id: job.id, title: job.title, family: job.family }, items: apps } });
    }
    if (req.method === 'POST' && path === '/api/pilot/hm/decision') {
      const store = await getStore();
      const body = await parseBody(req);
      const tenantId = body?.tenantId;
      const applicationId = body?.applicationId;
      const decision = body?.decision; // approve|reject|hold|null
      if (!tenantId || !applicationId) return json(res, 400, { success: false, error: 'tenantId/applicationId erforderlich' });
      const app = store.db.applications?.[applicationId];
      if (!app || app.tenantId !== tenantId) return json(res, 404, { success: false, error: 'application_not_found' });
      const { actorUserId, actor } = getActor(store, { tenantId, req, url });
      if (!requireRole(actor, ['hiring_manager', 'admin'])) return json(res, 403, { success: false, error: 'forbidden_hm_role_required' });
      const updated = store.updateApplication(applicationId, {
        screening: { hmDecision: decision || null, hmDecidedAt: nowISO(), hmNotes: String(body?.notes || '').slice(0, 2000) }
      });
      store.addEvent({ tenantId, jobId: updated.jobId, applicationId, action: 'hm_decision', payload: { decision: decision || null }, actorUserId });
      return json(res, 200, { success: true, data: updated.screening });
    }
    if (req.method === 'GET' && path === '/api/pilot/analytics') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      if (!tenantId) return json(res, 400, { success: false, error: 'tenantId erforderlich' });

      const apps = Object.values(store.db.applications).filter((a) => a.tenantId === tenantId);
      const events = store.db.events.filter((e) => e.tenantId === tenantId);
      const jobs = Object.values(store.db.jobs).filter((j) => j.tenantId === tenantId);

      const createdAtByApp = new Map();
      for (const e of events) if (e.action === 'application_created' && e.applicationId) createdAtByApp.set(e.applicationId, e.createdAt);

      const firstStatusChange = new Map();
      for (const e of events) {
        if (e.action !== 'status_changed' || !e.applicationId) continue;
        if (!firstStatusChange.has(e.applicationId)) firstStatusChange.set(e.applicationId, e.createdAt);
      }

      const ms = (isoA, isoB) => {
        const a = Date.parse(isoA || '');
        const b = Date.parse(isoB || '');
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        return b - a;
      };

      const ttfr = [];
      for (const a of apps) {
        const c = createdAtByApp.get(a.id) || a.submittedAt;
        const f = firstStatusChange.get(a.id);
        const d = ms(c, f);
        if (d !== null) ttfr.push(d);
      }
      const avg = (arr) => (arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : 0);

      const byJob = jobs.map((j) => {
        const ja = apps.filter((a) => a.jobId === j.id);
        const shortlisted = ja.filter((a) => a.status === 'shortlisted');
        const rejected = ja.filter((a) => a.status === 'rejected');
        const reviewing = ja.filter((a) => a.status === 'reviewing');
        return {
          jobId: j.id,
          title: j.title,
          family: j.family,
          total: ja.length,
          new: ja.filter((a) => a.status === 'new').length,
          reviewing: reviewing.length,
          shortlisted: shortlisted.length,
          rejected: rejected.length,
          avgOverallShortlisted: shortlisted.length ? Math.round(shortlisted.reduce((acc, a) => acc + (a.analysis?.scores?.overall || 0), 0) / shortlisted.length) : 0
        };
      });

      return json(res, 200, {
        success: true,
        data: {
          totals: { applications: apps.length, avgTimeToFirstReviewMs: avg(ttfr) },
          byJob
        }
      });
    }
    if (req.method === 'GET' && path === '/api/pilot/export/applications.csv') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      const jobId = url.searchParams.get('jobId');
      if (!tenantId || !jobId) return json(res, 400, { success: false, error: 'tenantId/jobId erforderlich' });
      const job = store.db.jobs?.[jobId];
      if (!job || job.tenantId !== tenantId) return json(res, 404, { success: false, error: 'job_not_found' });

      const rows = Object.values(store.db.applications)
        .filter((a) => a.tenantId === tenantId && a.jobId === jobId)
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
        .map((a) => [
          a.id,
          a.candidateName,
          a.status,
          String(a.analysis?.scores?.overall ?? ''),
          String(a.analysis?.scores?.evidence ?? ''),
          String(a.analysis?.scores?.templateRisk ?? ''),
          String(a.analysis?.mustHave?.passed ?? ''),
          String(a.screening?.hmDecision ?? ''),
          String(a.submittedAt || '')
        ]);

      const header = ['id', 'candidateName', 'status', 'overall', 'evidence', 'templateRisk', 'mustHavePassed', 'hmDecision', 'submittedAt'];
      const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [header.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
      res.end(csv);
      return;
    }

    if (req.method === 'GET' && path === '/api/pilot/export/events.csv') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      if (!tenantId) return json(res, 400, { success: false, error: 'tenantId erforderlich' });
      const events = store.db.events.filter((e) => e.tenantId === tenantId).slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const header = ['id', 'createdAt', 'tenantId', 'jobId', 'applicationId', 'actorUserId', 'action', 'payload'];
      const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = events.map((e) => [e.id, e.createdAt, e.tenantId, e.jobId || '', e.applicationId || '', e.actorUserId || '', e.action, JSON.stringify(e.payload || {})]);
      const csv = [header.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
      res.end(csv);
      return;
    }

    if (req.method === 'POST' && path === '/api/pilot/import/applications.csv') {
      const store = await getStore();
      const body = await parseBody(req);
      const tenantId = body?.tenantId;
      const jobId = body?.jobId;
      const csv = body?.csv;
      if (!tenantId || !jobId || !csv) return json(res, 400, { success: false, error: 'tenantId/jobId/csv erforderlich' });
      const job = store.db.jobs?.[jobId];
      if (!job || job.tenantId !== tenantId) return json(res, 404, { success: false, error: 'job_not_found' });
      const rows = parseCsv(csv);
      const objs = rowsToObjects(rows);
      let created = 0;
      for (const o of objs.slice(0, 1000)) {
        const candidateName = o.candidateName || o.name || o.candidate || '';
        const text = o.text || o.applicationText || o.coverLetter || o.raw || '';
        if (!String(candidateName).trim() || !String(text).trim()) continue;
        const app = store.createApplication({ tenantId, jobId, candidateName, source: o.source || 'import', text });
        const analysis = await analyzeForJob({ job, text: app.text, useLLM: false });
        store.updateApplication(app.id, { analysis });
        created++;
      }
      const cluster = clusterJob(store, { tenantId, jobId });
      return json(res, 200, { success: true, data: { created, clustered: cluster?.clusters?.length || 0 } });
    }

    if (req.method === 'GET' && path === '/api/pilot/sequences') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      if (!tenantId) return json(res, 400, { success: false, error: 'tenantId erforderlich' });
      const items = Object.values(store.db.sequences || {}).filter((s) => s.tenantId === tenantId);
      return json(res, 200, { success: true, data: items });
    }
    if (req.method === 'POST' && path === '/api/pilot/sequences') {
      const store = await getStore();
      const body = await parseBody(req);
      try {
        const seq = store.createSequence({ tenantId: body?.tenantId, name: body?.name, steps: body?.steps });
        return json(res, 200, { success: true, data: seq });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'PATCH' && path.startsWith('/api/pilot/sequences/')) {
      const store = await getStore();
      const parts = path.split('/').filter(Boolean);
      const sequenceId = parts[3];
      const body = await parseBody(req);
      try {
        const seq = store.db.sequences?.[sequenceId];
        if (!seq || seq.tenantId !== body?.tenantId) return json(res, 404, { success: false, error: 'sequence_not_found' });
        const updated = store.updateSequence(sequenceId, body);
        return json(res, 200, { success: true, data: updated });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'POST' && path === '/api/pilot/sequences/enroll') {
      const store = await getStore();
      const body = await parseBody(req);
      try {
        const enr = store.enrollSequence({ tenantId: body?.tenantId, sequenceId: body?.sequenceId, applicationId: body?.applicationId });
        return json(res, 200, { success: true, data: enr });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'POST' && path === '/api/pilot/sequences/run') {
      const store = await getStore();
      const body = await parseBody(req);
      const tenantId = body?.tenantId;
      if (!tenantId) return json(res, 400, { success: false, error: 'tenantId erforderlich' });
      const now = Date.now();
      const due = Object.values(store.db.enrollments || {})
        .filter((e) => e.tenantId === tenantId && e.status === 'active')
        .filter((e) => Date.parse(e.nextDueAt || '') <= now);
      let sent = 0;
      for (const e of due.slice(0, 200)) {
        const seq = store.db.sequences?.[e.sequenceId];
        const app = store.db.applications?.[e.applicationId];
        if (!seq || !app) {
          store.advanceEnrollment(e.id, { status: 'paused' });
          continue;
        }
        const step = seq.steps?.[e.stepIndex];
        if (!step) {
          store.advanceEnrollment(e.id, { status: 'done', nextDueAt: null });
          continue;
        }
        const tpl = store.db.templates?.[step.templateId];
        if (!tpl) {
          store.advanceEnrollment(e.id, { status: 'paused' });
          continue;
        }
        const job = store.db.jobs?.[app.jobId];
        const vars = { candidateName: app.candidateName, jobTitle: job?.title || '', senderName: 'Recruiting Team', ...(step.variables || {}) };
        const subject = renderTemplate(tpl.subject, vars);
        const msgBody = renderTemplate(tpl.body, vars);
        store.createMessage({ tenantId, applicationId: app.id, channel: tpl.channel, to: app.candidateName, subject, body: msgBody, templateId: tpl.id, meta: { sequenceId: seq.id, enrollmentId: e.id, stepIndex: e.stepIndex } });
        sent++;
        const nextIndex = e.stepIndex + 1;
        const nextStep = seq.steps?.[nextIndex];
        if (!nextStep) store.advanceEnrollment(e.id, { status: 'done', stepIndex: nextIndex, nextDueAt: null });
        else {
          const nextDue = new Date(Date.now() + (Number(nextStep.afterDays) || 0) * 86400000).toISOString();
          store.advanceEnrollment(e.id, { stepIndex: nextIndex, nextDueAt: nextDue });
        }
      }
      return json(res, 200, { success: true, data: { sent } });
    }

    if (req.method === 'GET' && path === '/api/pilot/scorecards') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      const applicationId = url.searchParams.get('applicationId');
      if (!tenantId || !applicationId) return json(res, 400, { success: false, error: 'tenantId/applicationId erforderlich' });
      const items = Object.values(store.db.scorecards || {}).filter((s) => s.tenantId === tenantId && s.applicationId === applicationId);
      return json(res, 200, { success: true, data: items });
    }
    if (req.method === 'POST' && path === '/api/pilot/scorecards') {
      const store = await getStore();
      const body = await parseBody(req);
      const tenantId = body?.tenantId;
      try {
        const { actorUserId } = getActor(store, { tenantId, req, url });
        const row = store.upsertScorecard({
          tenantId,
          applicationId: body?.applicationId,
          userId: actorUserId,
          role: body?.role || 'recruiter',
          criteria: body?.criteria || [],
          recommendation: body?.recommendation || 'maybe',
          notes: body?.notes || ''
        });
        return json(res, 200, { success: true, data: row });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }

    if (req.method === 'GET' && path === '/api/pilot/interview-kit') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      const applicationId = url.searchParams.get('applicationId');
      if (!tenantId || !applicationId) return json(res, 400, { success: false, error: 'tenantId/applicationId erforderlich' });
      const app = store.db.applications?.[applicationId];
      if (!app || app.tenantId !== tenantId) return json(res, 404, { success: false, error: 'application_not_found' });
      const job = store.db.jobs?.[app.jobId];
      const flags = app.analysis?.flags || [];
      const strongest = app.analysis?.evidencePack?.strongest || [];
      const weakest = app.analysis?.evidencePack?.weakest || [];
      const qs = [];
      for (const f of flags) {
        if (f?.type === 'buzzwords_no_evidence') qs.push('Nenne 2 konkrete Projekte (mit Link/Repo), in denen du die genannten Technologien wirklich eingesetzt hast. Was war dein Anteil?');
        if (f?.type === 'years_suspicious') qs.push('Kannst du die Zeitlinie (Jahre/Arbeitgeber/Role) kurz und konsistent auflisten?');
        if (f?.type === 'portfolio_no_link') qs.push('Bitte sende 1-2 Links (Portfolio/GitHub/Case Study). Was ist dein bestes Beispiel und warum?');
      }
      for (const c of strongest.slice(0, 2)) qs.push(`Deep dive: "${c.claim}" – wie genau gemessen? Welche Metriken? Was waren Trade-offs?`);
      for (const c of weakest.slice(0, 2)) qs.push(`Evidence gap: "${c.claim}" – welche artefaktische Evidenz (Link, Ticket, KPI, Demo) kannst du liefern?`);
      if (job?.family === 'software') qs.push('Live task: Debug-Session. Erklaere deinen Ansatz und welche Hypothesen du testest.');
      if (job?.family === 'sales') qs.push('Rollenspiel: Cold Outreach + Objection Handling. Welche Discovery-Fragen stellst du zuerst?');
      return json(res, 200, { success: true, data: { applicationId, job: { id: job?.id, title: job?.title || '' }, questions: Array.from(new Set(qs)).slice(0, 12) } });
    }
    if (req.method === 'POST' && path === '/api/pilot/tenants') {
      const store = await getStore();
      const body = await parseBody(req);
      const tenant = store.createTenant({ name: body?.name });
      return json(res, 200, { success: true, data: tenant });
    }
    if (req.method === 'POST' && path === '/api/pilot/teams') {
      const store = await getStore();
      const body = await parseBody(req);
      try {
        const team = store.createTeam({ tenantId: body?.tenantId, name: body?.name });
        return json(res, 200, { success: true, data: team });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'POST' && path === '/api/pilot/jobs') {
      const store = await getStore();
      const body = await parseBody(req);
      try {
        const job = store.createJob({
          tenantId: body?.tenantId,
          teamId: body?.teamId,
          title: body?.title,
          family: body?.family,
          location: body?.location,
          rubric: body?.rubric
        });
        return json(res, 200, { success: true, data: job });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'PATCH' && path.startsWith('/api/pilot/jobs/') && path.endsWith('/rubric')) {
      const store = await getStore();
      const body = await parseBody(req);
      const parts = path.split('/').filter(Boolean);
      const jobId = parts[3];
      try {
        const job = store.db.jobs[jobId];
        if (!job || job.tenantId !== body?.tenantId) return json(res, 404, { success: false, error: 'job_not_found' });
        const updated = store.updateJobRubric(jobId, body?.rubric);
        if (body?.reanalyze) await reanalyzeJob(store, { tenantId: body.tenantId, jobId, useLLM: false });
        if (body?.recluster) clusterJob(store, { tenantId: body.tenantId, jobId });
        return json(res, 200, { success: true, data: updated });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'POST' && path.startsWith('/api/pilot/jobs/') && path.endsWith('/reanalyze')) {
      const store = await getStore();
      const body = await parseBody(req);
      const parts = path.split('/').filter(Boolean);
      const jobId = parts[3];
      try {
        const data = await reanalyzeJob(store, { tenantId: body?.tenantId, jobId, useLLM: Boolean(body?.useLLM) });
        return json(res, 200, { success: true, data });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'POST' && path === '/api/pilot/seed') {
      const store = await getStore();
      const body = await parseBody(req);
      const tenantId = body?.tenantId;
      const jobId = body?.jobId;
      const count = clamp(Number(body?.count || 200), 1, 1000);
      const job = store.db.jobs[jobId];
      if (!tenantId || !jobId || !job || job.tenantId !== tenantId) return json(res, 400, { success: false, error: 'tenantId/jobId ungueltig' });

      const created = [];
      for (let i = 0; i < count; i++) {
        const demo = generateDemoApplication({ family: job.family });
        const app = store.createApplication({ tenantId, jobId, candidateName: demo.candidateName, text: demo.text, source: 'xing' });
        const analysis = await analyzeForJob({ job, text: app.text, useLLM: false });
        store.updateApplication(app.id, { analysis });
        created.push(app.id);
      }

      const cluster = clusterJob(store, { tenantId, jobId });
      return json(res, 200, { success: true, data: { created: created.length, jobId, cluster } });
    }
    if (req.method === 'POST' && path === '/api/pilot/cluster') {
      const store = await getStore();
      const body = await parseBody(req);
      try {
        const data = clusterJob(store, { tenantId: body?.tenantId, jobId: body?.jobId });
        return json(res, 200, { success: true, data });
      } catch (e) {
        return json(res, 400, { success: false, error: String(e?.message || e) });
      }
    }
    if (req.method === 'GET' && path === '/api/pilot/applications') {
      const store = await getStore();
      const tenantId = url.searchParams.get('tenantId');
      const jobId = url.searchParams.get('jobId');
      if (!tenantId || !jobId) return json(res, 400, { success: false, error: 'tenantId und jobId erforderlich' });

      const status = url.searchParams.get('status');
      const mustHave = url.searchParams.get('mustHave'); // pass|fail|null
      const q = (url.searchParams.get('q') || '').toLowerCase().trim();
      const collapsed = url.searchParams.get('collapsedClusters') === '1';
      const sort = url.searchParams.get('sort') || 'submitted_desc';
      const page = clamp(Number(url.searchParams.get('page') || 1), 1, 9999);
      const limit = clamp(Number(url.searchParams.get('limit') || 50), 5, 200);

      let apps = Object.values(store.db.applications).filter((a) => a.tenantId === tenantId && a.jobId === jobId);
      if (status) apps = apps.filter((a) => a.status === status);
      if (mustHave === 'pass') apps = apps.filter((a) => a.analysis?.mustHave?.passed === true);
      if (mustHave === 'fail') apps = apps.filter((a) => a.analysis?.mustHave?.passed === false);
      if (q) apps = apps.filter((a) => (a.candidateName || '').toLowerCase().includes(q));
      if (collapsed) apps = apps.filter((a) => !a.clusterId || a.isClusterRepresentative);

      if (sort === 'overall_desc') apps.sort((a, b) => (b.analysis?.scores?.overall || 0) - (a.analysis?.scores?.overall || 0));
      else apps.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

      const total = apps.length;
      const start = (page - 1) * limit;
      const items = apps.slice(start, start + limit).map((a) => ({
        id: a.id,
        candidateName: a.candidateName,
        submittedAt: a.submittedAt,
        status: a.status,
        source: a.source,
        tags: a.tags,
        scores: a.analysis?.scores || null,
        mustHavePassed: a.analysis?.mustHave?.passed ?? null,
        clusterId: a.clusterId,
        isClusterRepresentative: a.isClusterRepresentative,
        noteCount: a.notes?.length || 0
      }));

      const job = store.db.jobs[jobId];
      const cluster = job?.cluster || null;
      return json(res, 200, { success: true, data: { page, limit, total, items, cluster } });
    }
    if (path.startsWith('/api/pilot/applications/')) {
      const store = await getStore();
      const parts = path.split('/').filter(Boolean);
      const applicationId = parts[3];

      if (req.method === 'GET' && parts.length === 4) {
        const tenantId = url.searchParams.get('tenantId');
        const app = store.db.applications[applicationId];
        if (!app || (tenantId && app.tenantId !== tenantId)) return json(res, 404, { success: false, error: 'application_not_found' });
        const events = store.db.events.filter((e) => e.applicationId === applicationId).slice(-60);
        const norm = (s) => String(s || '').trim().toLowerCase();
        const related = tenantId
          ? Object.values(store.db.applications)
              .filter((a) => a.tenantId === tenantId && a.id !== app.id)
              .filter((a) => norm(a.candidateName) && norm(a.candidateName) === norm(app.candidateName))
              .slice(0, 8)
              .map((a) => ({ id: a.id, jobId: a.jobId, jobTitle: store.db.jobs?.[a.jobId]?.title || '', status: a.status, submittedAt: a.submittedAt }))
          : [];
        return json(res, 200, { success: true, data: { application: app, events, related } });
      }

      if (req.method === 'PATCH' && parts.length === 4) {
        const body = await parseBody(req);
        const tenantId = body?.tenantId;
        const { actorUserId } = getActor(store, { tenantId, req, url });
        const app = store.db.applications[applicationId];
        if (!app || !tenantId || app.tenantId !== tenantId) return json(res, 404, { success: false, error: 'application_not_found' });
        const beforeStatus = app.status;
        const updated = store.updateApplication(applicationId, { status: body?.status, tags: body?.tags });
        if (body?.status && beforeStatus !== body.status) store.addEvent({ tenantId, jobId: updated.jobId, applicationId, action: 'status_changed', payload: { from: beforeStatus, to: body.status }, actorUserId });
        return json(res, 200, { success: true, data: updated });
      }

      if (req.method === 'POST' && parts.length === 5 && parts[4] === 'note') {
        const body = await parseBody(req);
        const tenantId = body?.tenantId;
        const { actorUserId } = getActor(store, { tenantId, req, url });
        const app = store.db.applications[applicationId];
        if (!app || !tenantId || app.tenantId !== tenantId) return json(res, 404, { success: false, error: 'application_not_found' });
        const note = store.addNote(applicationId, { text: body?.text });
        if (actorUserId) store.addEvent({ tenantId, jobId: app.jobId, applicationId, action: 'note_added_by_user', payload: { noteId: note.id }, actorUserId });
        return json(res, 200, { success: true, data: note });
      }

      if (req.method === 'POST' && parts.length === 6 && parts[4] === 'assessment' && parts[5] === 'send') {
        const body = await parseBody(req);
        const tenantId = body?.tenantId;
        const { actorUserId } = getActor(store, { tenantId, req, url });
        const app = store.db.applications[applicationId];
        if (!app || !tenantId || app.tenantId !== tenantId) return json(res, 404, { success: false, error: 'application_not_found' });
        const tasks = app.analysis?.microAssessment?.tasks || [];
        const asmt = store.createAssessment({ tenantId, applicationId, tasks });
        const updated = store.updateApplication(applicationId, { assessment: { sentAt: nowISO(), completedAt: null, assessmentId: asmt.id, token: asmt.token } });
        store.addEvent({ tenantId, jobId: updated.jobId, applicationId, action: 'assessment_sent', payload: { assessmentId: asmt.id }, actorUserId });
        return json(res, 200, { success: true, data: { ...updated.assessment, link: `/assessment?token=${encodeURIComponent(asmt.token)}` } });
      }
    }

    if (path.startsWith('/api/public/assessment/')) {
      const store = await getStore();
      const parts = path.split('/').filter(Boolean); // api public assessment :token [submit]
      const token = parts[3];
      const asmt = Object.values(store.db.assessments || {}).find((a) => a.token === token) || null;
      if (!asmt) return json(res, 404, { success: false, error: 'assessment_not_found' });
      const app = store.db.applications?.[asmt.applicationId] || null;
      const job = app ? store.db.jobs?.[app.jobId] : null;
      if (req.method === 'GET' && parts.length === 4) {
        return json(res, 200, {
          success: true,
          data: {
            assessmentId: asmt.id,
            token: asmt.token,
            submittedAt: asmt.submittedAt,
            candidateName: app?.candidateName || '',
            jobTitle: job?.title || '',
            tasks: asmt.tasks || []
          }
        });
      }
      if (req.method === 'POST' && parts.length === 5 && parts[4] === 'submit') {
        const body = await parseBody(req);
        const updated = store.submitAssessment({ tenantId: asmt.tenantId, assessmentId: asmt.id, answers: body?.answers || {} });
        if (app) store.updateApplication(app.id, { assessment: { ...(app.assessment || {}), completedAt: updated.submittedAt } });
        return json(res, 200, { success: true, data: { submittedAt: updated.submittedAt } });
      }
      return json(res, 404, { success: false, error: 'Route nicht gefunden' });
    }

    if (req.method === 'GET' && path === '/api/triage/demo') {
      return json(res, 200, { success: true, data: getTriageDemo() });
    }
    if (req.method === 'POST' && path === '/api/triage/analyze') {
      const body = await parseBody(req);
      if (!body?.applicationText) return json(res, 400, { success: false, error: 'applicationText erforderlich' });
      const data = body?.useLLM
        ? await analyzeApplicationWithLLM({ jobFamily: body.jobFamily, applicationText: body.applicationText, rubric: body?.rubric })
        : analyzeApplication({ jobFamily: body.jobFamily, applicationText: body.applicationText, rubric: body?.rubric });
      return json(res, 200, { success: true, data });
    }
    if (req.method === 'POST' && path === '/api/triage/cluster') {
      const body = await parseBody(req);
      const data = clusterApplications({ applications: body?.applications || [], threshold: body?.threshold, shingleSize: body?.shingleSize });
      return json(res, 200, { success: true, data });
    }
    if (req.method==='GET' && path==='/api/alerts/ghosting/r1') {
      const data = pipelineEntries.filter(p=>p.ghosting_risk_score>50).map(p=>({entryId:p.id,risk:p.ghosting_risk_score,recommendation:p.ghosting_risk_score>70?'Persönlichen Touchpoint setzen (Anruf/LinkedIn)':'Hiring Manager eskalieren – Feedback ausstehend'}));
      return json(res,200,{success:true,data});
    }
    if (req.method==='GET' && path.startsWith('/api/alerts/ghosting/')) {
      const entryId = path.split('/').pop();
      const e = pipelineEntries.find(p=>p.id===entryId); if(!e) return json(res,404,{success:false,error:'Nicht gefunden'});
      return json(res,200,{success:true,data:{entryId,risk:e.ghosting_risk_score,recommendation:e.ghosting_risk_score>70?'Gehaltsdiskussion proaktiv führen':'Follow-up senden'}});
    }
    if (req.method==='POST' && path.endsWith('/dismiss')) return json(res,200,{success:true,data:{dismissed:true}});

    if (req.method==='GET' && path.startsWith('/api/hiring-managers/') && path.endsWith('/score')) {
      const id = path.split('/')[3]; const hm = hiringManagers.find(h=>h.id===id); if(!hm) return json(res,404,{success:false,error:'Nicht gefunden'});
      const score = Math.round((hm.avg_feedback_speed_hours<24?1:hm.avg_feedback_speed_hours<48?0.7:0.3)*25 + hm.interview_consistency_score*25 + hm.offer_conversion_rate*25 + (hm.total_processes>8?0.8:0.5)*15 + 0.7*10);
      return json(res,200,{success:true,data:{score,grade:score>80?'A':score>65?'B':score>50?'C':score>40?'D':'F',breakdown:{feedback:hm.avg_feedback_speed_hours,consistency:hm.interview_consistency_score,conversion:hm.offer_conversion_rate}}});
    }
    if (req.method==='GET' && path.startsWith('/api/hiring-managers/') && path.endsWith('/trend')) return json(res,200,{success:true,data:[1,2,3,4,5,6].map(m=>({month:m,score:45+Math.round(Math.random()*40)}))});
    if (req.method==='GET' && path.startsWith('/api/companies/') && path.endsWith('/managers')) {
      const cid=path.split('/')[3];
      return json(res,200,{success:true,data:hiringManagers.filter(h=>h.company_id===cid)});
    }

    if (req.method==='GET' && path==='/api/market/heatmap') {
      const role = url.searchParams.get('role');
      return json(res,200,{success:true,data:marketData.filter(m=>!role||m.role_category===role)});
    }
    if (req.method==='GET' && path.startsWith('/api/market/detail/')) return json(res,200,{success:true,data:marketData.filter(m=>m.region===decodeURIComponent(path.split('/').pop()))});
    if (req.method==='GET' && path.startsWith('/api/market/export/')) return json(res,200,{success:true,data:{url:'/reports/marktbericht.pdf'}});

    if (req.method==='POST' && path==='/api/agent/search') {
      const body=await parseBody(req);
      const runId=`run${Date.now()}`;
      globalThis.agentRuns ||= {};
      globalThis.agentRuns[runId]={status:'done',results:candidates.map(c=>({candidate:c,score:Math.round(Math.random()*40+60),reason:`${c.name} erfüllt Must-have Skills und passt zur Region ${body.jobSpec?.region||c.location_city}.`})).sort((a,b)=>b.score-a.score)};
      return json(res,200,{success:true,data:{runId}});
    }
    if (req.method==='GET' && path.startsWith('/api/agent/status/')) { const run=globalThis.agentRuns?.[path.split('/').pop()]; return json(res,200,{success:true,data:{status:run?.status||'processing'}}); }
    if (req.method==='GET' && path.startsWith('/api/agent/results/')) { const run=globalThis.agentRuns?.[path.split('/').pop()]; return json(res,200,{success:true,data:run?.results||[]}); }

    if (req.method==='POST' && path==='/api/interviews') { const b=await parseBody(req); const id=`int${interviews.length+1}`; interviews.push({id,...b}); return json(res,200,{success:true,data:{id}}); }
    if (req.method==='POST' && path.includes('/api/interviews/') && path.endsWith('/analyze')) {
      const id=path.split('/')[3]; const i=interviews.find(x=>x.id===id); if(!i) return json(res,404,{success:false,error:'Nicht gefunden'});
      i.notes_summary='Kandidat überzeugt fachlich, Kommunikationsstil klar, moderates Risiko bei Führung in großen Teams.';
      i.competency_scores={technical_skills:8,leadership:6,communication:7,problem_solving:8,cultural_fit:7};
      i.sentiment_score=0.68; i.red_flags=['Leadership in Matrixstrukturen unklar'];
      return json(res,200,{success:true,data:i});
    }
    if (req.method==='GET' && path.startsWith('/api/interviews/compare/')) {
      const entry=path.split('/').pop(); const data=interviews.filter(i=>i.pipeline_entry_id===entry);
      return json(res,200,{success:true,data:{alignment:'Hoch bei Fachkompetenz, gemischt bei Leadership.',interviews:data}});
    }

    if (req.method==='GET' && path.startsWith('/api/compensation/') && path.endsWith('/predict')) {
      const entry=pipelineEntries.find(p=>p.id===path.split('/')[3]); if(!entry) return json(res,404,{success:false,error:'Nicht gefunden'});
      const cand=candidates.find(c=>c.id===entry.candidate_id); const job=jobs.find(j=>j.id===entry.job_id);
      const gap=(job?.salary_max||0)-(cand?.salary_expectation||0);
      return json(res,200,{success:true,data:{fit:gap>=5000?'green':gap>=0?'yellow':'red',gap,market_position:gap>0?'below_median':'above_median',negotiation_tips:gap>=0?['Gesamtpaket inkl. Weiterbildung hervorheben']:['Variabler Bonus und Remote-Flexibilität anbieten']}});
    }
    if (req.method==='GET' && path==='/api/compensation/benchmark') {
      const role=url.searchParams.get('role'); const region=url.searchParams.get('region');
      return json(res,200,{success:true,data:marketData.find(m=>m.role_category===role&&m.region===region)||null});
    }

    if (req.method==='GET' && path==='/api/silver-medals') return json(res,200,{success:true,data:silverMedals});
    if (req.method==='GET' && path.startsWith('/api/silver-medals/matches/')) {
      const job=jobs.find(j=>j.id===path.split('/').pop());
      const data=silverMedals.map(sm=>({silverMedalId:sm.id,score:72+Math.round(Math.random()*20),message:`Kandidat passt auf neue Rolle ${job?.title}.`})).filter(m=>m.score>70);
      return json(res,200,{success:true,data});
    }
    if (req.method==='POST' && path.includes('/api/silver-medals/') && path.endsWith('/reactivate')) {
      return json(res,200,{success:true,data:{message:'Wertschätzende Wiederansprache generiert und Copilot geöffnet.'}});
    }

    return json(res, 404, { success: false, error: 'Route nicht gefunden' });
  }

  if (path === '/' || path === '/index.html') return serveStatic(res, '/');
  if (path === '/features') return serveStatic(res, '/features.html');
  if (path === '/login') return serveStatic(res, '/login.html');
  if (path === '/features.html' || path === '/login.html') return serveStatic(res, path);
  if (path === '/app.html') return serveStatic(res, '/app.html');
  if (path === '/app.js' || path === '/styles.css' || path === '/marketing.css') return serveStatic(res, path);
  if (path.startsWith('/assets/')) return serveStatic(res, path);

  // SPA fallback: app shell for all non-API routes.
  return serveStatic(res, '/app.html');
};

const server = createServer(handler);

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, () => console.log(`RecruiterIQ läuft auf http://localhost:${PORT}`));
}

export { server, scoreDealProbability, ghostRisk };
export { handler };
