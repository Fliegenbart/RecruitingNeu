const routes = [
  ['dashboard','Dashboard'],
  ['pipeline','Pipeline'],
  ['worklist','Worklist'],
  ['inbox','Inbox'],
  ['sequences','Sequences'],
  ['templates','Templates'],
  ['integrations','Integrations'],
  ['analytics','Analytics'],
  ['hm','Hiring Manager'],
  ['assessment','Assessment (Public)'],
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

const isAuthed = () => localStorage.getItem('rx_auth') === '1';

const authHeader = () => {
  const uid = state?.auth?.userId || localStorage.getItem('rx_user') || '';
  return uid ? { 'X-User-Id': uid } : {};
};
const fetchJSON = (url, opts={}) => {
  const headers = { ...(opts.headers || {}), ...authHeader() };
  return fetch(url, { ...opts, headers }).then(r=>r.json());
};
const badge = (v)=> v>70?'<span class="badge green">'+v+'</span>':v>=40?'<span class="badge yellow">'+v+'</span>':'<span class="badge red">'+v+'</span>';
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

const qs = (obj) => new URLSearchParams(Object.entries(obj).filter(([,v]) => v !== undefined && v !== null)).toString();

async function ensurePilotContext(){
  if (!state.pilot?.context) state.pilot = { ...(state.pilot||{}), context: await fetchJSON('/api/pilot/context') };
  const users = state.pilot.context?.data?.users || [];
  if (!state.auth) state.auth = { userId: '' };
  const saved = localStorage.getItem('rx_user') || '';
  const pick = (saved && users.find(u=>u.id===saved)) ? saved : (users.find(u=>u.role==='recruiter')?.id || users[0]?.id || '');
  if (!state.auth.userId) state.auth.userId = pick;
  if (state.auth.userId) localStorage.setItem('rx_user', state.auth.userId);
  return state.pilot.context;
}

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

async function loadWorklist(){
  state.worklist ??= { tenantId: null, userId: '' };
  if (!state.pilot?.context) state.pilot = { ...(state.pilot||{}), context: await fetchJSON('/api/pilot/context') };
  const ctx = state.pilot.context.data;
  const tenants = ctx.tenants || [];
  const users = ctx.users || [];
  if (!state.worklist.tenantId && tenants.length) state.worklist.tenantId = tenants[0].id;

  const html = `
    <h2>Worklist (Today)</h2>
    <div class='small'>Schneller Einstieg: Priorisierte Kacheln. Klick fuehrt dich direkt zur Bewerbung in der Inbox.</div>
    <div class='card' style='margin-top:12px'>
      <div class='grid2'>
        <div>
          <div class='small'>Tenant</div>
          <select id='wlTenant'></select>
        </div>
        <div>
          <div class='small'>Recruiter (optional)</div>
          <select id='wlUser'></select>
        </div>
      </div>
      <div class='row'><button class='btn primary' id='wlRefresh'>Refresh</button></div>
    </div>
    <div id='wlOut' style='margin-top:12px'><div class='card'>Lade...</div></div>
  `;

  const afterRender = () => {
    const $t = document.getElementById('wlTenant');
    const $u = document.getElementById('wlUser');
    const $out = document.getElementById('wlOut');
    const $r = document.getElementById('wlRefresh');

    const renderSection = (title, items) => `
      <div class='card' style='margin-top:12px'>
        <div class='row' style='justify-content:space-between;align-items:center'>
          <h3 style='margin:0'>${esc(title)}</h3>
          <span class='pill'>${esc(items.length)}</span>
        </div>
        ${items.length ? `
          <table class='table' style='margin-top:8px'>
            <tr><th>Kandidat</th><th>Job</th><th>Overall</th><th>Evidence</th><th>TemplateRisk</th></tr>
            ${items.map(a=>`
              <tr class='click' data-app='${esc(a.id)}'>
                <td><strong>${esc(a.candidateName)}</strong><div class='small'>${esc(fmtDate(a.submittedAt))} · ${esc(a.status)}</div></td>
                <td class='small'>${esc(a.jobTitle)}</td>
                <td>${badgeScore(a.overall || 0)}</td>
                <td>${badgeScore(a.evidence || 0)}</td>
                <td>${badgeScore(a.templateRisk || 0, false)}</td>
              </tr>
            `).join('')}
          </table>
        ` : `<div class='small' style='margin-top:8px'>Keine Items.</div>`}
      </div>
    `;

    const load = async () => {
      $out.innerHTML = `<div class='card'>Lade...</div>`;
      const res = await fetchJSON('/api/pilot/worklist?' + qs({ tenantId: $t.value, userId: $u.value || undefined }));
      if (!res?.success) return $out.innerHTML = `<div class='card'>Fehler: ${esc(res?.error || 'unbekannt')}</div>`;
      const d = res.data;
      $out.innerHTML =
        renderSection('New', d.new || []) +
        renderSection('Needs Info', d.needs_info || []) +
        renderSection('Waiting HM', d.waiting_hm || []) +
        renderSection('Assessment Due', d.assessment_due || []);

      $out.querySelectorAll('[data-app]').forEach((tr) => {
        tr.onclick = () => {
          const id = tr.dataset.app;
          history.pushState({}, '', '/inbox?appId=' + encodeURIComponent(id));
          current = 'inbox';
          render();
        };
      });
    };

    $t.innerHTML = tenants.map(t=>`<option value='${esc(t.id)}' ${t.id===state.worklist.tenantId?'selected':''}>${esc(t.name)}</option>`).join('');
    const tUsers = users.filter(u=>u.tenantId===$t.value && u.role==='recruiter');
    $u.innerHTML = [`<option value=''>Alle</option>`, ...tUsers.map(u=>`<option value='${esc(u.id)}'>${esc(u.name)}</option>`)].join('');
    $u.value = state.worklist.userId || '';

    $t.onchange = () => {
      state.worklist.tenantId = $t.value;
      const tu = users.filter(u=>u.tenantId===$t.value && u.role==='recruiter');
      $u.innerHTML = [`<option value=''>Alle</option>`, ...tu.map(u=>`<option value='${esc(u.id)}'>${esc(u.name)}</option>`)].join('');
      $u.value = '';
      load();
    };
    $u.onchange = () => { state.worklist.userId = $u.value; load(); };
    $r.onclick = load;

    load();
  };

  return { html, afterRender };
}

async function loadTemplates(){
  state.templates ??= { tenantId: null, selectedId: null };
  if (!state.pilot?.context) state.pilot = { ...(state.pilot||{}), context: await fetchJSON('/api/pilot/context') };
  const ctx = state.pilot.context.data;
  const tenants = ctx.tenants || [];
  if (!state.templates.tenantId && tenants.length) state.templates.tenantId = tenants[0].id;

  const html = `
    <h2>Templates</h2>
    <div class='small'>Kommunikation aus der Inbox: Variablen via <span class='mono'>{{candidateName}}</span>, <span class='mono'>{{jobTitle}}</span>, <span class='mono'>{{senderName}}</span>.</div>
    <div class='card' style='margin-top:12px'>
      <div class='grid2'>
        <div>
          <div class='small'>Tenant</div>
          <select id='tplTenant'></select>
        </div>
        <div>
          <div class='small'>Template</div>
          <select id='tplSelect'></select>
        </div>
      </div>
      <div class='row'>
        <button class='btn' id='tplNew'>New</button>
        <button class='btn primary' id='tplSave'>Save</button>
        <button class='btn' id='tplRefresh'>Refresh</button>
      </div>
    </div>
    <div class='grid2' style='margin-top:12px'>
      <div class='card'>
        <div class='small'>Name</div>
        <input id='tplName'/>
        <div class='small' style='margin-top:10px'>Channel</div>
        <select id='tplChannel'>
          <option value='email'>email</option>
          <option value='sms'>sms</option>
          <option value='linkedin'>linkedin</option>
        </select>
        <div class='small' style='margin-top:10px'>Subject</div>
        <input id='tplSubject'/>
        <div class='small' style='margin-top:10px'>Body</div>
        <textarea id='tplBody' rows='10'></textarea>
      </div>
      <div class='card'>
        <h3>Preview</h3>
        <div class='small'>Beispielvariablen</div>
        <pre class='mono' id='tplVars'>{"candidateName":"Emma Richter","jobTitle":"Fullstack Engineer","senderName":"Leonie Weber","question":"Kannst du das kurz belegen?"}</pre>
        <div class='row'><button class='btn' id='tplPreviewBtn'>Render</button></div>
        <div class='card' style='margin-top:12px'>
          <div class='small'>Subject</div>
          <div id='tplPreviewSubject' class='mono'></div>
          <div class='small' style='margin-top:10px'>Body</div>
          <pre id='tplPreviewBody' class='mono'></pre>
        </div>
      </div>
    </div>
  `;

  const afterRender = () => {
    const $tenant = document.getElementById('tplTenant');
    const $sel = document.getElementById('tplSelect');
    const $name = document.getElementById('tplName');
    const $channel = document.getElementById('tplChannel');
    const $subject = document.getElementById('tplSubject');
    const $body = document.getElementById('tplBody');
    const $new = document.getElementById('tplNew');
    const $save = document.getElementById('tplSave');
    const $refresh = document.getElementById('tplRefresh');
    const $vars = document.getElementById('tplVars');
    const $prevBtn = document.getElementById('tplPreviewBtn');
    const $pSub = document.getElementById('tplPreviewSubject');
    const $pBody = document.getElementById('tplPreviewBody');

    let templates = [];

    const fill = () => {
      $tenant.innerHTML = tenants.map(t=>`<option value='${esc(t.id)}' ${t.id===state.templates.tenantId?'selected':''}>${esc(t.name)}</option>`).join('');
    };

    const selectTemplate = (id) => {
      const t = templates.find(x=>x.id===id) || null;
      state.templates.selectedId = t?.id || null;
      $name.value = t?.name || '';
      $channel.value = t?.channel || 'email';
      $subject.value = t?.subject || '';
      $body.value = t?.body || '';
    };

    const load = async () => {
      const res = await fetchJSON('/api/pilot/templates?' + qs({ tenantId: $tenant.value }));
      templates = res?.success ? res.data : [];
      if (!templates.length) {
        $sel.innerHTML = `<option value=''>No templates</option>`;
        selectTemplate(null);
        return;
      }
      if (!state.templates.selectedId || !templates.some(t=>t.id===state.templates.selectedId)) state.templates.selectedId = templates[0].id;
      $sel.innerHTML = templates.map(t=>`<option value='${esc(t.id)}' ${t.id===state.templates.selectedId?'selected':''}>${esc(t.name)}</option>`).join('');
      selectTemplate(state.templates.selectedId);
    };

    const renderPreview = () => {
      let vars = {};
      try { vars = JSON.parse($vars.textContent || '{}'); } catch {}
      const sub = $subject.value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_,k)=>vars[k] ?? '');
      const bod = $body.value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_,k)=>vars[k] ?? '');
      $pSub.textContent = sub;
      $pBody.textContent = bod;
    };

    fill();
    load();
    $tenant.onchange = async () => { state.templates.tenantId = $tenant.value; state.templates.selectedId = null; await load(); };
    $sel.onchange = () => selectTemplate($sel.value);
    $refresh.onclick = load;
    $prevBtn.onclick = renderPreview;

    $new.onclick = async () => {
      const res = await fetchJSON('/api/pilot/templates', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:$tenant.value,name:'New Template',channel:'email',subject:'',body:''})});
      if (!res?.success) return alert(res?.error || 'Fehler');
      state.templates.selectedId = res.data.id;
      await load();
    };

    $save.onclick = async () => {
      const id = state.templates.selectedId;
      if (!id) return;
      const res = await fetchJSON('/api/pilot/templates/' + id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:$tenant.value,name:$name.value,channel:$channel.value,subject:$subject.value,body:$body.value})});
      if (!res?.success) return alert(res?.error || 'Fehler');
      await load();
      renderPreview();
    };
  };

  return { html, afterRender };
}

