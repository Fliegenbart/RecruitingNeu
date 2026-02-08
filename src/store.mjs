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
  users: {},
  templates: {},
  sequences: {},
  enrollments: {},
  assignments: {},
  applications: {},
  messages: {},
  assessments: {},
  scorecards: {},
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
    users: d.users && typeof d.users === 'object' ? d.users : base.users,
    templates: d.templates && typeof d.templates === 'object' ? d.templates : base.templates,
    sequences: d.sequences && typeof d.sequences === 'object' ? d.sequences : base.sequences,
    enrollments: d.enrollments && typeof d.enrollments === 'object' ? d.enrollments : base.enrollments,
    assignments: d.assignments && typeof d.assignments === 'object' ? d.assignments : base.assignments,
    applications: d.applications && typeof d.applications === 'object' ? d.applications : base.applications,
    messages: d.messages && typeof d.messages === 'object' ? d.messages : base.messages,
    assessments: d.assessments && typeof d.assessments === 'object' ? d.assessments : base.assessments,
    scorecards: d.scorecards && typeof d.scorecards === 'object' ? d.scorecards : base.scorecards,
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

    const u1 = this.createUser({ tenantId: tenant1.id, teamId: t1_team1.id, name: 'Leonie Weber', email: 'leonie@acme.example', role: 'recruiter' });
    const u2 = this.createUser({ tenantId: tenant1.id, teamId: t1_team2.id, name: 'Sofia Braun', email: 'sofia@acme.example', role: 'recruiter' });
    const u3 = this.createUser({ tenantId: tenant2.id, teamId: t2_team1.id, name: 'Anna Schmitt', email: 'anna@nimbus.example', role: 'recruiter' });

    const hm1 = this.createUser({ tenantId: tenant1.id, teamId: t1_team1.id, name: 'Tobias Krüger', email: 'tobias@acme.example', role: 'hiring_manager' });
    const hm2 = this.createUser({ tenantId: tenant2.id, teamId: t2_team1.id, name: 'Nina Vogt', email: 'nina@nimbus.example', role: 'hiring_manager' });

    this.createUser({ tenantId: tenant1.id, teamId: t1_team1.id, name: 'Admin Acme', email: 'admin@acme.example', role: 'admin' });
    this.createUser({ tenantId: tenant2.id, teamId: t2_team1.id, name: 'Admin Nimbus', email: 'admin@nimbus.example', role: 'admin' });

    const jobIds = Object.values(this.db.jobs).map((j) => j.id);
    for (const jid of jobIds) {
      const j = this.db.jobs[jid];
      const recruiter = j.tenantId === tenant1.id ? (j.teamId === t1_team2.id ? u2 : u1) : u3;
      const hm = j.tenantId === tenant1.id ? hm1 : hm2;
      this.setAssignment({ tenantId: j.tenantId, jobId: jid, recruiterUserIds: [recruiter.id], hiringManagerUserIds: [hm.id] });
    }

    this.createTemplate({
      tenantId: tenant1.id,
      name: 'Needs Info',
      channel: 'email',
      subject: 'Kurze Rückfrage zur Bewerbung: {{jobTitle}}',
      body: 'Hi {{candidateName}},\\n\\nkurze Frage, damit wir sauber matchen: {{question}}\\n\\nDanke!\\n{{senderName}}'
    });
    this.createTemplate({
      tenantId: tenant1.id,
      name: 'Next Step',
      channel: 'email',
      subject: 'Nächster Schritt: {{jobTitle}}',
      body: 'Hi {{candidateName}},\\n\\npasst super. Hast du diese Woche 15 Minuten für ein kurzes Screening?\\n\\n{{senderName}}'
    });

    this.createTemplate({
      tenantId: tenant2.id,
      name: 'Follow-up 1',
      channel: 'email',
      subject: 'Follow-up: {{jobTitle}}',
      body: 'Hi {{candidateName}},\\n\\nkurzes Follow-up, ob die Rolle noch spannend ist.\\n\\n{{senderName}}'
    });

    // Default sequences (simple drip)
    const t1_tpls = Object.values(this.db.templates).filter((t) => t.tenantId === tenant1.id);
    const t2_tpls = Object.values(this.db.templates).filter((t) => t.tenantId === tenant2.id);
    const t1_next = t1_tpls.find((t) => t.name === 'Next Step') || t1_tpls[0];
    const t1_need = t1_tpls.find((t) => t.name === 'Needs Info') || t1_tpls[0];
    const t2_follow = t2_tpls.find((t) => t.name === 'Follow-up 1') || t2_tpls[0];

    if (t1_next && t1_need) {
      this.createSequence({
        tenantId: tenant1.id,
        name: 'Screening Drip (3 steps)',
        steps: [
          { afterDays: 0, templateId: t1_next.id },
          { afterDays: 3, templateId: t1_need.id, variables: { question: 'Kannst du bitte 2 Links zu Projekten/Repos senden, die du wirklich selbst gebaut hast?' } },
          { afterDays: 7, templateId: t1_next.id }
        ]
      });
    }
    if (t2_follow) {
      this.createSequence({
        tenantId: tenant2.id,
        name: 'Follow-up Drip (2 steps)',
        steps: [{ afterDays: 0, templateId: t2_follow.id }, { afterDays: 5, templateId: t2_follow.id }]
      });
    }

    this.scheduleSave();
  }

  // --- Users / Templates / Sequences / Assignments
  createUser({ tenantId, teamId = null, name, email, role = 'recruiter' } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    if (teamId && (!this.db.teams[teamId] || this.db.teams[teamId].tenantId !== tenantId)) throw new Error('team_not_found');
    const id = makeId('usr');
    const u = { id, tenantId, teamId, name: sanitizeName(name) || 'User', email: sanitizeName(email) || '', role: String(role), createdAt: nowISO() };
    this.db.users[id] = u;
    this.scheduleSave();
    return u;
  }

  createTemplate({ tenantId, name, channel = 'email', subject = '', body = '' } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    const id = makeId('tpl');
    const t = { id, tenantId, name: sanitizeName(name) || 'Template', channel: String(channel), subject: String(subject || '').slice(0, 200), body: String(body || '').slice(0, 4000), createdAt: nowISO() };
    this.db.templates[id] = t;
    this.scheduleSave();
    return t;
  }

  updateTemplate(templateId, patch = {}) {
    const t = this.db.templates[templateId];
    if (!t) throw new Error('template_not_found');
    if (typeof patch.name === 'string') t.name = sanitizeName(patch.name) || t.name;
    if (typeof patch.channel === 'string') t.channel = String(patch.channel);
    if (typeof patch.subject === 'string') t.subject = String(patch.subject).slice(0, 200);
    if (typeof patch.body === 'string') t.body = String(patch.body).slice(0, 4000);
    t.updatedAt = nowISO();
    this.scheduleSave();
    return t;
  }

  createSequence({ tenantId, name, steps = [] } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    const id = makeId('seq');
    const cleanSteps = Array.isArray(steps)
      ? steps
          .map((s) => ({
            afterDays: Number.isFinite(Number(s?.afterDays)) ? clamp(Number(s.afterDays), 0, 365) : 0,
            templateId: s?.templateId ? String(s.templateId) : null,
            variables: s?.variables && typeof s.variables === 'object' ? s.variables : {}
          }))
          .filter((s) => s.templateId && this.db.templates[s.templateId] && this.db.templates[s.templateId].tenantId === tenantId)
          .slice(0, 12)
      : [];
    const seq = { id, tenantId, name: sanitizeName(name) || 'Sequence', steps: cleanSteps, createdAt: nowISO(), updatedAt: nowISO() };
    this.db.sequences[id] = seq;
    this.scheduleSave();
    return seq;
  }

  updateSequence(sequenceId, patch = {}) {
    const s = this.db.sequences[sequenceId];
    if (!s) throw new Error('sequence_not_found');
    if (typeof patch.name === 'string') s.name = sanitizeName(patch.name) || s.name;
    if (Array.isArray(patch.steps)) {
      const tenantId = s.tenantId;
      s.steps = patch.steps
        .map((st) => ({
          afterDays: Number.isFinite(Number(st?.afterDays)) ? clamp(Number(st.afterDays), 0, 365) : 0,
          templateId: st?.templateId ? String(st.templateId) : null,
          variables: st?.variables && typeof st.variables === 'object' ? st.variables : {}
        }))
        .filter((st) => st.templateId && this.db.templates[st.templateId] && this.db.templates[st.templateId].tenantId === tenantId)
        .slice(0, 12);
    }
    s.updatedAt = nowISO();
    this.scheduleSave();
    return s;
  }

  enrollSequence({ tenantId, sequenceId, applicationId } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    const seq = this.db.sequences[sequenceId];
    if (!seq || seq.tenantId !== tenantId) throw new Error('sequence_not_found');
    const app = this.db.applications[applicationId];
    if (!app || app.tenantId !== tenantId) throw new Error('application_not_found');
    const id = makeId('enr');
    const nextDueAt = nowISO(); // step0 due immediately
    const e = { id, tenantId, sequenceId, applicationId, jobId: app.jobId, status: 'active', stepIndex: 0, nextDueAt, enrolledAt: nowISO(), updatedAt: nowISO() };
    this.db.enrollments[id] = e;
    this.addEvent({ tenantId, jobId: app.jobId, applicationId, action: 'sequence_enrolled', payload: { sequenceId } });
    this.scheduleSave();
    return e;
  }

  advanceEnrollment(enrollmentId, patch = {}) {
    const e = this.db.enrollments[enrollmentId];
    if (!e) throw new Error('enrollment_not_found');
    if (patch.status) e.status = String(patch.status);
    if (Number.isFinite(Number(patch.stepIndex))) e.stepIndex = clamp(Number(patch.stepIndex), 0, 99);
    if (typeof patch.nextDueAt === 'string') e.nextDueAt = patch.nextDueAt;
    e.updatedAt = nowISO();
    this.scheduleSave();
    return e;
  }

  setAssignment({ tenantId, jobId, recruiterUserIds = [], hiringManagerUserIds = [] } = {}) {
    const job = this.db.jobs[jobId];
    if (!tenantId || !job || job.tenantId !== tenantId) throw new Error('job_not_found');
    const key = `${tenantId}:${jobId}`;
    const clean = (ids) => (ids || []).map(String).filter((id) => this.db.users[id] && this.db.users[id].tenantId === tenantId).slice(0, 20);
    const a = { tenantId, jobId, recruiterUserIds: clean(recruiterUserIds), hiringManagerUserIds: clean(hiringManagerUserIds), updatedAt: nowISO() };
    this.db.assignments[key] = a;
    this.scheduleSave();
    return a;
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
      assessment: { sentAt: null, completedAt: null, assessmentId: null, token: null },
      screening: { assignedRecruiterUserId: null, hmDecision: null, hmDecidedAt: null, hmNotes: '' },
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
    if (patch.screening && typeof patch.screening === 'object') app.screening = { ...(app.screening || {}), ...patch.screening };
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

  addEvent({ tenantId, jobId = null, applicationId = null, action, payload = {}, actorUserId = null } = {}) {
    const ev = { id: makeId('ev'), tenantId, jobId, applicationId, actorUserId: actorUserId ? String(actorUserId) : null, action: String(action || ''), payload, createdAt: nowISO() };
    this.db.events.push(ev);
    // cap to avoid uncontrolled growth in prototype
    if (this.db.events.length > 2000) this.db.events.splice(0, this.db.events.length - 2000);
    return ev;
  }

  // --- Messages (simulated email/sms/linkedin)
  createMessage({ tenantId, applicationId, channel = 'email', to = '', subject = '', body = '', templateId = null, meta = {} } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    const app = this.db.applications[applicationId];
    if (!app || app.tenantId !== tenantId) throw new Error('application_not_found');
    const id = makeId('msg');
    const m = {
      id,
      tenantId,
      applicationId,
      jobId: app.jobId,
      channel: String(channel),
      to: String(to || '').slice(0, 200),
      subject: String(subject || '').slice(0, 200),
      body: String(body || '').slice(0, 8000),
      templateId: templateId ? String(templateId) : null,
      status: 'sent',
      sentAt: nowISO(),
      meta: meta && typeof meta === 'object' ? meta : {}
    };
    this.db.messages[id] = m;
    this.addEvent({ tenantId, jobId: app.jobId, applicationId, action: 'message_sent', payload: { messageId: id, channel: m.channel, templateId: m.templateId } });
    this.scheduleSave();
    return m;
  }

  // --- Assessments (candidate proof-of-work)
  createAssessment({ tenantId, applicationId, tasks = [] } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    const app = this.db.applications[applicationId];
    if (!app || app.tenantId !== tenantId) throw new Error('application_not_found');
    const id = makeId('asmt');
    const token = randomUUID().replace(/-/g, '').slice(0, 24);
    const a = {
      id,
      token,
      tenantId,
      applicationId,
      jobId: app.jobId,
      tasks: Array.isArray(tasks) ? tasks : [],
      answers: {},
      autoScore: null,
      createdAt: nowISO(),
      submittedAt: null
    };
    this.db.assessments[id] = a;
    this.scheduleSave();
    return a;
  }

  submitAssessment({ tenantId, assessmentId, answers = {} } = {}) {
    const a = this.db.assessments[assessmentId];
    if (!a || a.tenantId !== tenantId) throw new Error('assessment_not_found');
    a.answers = answers && typeof answers === 'object' ? answers : {};
    a.submittedAt = nowISO();
    this.addEvent({ tenantId, jobId: a.jobId, applicationId: a.applicationId, action: 'assessment_submitted', payload: { assessmentId } });
    this.scheduleSave();
    return a;
  }

  // --- Scorecards
  upsertScorecard({ tenantId, applicationId, userId = null, role = 'recruiter', criteria = [], recommendation = 'maybe', notes = '' } = {}) {
    if (!tenantId || !this.db.tenants[tenantId]) throw new Error('tenant_not_found');
    const app = this.db.applications[applicationId];
    if (!app || app.tenantId !== tenantId) throw new Error('application_not_found');
    const existing = Object.values(this.db.scorecards).find((s) => s.tenantId === tenantId && s.applicationId === applicationId && s.role === String(role) && (userId ? s.userId === userId : true));
    const id = existing?.id || makeId('sc');
    const cleanCriteria = Array.isArray(criteria)
      ? criteria
          .map((c) => ({
            key: sanitizeName(c?.key) || '',
            label: sanitizeName(c?.label) || '',
            weight: Number.isFinite(Number(c?.weight)) ? clamp(Number(c.weight), 0, 10) : 1,
            score: Number.isFinite(Number(c?.score)) ? clamp(Number(c.score), 1, 5) : 3,
            note: String(c?.note || '').slice(0, 1000)
          }))
          .filter((c) => c.key || c.label)
          .slice(0, 24)
      : [];

    const row = {
      id,
      tenantId,
      applicationId,
      jobId: app.jobId,
      userId: userId ? String(userId) : null,
      role: String(role),
      criteria: cleanCriteria,
      recommendation: String(recommendation || 'maybe'),
      notes: String(notes || '').slice(0, 3000),
      createdAt: existing?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    this.db.scorecards[id] = row;
    this.addEvent({ tenantId, jobId: app.jobId, applicationId, action: 'scorecard_saved', payload: { scorecardId: id, role: row.role }, actorUserId: userId });
    this.scheduleSave();
    return row;
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

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
