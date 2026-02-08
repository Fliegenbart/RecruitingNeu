const routes = [
  ['dashboard','Dashboard'],
  ['pipeline','Pipeline'],
  ['inbox','Inbox'],
  ['triage','Triage (Playground)'],
  ['copilot','Copilot'],
  ['market','Markt'],
  ['agent','Agent'],
  ['talent-pool','Talent Pool'],
  ['companies','Unternehmen'],
  ['interviews','Interviews']
];

const app = document.getElementById('app');
const routeIds = new Set(routes.map(([id]) => id));
const pathRoute = () => {
  const p = (location.pathname || '/').replace(/^\/+/, '').split('/')[0];
  return routeIds.has(p) ? p : 'dashboard';
};
let current = pathRoute();
let state={};

const fetchJSON = (url, opts) => fetch(url, opts).then(r=>r.json());
const badge = (v)=> v>70?'<span class="badge green">🟢 '+v+'</span>':v>=40?'<span class="badge yellow">🟡 '+v+'</span>':'<span class="badge red">🔴 '+v+'</span>';
const badgeScore = (v, goodHigh=true)=>{
  const n = Number(v || 0);
  const score = goodHigh ? n : (100 - n);
  const cls = score>70?'green':score>=40?'yellow':'red';
  return `<span class="badge ${cls}">${Math.round(n)}</span>`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('de-DE'); } catch { return String(iso); }
};

async function loadDashboard(){
  const [kpi,funnel] = await Promise.all([fetchJSON('/api/dashboard/kpis/r1'), fetchJSON('/api/dashboard/funnel/r1')]);
  return `<h2>Outcome-Based Recruiter Dashboard</h2><div class="cards">${Object.entries(kpi.data).map(([k,v])=>`<div class='card'><div class='small'>${k}</div><div style='font-size:24px'>${v}</div></div>`).join('')}</div>
  <div class='card' style='margin-top:12px'><h3>Funnel</h3><table class='table'><tr><th>Stufe</th><th>Anzahl</th><th>Conversion</th></tr>${funnel.data.map(f=>`<tr><td>${f.stage}</td><td>${f.count}</td><td>${Math.round(f.conversion*100)}%</td></tr>`).join('')}</table></div>`;
}

async function loadPipeline(){
  const [entries,alerts]=await Promise.all([fetchJSON('/api/pipeline/job1'),fetchJSON('/api/alerts/ghosting/r1')]);
  return `<h2>Pipeline mit Deal-Score + Ghosting Alert</h2>
    <div class='card'>Aktive Alerts: ${alerts.data.length}</div>
    <div class='card' style='margin-top:12px'><table class='table'><tr><th>Entry</th><th>Stage</th><th>Deal</th><th>Ghosting</th></tr>${entries.data.slice(0,12).map(e=>`<tr><td>${e.id}</td><td>${e.stage}</td><td>${badge(e.deal_probability_score)}</td><td>${badge(e.ghosting_risk_score)}</td></tr>`).join('')}</table></div>`;
}