async function loadSequences(){
  state.sequences ??= { tenantId: null, selectedId: null };
  const ctx = state.pilot.context.data;
  const tenants = ctx.tenants || [];
  const templates = ctx.templates || [];
  if (!state.sequences.tenantId && tenants.length) state.sequences.tenantId = tenants[0].id;

  const html = `
    <h2>Sequences</h2>
    <div class='small'>Einfacher Drip: steps mit <span class='mono'>afterDays</span> und Template. "Run due" simuliert einen Scheduler.</div>
    <div class='card' style='margin-top:12px'>
      <div class='grid2'>
        <div>
          <div class='small'>Tenant</div>
          <select id='seqTenant'></select>
        </div>
        <div>
          <div class='small'>Sequence</div>
          <select id='seqSelect'></select>
        </div>
      </div>
      <div class='row'>
        <button class='btn' id='seqNew'>New</button>
        <button class='btn primary' id='seqSave'>Save</button>
        <button class='btn' id='seqRun'>Run due</button>
        <button class='btn' id='seqRefresh'>Refresh</button>
        <span class='small' id='seqMeta'></span>
      </div>
    </div>
    <div class='card' style='margin-top:12px'>
      <div class='small'>Name</div>
      <input id='seqName'/>
      <div class='small' style='margin-top:10px'>Steps</div>
      <div id='seqSteps'></div>
      <div class='row'><button class='btn' id='seqAddStep'>+ Step</button></div>
    </div>
  `;

  const afterRender = () => {
    const $t = document.getElementById('seqTenant');
    const $s = document.getElementById('seqSelect');
    const $name = document.getElementById('seqName');
    const $steps = document.getElementById('seqSteps');
    const $meta = document.getElementById('seqMeta');
    const $new = document.getElementById('seqNew');
    const $save = document.getElementById('seqSave');
    const $run = document.getElementById('seqRun');
    const $ref = document.getElementById('seqRefresh');
    const $add = document.getElementById('seqAddStep');

    const tplOptions = (tenantId) =>
      templates
        .filter(x=>x.tenantId===tenantId)
        .map(x=>`<option value='${esc(x.id)}'>${esc(x.name)} · ${esc(x.channel)}</option>`)
        .join('');

    const readSteps = () => {
      return Array.from($steps.querySelectorAll('[data-step]')).map((row) => {
        const afterDays = Number(row.querySelector('input[data-after]').value || 0);
        const templateId = row.querySelector('select[data-tpl]').value;
        let variables = {};
        try { variables = JSON.parse(row.querySelector('textarea[data-vars]').value || '{}'); } catch { variables = {}; }
        return { afterDays, templateId, variables };
      });
    };

    const renderSteps = (tenantId, steps=[]) => {
      $steps.innerHTML = (steps.length ? steps : [{ afterDays: 0, templateId: '', variables: {} }]).map((st, idx) => `
        <div class='card' data-step='${idx}' style='margin-top:10px'>
          <div class='grid3'>
            <div>
              <div class='small'>afterDays</div>
              <input data-after value='${esc(st.afterDays ?? 0)}'/>
            </div>
            <div style='grid-column:span 2'>
              <div class='small'>Template</div>
              <select data-tpl>
                <option value=''>-</option>
                ${tplOptions(tenantId)}
              </select>
            </div>
          </div>
          <div class='small' style='margin-top:8px'>variables (JSON)</div>
          <textarea data-vars rows='3' class='mono'>${esc(JSON.stringify(st.variables || {}, null, 2))}</textarea>
        </div>
      `).join('');
      // set selects
      Array.from($steps.querySelectorAll('select[data-tpl]')).forEach((sel, i) => { sel.value = steps[i]?.templateId || ''; });
    };

    const load = async () => {
      $meta.textContent = 'Lade...';
      const res = await fetchJSON('/api/pilot/sequences?' + qs({ tenantId: $t.value }));
      if (!res?.success) { $meta.textContent = 'Fehler'; return; }
      const items = res.data || [];
      if (!state.sequences.selectedId && items.length) state.sequences.selectedId = items[0].id;
      $s.innerHTML = items.map(x=>`<option value='${esc(x.id)}'>${esc(x.name)}</option>`).join('') || `<option value=''>-</option>`;
      $s.value = state.sequences.selectedId || '';
      const sel = items.find(x=>x.id===$s.value) || null;
      $name.value = sel?.name || '';
      renderSteps($t.value, sel?.steps || []);
      $meta.textContent = `${items.length} sequences`;
    };

    $t.innerHTML = tenants.map(t=>`<option value='${esc(t.id)}' ${t.id===state.sequences.tenantId?'selected':''}>${esc(t.name)}</option>`).join('');
    $t.onchange = () => { state.sequences.tenantId = $t.value; state.sequences.selectedId = null; load(); };
    $s.onchange = () => { state.sequences.selectedId = $s.value; load(); };

    $new.onclick = async () => {
      const res = await fetchJSON('/api/pilot/sequences', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:$t.value,name:'New sequence',steps:[]})});
      if (!res?.success) return alert(res?.error || 'Fehler');
      state.sequences.selectedId = res.data.id;
      await load();
    };
    $save.onclick = async () => {
      const id = $s.value;
      if (!id) return;
      const payload = { tenantId:$t.value, name:$name.value, steps: readSteps() };
      const res = await fetchJSON('/api/pilot/sequences/' + encodeURIComponent(id), {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if (!res?.success) return alert(res?.error || 'Fehler');
      await load();
    };
    $run.onclick = async () => {
      const res = await fetchJSON('/api/pilot/sequences/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:$t.value})});
      if (!res?.success) return alert(res?.error || 'Fehler');
      $meta.textContent = `sent: ${res.data.sent}`;
    };
    $ref.onclick = load;
    $add.onclick = () => {
      const cur = readSteps();
      cur.push({ afterDays: 3, templateId: '', variables: {} });
      renderSteps($t.value, cur);
    };

    load();
  };

  return { html, afterRender };
}

async function loadIntegrations(){
  state.integrations ??= { tenantId: null, jobId: null, csv: '' };
  const ctx = state.pilot.context.data;
  const tenants = ctx.tenants || [];
  const jobs = ctx.jobs || [];
  if (!state.integrations.tenantId && tenants.length) state.integrations.tenantId = tenants[0].id;
  if (!state.integrations.jobId) state.integrations.jobId = (jobs.find(j=>j.tenantId===state.integrations.tenantId)?.id || jobs[0]?.id || null);

  const html = `
    <h2>Integrations</h2>
    <div class='small'>CSV Import/Export (ATS Stub) + Audit Export.</div>
    <div class='card' style='margin-top:12px'>
      <div class='grid2'>
        <div>
          <div class='small'>Tenant</div>
          <select id='intTenant'></select>
        </div>
        <div>
          <div class='small'>Job</div>
          <select id='intJob'></select>
        </div>
      </div>
      <div class='row'>
        <a class='btn' id='intExportApps' href='#' target='_blank'>Export applications.csv</a>
        <a class='btn' id='intExportEvents' href='#' target='_blank'>Export events.csv</a>
      </div>
    </div>
    <div class='card' style='margin-top:12px'>
      <h3>CSV Import</h3>
      <div class='small'>Header: <span class='mono'>candidateName,text,source</span>. (id optional). Max 1000 rows.</div>
      <input type='file' id='intFile' accept='.csv,text/csv'/>
      <div class='small' style='margin-top:8px'>Oder Paste:</div>
      <textarea id='intCsv' rows='8' class='mono' placeholder='candidateName,text,source\\n...'></textarea>
      <div class='row'>
        <button class='btn primary' id='intImport'>Import + Analyze + Cluster</button>
        <span class='small' id='intMeta'></span>
      </div>
    </div>
  `;

  const afterRender = () => {
    const $t = document.getElementById('intTenant');
    const $j = document.getElementById('intJob');
    const $csv = document.getElementById('intCsv');
    const $file = document.getElementById('intFile');
    const $imp = document.getElementById('intImport');
    const $meta = document.getElementById('intMeta');
    const $ea = document.getElementById('intExportApps');
    const $ev = document.getElementById('intExportEvents');

    const fillJobs = () => {
      const tId = $t.value;
      const js = jobs.filter(x=>x.tenantId===tId);
      $j.innerHTML = js.map(x=>`<option value='${esc(x.id)}'>${esc(x.title)} (${esc(x.location||'')})</option>`).join('');
      if (!js.find(x=>x.id===state.integrations.jobId)) state.integrations.jobId = js[0]?.id || null;
      $j.value = state.integrations.jobId || '';
      $ea.href = '/api/pilot/export/applications.csv?' + qs({ tenantId: tId, jobId: $j.value });
      $ev.href = '/api/pilot/export/events.csv?' + qs({ tenantId: tId });
    };

    $t.innerHTML = tenants.map(t=>`<option value='${esc(t.id)}' ${t.id===state.integrations.tenantId?'selected':''}>${esc(t.name)}</option>`).join('');
    fillJobs();

    $t.onchange = () => { state.integrations.tenantId = $t.value; fillJobs(); };
    $j.onchange = () => { state.integrations.jobId = $j.value; fillJobs(); };

    $file.onchange = async () => {
      const f = $file.files?.[0];
      if (!f) return;
      $csv.value = await f.text();
    };

    $imp.onclick = async () => {
      $meta.textContent = 'Importing...';
      const res = await fetchJSON('/api/pilot/import/applications.csv', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:$t.value,jobId:$j.value,csv:$csv.value})});
      if (!res?.success) { $meta.textContent = 'Fehler: ' + (res?.error || 'unbekannt'); return; }
      $meta.textContent = `created: ${res.data.created} · clustered: ${res.data.clustered}`;
    };
  };

  return { html, afterRender };
}

