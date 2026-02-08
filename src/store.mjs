import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_PATH = join(process.cwd(), 'data', 'db.json');

const nowISO = () => new Date().toISOString();

const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 8)}`;

const defaultDb = () => ({
  version: 1,
  tenants: {},
  teams: {},
  jobs: {},
  applications: {},
  events: []
});

const tryParseJSON = (s) => {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const coerceDb = (raw) => {
  const base = defaultDb();
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    version: typeof d.version === 'number' ? d.version : base.version,
    tenants: d.tenants && typeof d.tenants === 'object' ? d.tenants : base.tenants,
    teams: d.teams && typeof d.teams === 'object' ? d.teams : base.teams,
    jobs: d.jobs && typeof d.jobs === 'object' ? d.jobs : base.jobs,
    applications: d.applications && typeof d.applications === 'object' ? d.applications : base.applications,
    events: Array.isArray(d.events) ? d.events : base.events
  };
};

const sanitizeName = (s) => String(s || '').trim().slice(0, 120);

const pick = (o, keys) => {
  const out = {};
  for (const k of keys) if (k in o) out[k] = o[k];
  return out;
};

class Store {
  constructor({ persistPath = DEFAULT_PATH, persist = true } = {}) {
    this.persistPath = persistPath;
    this.persist = Boolean(persist);
    this.db = defaultDb();
    this._saveTimer = null;
  }

  async load() {
    if (!this.persist) return this.db;
    try {
      const raw = await readFile(this.persistPath, 'utf8');
      const parsed = tryParseJSON(raw);
      this.db = coerceDb(parsed);
    } catch {
      // ignore missing/unreadable file
      this.db = defaultDb();
    }
    return this.db;
  }

  scheduleSave() {
    if (!this.persist) return;
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.save().catch(() => {});
    }, 150);
  }

  async save() {
    if (!this.persist) return;
    await mkdir(dirname(this.persistPath), { recursive: true });
    await writeFile(this.persistPath, JSON.stringify(this.db, null, 2), 'utf8');
  }

  ensureSeeded() {
    // If there is already data, don't reseed.
    if (Object.keys(this.db.tenants).length) return;

    const tenant1 = this.createTenant({ name: 'Acme GmbH' });
    const tenant2 = this.createTenant({ name: 'Nimbus AG' });

    const t1_team1 = this.createTeam({ tenantId: tenant1.id, name: 'Tech Recruiting' });
    const t1_team2 = this.createTeam({ tenantId: tenant1.id, name: 'Go-to-Market' });
    const t2_team1 = this.createTeam({ tenantId: tenant2.id, name: 'Talent Acquisition' });
    const t2_team2 = this.createTeam({ tenantId: tenant2.id, name: 'People Ops' });

    this.createJob({
      tenantId: tenant1.id,
      teamId: t1_team1.id,
      title: 'Fullstack Engineer (TypeScript/React)',
      family: 'software',
      location: 'Berlin',
      rubric: { weights: { fit: 0.5, evidence: 0.3, antiTemplate: 0.2 }, clusterThreshold: 0.82, shingleSize: 3 }
    });
    this.createJob({
      tenantId: tenant1.id,
      teamId: t1_team2.id,
      title: 'Account Executive (B2B SaaS)',
      family: 'sales',
      location: 'Hamburg',
      rubric: { weights: { fit: 0.45, evidence: 0.35, antiTemplate: 0.2 }, clusterThreshold: 0.8, shingleSize: 3 }
    });
    this.createJob({
      tenantId: tenant2.id,
      teamId: t2_team1.id,
      title: 'Product Manager (Activation)',
      family: 'pm',
      location: 'Muenchen',
      rubric: { weights: { fit: 0.45, evidence: 0.35, antiTemplate: 0.2 }, clusterThreshold: 0.82, shingleSize: 3 }
    });
    this.createJob({
      tenantId: tenant2.id,
      teamId: t2_team2.id,
      title: 'Sales Manager (Team Lead)',
      family: 'sales',
      location: 'Frankfurt',
      rubric: { weights: { fit: 0.45, evidence: 0.35, antiTemplate: 0.2 }, clusterThreshold: 0.82, shingleSize: 3 }
    });

    this.scheduleSave();
  }

  // --- Tenants/Teams/Jobs
  createTenant({ name } = {}) {
    const id = makeId('ten');
    const t = { id, name: sanitizeName(name) || 'Tenant', createdAt: nowISO() };
    this.db.tenants[id] = t;
    this.scheduleSave();
    return t;
  }

  createTeam({ tenantId, name } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    const id = makeId('team');
    const team = { id, tenantId, name: sanitizeName(name) || 'Team', createdAt: nowISO() };
    this.db.teams[id] = team;
    this.scheduleSave();
    return team;
  }

  createJob({ tenantId, teamId, title, family, location = '', rubric = {} } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    if (!teamId || !this.db.teams[teamId] || this.db.teams[teamId].tenantId !== tenantId) throw new Error('team_not_found');
    const id = makeId('job');
    const job = {
      id,
      tenantId,
      teamId,
      title: sanitizeName(title) || 'Job',
      family: String(family || 'software'),
      location: sanitizeName(location),
      rubric: rubric && typeof rubric === 'object' ? rubric : {},
      cluster: null,
      createdAt: nowISO()
    };
    this.db.jobs[id] = job;
    this.scheduleSave();
    return job;
  }

  updateJobRubric(jobId, rubric) {
    const job = this.db.jobs[jobId];
    if (!job) throw new Error('job_not_found');
    job.rubric = rubric && typeof rubric === 'object' ? rubric : {};
    job.updatedAt = nowISO();
    this.scheduleSave();
    return job;
  }

  setJobCluster(jobId, cluster) {
    const job = this.db.jobs[jobId];
    if (!job) throw new Error('job_not_found');
    job.cluster = cluster && typeof cluster === 'object' ? cluster : null;
    job.updatedAt = nowISO();
    this.scheduleSave();
    return job;
  }

  // --- Applications
  createApplication({ tenantId, jobId, candidateName, source = 'xing', text } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    const job = this.db.jobs[jobId];
    if (!job || job.tenantId !== tenantId) throw new Error('job_not_found');
    const id = makeId('app');
    const app = {
      id,
      tenantId,
      jobId,
      candidateName: sanitizeName(candidateName) || `Candidate ${id.slice(-4)}`,
      source: sanitizeName(source) || 'xing',
      submittedAt: nowISO(),
      status: 'new',
      text: String(text || ''),
      analysis: null,
      clusterId: null,
      isClusterRepresentative: false,
      notes: [],
      tags: [],
      assessment: { sentAt: null, completedAt: null },
      updatedAt: nowISO()
    };
    this.db.applications[id] = app;
    this.addEvent({ tenantId, jobId, applicationId: id, action: 'application_created', payload: pick(app, ['candidateName', 'source']) });
    this.scheduleSave();
    return app;
  }

  updateApplication(applicationId, patch = {}) {
    const app = this.db.applications[applicationId];
    if (!app) throw new Error('application_not_found');
    if (patch.status) app.status = String(patch.status);
    if (typeof patch.text === 'string') app.text = patch.text;
    if (typeof patch.candidateName === 'string') app.candidateName = sanitizeName(patch.candidateName);
    if (Array.isArray(patch.tags)) app.tags = patch.tags.map((t) => sanitizeName(t)).filter(Boolean).slice(0, 20);
    if (typeof patch.clusterId === 'string' || patch.clusterId === null) app.clusterId = patch.clusterId;
    if (typeof patch.isClusterRepresentative === 'boolean') app.isClusterRepresentative = patch.isClusterRepresentative;
    if (patch.analysis !== undefined) app.analysis = patch.analysis;
    if (patch.assessment && typeof patch.assessment === 'object') app.assessment = { ...app.assessment, ...patch.assessment };
    app.updatedAt = nowISO();
    this.scheduleSave();
    return app;
  }

  addNote(applicationId, { text } = {}) {
    const app = this.db.applications[applicationId];
    if (!app) throw new Error('application_not_found');
    const note = { id: makeId('note'), text: String(text || '').trim().slice(0, 2000), createdAt: nowISO() };
    app.notes.push(note);
    app.updatedAt = nowISO();
    this.addEvent({ tenantId: app.tenantId, jobId: app.jobId, applicationId: app.id, action: 'note_added', payload: { noteId: note.id } });
    this.scheduleSave();
    return note;
  }

  addEvent({ tenantId, jobId = null, applicationId = null, action, payload = {} } = {}) {
    const ev = { id: makeId('ev'), tenantId, jobId, applicationId, action: String(action || ''), payload, createdAt: nowISO() };
    this.db.events.push(ev);
    // cap to avoid uncontrolled growth in prototype
    if (this.db.events.length > 2000) this.db.events.splice(0, this.db.events.length - 2000);
    return ev;
  }
}

let singleton = null;

export const getStore = async ({ persist } = {}) => {
  if (!singleton) {
    const persistEnabled = persist !== undefined ? Boolean(persist) : process.env.STORE_PERSIST !== '0';
    singleton = new Store({ persist: persistEnabled, persistPath: process.env.DB_PATH || DEFAULT_PATH });
    await singleton.load();
    singleton.ensureSeeded();
  }
  return singleton;
};

export { makeId, nowISO };