async function loadCopilot(){
  const gen = await fetchJSON('/api/copilot/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidateId:'cand1',jobId:'job1'})});
  return `<h2>Next-Best-Message Copilot</h2><div class='grid2'>${['direct','advisory','visionary'].map(t=>`<div class='card'><h3>${t.toUpperCase()} <span class='small'>${Math.round(gen.data.predicted_response_rate[t]*100)}%</span></h3><p>${gen.data[t]}</p></div>`).join('')}</div>`;
}

async function loadMarket(){
  const data=await fetchJSON('/api/market/heatmap?role=Software%20Engineer');
  return `<h2>Talent-Market Heatmap (Tabellarischer Prototyp)</h2><div class='card'><table class='table'><tr><th>Region</th><th>Dichte</th><th>Median</th><th>Remote %</th></tr>${data.data.slice(0,16).map(m=>`<tr><td>${m.region}</td><td>${m.talent_density}</td><td>€${m.median_salary}</td><td>${m.remote_readiness_pct}%</td></tr>`).join('')}</table></div>`;
}

async function loadAgent(){
  const run=await fetchJSON('/api/agent/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobSpec:{region:'Berlin'}})});
  const results=await fetchJSON('/api/agent/results/'+run.data.runId);
  return `<h2>Search-to-Shortlist Agent</h2><div class='card'><table class='table'><tr><th>Name</th><th>Score</th><th>Begründung</th></tr>${results.data.slice(0,5).map(r=>`<tr><td>${r.candidate.name}</td><td>${r.score}</td><td>${r.reason}</td></tr>`).join('')}</table></div>`;
}

async function loadSilver(){
  const pool=await fetchJSON('/api/silver-medals');
  return `<h2>Silver-Medal Re-Activation</h2><div class='card'><table class='table'><tr><th>ID</th><th>Kandidat</th><th>Rang</th></tr>${pool.data.map(s=>`<tr><td>${s.id}</td><td>${s.candidate_id}</td><td>${s.shortlist_position}</td></tr>`).join('')}</table></div>`;
}

async function loadCompanies(){
  const score=await fetchJSON('/api/hiring-managers/hm1/score');
  return `<h2>Hiring Manager Quality</h2><div class='card'><div>Score: ${score.data.score} (${score.data.grade})</div><pre>${JSON.stringify(score.data.breakdown,null,2)}</pre></div>`;
}

async function loadInterviews(){
  const analyzed=await fetchJSON('/api/interviews/int1/analyze',{method:'POST'});
  const comp=await fetchJSON('/api/compensation/pe1/predict');
  return `<h2>Interview Intelligence + Compensation Fit</h2><div class='grid2'><div class='card'><h3>Interview Analyse</h3><p>${analyzed.data.notes_summary}</p><pre>${JSON.stringify(analyzed.data.competency_scores,null,2)}</pre></div><div class='card'><h3>Compensation</h3><div>Fit: ${comp.data.fit}</div><div>Gap: €${comp.data.gap}</div><ul>${comp.data.negotiation_tips.map(t=>`<li>${t}</li>`).join('')}</ul></div></div>`;
}

async function loadInbox(){
  state.pilot ??= {
    context: null,
    tenantId: null,
    teamId: null,
    jobId: null,
    filters: { status:'', mustHave:'', q:'', collapsedClusters:true, sort:'submitted_desc', page:1, limit:50 },
    list: null,
    selectedAppId: null,
    selectedApp: null
  };

  if (!state.pilot.context) state.pilot.context = await fetchJSON('/api/pilot/context');
  if (!state.triageDemo) state.triageDemo = await fetchJSON('/api/triage/demo');

  const triage = state.triageDemo.data;
  const ctx = state.pilot.context.data;
  const tenants = ctx.tenants || [];
  if (!state.pilot.tenantId && tenants.length) state.pilot.tenantId = tenants[0].id;
  const teamsAll = ctx.teams || [];
  const jobsAll = ctx.jobs || [];
  const teams = teamsAll.filter(t=>t.tenantId===state.pilot.tenantId);
  if (!state.pilot.teamId && teams.length) state.pilot.teamId = teams[0].id;
  if (state.pilot.teamId && !teams.some(t=>t.id===state.pilot.teamId)) state.pilot.teamId = teams[0]?.id || null;
  const jobs = jobsAll.filter(j=>j.tenantId===state.pilot.tenantId && (!state.pilot.teamId || j.teamId===state.pilot.teamId));
  if (!state.pilot.jobId && jobs.length) state.pilot.jobId = jobs[0].id;
  if (state.pilot.jobId && !jobs.some(j=>j.id===state.pilot.jobId)) state.pilot.jobId = jobs[0]?.id || null;

  const html = `
    <h2>Inbox: Bewerbungen</h2>
    <div class='small'>Mandantenfaehig (Tenant/Team/Job), konfigurierbare Rubrik, Duplikat-Cluster und Claim-to-Evidence.</div>

    <div class='card' style='margin-top:12px'>
      <div class='grid3'>
        <div>
          <div class='small'>Tenant</div>
          <select id='inboxTenant'></select>
        </div>
        <div>
          <div class='small'>Team</div>
          <select id='inboxTeam'></select>
        </div>
        <div>
          <div class='small'>Job</div>
          <select id='inboxJob'></select>
        </div>
      </div>

      <div class='row'>
        <button class='btn primary' id='inboxSeedBtn'>Seed: 200 Bewerbungen</button>
        <button class='btn' id='inboxClusterBtn'>Duplikate clustern</button>
        <button class='btn' id='inboxRubricBtn'>Rubrik konfigurieren</button>
        <button class='btn' id='inboxRefreshBtn'>Refresh</button>
      </div>

      <div id='inboxRubric' class='card hidden' style='margin-top:12px'></div>

      <div class='row' style='margin-top:12px'>
        <div style='min-width:160px'>
          <div class='small'>Status</div>
          <select id='inboxStatus'>
            <option value=''>Alle</option>
            <option value='new'>new</option>
            <option value='reviewing'>reviewing</option>
            <option value='needs_info'>needs_info</option>
            <option value='shortlisted'>shortlisted</option>
            <option value='rejected'>rejected</option>
          </select>
        </div>
        <div style='min-width:170px'>
          <div class='small'>Must-have</div>
          <select id='inboxMustHave'>
            <option value=''>Alle</option>
            <option value='pass'>PASS</option>
            <option value='fail'>FAIL</option>
          </select>
        </div>
        <div style='flex:1;min-width:240px'>
          <div class='small'>Suche (Name)</div>
          <input id='inboxSearch' placeholder='z.B. Emma' />
        </div>
        <div style='min-width:160px'>
          <div class='small'>Sort</div>
          <select id='inboxSort'>
            <option value='submitted_desc'>Neueste</option>
            <option value='overall_desc'>Overall</option>
          </select>
        </div>
        <label class='small' style='display:flex;align-items:end;gap:8px;padding-bottom:8px'>
          <input type='checkbox' id='inboxCollapsed'/> Duplikate einklappen
        </label>
      </div>
    </div>

    <div class='inboxLayout' style='margin-top:12px'>
      <div class='card'>
        <div class='row' style='justify-content:space-between;align-items:center'>
          <div><strong>Queue</strong> <span class='small' id='inboxMeta'></span></div>
          <div class='row' style='margin-top:0'>
            <button class='btn' id='inboxPrev'>Prev</button>
            <button class='btn' id='inboxNext'>Next</button>
          </div>
        </div>
        <div id='inboxTableWrap' style='margin-top:10px'>Lade...</div>
      </div>
      <div id='inboxDetail'>
        <div class='card'>Waehle links eine Bewerbung aus.</div>
      </div>
    </div>
  `;

  const afterRender = () => {
    const $tenant = document.getElementById('inboxTenant');
    const $team = document.getElementById('inboxTeam');
    const $job = document.getElementById('inboxJob');
    const $seed = document.getElementById('inboxSeedBtn');
    const $cluster = document.getElementById('inboxClusterBtn');
    const $rubricBtn = document.getElementById('inboxRubricBtn');
    const $rubric = document.getElementById('inboxRubric');
    const $refresh = document.getElementById('inboxRefreshBtn');
    const $status = document.getElementById('inboxStatus');
    const $must = document.getElementById('inboxMustHave');
    const $q = document.getElementById('inboxSearch');
    const $sort = document.getElementById('inboxSort');
    const $collapsed = document.getElementById('inboxCollapsed');
    const $meta = document.getElementById('inboxMeta');
    const $wrap = document.getElementById('inboxTableWrap');
    const $detail = document.getElementById('inboxDetail');
    const $prev = document.getElementById('inboxPrev');
    const $next = document.getElementById('inboxNext');

    const ctxNow = () => state.pilot.context?.data || { tenants: [], teams: [], jobs: [] };
    const ensureValidSelection = () => {
      const c = ctxNow();
      const ten = c.tenants || [];
      if (!state.pilot.tenantId || !ten.some(t=>t.id===state.pilot.tenantId)) state.pilot.tenantId = ten[0]?.id || null;
      const teams = (c.teams || []).filter(t=>t.tenantId===state.pilot.tenantId);
      if (!state.pilot.teamId || !teams.some(t=>t.id===state.pilot.teamId)) state.pilot.teamId = teams[0]?.id || null;
      const jobs = (c.jobs || []).filter(j=>j.tenantId===state.pilot.tenantId && (!state.pilot.teamId || j.teamId===state.pilot.teamId));
      if (!state.pilot.jobId || !jobs.some(j=>j.id===state.pilot.jobId)) state.pilot.jobId = jobs[0]?.id || null;
    };

    const selectedJob = () => (ctxNow().jobs || []).find(j=>j.id===state.pilot.jobId) || null;
    const triageFamilyDef = (family) => (triage.jobFamilies || []).find(j=>j.id===family) || null;

    const setContext = async () => {
      state.pilot.context = await fetchJSON('/api/pilot/context');
      ensureValidSelection();
    };

    const fillSelectors = () => {
      const c = ctxNow();
      $tenant.innerHTML = (c.tenants || []).map(t=>`<option value='${esc(t.id)}' ${t.id===state.pilot.tenantId?'selected':''}>${esc(t.name)}</option>`).join('');
      const tTeams = (c.teams || []).filter(t=>t.tenantId===state.pilot.tenantId);
      $team.innerHTML = tTeams.map(t=>`<option value='${esc(t.id)}' ${t.id===state.pilot.teamId?'selected':''}>${esc(t.name)}</option>`).join('');
      const tJobs = (c.jobs || []).filter(j=>j.tenantId===state.pilot.tenantId && (!state.pilot.teamId || j.teamId===state.pilot.teamId));
      $job.innerHTML = tJobs.map(j=>`<option value='${esc(j.id)}' ${j.id===state.pilot.jobId?'selected':''}>${esc(j.title)} (${esc(j.family)}) · ${esc(j.applicationCount || 0)}</option>`).join('');
    };

    const renderRubric = () => {
      const job = selectedJob();
      if (!job) {
        $rubric.innerHTML = `<div class='small'>Kein Job ausgewaehlt.</div>`;
        return;
      }

      const def = triageFamilyDef(job.family);
      const availableMust = def?.mustHave || [];
      const availableNice = def?.niceToHave || [];
      const rubric = job.rubric || {};

      const mustIds = Array.isArray(rubric.mustHaveIds) && rubric.mustHaveIds.length ? rubric.mustHaveIds : availableMust.map(x=>x.id);
      const niceIds = Array.isArray(rubric.niceToHaveIds) && rubric.niceToHaveIds.length ? rubric.niceToHaveIds : availableNice.map(x=>x.id);
      const w = rubric.weights || { fit:0.5,evidence:0.3,antiTemplate:0.2 };
      const thr = rubric.clusterThreshold ?? 0.82;
      const sh = rubric.shingleSize ?? 3;

      $rubric.innerHTML = `
        <div class='row' style='justify-content:space-between;align-items:center'>
          <h3 style='margin:0'>Rubrik: ${esc(job.title)}</h3>
          <span class='pill'>${esc(job.family)}</span>
        </div>
        <div class='grid2' style='margin-top:12px'>
          <div class='card'>
            <div class='small'>Must-have (Gate)</div>
            ${availableMust.map(m=>`<label class='small' style='display:flex;gap:8px;margin-top:6px'><input type='checkbox' data-must='1' value='${esc(m.id)}' ${mustIds.includes(m.id)?'checked':''}/> ${esc(m.label)}</label>`).join('')}
          </div>
          <div class='card'>
            <div class='small'>Nice-to-have</div>
            ${availableNice.map(m=>`<label class='small' style='display:flex;gap:8px;margin-top:6px'><input type='checkbox' data-nice='1' value='${esc(m.id)}' ${niceIds.includes(m.id)?'checked':''}/> ${esc(m.label)}</label>`).join('')}
          </div>
        </div>
        <div class='grid3' style='margin-top:12px'>
          <div class='card'>
            <div class='small'>Weights (auto-normalized)</div>
            <div class='grid3' style='margin-top:8px'>
              <div><div class='small'>fit</div><input id='rubricFit' type='number' step='0.05' value='${esc(w.fit)}'/></div>
              <div><div class='small'>evidence</div><input id='rubricEvidence' type='number' step='0.05' value='${esc(w.evidence)}'/></div>
              <div><div class='small'>antiTemplate</div><input id='rubricAnti' type='number' step='0.05' value='${esc(w.antiTemplate)}'/></div>
            </div>
          </div>
          <div class='card'>
            <div class='small'>Duplikat-Cluster</div>
            <div class='grid2' style='margin-top:8px'>
              <div><div class='small'>threshold</div><input id='rubricThr' type='number' step='0.01' value='${esc(thr)}'/></div>
              <div><div class='small'>shingleSize</div><input id='rubricSh' type='number' step='1' value='${esc(sh)}'/></div>
            </div>
          </div>
          <div class='card'>
            <div class='small'>Apply</div>
            <label class='small' style='display:flex;gap:8px;margin-top:8px'><input type='checkbox' id='rubricReanalyze'/> Re-analyze Job</label>
            <label class='small' style='display:flex;gap:8px;margin-top:6px'><input type='checkbox' id='rubricRecluster'/> Re-cluster Job</label>
            <div class='row'><button class='btn primary' id='rubricSave'>Speichern</button></div>
          </div>
        </div>
      `;

      document.getElementById('rubricSave').onclick = async () => {
        const must = Array.from($rubric.querySelectorAll('input[data-must]')).filter(x=>x.checked).map(x=>x.value);
        const nice = Array.from($rubric.querySelectorAll('input[data-nice]')).filter(x=>x.checked).map(x=>x.value);
        const payload = {
          tenantId: state.pilot.tenantId,
          rubric: {
            mustHaveIds: must,
            niceToHaveIds: nice,
            weights: {
              fit: Number(document.getElementById('rubricFit').value),
              evidence: Number(document.getElementById('rubricEvidence').value),
              antiTemplate: Number(document.getElementById('rubricAnti').value)
            },
            clusterThreshold: Number(document.getElementById('rubricThr').value),
            shingleSize: Number(document.getElementById('rubricSh').value)
          },
          reanalyze: document.getElementById('rubricReanalyze').checked,
          recluster: document.getElementById('rubricRecluster').checked
        };
        const res = await fetchJSON(`/api/pilot/jobs/${job.id}/rubric`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if (!res?.success) alert(res?.error || 'Fehler');
        await setContext();
        await refresh();
      };
    };

    const renderTable = (list) => {
      if (!list) return `<div class='small'>Keine Daten.</div>`;
      const items = list.items || [];
      if (!items.length) return `<div class='small'>Keine Bewerbungen im aktuellen Filter.</div>`;
      return `
        <table class='table'>
          <tr>
            <th>Kandidat</th>
            <th>Status</th>
            <th>Overall</th>
            <th>Evidence</th>
            <th>TemplateRisk</th>
            <th>Must-have</th>
            <th>Cluster</th>
          </tr>
          ${items.map(a=>`
            <tr class='click' data-app='${esc(a.id)}'>
              <td>
                <div><strong>${esc(a.candidateName)}</strong></div>
                <div class='small'>${esc(fmtDate(a.submittedAt))} · ${esc(a.source)} · Notes: ${esc(a.noteCount)}</div>
              </td>
              <td><span class='pill'>${esc(a.status)}</span></td>
              <td>${badgeScore(a.scores?.overall || 0)}</td>
              <td>${badgeScore(a.scores?.evidence || 0)}</td>
              <td>${badgeScore(a.scores?.templateRisk || 0, false)}</td>
              <td>${a.mustHavePassed===null ? `<span class='small'>-</span>` : a.mustHavePassed ? `<span class='pill good'>PASS</span>` : `<span class='pill bad'>FAIL</span>`}</td>
              <td>${a.clusterId ? `<span class='pill ${a.isClusterRepresentative?'good':'warn'}'>${esc(a.isClusterRepresentative?'REP':'DUP')}</span>` : `<span class='small'>-</span>`}</td>
            </tr>
          `).join('')}
        </table>
      `;
    };

    const renderDetail = (d) => {
      const a = d?.application;
      if (!a) return `<div class='card'>Keine Details.</div>`;
      const analysis = a.analysis;
      const events = d?.events || [];

      const claimsRows = (analysis?.claims || []).map(c=>`
        <tr>
          <td>${esc(c.risk)}</td>
          <td>${esc(c.claim)}</td>
          <td class='mono'>${(c.evidence||[]).map(esc).join(' | ')}</td>
        </tr>
      `).join('');

      const tasks = analysis?.microAssessment?.tasks || [];

      return `
        <div class='card'>
          <div class='row' style='justify-content:space-between;align-items:center'>
            <div>
              <div class='small'>${esc(a.id)}</div>
              <div style='font-size:20px;font-weight:900'>${esc(a.candidateName)}</div>
              <div class='small'>${esc(fmtDate(a.submittedAt))} · ${esc(a.source)}</div>
            </div>
            <div class='row' style='margin-top:0'>
              <select id='detailStatus'>
                ${['new','reviewing','needs_info','shortlisted','rejected'].map(s=>`<option value='${esc(s)}' ${s===a.status?'selected':''}>${esc(s)}</option>`).join('')}
              </select>
              <button class='btn primary' id='detailSaveStatus'>Update</button>
            </div>
          </div>

          <div class='grid3' style='margin-top:12px'>
            <div class='card'><div class='small'>Overall</div><div class='big'>${badgeScore(analysis?.scores?.overall || 0)}</div></div>
            <div class='card'><div class='small'>Fit</div><div class='big'>${badgeScore(analysis?.scores?.fit || 0)}</div></div>
            <div class='card'><div class='small'>Evidence</div><div class='big'>${badgeScore(analysis?.scores?.evidence || 0)}</div></div>
          </div>
          <div class='card' style='margin-top:12px'>
            <div class='small'>TemplateRisk (niedrig ist gut)</div>
            <div class='big'>${badgeScore(analysis?.scores?.templateRisk || 0, false)}</div>
          </div>

          <div class='card' style='margin-top:12px'>
            <h3>Actions</h3>
            <div class='row'>
              <button class='btn' id='detailSendAssessment'>Proof-of-Work senden</button>
              <span class='small'>sent: ${esc(a.assessment?.sentAt ? fmtDate(a.assessment.sentAt) : '-')}</span>
            </div>
            <div style='margin-top:10px' class='small'>Note</div>
            <textarea id='detailNote' rows='3' placeholder='Kurze Notiz...'></textarea>
            <div class='row'><button class='btn' id='detailAddNote'>Notiz speichern</button></div>
          </div>

          <div class='card' style='margin-top:12px'>
            <h3>Must-have Gate</h3>
            <div class='row'>
              <span class='pill ${analysis?.mustHave?.passed ? 'good' : 'bad'}'>${analysis?.mustHave?.passed ? 'PASS' : 'FAIL'}</span>
            </div>
            <div class='small' style='margin-top:8px'>${(analysis?.mustHave?.reasons || []).map(esc).join('<br/>')}</div>
          </div>

          <div class='card' style='margin-top:12px'>
            <h3>Claims</h3>
            <table class='table'>
              <tr><th>Risk</th><th>Claim</th><th>Evidence</th></tr>
              ${claimsRows || `<tr><td colspan='3' class='small'>Keine Claims gefunden.</td></tr>`}
            </table>
          </div>

          <div class='card' style='margin-top:12px'>
            <h3>Follow-ups</h3>
            <ul>${(analysis?.followUps || []).map(q=>`<li>${esc(q)}</li>`).join('') || `<li class='small'>-</li>`}</ul>
          </div>

          <div class='card' style='margin-top:12px'>
            <h3>Proof-of-Work (Rubrik)</h3>
            ${tasks.map(t=>`
              <div class='card' style='margin-top:10px'>
                <div><strong>${esc(t.title)}</strong></div>
                <pre class='mono' style='margin-top:8px'>${esc(t.prompt)}</pre>
              </div>
            `).join('') || `<div class='small'>Keine Tasks.</div>`}
          </div>

          <div class='card' style='margin-top:12px'>
            <h3>Rohtext</h3>
            <pre class='mono'>${esc(a.text || '')}</pre>
          </div>

          <div class='card' style='margin-top:12px'>
            <h3>Audit</h3>
            <table class='table'>
              <tr><th>Zeit</th><th>Action</th><th>Payload</th></tr>
              ${events.slice().reverse().map(e=>`<tr><td class='small'>${esc(fmtDate(e.createdAt))}</td><td class='mono'>${esc(e.action)}</td><td class='small mono'>${esc(JSON.stringify(e.payload || {}))}</td></tr>`).join('') || `<tr><td colspan='3' class='small'>-</td></tr>`}
            </table>
          </div>
        </div>
      `;
    };

    const loadList = async () => {
      if (!state.pilot.jobId) {
        state.pilot.list = { items: [], total: 0, page: 1, limit: state.pilot.filters.limit };
        return;
      }
      const f = state.pilot.filters;
      const qs = new URLSearchParams({
        tenantId: state.pilot.tenantId,
        jobId: state.pilot.jobId,
        status: f.status || '',
        mustHave: f.mustHave || '',
        q: f.q || '',
        collapsedClusters: f.collapsedClusters ? '1' : '0',
        sort: f.sort,
        page: String(f.page),
        limit: String(f.limit)
      });
      const res = await fetchJSON('/api/pilot/applications?' + qs.toString());
      state.pilot.list = res.data;
    };

    const refresh = async () => {
      ensureValidSelection();
      fillSelectors();
      $status.value = state.pilot.filters.status;
      $must.value = state.pilot.filters.mustHave;
      $q.value = state.pilot.filters.q;
      $sort.value = state.pilot.filters.sort;
      $collapsed.checked = Boolean(state.pilot.filters.collapsedClusters);
      renderRubric();

      $wrap.innerHTML = 'Lade...';
      await loadList();
      $wrap.innerHTML = renderTable(state.pilot.list);
      const cl = state.pilot.list.cluster;
      const clInfo = cl && Array.isArray(cl.clusters) ? ` · clusters ${cl.clusters.length} (${fmtDate(cl.computedAt)})` : '';
      $meta.textContent = `${state.pilot.list.total} items · page ${state.pilot.list.page}${clInfo}`;

      $wrap.querySelectorAll('tr[data-app]').forEach(tr=>{
        tr.onclick = async () => {
          const id = tr.dataset.app;
          state.pilot.selectedAppId = id;
          const detailUrl = () => `/api/pilot/applications/${id}?tenantId=${encodeURIComponent(state.pilot.tenantId)}`;

          const bindDetail = () => {
            const $save = document.getElementById('detailSaveStatus');
            const $addNote = document.getElementById('detailAddNote');
            const $send = document.getElementById('detailSendAssessment');

            if ($save) $save.onclick = async () => {
              const st = document.getElementById('detailStatus').value;
              await fetchJSON(`/api/pilot/applications/${id}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId: state.pilot.tenantId, status: st})});
              await refresh();
              await showDetail();
            };
            if ($addNote) $addNote.onclick = async () => {
              const txt = document.getElementById('detailNote').value;
              await fetchJSON(`/api/pilot/applications/${id}/note`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId: state.pilot.tenantId, text: txt})});
              await refresh();
              await showDetail();
            };
            if ($send) $send.onclick = async () => {
              await fetchJSON(`/api/pilot/applications/${id}/assessment/send`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId: state.pilot.tenantId})});
              await showDetail();
            };
          };

          const showDetail = async () => {
            const d = await fetchJSON(detailUrl());
            $detail.innerHTML = renderDetail(d.data);
            bindDetail();
          };

          $detail.innerHTML = `<div class='card'>Lade Details...</div>`;
          await showDetail();
        };
      });
    };

    $tenant.onchange = async () => {
      state.pilot.tenantId = $tenant.value;
      state.pilot.teamId = null;
      state.pilot.jobId = null;
      state.pilot.filters.page = 1;
      await refresh();
    };
    $team.onchange = async () => {
      state.pilot.teamId = $team.value;
      state.pilot.jobId = null;
      state.pilot.filters.page = 1;
      await refresh();
    };
    $job.onchange = async () => {
      state.pilot.jobId = $job.value;
      state.pilot.filters.page = 1;
      $detail.innerHTML = `<div class='card'>Waehle links eine Bewerbung aus.</div>`;
      await refresh();
    };

    $rubricBtn.onclick = () => { $rubric.classList.toggle('hidden'); };

    $seed.onclick = async () => {
      if (!state.pilot.jobId) return;
      $seed.textContent = 'Seeding...';
      await fetchJSON('/api/pilot/seed', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId: state.pilot.tenantId, jobId: state.pilot.jobId, count: 200})});
      await setContext();
      $seed.textContent = 'Seed: 200 Bewerbungen';
      await refresh();
    };

    $cluster.onclick = async () => {
      if (!state.pilot.jobId) return;
      $cluster.textContent = 'Clustere...';
      await fetchJSON('/api/pilot/cluster', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId: state.pilot.tenantId, jobId: state.pilot.jobId})});
      $cluster.textContent = 'Duplikate clustern';
      await refresh();
    };

    $refresh.onclick = refresh;

    $status.onchange = async () => { state.pilot.filters.status = $status.value; state.pilot.filters.page = 1; await refresh(); };
    $must.onchange = async () => { state.pilot.filters.mustHave = $must.value; state.pilot.filters.page = 1; await refresh(); };
    $sort.onchange = async () => { state.pilot.filters.sort = $sort.value; state.pilot.filters.page = 1; await refresh(); };
    $collapsed.onchange = async () => { state.pilot.filters.collapsedClusters = $collapsed.checked; state.pilot.filters.page = 1; await refresh(); };
    $q.oninput = () => { state.pilot.filters.q = $q.value; };
    $q.onkeydown = async (e) => { if (e.key === 'Enter') { state.pilot.filters.page = 1; await refresh(); } };

    $prev.onclick = async () => { state.pilot.filters.page = Math.max(1, state.pilot.filters.page - 1); await refresh(); };
    $next.onclick = async () => { state.pilot.filters.page = state.pilot.filters.page + 1; await refresh(); };

    refresh();
  };

  return { html, afterRender };
}

async function loadTriage(){
  state.triage ??= { jobFamily: 'software', selectedAppId: null };
  if (!state.triageDemo) state.triageDemo = await fetchJSON('/api/triage/demo');
  const demo = state.triageDemo.data;

  const initialFamily = demo.jobFamilies.some(j=>j.id===state.triage.jobFamily) ? state.triage.jobFamily : demo.jobFamilies[0]?.id || 'software';

  const html = `
    <h2>Bewerbungs-Triage (KI-Text-resilient)</h2>
    <div class='small'>Ziel: Claim-to-Evidence + Duplikat-Cluster + kurze Proof-of-Work Aufgaben. Kein "AI-Detektor".</div>
    <div class='split' style='margin-top:12px'>
      <div class='card'>
        <div class='grid2'>
          <div>
            <div class='small'>Job-Familie</div>
            <select id='triageJobFamily'></select>
          </div>
          <div>
            <div class='small'>Demo-Bewerbung</div>
            <select id='triageDemoSelect'></select>
          </div>
        </div>
        <div class='row' style='margin-top:8px'>
          <label class='small'><input type='checkbox' id='triageUseLLM'/> Ollama (lokal) Enrichment</label>
          <span class='small mono'>TRIAGE_USE_OLLAMA=1 OLLAMA_MODEL=...</span>
        </div>
        <div style='margin-top:10px' class='small'>Bewerbungstext</div>
        <textarea id='triageText' rows='12' placeholder='Text hier einfuegen...'></textarea>
        <div class='row'>
          <button class='btn primary' id='triageAnalyzeBtn'>Analysieren</button>
          <button class='btn' id='triageClusterBtn'>Duplikate clustern</button>
        </div>
        <div class='small' style='margin-top:10px'>API: <span class='mono'>/api/triage/*</span></div>
      </div>
      <div id='triageOut'>
        <div class='card'>Analyse-Ausgabe erscheint hier.</div>
      </div>
    </div>
  `;

  const afterRender = () => {
    const $family = document.getElementById('triageJobFamily');
    const $demo = document.getElementById('triageDemoSelect');
    const $text = document.getElementById('triageText');
    const $out = document.getElementById('triageOut');
    const $analyze = document.getElementById('triageAnalyzeBtn');
    const $cluster = document.getElementById('triageClusterBtn');
    const $useLLM = document.getElementById('triageUseLLM');

    const setOut = (inner) => { $out.innerHTML = inner; };

    const renderAnalysis = (a) => {
      const mh = a.mustHave || {};
      const missingReq = (mh.missingRequired || []).map(esc);
      const missingNice = (mh.missingNiceToHave || []).map(esc);

      const llmPill = a.llm?.used
        ? `<span class='pill good'>LLM: ${esc(a.llm.provider)} ${esc(a.llm.model || '')}</span>`
        : a.llm?.reason
          ? `<span class='pill warn'>LLM: ${esc(a.llm.reason)}</span>`
          : `<span class='pill'>LLM: off</span>`;

      const llmSummary = a.llm?.used && a.llm?.summary
        ? `<div class='card' style='margin-top:12px'><h3>LLM Summary</h3><div>${esc(a.llm.summary)}</div></div>`
        : '';

      const scoreRow = `
        <div class='grid3'>
          <div class='card'><div class='small'>Overall</div><div class='big'>${badgeScore(a.scores.overall)}</div></div>
          <div class='card'><div class='small'>Fit</div><div class='big'>${badgeScore(a.scores.fit)}</div></div>
          <div class='card'><div class='small'>Evidence</div><div class='big'>${badgeScore(a.scores.evidence)}</div></div>
        </div>
        <div class='card' style='margin-top:12px'><div class='small'>Template-Risiko (niedrig ist gut)</div><div class='big'>${badgeScore(a.scores.templateRisk, false)}</div></div>
        <div class='card' style='margin-top:12px'><h3>LLM (optional)</h3><div class='row'>${llmPill}</div><div class='small'>Hinweis: LLM ist nur Enrichment. Gate/Score funktionieren ohne LLM.</div></div>
      `;

      const mustHaveCard = `
        <div class='card' style='margin-top:12px'>
          <h3>Must-have Gate</h3>
          <div class='row'>
            <span class='pill ${mh.passed ? 'good' : 'bad'}'>${mh.passed ? 'PASS' : 'FAIL'}</span>
            ${missingReq.length ? `<span class='pill warn'>Fehlt: ${missingReq.join(', ')}</span>` : `<span class='pill good'>Keine Must-haves fehlen</span>`}
          </div>
          ${missingNice.length ? `<div class='small' style='margin-top:8px'>Nice-to-have fehlen: ${missingNice.join(', ')}</div>` : `<div class='small' style='margin-top:8px'>Nice-to-have: ok</div>`}
        </div>
      `;

      const claimsRows = (a.claims || []).map(c=>`
        <tr>
          <td>${esc(c.risk)}</td>
          <td>${esc(c.claim)}</td>
          <td class='mono'>${(c.evidence||[]).map(esc).join(' | ')}</td>
          <td>${esc(c.followUpQuestion)}</td>
        </tr>
      `).join('');
      const claimsCard = `
        <div class='card' style='margin-top:12px'>
          <h3>Claims (heuristisch)</h3>
          <table class='table'>
            <tr><th>Risk</th><th>Claim</th><th>Evidence</th><th>Follow-up</th></tr>
            ${claimsRows || `<tr><td colspan='4' class='small'>Keine Claims gefunden (oder Text ist sehr generisch).</td></tr>`}
          </table>
        </div>
      `;

      const followUps = (a.followUps || []).map(q=>`<li>${esc(q)}</li>`).join('');
      const followUpCard = `
        <div class='card' style='margin-top:12px'>
          <h3>Empfohlene Screening-Fragen</h3>
          <ul>${followUps || `<li class='small'>Keine spezifischen Follow-ups generiert.</li>`}</ul>
        </div>
      `;

      const tasks = a.microAssessment?.tasks || [];
      const assessmentCard = `
        <div class='card' style='margin-top:12px'>
          <h3>Proof-of-Work (Micro-Assessment, ${esc(a.microAssessment?.timeboxMinutes || '')} Min)</h3>
          ${tasks.map(t=>`
            <div class='card' style='margin-top:10px'>
              <div class='row' style='justify-content:space-between;align-items:center'>
                <div><strong>${esc(t.title)}</strong></div>
                <span class='pill'>${esc(a.jobFamily)}</span>
              </div>
              <pre class='mono' style='margin-top:8px'>${esc(t.prompt)}</pre>
              <div class='small'>Rubrik</div>
              <ul>${(t.rubric||[]).map(r=>`<li>${esc(r)}</li>`).join('')}</ul>
            </div>
          `).join('')}
        </div>
      `;

      return scoreRow + mustHaveCard + claimsCard + followUpCard + assessmentCard + llmSummary;
    };

    const renderClusters = (d, familyApps) => {
      const clusters = d.clusters || [];
      if (!clusters.length) return `<div class='card'>Keine Duplikat-Cluster gefunden (Threshold ${esc(d.threshold)}).</div>`;
      const byId = new Map(familyApps.map(a=>[a.id,a]));
      return `
        <div class='card'>
          <h3>Duplikat-Cluster</h3>
          <div class='small'>Threshold: ${esc(d.threshold)} (3-gram Jaccard)</div>
          ${clusters.map(cl=>`
            <div class='card' style='margin-top:10px'>
              <div class='row' style='justify-content:space-between;align-items:center'>
                <div><strong>${esc(cl.clusterId)}</strong> <span class='small'>avg sim ${esc(cl.avgSimilarity)}</span></div>
                <span class='pill'>${esc(cl.items.length)} items</span>
              </div>
              <div class='small' style='margin-top:8px'>Representative: ${esc(cl.representativeId)} ${esc(byId.get(cl.representativeId)?.label || '')}</div>
              <ul style='margin-top:8px'>${cl.items.map(id=>`<li class='mono'>${esc(id)} ${esc(byId.get(id)?.label || '')}</li>`).join('')}</ul>
            </div>
          `).join('')}
        </div>
      `;
    };

    const familyApps = (family) => (demo.applications || []).filter(a=>a.jobFamily===family);

    const fillDemoSelect = (family) => {
      const apps = familyApps(family);
      if (!apps.length) {
        $demo.innerHTML = `<option value=''>Keine Demos</option>`;
        state.triage.selectedAppId = null;
        $text.value = '';
        return;
      }
      if (!state.triage.selectedAppId || !apps.some(a=>a.id===state.triage.selectedAppId)) state.triage.selectedAppId = apps[0].id;
      $demo.innerHTML = apps.map(a=>`<option value='${esc(a.id)}' ${a.id===state.triage.selectedAppId?'selected':''}>${esc(a.label)} (${esc(a.id)})</option>`).join('');
      const sel = apps.find(a=>a.id===state.triage.selectedAppId);
      $text.value = sel?.text || '';
    };

    $family.innerHTML = (demo.jobFamilies || []).map(j=>`<option value='${esc(j.id)}' ${j.id===initialFamily?'selected':''}>${esc(j.label)}</option>`).join('');
    fillDemoSelect(initialFamily);

    $family.onchange = () => {
      state.triage.jobFamily = $family.value;
      fillDemoSelect($family.value);
      setOut(`<div class='card'>Analyse-Ausgabe erscheint hier.</div>`);
    };
    $demo.onchange = () => {
      state.triage.selectedAppId = $demo.value;
      const sel = familyApps($family.value).find(a=>a.id===$demo.value);
      $text.value = sel?.text || '';
    };

    $analyze.onclick = async () => {
      setOut(`<div class='card'>Analysiere...</div>`);
      const res = await fetchJSON('/api/triage/analyze', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobFamily:$family.value,applicationText:$text.value,useLLM:$useLLM.checked})});
      if (!res?.success) return setOut(`<div class='card'>Fehler: ${esc(res?.error || 'unbekannt')}</div>`);
      setOut(renderAnalysis(res.data));
    };

    $cluster.onclick = async () => {
      setOut(`<div class='card'>Clustere...</div>`);
      const apps = familyApps($family.value).map(a=>({id:a.id,text:a.text}));
      const res = await fetchJSON('/api/triage/cluster', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({applications:apps,threshold:0.82,shingleSize:3})});
      if (!res?.success) return setOut(`<div class='card'>Fehler: ${esc(res?.error || 'unbekannt')}</div>`);
      setOut(renderClusters(res.data, familyApps($family.value)));
    };
  };

  return { html, afterRender };
}

async function render(){
  app.innerHTML = `<div class='layout'><aside class='sidebar'><h3>RecruiterIQ</h3>${routes.map(([id,l])=>`<button data-route='${id}'>${l}</button>`).join('')}</aside><main class='main'><div class='small'>/${current}</div><div id='view'>Lade...</div></main></div>`;
  app.querySelectorAll('button[data-route]').forEach(btn=>btn.onclick=()=>{
    const id = btn.dataset.route;
    if (!id || id === current) return;
    current = id;
    history.pushState({}, '', '/' + id);
    render();
  });
  const views={dashboard:loadDashboard,pipeline:loadPipeline,inbox:loadInbox,triage:loadTriage,copilot:loadCopilot,market:loadMarket,agent:loadAgent,'talent-pool':loadSilver,companies:loadCompanies,interviews:loadInterviews};
  const view = await views[current]();
  const html = typeof view === 'string' ? view : view?.html || '';
  document.getElementById('view').innerHTML = html;
  if (view && typeof view === 'object' && typeof view.afterRender === 'function') view.afterRender();
}

render();

window.addEventListener('popstate', () => {
  const next = pathRoute();
  if (next !== current) {
    current = next;
    render();
  }
});