async function loadAssessment(){
  const token = new URLSearchParams(location.search).get('token') || '';
  if (!token) return `<div class='card'>Missing token.</div>`;
  const d = await fetchJSON('/api/public/assessment/' + encodeURIComponent(token));
  if (!d?.success) return `<div class='card'>Fehler: ${esc(d?.error || 'unbekannt')}</div>`;
  const a = d.data;
  const html = `
    <h2>Proof-of-Work</h2>
    <div class='card'>
      <div><strong>${esc(a.candidateName)}</strong></div>
      <div class='small'>Role: ${esc(a.jobTitle)}</div>
      <div class='small'>Token: <span class='mono'>${esc(a.token)}</span></div>
    </div>
    <div class='card' style='margin-top:12px'>
      ${(a.tasks || []).map((t, idx)=>`
        <div class='card' style='margin-top:10px'>
          <div><strong>${esc(t.title || ('Task ' + (idx+1)))}</strong></div>
          <pre class='mono' style='margin-top:8px'>${esc(t.prompt || '')}</pre>
          <div class='small' style='margin-top:8px'>Your answer</div>
          <textarea class='mono' rows='6' data-answer='${idx}'></textarea>
        </div>
      `).join('') || `<div class='small'>No tasks.</div>`}
      <div class='row'>
        <button class='btn primary' id='asmtSubmit'>Submit</button>
        <span class='small' id='asmtMeta'></span>
      </div>
    </div>
  `;
  const afterRender = () => {
    const $m = document.getElementById('asmtMeta');
    document.getElementById('asmtSubmit').onclick = async () => {
      const answers = {};
      document.querySelectorAll('textarea[data-answer]').forEach((ta) => { answers[String(ta.dataset.answer)] = ta.value; });
      const res = await fetchJSON('/api/public/assessment/' + encodeURIComponent(token) + '/submit', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers})});
      if (!res?.success) { $m.textContent = 'Fehler: ' + (res?.error || 'unbekannt'); return; }
      $m.textContent = 'Submitted: ' + (res.data.submittedAt || '');
    };
  };
  return { html, afterRender };
}

async function loadAnalytics(){
  state.analytics ??= { tenantId: null };
  if (!state.pilot?.context) state.pilot = { ...(state.pilot||{}), context: await fetchJSON('/api/pilot/context') };
  const ctx = state.pilot.context.data;
  const tenants = ctx.tenants || [];
  if (!state.analytics.tenantId && tenants.length) state.analytics.tenantId = tenants[0].id;

  const html = `
    <h2>Analytics</h2>
    <div class='small'>ROI/Flow: Time-to-first-review, Status-Verteilung, Quality-Proxies.</div>
    <div class='card' style='margin-top:12px'>
      <div class='grid2'>
        <div>
          <div class='small'>Tenant</div>
          <select id='anTenant'></select>
        </div>
        <div>
          <div class='small'>Aktion</div>
          <div class='row' style='margin-top:0'><button class='btn primary' id='anRefresh'>Refresh</button></div>
        </div>
      </div>
    </div>
    <div id='anOut' style='margin-top:12px'><div class='card'>Lade...</div></div>
  `;

  const afterRender = () => {
    const $t = document.getElementById('anTenant');
    const $o = document.getElementById('anOut');
    const $r = document.getElementById('anRefresh');

    $t.innerHTML = tenants.map(t=>`<option value='${esc(t.id)}' ${t.id===state.analytics.tenantId?'selected':''}>${esc(t.name)}</option>`).join('');

    const render = (d) => `
      <div class='grid3'>
        <div class='card'><div class='small'>Applications</div><div class='big'>${esc(d.totals.applications)}</div></div>
        <div class='card'><div class='small'>Avg Time to First Review</div><div class='big'>${esc(Math.round((d.totals.avgTimeToFirstReviewMs||0)/60000))}m</div></div>
        <div class='card'><div class='small'>Jobs</div><div class='big'>${esc((d.byJob||[]).length)}</div></div>
      </div>
      <div class='card' style='margin-top:12px'>
        <h3>By Job</h3>
        <table class='table'>
          <tr><th>Job</th><th>Total</th><th>New</th><th>Reviewing</th><th>Shortlisted</th><th>Rejected</th><th>Avg Overall (Shortlisted)</th></tr>
          ${(d.byJob||[]).map(j=>`
            <tr>
              <td><strong>${esc(j.title)}</strong><div class='small'>${esc(j.family)} · ${esc(j.jobId)}</div></td>
              <td>${esc(j.total)}</td>
              <td>${esc(j.new)}</td>
              <td>${esc(j.reviewing)}</td>
              <td>${esc(j.shortlisted)}</td>
              <td>${esc(j.rejected)}</td>
              <td>${esc(j.avgOverallShortlisted)}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;

    const load = async () => {
      $o.innerHTML = `<div class='card'>Lade...</div>`;
      const res = await fetchJSON('/api/pilot/analytics?' + qs({ tenantId: $t.value }));
      if (!res?.success) return $o.innerHTML = `<div class='card'>Fehler: ${esc(res?.error || 'unbekannt')}</div>`;
      $o.innerHTML = render(res.data);
    };

    $t.onchange = () => { state.analytics.tenantId = $t.value; load(); };
    $r.onclick = load;
    load();
  };

  return { html, afterRender };
}

async function loadHm(){
  state.hm ??= { tenantId: null, jobId: null };
  if (!state.pilot?.context) state.pilot = { ...(state.pilot||{}), context: await fetchJSON('/api/pilot/context') };
  const ctx = state.pilot.context.data;
  const tenants = ctx.tenants || [];
  const jobsAll = ctx.jobs || [];
  if (!state.hm.tenantId && tenants.length) state.hm.tenantId = tenants[0].id;
  const jobs = jobsAll.filter(j=>j.tenantId===state.hm.tenantId);
  if (!state.hm.jobId && jobs.length) state.hm.jobId = jobs[0].id;

  const html = `
    <h2>Hiring Manager Portal (Pilot)</h2>
    <div class='small'>HM sieht nur Shortlist + Evidence Pack + Entscheidung.</div>
    <div class='card' style='margin-top:12px'>
      <div class='grid2'>
        <div>
          <div class='small'>Tenant</div>
          <select id='hmTenant'></select>
        </div>
        <div>
          <div class='small'>Job</div>
          <select id='hmJob'></select>
        </div>
      </div>
      <div class='row'><button class='btn primary' id='hmRefresh'>Refresh</button></div>
    </div>
    <div id='hmOut' style='margin-top:12px'><div class='card'>Lade...</div></div>
  `;

  const afterRender = () => {
    const $t = document.getElementById('hmTenant');
    const $j = document.getElementById('hmJob');
    const $o = document.getElementById('hmOut');
    const $r = document.getElementById('hmRefresh');

    const fill = () => {
      $t.innerHTML = tenants.map(t=>`<option value='${esc(t.id)}' ${t.id===state.hm.tenantId?'selected':''}>${esc(t.name)}</option>`).join('');
      const js = jobsAll.filter(x=>x.tenantId===$t.value);
      if (!state.hm.jobId || !js.some(x=>x.id===state.hm.jobId)) state.hm.jobId = js[0]?.id || null;
      $j.innerHTML = js.map(x=>`<option value='${esc(x.id)}' ${x.id===state.hm.jobId?'selected':''}>${esc(x.title)} (${esc(x.family)})</option>`).join('');
    };

    const card = (a) => {
      const ev = a.evidencePack;
      const strongest = (ev?.strongest || []).map(c=>`<li><span class='pill good'>${esc(c.risk)}</span> ${esc(c.claim)} <span class='small mono'>${esc((c.evidence||[]).join(' | '))}</span></li>`).join('');
      const weakest = (ev?.weakest || []).map(c=>`<li><span class='pill warn'>${esc(c.risk)}</span> ${esc(c.claim)} <span class='small mono'>${esc((c.evidence||[]).join(' | '))}</span></li>`).join('');
      const flags = (a.flags||[]).map(f=>`<li><span class='pill warn'>${esc(f.severity)}</span> ${esc(f.message)}</li>`).join('');
      return `
        <div class='card' style='margin-top:12px'>
          <div class='row' style='justify-content:space-between;align-items:center'>
            <div><strong>${esc(a.candidateName)}</strong> <span class='small'>${esc(fmtDate(a.submittedAt))}</span></div>
            <div class='row' style='margin-top:0'>
              ${badgeScore(a.scores?.overall || 0)}
              <span class='pill'>${esc(a.hmDecision || 'undecided')}</span>
            </div>
          </div>
          <div class='grid3' style='margin-top:10px'>
            <div class='card'><div class='small'>Evidence</div><div class='big'>${badgeScore(a.scores?.evidence || 0)}</div></div>
            <div class='card'><div class='small'>TemplateRisk</div><div class='big'>${badgeScore(a.scores?.templateRisk || 0, false)}</div></div>
            <div class='card'><div class='small'>Fit</div><div class='big'>${badgeScore(a.scores?.fit || 0)}</div></div>
          </div>
          <div class='grid2' style='margin-top:12px'>
            <div class='card'><div class='small'>Strongest Evidence</div><ul>${strongest || `<li class='small'>-</li>`}</ul></div>
            <div class='card'><div class='small'>Weak Claims</div><ul>${weakest || `<li class='small'>-</li>`}</ul></div>
          </div>
          ${flags ? `<div class='card' style='margin-top:12px'><div class='small'>Flags</div><ul>${flags}</ul></div>` : ``}
          <div class='card' style='margin-top:12px'>
            <div class='small'>HM Notes</div>
            <textarea rows='3' data-notes='${esc(a.id)}'>${esc(a.hmNotes || '')}</textarea>
            <div class='row'>
              <button class='btn primary' data-dec='approve' data-app='${esc(a.id)}'>Approve</button>
              <button class='btn' data-dec='hold' data-app='${esc(a.id)}'>Hold</button>
              <button class='btn' data-dec='reject' data-app='${esc(a.id)}'>Reject</button>
            </div>
          </div>
        </div>
      `;
    };

    const load = async () => {
      $o.innerHTML = `<div class='card'>Lade...</div>`;
      const res = await fetchJSON('/api/pilot/hm/queue?' + qs({ tenantId: $t.value, jobId: $j.value }));
      if (!res?.success) return $o.innerHTML = `<div class='card'>Fehler: ${esc(res?.error || 'unbekannt')}</div>`;
      const items = res.data.items || [];
      $o.innerHTML = items.length ? items.map(card).join('') : `<div class='card'>Keine Shortlist Items.</div>`;

      $o.querySelectorAll('button[data-app]').forEach((btn) => {
        btn.onclick = async () => {
          const appId = btn.dataset.app;
          const dec = btn.dataset.dec;
          const notes = $o.querySelector(`textarea[data-notes='${CSS.escape(appId)}']`)?.value || '';
          await fetchJSON('/api/pilot/hm/decision', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:$t.value, applicationId: appId, decision: dec, notes})});
          load();
        };
      });
    };

    fill();
    $t.onchange = () => { state.hm.tenantId = $t.value; fill(); load(); };
    $j.onchange = () => { state.hm.jobId = $j.value; load(); };
    $r.onclick = load;
    load();
  };

  return { html, afterRender };
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
            <th><input type='checkbox' id='inboxSelectAll'/></th>
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
              <td><input type='checkbox' class='inboxSel' data-sel='${esc(a.id)}'/></td>
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
      const related = d?.related || [];
      const ctx = state.pilot?.context?.data || {};
      const job = (ctx.jobs || []).find(j=>j.id===a.jobId) || null;
      const templates = (ctx.templates || []).filter(t=>t.tenantId===a.tenantId);

      const claimsRows = (analysis?.claims || []).map(c=>`
        <tr>
          <td>${esc(c.risk)}</td>
          <td>${esc(c.claim)}</td>
          <td class='mono'>${(c.evidence||[]).map(esc).join(' | ')}</td>
        </tr>
      `).join('');

      const tasks = analysis?.microAssessment?.tasks || [];
      const flags = analysis?.flags || [];
      const ep = analysis?.evidencePack || null;
      const assessmentLink = a.assessment?.token ? `/assessment?token=${encodeURIComponent(a.assessment.token)}` : null;

      const scorecardCriteria = [
        { key:'role_fit', label:'Role fit', weight:2 },
        { key:'evidence', label:'Evidence quality', weight:3 },
        { key:'ownership', label:'Ownership / impact', weight:2 },
        { key:'communication', label:'Communication clarity', weight:1 },
        { key:'risk', label:'Risk / inconsistencies', weight:2 }
      ];

      return `
        <div class='card'>
          <div class='row' style='justify-content:space-between;align-items:center'>
            <div>
              <div class='small'>${esc(a.id)}</div>
              <div style='font-size:20px;font-weight:900'>${esc(a.candidateName)}</div>
              <div class='small'>${esc(fmtDate(a.submittedAt))} · ${esc(a.source)} · ${esc(job?.title || '')}</div>
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
              <span class='small'>done: ${esc(a.assessment?.completedAt ? fmtDate(a.assessment.completedAt) : '-')}</span>
            </div>
            ${assessmentLink ? `<div class='small' style='margin-top:8px'>Link: <a href='${esc(assessmentLink)}' target='_blank'>${esc(assessmentLink)}</a></div>` : ``}

            <div class='small' style='margin-top:12px'>Template senden</div>
            <div class='row'>
              <select id='detailTpl'>
                ${(templates || []).map(t=>`<option value='${esc(t.id)}'>${esc(t.name)} · ${esc(t.channel)}</option>`).join('') || `<option value=''>-</option>`}
              </select>
              <input id='detailTplQuestion' placeholder='{{question}} (optional)'/>
              <select id='detailTplSetStatus'>
                <option value=''>Status unveraendert</option>
                <option value='reviewing'>reviewing</option>
                <option value='needs_info'>needs_info</option>
                <option value='shortlisted'>shortlisted</option>
                <option value='rejected'>rejected</option>
              </select>
              <button class='btn' id='detailTplSend'>Send</button>
            </div>

            <div class='small' style='margin-top:12px'>Sequence enroll</div>
            <div class='row'>
              <select id='detailSeq'><option value=''>Lade...</option></select>
              <button class='btn' id='detailSeqEnroll'>Enroll</button>
              <button class='btn' id='detailSeqRun'>Run due</button>
              <span class='small' id='detailSeqMeta'></span>
            </div>

            <div class='row'>
              <button class='btn' id='detailInterviewKit'>Interview kit</button>
              <span class='small' id='detailInterviewMeta'></span>
            </div>
            <div id='detailInterviewOut'></div>
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
            <h3>Evidence Pack</h3>
            ${ep ? `
              <div class='small'>${esc(ep.summary || '')}</div>
              <div class='grid2' style='margin-top:10px'>
                <div class='card'>
                  <div class='small'>Strongest</div>
                  <ul>${(ep.strongest || []).slice(0,4).map(x=>`<li>${esc(x.claim)}</li>`).join('') || `<li class='small'>-</li>`}</ul>
                </div>
                <div class='card'>
                  <div class='small'>Weakest</div>
                  <ul>${(ep.weakest || []).slice(0,4).map(x=>`<li>${esc(x.claim)}</li>`).join('') || `<li class='small'>-</li>`}</ul>
                </div>
              </div>
            ` : `<div class='small'>-</div>`}
            ${flags.length ? `<div class='small' style='margin-top:10px'>Flags: ${flags.map(f=>`<span class='pill warn'>${esc(f.type)}</span>`).join(' ')}</div>` : ``}
          </div>

          <div class='card' style='margin-top:12px'>
            <h3>Claims</h3>
            <table class='table'>
              <tr><th>Risk</th><th>Claim</th><th>Evidence</th></tr>
              ${claimsRows || `<tr><td colspan='3' class='small'>Keine Claims gefunden.</td></tr>`}
            </table>
          </div>

          <div class='card' style='margin-top:12px'>
            <h3>Scorecard</h3>
            <div class='small'>1 (schwach) bis 5 (stark). Fokus: evidence-first statt "AI detection".</div>
            <table class='table' style='margin-top:8px'>
              <tr><th>Kriterium</th><th>Weight</th><th>Score</th><th>Note</th></tr>
              ${scorecardCriteria.map(c=>`
                <tr>
                  <td>${esc(c.label)}</td>
                  <td class='small'>${esc(c.weight)}</td>
                  <td>
                    <select data-sc-score='${esc(c.key)}'>
                      ${[1,2,3,4,5].map(n=>`<option value='${n}'>${n}</option>`).join('')}
                    </select>
                  </td>
                  <td><input data-sc-note='${esc(c.key)}' placeholder='kurz...'/></td>
                </tr>
              `).join('')}
            </table>
            <div class='row'>
              <select id='detailScRec'>
                <option value='maybe'>maybe</option>
                <option value='yes'>yes</option>
                <option value='no'>no</option>
              </select>
              <button class='btn primary' id='detailScSave'>Save scorecard</button>
              <span class='small' id='detailScMeta'></span>
            </div>
            <div id='detailScOut'></div>
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

          ${related.length ? `
            <div class='card' style='margin-top:12px'>
              <h3>Possible Duplicates (Same Name)</h3>
              <table class='table'>
                <tr><th>ID</th><th>Job</th><th>Status</th><th>Submitted</th></tr>
                ${related.map(r=>`<tr><td class='mono'>${esc(r.id)}</td><td>${esc(r.jobTitle)}</td><td class='small'>${esc(r.status)}</td><td class='small'>${esc(fmtDate(r.submittedAt))}</td></tr>`).join('')}
              </table>
            </div>
          ` : ``}

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

      // Batch toolbar (status only for now)
      if (!$wrap.querySelector('#inboxBatchBar')) {
        const bar = document.createElement('div');
        bar.className = 'row';
        bar.id = 'inboxBatchBar';
        bar.innerHTML = `
          <select id='inboxBatchStatus'>
            <option value=''>Batch status...</option>
            <option value='reviewing'>reviewing</option>
            <option value='needs_info'>needs_info</option>
            <option value='shortlisted'>shortlisted</option>
            <option value='rejected'>rejected</option>
          </select>
          <button class='btn' id='inboxBatchApply'>Apply</button>
          <span class='small' id='inboxBatchMeta'></span>
        `;
        $wrap.parentElement.insertBefore(bar, $wrap);
      }

      const $all = document.getElementById('inboxSelectAll');
      const $apply = document.getElementById('inboxBatchApply');
      const $st = document.getElementById('inboxBatchStatus');
      const $bm = document.getElementById('inboxBatchMeta');
      const selectedIds = () => Array.from(document.querySelectorAll('input.inboxSel')).filter(x=>x.checked).map(x=>x.dataset.sel);
      const updateMeta = () => { $bm.textContent = `${selectedIds().length} selected`; };
      $all.onchange = () => {
        const v = $all.checked;
        document.querySelectorAll('input.inboxSel').forEach(x=>{ x.checked = v; });
        updateMeta();
      };
      document.querySelectorAll('input.inboxSel').forEach(x=>x.onchange = updateMeta);
      updateMeta();
      $apply.onclick = async () => {
        const ids = selectedIds();
        if (!ids.length || !$st.value) return;
        await fetchJSON('/api/pilot/batch', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId: state.pilot.tenantId, applicationIds: ids, status: $st.value})});
        await refresh();
      };

      $wrap.querySelectorAll('tr[data-app]').forEach(tr=>{
        tr.onclick = null;
        tr.addEventListener('click', async (e) => {
          // ignore click on checkbox
          if (e?.target?.classList?.contains('inboxSel') || e?.target?.id === 'inboxSelectAll') return;
          const id = tr.dataset.app;
          state.pilot.selectedAppId = id;
          const detailUrl = () => `/api/pilot/applications/${id}?tenantId=${encodeURIComponent(state.pilot.tenantId)}`;

	          const bindDetail = () => {
	            const $save = document.getElementById('detailSaveStatus');
	            const $addNote = document.getElementById('detailAddNote');
	            const $send = document.getElementById('detailSendAssessment');
	            const $tplSend = document.getElementById('detailTplSend');
	            const $seqEnroll = document.getElementById('detailSeqEnroll');
	            const $seqRun = document.getElementById('detailSeqRun');
	            const $kit = document.getElementById('detailInterviewKit');
	            const $scSave = document.getElementById('detailScSave');

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

	            // Template send
	            if ($tplSend) $tplSend.onclick = async () => {
	              const templateId = document.getElementById('detailTpl').value;
	              const question = document.getElementById('detailTplQuestion').value;
	              const setStatus = document.getElementById('detailTplSetStatus').value;
	              if (!templateId) return;
	              const payload = { tenantId: state.pilot.tenantId, applicationId: id, templateId, variables: { question }, setStatus: setStatus || undefined };
	              const res = await fetchJSON('/api/pilot/messages/send', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
	              if (!res?.success) alert(res?.error || 'Fehler');
	              await refresh();
	              await showDetail();
	            };

	            // Sequences
	            const loadSeq = async () => {
	              const $sel = document.getElementById('detailSeq');
	              const $m = document.getElementById('detailSeqMeta');
	              if (!$sel) return;
	              const r = await fetchJSON('/api/pilot/sequences?' + qs({ tenantId: state.pilot.tenantId }));
	              if (!r?.success) { $sel.innerHTML = `<option value=''>-</option>`; return; }
	              const items = r.data || [];
	              $sel.innerHTML = [`<option value=''>-</option>`, ...items.map(x=>`<option value='${esc(x.id)}'>${esc(x.name)}</option>`)].join('');
	              if ($m) $m.textContent = `${items.length} sequences`;
	            };
	            loadSeq();
	            if ($seqEnroll) $seqEnroll.onclick = async () => {
	              const seqId = document.getElementById('detailSeq').value;
	              const $m = document.getElementById('detailSeqMeta');
	              if (!seqId) return;
	              const res = await fetchJSON('/api/pilot/sequences/enroll', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId: state.pilot.tenantId, sequenceId: seqId, applicationId: id})});
	              if (!res?.success) { if ($m) $m.textContent = res?.error || 'Fehler'; return; }
	              if ($m) $m.textContent = 'Enrolled';
	            };
	            if ($seqRun) $seqRun.onclick = async () => {
	              const $m = document.getElementById('detailSeqMeta');
	              const res = await fetchJSON('/api/pilot/sequences/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId: state.pilot.tenantId})});
	              if (!res?.success) { if ($m) $m.textContent = res?.error || 'Fehler'; return; }
	              if ($m) $m.textContent = 'sent: ' + res.data.sent;
	            };

	            // Interview kit
	            if ($kit) $kit.onclick = async () => {
	              const $m = document.getElementById('detailInterviewMeta');
	              const $out = document.getElementById('detailInterviewOut');
	              if ($m) $m.textContent = 'Loading...';
	              const res = await fetchJSON('/api/pilot/interview-kit?' + qs({ tenantId: state.pilot.tenantId, applicationId: id }));
	              if (!res?.success) { if ($m) $m.textContent = res?.error || 'Fehler'; return; }
	              if ($m) $m.textContent = `Questions: ${res.data.questions.length}`;
	              if ($out) $out.innerHTML = `<div class='card' style='margin-top:10px'><ul>${res.data.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul></div>`;
	            };

	            // Scorecard
	            const loadScorecards = async () => {
	              const $out = document.getElementById('detailScOut');
	              const res = await fetchJSON('/api/pilot/scorecards?' + qs({ tenantId: state.pilot.tenantId, applicationId: id }));
	              if (!$out) return;
	              if (!res?.success) { $out.innerHTML = `<div class='small'>Fehler: ${esc(res?.error||'')}</div>`; return; }
	              const items = res.data || [];
	              $out.innerHTML = items.length ? `
	                <div class='card' style='margin-top:10px'>
	                  <div class='small'>Saved scorecards</div>
	                  <table class='table'>
	                    <tr><th>Role</th><th>User</th><th>Recommendation</th><th>Updated</th></tr>
	                    ${items.map(s=>`<tr><td class='mono'>${esc(s.role)}</td><td class='small mono'>${esc(s.userId||'')}</td><td>${esc(s.recommendation)}</td><td class='small'>${esc(fmtDate(s.updatedAt))}</td></tr>`).join('')}
	                  </table>
	                </div>
	              ` : `<div class='small' style='margin-top:10px'>Noch keine Scorecards.</div>`;
	            };
	            loadScorecards();
	            if ($scSave) $scSave.onclick = async () => {
	              const $m = document.getElementById('detailScMeta');
	              const rec = document.getElementById('detailScRec').value;
	              const criteria = [
	                'role_fit',
	                'evidence',
	                'ownership',
	                'communication',
	                'risk'
	              ].map((k) => ({
	                key: k,
	                label: k,
	                weight: k==='evidence'?3:(k==='risk'?2:1),
	                score: Number(document.querySelector(`select[data-sc-score='${k}']`)?.value || 3),
	                note: document.querySelector(`input[data-sc-note='${k}']`)?.value || ''
	              }));
	              if ($m) $m.textContent = 'Saving...';
	              const res = await fetchJSON('/api/pilot/scorecards', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId: state.pilot.tenantId, applicationId: id, role: 'recruiter', criteria, recommendation: rec})});
	              if (!res?.success) { if ($m) $m.textContent = res?.error || 'Fehler'; return; }
	              if ($m) $m.textContent = 'Saved';
	              await loadScorecards();
	            };
	          };

          const showDetail = async () => {
            const d = await fetchJSON(detailUrl());
            $detail.innerHTML = renderDetail(d.data);
            bindDetail();
          };

          $detail.innerHTML = `<div class='card'>Lade Details...</div>`;
          await showDetail();
        });
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

    // Deep-link to a specific application
    const appId = new URLSearchParams(location.search || '').get('appId');
    if (appId) {
      setTimeout(() => {
        const row = document.querySelector(`tr[data-app='${CSS.escape(appId)}']`);
        row?.click?.();
      }, 50);
    }
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
  if (current !== 'assessment' && !isAuthed()) {
    const next = encodeURIComponent(location.pathname + (location.search || ''));
    location.href = '/login?next=' + next;
    return;
  }
  const sidebarButtons = routes
    .filter(([id]) => id !== 'assessment')
    .map(([id,l])=>`<button data-route='${id}'>${l}</button>`)
    .join('');
  app.innerHTML = `
    <div class='layout'>
      <aside class='sidebar'>
        <h3>RecruiterIQ</h3>
        ${sidebarButtons}
      </aside>
      <main class='main'>
        <div class='row' style='justify-content:space-between;align-items:center'>
          <div class='small'>/${current}</div>
          <div class='row' style='margin-top:0'>
            <select id='userSelect' style='max-width:260px'></select>
            <button class='btn' id='logoutBtn'>Logout</button>
          </div>
        </div>
        <div id='view'>Lade...</div>
      </main>
    </div>
  `;
  app.querySelectorAll('button[data-route]').forEach(btn=>btn.onclick=()=>{
    const id = btn.dataset.route;
    if (!id || id === current) return;
    current = id;
    history.pushState({}, '', '/' + id);
    render();
  });

  if (current !== 'assessment') await ensurePilotContext();

  // User selector
  const $us = document.getElementById('userSelect');
  const $logout = document.getElementById('logoutBtn');
  if ($logout) $logout.onclick = () => {
    localStorage.removeItem('rx_auth');
    localStorage.removeItem('rx_auth_at');
    location.href = '/';
  };
  const users = state.pilot?.context?.data?.users || [];
  if (current === 'assessment') {
    $us.innerHTML = `<option value=''>Public</option>`;
    $us.disabled = true;
  } else {
    $us.disabled = false;
    $us.innerHTML = users.map(u=>`<option value='${esc(u.id)}'>${esc(u.name)} · ${esc(u.role)}</option>`).join('');
    $us.value = state.auth?.userId || '';
    $us.onchange = () => {
      state.auth.userId = $us.value;
      localStorage.setItem('rx_user', state.auth.userId);
      render();
    };
  }

  const views={
    dashboard:loadDashboard,
    pipeline:loadPipeline,
    worklist:loadWorklist,
    inbox:loadInbox,
    sequences:loadSequences,
    templates:loadTemplates,
    integrations:loadIntegrations,
    analytics:loadAnalytics,
    hm:loadHm,
    assessment:loadAssessment,
    triage:loadTriage,
    copilot:loadCopilot,
    market:loadMarket,
    agent:loadAgent,
    'talent-pool':loadSilver,
    companies:loadCompanies,
    interviews:loadInterviews
  };
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
