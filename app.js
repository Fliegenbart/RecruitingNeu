const sections = [
  { label: null, items: [
    ['dashboard', 'Dashboard', 'Was heute ansteht und wie dein Recruiting laeuft.'],
    ['inbox', 'Inbox', 'Bewerbungen sichten, KI-Score sehen, entscheiden.'],
    ['nachrichten', 'Nachrichten', 'KI-Copilot und Vorlagen fuer Kandidaten-Ansprache.'],
    ['hm', 'Hiring Manager', 'Shortlist mit Evidence Pack an den HM uebergeben.'],
  ]},
  { label: 'Einstellungen', items: [
    ['analytics', 'Analytics', 'Metriken und Auswertungen.'],
    ['sequences', 'Sequenzen', 'Automatische Follow-up-Ketten.'],
    ['integrations', 'Import / Export', 'CSV-Import und Datenexport.'],
  ]},
];

const routes = sections.flatMap(s => s.items);
const routeDescriptions = Object.fromEntries(routes.map(([id, label, desc]) => [id, { label, desc }]));

const app = document.getElementById('app');
const routeIds = new Set(routes.map(([id]) => id));
routeIds.add('home');
const pathRoute = () => {
  const p = (location.pathname || '/').replace(/^\/+/, '').split('/')[0];
  if (p === 'assessment') return 'assessment';
  return routeIds.has(p) ? p : 'home';
};
let current = pathRoute();
let state={};

const isAuthed = () => {
  try {
    const q = new URLSearchParams(location.search || '');
    if (q.get('demo') === '1') {
      localStorage.setItem('rx_auth', '1');
      localStorage.setItem('rx_auth_at', String(Date.now()));
      return true;
    }
  } catch {}
  return localStorage.getItem('rx_auth') === '1';
};

const authHeader = () => {
  const uid = state?.auth?.userId || localStorage.getItem('rx_user') || '';
  return uid ? { 'X-User-Id': uid } : {};
};
const fetchJSON = (url, opts={}) => {
  const headers = { ...(opts.headers || {}), ...authHeader() };
  return fetch(url, { ...opts, headers }).then(r=>r.json());
};
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

async function loadHome(){
  const steps = [
    ['inbox', 'Inbox oeffnen', 'Bewerbungen durchgehen, KI-Scores sehen, Kandidaten bewerten.'],
    ['nachrichten', 'Nachricht schreiben', 'Per KI-Copilot personalisierte Nachrichten generieren.'],
    ['hm', 'An Hiring Manager', 'Shortlist mit Evidence Pack uebergeben, Entscheidung einholen.'],
    ['dashboard', 'Fortschritt pruefen', 'KPIs und heutige Aufgaben im Blick behalten.'],
  ];

  const html = `
    <div style='max-width:720px;margin:40px auto 0'>
      <div style='text-align:center'>
        <h2 style='font-size:32px;letter-spacing:-0.8px;margin:0'>Weniger raten. Besser einstellen.</h2>
        <div style='color:var(--text-secondary);margin-top:8px;font-size:16px;line-height:1.5'>
          RecruiterIQ analysiert Bewerbungen auf echte Belege statt Bauchgefuehl.<br/>
          Claims werden geprueft, Skills gematcht, Risiken erkannt.
        </div>
      </div>
      <div style='margin-top:40px;display:flex;flex-direction:column;gap:8px'>
        ${steps.map(([id, title, desc], i) => `
          <div class='card click' data-goto='${esc(id)}' style='cursor:pointer;display:flex;align-items:center;gap:16px;padding:16px 20px'>
            <div style='width:32px;height:32px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0'>${i+1}</div>
            <div>
              <div style='font-weight:600;font-size:15px'>${esc(title)}</div>
              <div class='small' style='margin-top:2px'>${esc(desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style='margin-top:40px;text-align:center'>
        <div class='small'>Tipp: Die KI-Features (Skill-Matching, Zusammenfassung, Nachrichten) werden staerker mit einem lokalen LLM via Ollama. Ohne LLM funktioniert alles mit Heuristiken.</div>
      </div>
    </div>
  `;

  const afterRender = () => {
    document.querySelectorAll('[data-goto]').forEach(el => {
      el.onclick = () => {
        current = el.dataset.goto;
        history.pushState({}, '', '/' + current);
        render();
      };
    });
  };

  return { html, afterRender };
}

async function loadDashboard(){
  await ensurePilotContext();
  const ctx = state.pilot.context.data;
  const tenants = ctx.tenants || [];
  const tId = tenants[0]?.id || '';

  const [kpi, wl] = await Promise.all([
    fetchJSON('/api/dashboard/kpis/r1'),
    fetchJSON('/api/pilot/worklist?' + qs({ tenantId: tId }))
  ]);

  const wlData = wl?.data || {};
  const newApps = wlData.new || [];
  const needsInfo = wlData.needs_info || [];
  const waitingHm = wlData.waiting_hm || [];
  const totalTodo = newApps.length + needsInfo.length + waitingHm.length;

  const kpiCards = [
    ['Heute offen', totalTodo, totalTodo > 0 ? 'var(--primary)' : 'var(--secondary)'],
    ['Neue Bewerbungen', newApps.length, null],
    ['Warten auf Infos', needsInfo.length, null],
    ['Warten auf HM', waitingHm.length, null],
  ];

  const appRow = (a) => `
    <tr class='click' data-goto-app='${esc(a.id)}' style='cursor:pointer'>
      <td><strong>${esc(a.candidateName)}</strong><div class='small'>${esc(a.jobTitle || '')}</div></td>
      <td>${badgeScore(a.overall || 0)}</td>
      <td><span class='pill'>${esc(a.status)}</span></td>
      <td class='small'>${esc(fmtDate(a.submittedAt))}</td>
    </tr>
  `;

  const html = `
    <h2>Dashboard</h2>
    <div class='small' style='margin-bottom:16px'>Was heute ansteht.</div>
    <div class='cards'>
      ${kpiCards.map(([label, val, color]) => `
        <div class='card'>
          <div class='small'>${esc(label)}</div>
          <div class='big' ${color ? `style='color:${color}'` : ''}>${esc(val)}</div>
        </div>
      `).join('')}
    </div>
    ${newApps.length ? `
      <div class='card' style='margin-top:16px'>
        <h3>Neue Bewerbungen</h3>
        <div class='small' style='margin-bottom:8px'>Diese Bewerbungen warten auf deine erste Einschaetzung.</div>
        <table class='table'>
          <tr><th>Kandidat</th><th>Score</th><th>Status</th><th>Eingegangen</th></tr>
          ${newApps.slice(0, 10).map(appRow).join('')}
        </table>
        ${newApps.length > 10 ? `<div class='small' style='margin-top:8px'>+ ${newApps.length - 10} weitere</div>` : ''}
      </div>
    ` : `<div class='card' style='margin-top:16px'><div class='small'>Keine neuen Bewerbungen. Alles aufgearbeitet.</div></div>`}
    ${needsInfo.length ? `
      <div class='card' style='margin-top:12px'>
        <h3>Warten auf Infos</h3>
        <div class='small' style='margin-bottom:8px'>Du hast Rueckfragen gestellt - diese Kandidaten haben noch nicht geantwortet.</div>
        <table class='table'>
          <tr><th>Kandidat</th><th>Score</th><th>Status</th><th>Eingegangen</th></tr>
          ${needsInfo.slice(0, 5).map(appRow).join('')}
        </table>
      </div>
    ` : ''}
    ${waitingHm.length ? `
      <div class='card' style='margin-top:12px'>
        <h3>Warten auf Hiring Manager</h3>
        <div class='small' style='margin-bottom:8px'>Diese Kandidaten sind beim HM - du wartest auf Feedback.</div>
        <table class='table'>
          <tr><th>Kandidat</th><th>Score</th><th>Status</th><th>Eingegangen</th></tr>
          ${waitingHm.slice(0, 5).map(appRow).join('')}
        </table>
      </div>
    ` : ''}
  `;

  const afterRender = () => {
    document.querySelectorAll('[data-goto-app]').forEach(tr => {
      tr.onclick = () => {
        const id = tr.dataset.gotoApp;
        history.pushState({}, '', '/inbox?appId=' + encodeURIComponent(id));
        current = 'inbox';
        render();
      };
    });
  };

  return { html, afterRender };
}



async function loadNachrichten(){
  await ensurePilotContext();
  const ctx = state.pilot.context.data;
  const tenants = ctx.tenants || [];
  state.nachrichten ??= { tab: 'copilot', tenantId: tenants[0]?.id || '', selectedTplId: null };

  const html = `
    <h2>Nachrichten</h2>
    <div class='small' style='margin-bottom:16px'>Schreibe Kandidaten an: Per KI generiert oder mit gespeicherten Vorlagen.</div>
    <div class='row' style='margin-bottom:16px'>
      <button class='btn ${state.nachrichten.tab==='copilot'?'primary':''}' data-tab='copilot'>KI-Copilot</button>
      <button class='btn ${state.nachrichten.tab==='templates'?'primary':''}' data-tab='templates'>Vorlagen</button>
    </div>
    <div id='nachrichtenContent'></div>
  `;

  const afterRender = () => {
    const $content = document.getElementById('nachrichtenContent');

    const renderCopilot = () => {
      const cands = Array.from({length:10},(_,i)=>({id:'cand'+(i+1),name:['Luca Fischer','Emma Richter','Noah Hofmann','Mia Becker','Paul Wagner','Lina Schulz','Elias Neumann','Hannah Wolf','Felix Klein','Clara Schreiber'][i]}));
      const jobsList = Array.from({length:5},(_,i)=>({id:'job'+(i+1),title:['Software Engineer','Product Manager','Data Scientist','Sales Manager','DevOps Engineer'][i]}));
      $content.innerHTML = `
        <div class='card'>
          <div class='small' style='margin-bottom:12px'>Waehle Kandidat und Job, dann generiert die KI drei verschiedene Nachrichten (direkt, beratend, visionaer). Ohne LLM kommen Fallback-Templates.</div>
          <div class='grid3'>
            <div><div class='small'>Kandidat</div><select id='cpCand'>${cands.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('')}</select></div>
            <div><div class='small'>Job</div><select id='cpJob'>${jobsList.map(j=>'<option value="'+j.id+'">'+esc(j.title)+'</option>').join('')}</select></div>
            <div><div class='small'>Kontext (optional)</div><input id='cpCtx' placeholder='z.B. Referral von Max'/></div>
          </div>
          <div class='row'><button class='btn primary' id='cpGen'>Nachrichten generieren</button><span class='small' id='cpLLM'></span></div>
        </div>
        <div id='cpOut' style='margin-top:12px'></div>
      `;
      document.getElementById('cpGen').onclick = async () => {
        const btn = document.getElementById('cpGen');
        btn.disabled = true; btn.textContent = 'Generiere...';
        const gen = await fetchJSON('/api/copilot/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidateId:document.getElementById('cpCand').value,jobId:document.getElementById('cpJob').value,context:document.getElementById('cpCtx').value})});
        btn.disabled = false; btn.textContent = 'Nachrichten generieren';
        const $out = document.getElementById('cpOut');
        if (!gen?.success) { $out.innerHTML = '<div class="card">Fehler: '+(gen?.error||'unbekannt')+'</div>'; return; }
        const d = gen.data;
        document.getElementById('cpLLM').innerHTML = d.llm?.used ? '<span class="pill good">LLM: '+esc(d.llm.model||'aktiv')+'</span>' : '<span class="pill warn">LLM: off (Fallback)</span>';
        $out.innerHTML = [
          ['direct','Direkt'],['advisory','Beratend'],['visionary','Visionaer']
        ].map(([t,label])=>`<div class='card' style='margin-top:10px'><div class='row' style='justify-content:space-between;align-items:center;margin-top:0'><h3>${label}</h3><span class='small'>~${Math.round(d.predicted_response_rate[t]*100)}% Response</span></div><p style='white-space:pre-wrap'>${esc(d[t])}</p></div>`).join('');
      };
    };

    const renderTemplates = () => {
      const tId = state.nachrichten.tenantId;
      $content.innerHTML = `
        <div class='card'>
          <div class='small' style='margin-bottom:12px'>Vorlagen fuer E-Mail, SMS und LinkedIn. Verwende <span class='mono'>{{candidateName}}</span>, <span class='mono'>{{jobTitle}}</span> als Platzhalter.</div>
          <div class='grid2'>
            <div><div class='small'>Tenant</div><select id='tplT'>${tenants.map(t=>`<option value='${esc(t.id)}' ${t.id===tId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
            <div><div class='small'>Vorlage</div><select id='tplSel'></select></div>
          </div>
          <div class='row'><button class='btn' id='tplNew'>Neue Vorlage</button><button class='btn primary' id='tplSave'>Speichern</button></div>
        </div>
        <div class='card' style='margin-top:12px'>
          <div class='grid2'>
            <div>
              <div class='small'>Name</div><input id='tplName'/>
              <div class='small' style='margin-top:10px'>Kanal</div>
              <select id='tplCh'><option value='email'>E-Mail</option><option value='sms'>SMS</option><option value='linkedin'>LinkedIn</option></select>
              <div class='small' style='margin-top:10px'>Betreff</div><input id='tplSub'/>
              <div class='small' style='margin-top:10px'>Text</div><textarea id='tplBod' rows='8'></textarea>
            </div>
            <div>
              <div class='small'>Vorschau</div>
              <div class='card' style='margin-top:8px'>
                <div class='small'>Betreff</div><div id='tplPSub' class='mono'></div>
                <div class='small' style='margin-top:8px'>Text</div><pre id='tplPBod' class='mono'></pre>
              </div>
              <div class='row'><button class='btn' id='tplPrev'>Vorschau aktualisieren</button></div>
            </div>
          </div>
        </div>
      `;

      let templates = [];
      const vars = {candidateName:'Emma Richter',jobTitle:'Fullstack Engineer',senderName:'Leonie Weber'};
      const load = async () => {
        const res = await fetchJSON('/api/pilot/templates?' + qs({ tenantId: document.getElementById('tplT').value }));
        templates = res?.success ? res.data : [];
        const $sel = document.getElementById('tplSel');
        if (!templates.length) { $sel.innerHTML = '<option>Keine Vorlagen</option>'; return; }
        if (!state.nachrichten.selectedTplId || !templates.some(t=>t.id===state.nachrichten.selectedTplId)) state.nachrichten.selectedTplId = templates[0].id;
        $sel.innerHTML = templates.map(t=>`<option value='${esc(t.id)}' ${t.id===state.nachrichten.selectedTplId?'selected':''}>${esc(t.name)}</option>`).join('');
        select(state.nachrichten.selectedTplId);
      };
      const select = (id) => {
        const t = templates.find(x=>x.id===id);
        state.nachrichten.selectedTplId = id;
        document.getElementById('tplName').value = t?.name || '';
        document.getElementById('tplCh').value = t?.channel || 'email';
        document.getElementById('tplSub').value = t?.subject || '';
        document.getElementById('tplBod').value = t?.body || '';
      };
      const preview = () => {
        const r = (s) => s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_,k)=>vars[k]??'');
        document.getElementById('tplPSub').textContent = r(document.getElementById('tplSub').value);
        document.getElementById('tplPBod').textContent = r(document.getElementById('tplBod').value);
      };
      load();
      document.getElementById('tplT').onchange = () => { state.nachrichten.tenantId = document.getElementById('tplT').value; state.nachrichten.selectedTplId = null; load(); };
      document.getElementById('tplSel').onchange = () => select(document.getElementById('tplSel').value);
      document.getElementById('tplPrev').onclick = preview;
      document.getElementById('tplNew').onclick = async () => {
        const res = await fetchJSON('/api/pilot/templates', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:document.getElementById('tplT').value,name:'Neue Vorlage',channel:'email',subject:'',body:''})});
        if (res?.success) { state.nachrichten.selectedTplId = res.data.id; await load(); }
      };
      document.getElementById('tplSave').onclick = async () => {
        const id = state.nachrichten.selectedTplId;
        if (!id) return;
        await fetchJSON('/api/pilot/templates/' + id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:document.getElementById('tplT').value,name:document.getElementById('tplName').value,channel:document.getElementById('tplCh').value,subject:document.getElementById('tplSub').value,body:document.getElementById('tplBod').value})});
        await load(); preview();
      };
    };

    const showTab = (tab) => {
      state.nachrichten.tab = tab;
      document.querySelectorAll('[data-tab]').forEach(b => {
        b.classList.toggle('primary', b.dataset.tab === tab);
      });
      if (tab === 'copilot') renderCopilot();
      else renderTemplates();
    };

    document.querySelectorAll('[data-tab]').forEach(b => {
      b.onclick = () => showTab(b.dataset.tab);
    });

    showTab(state.nachrichten.tab);
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
    <h2>Sequenzen</h2>
    <div class='small' style='margin-bottom:8px'>Automatische Follow-up-Ketten: Definiere Schritte mit Wartezeit und Template. "Run due" sendet faellige Nachrichten.</div>
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
    <h2>Import / Export</h2>
    <div class='small' style='margin-bottom:8px'>Bewerbungen per CSV importieren (bis 1.000 Zeilen). Exportiere Bewerbungs- und Audit-Daten als CSV fuer dein ATS.</div>
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

      // Show auto-scoring results if available
      const scoring = res.data.scoring;
      if (scoring && scoring.used) {
        const scoreColor = scoring.percentage >= 70 ? 'var(--secondary, #30d158)' : scoring.percentage >= 40 ? 'var(--warning, #ff9f0a)' : 'var(--danger, #ff453a)';
        const resultsHtml = `
          <div class='card' style='margin-top:16px; border-left: 3px solid ${scoreColor}'>
            <div style='display:flex; align-items:center; gap:12px; margin-bottom:12px'>
              <div style='font-size:2em; font-weight:700; color:${scoreColor}'>${scoring.percentage}%</div>
              <div>
                <div><strong>KI-Bewertung</strong></div>
                <div class='small'>${esc(scoring.totalScore)}/${esc(scoring.maxTotal)} Punkte · ${esc(scoring.recommendation || '')}</div>
              </div>
            </div>
            ${(scoring.taskResults || []).map((tr, i) => `
              <div style='padding:10px 0; border-top:1px solid rgba(128,128,128,0.2)'>
                <div style='display:flex; justify-content:space-between; align-items:center'>
                  <strong>${esc(tr.task || ('Task ' + (i+1)))}</strong>
                  <span style='font-weight:600; color:${tr.score >= 7 ? 'var(--secondary, #30d158)' : tr.score >= 4 ? 'var(--warning, #ff9f0a)' : 'var(--danger, #ff453a)'}'>${tr.score}/10</span>
                </div>
                <div class='small' style='margin-top:4px'>${esc(tr.feedback || '')}</div>
                ${tr.strengths?.length ? `<div style='margin-top:6px'>${tr.strengths.map(s => `<span class='pill' style='background:rgba(48,209,88,0.15); color:#30d158'>${esc(s)}</span>`).join(' ')}</div>` : ''}
                ${tr.gaps?.length ? `<div style='margin-top:4px'>${tr.gaps.map(g => `<span class='pill' style='background:rgba(255,69,58,0.15); color:#ff453a'>${esc(g)}</span>`).join(' ')}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `;
        document.getElementById('asmtSubmit').parentElement.insertAdjacentHTML('afterend', resultsHtml);
        document.getElementById('asmtSubmit').disabled = true;
        document.getElementById('asmtSubmit').textContent = 'Bewertet';
      }
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
    <div class='small' style='margin-bottom:8px'>Time-to-first-Review, Status-Verteilung pro Job und Quality-Proxies. Zeigt, wo der Prozess stockt.</div>
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
    <h2>HM-Portal</h2>
    <div class='small' style='margin-bottom:8px'>Das sieht dein Hiring Manager: Shortlist mit Evidence Pack, Scores und Entscheidungs-Buttons (Approve / Hold / Reject).</div>
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
    <h2>Inbox</h2>
    <div class='small' style='margin-bottom:8px'>Alle Bewerbungen fuer einen Job. Filtere nach Status oder Must-haves, klicke auf einen Kandidaten fuer die Detail-Analyse mit Evidence Pack, Claims und Scorecard.</div>

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

    const urlParams = new URLSearchParams(location.search || '');
    const shot = urlParams.get('shot'); // e.g. ?shot=detail for stable screenshots
    const appId = urlParams.get('appId');

    if (shot === 'detail') {
      // Stable, "hero-shot" friendly default.
      state.pilot.filters.status = '';
      state.pilot.filters.mustHave = '';
      state.pilot.filters.q = '';
      state.pilot.filters.collapsedClusters = true;
      state.pilot.filters.sort = 'overall_desc';
      state.pilot.filters.page = 1;
      state.pilot.filters.limit = 50;
    }

    (async () => {
      await refresh();

      if (appId) {
        setTimeout(() => {
          const row = document.querySelector(`tr[data-app='${CSS.escape(appId)}']`);
          row?.click?.();
        }, 50);
      } else if (shot === 'detail') {
        setTimeout(() => {
          const row = document.querySelector('tr[data-app]');
          row?.click?.();
        }, 90);
      }
    })();
  };

  return { html, afterRender };
}

async function loadTriage(){
  state.triage ??= { jobFamily: 'software', selectedAppId: null };
  if (!state.triageDemo) state.triageDemo = await fetchJSON('/api/triage/demo');
  const demo = state.triageDemo.data;

  const initialFamily = demo.jobFamilies.some(j=>j.id===state.triage.jobFamily) ? state.triage.jobFamily : demo.jobFamilies[0]?.id || 'software';

  const html = `
    <h2>Bewerbungs-Triage</h2>
    <div class='small' style='margin-bottom:8px'>Playground: Fuege einen Bewerbungstext ein und sieh, wie die KI Claims extrahiert, Evidenz bewertet und Proof-of-Work Aufgaben generiert. Optional mit lokalem LLM fuer semantisches Skill-Matching.</div>
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

      const summaryCard = a.summary
        ? `<div class='card' style='margin-top:12px;border-color:rgba(10,132,255,0.3)'><h3>KI-Zusammenfassung</h3><div style='white-space:pre-wrap'>${esc(a.summary)}</div></div>`
        : a.llm?.summary
          ? `<div class='card' style='margin-top:12px;border-color:rgba(10,132,255,0.3)'><h3>KI-Zusammenfassung</h3><div style='white-space:pre-wrap'>${esc(a.llm.summary)}</div></div>`
          : '';

      const semanticCard = a.semanticSkills
        ? `<div class='card' style='margin-top:12px'>
            <h3>Semantisches Skill-Matching (LLM)</h3>
            ${a.llm?.scoreBoost ? `<div class='small' style='margin-bottom:8px'>Score-Boost: +${a.llm.scoreBoost} (implizite Skills erkannt)</div>` : ''}
            ${(a.semanticSkills.matchedSkills||[]).length ? `<div class='row'>${a.semanticSkills.matchedSkills.map(s=>`<span class='pill good'>${esc(s.skill)} (${Math.round((s.confidence||0)*100)}%)</span>`).join('')}</div>` : ''}
            ${(a.semanticSkills.implicitSkills||[]).length ? `<div style='margin-top:8px'><div class='small'>Implizit erkannt:</div><div class='row'>${a.semanticSkills.implicitSkills.map(s=>`<span class='pill warn'>${esc(s.skill)}: ${esc(s.evidence||'')}</span>`).join('')}</div></div>` : ''}
            ${(a.semanticSkills.missingSkills||[]).length ? `<div style='margin-top:8px'><div class='small'>Nicht gefunden:</div><div class='row'>${a.semanticSkills.missingSkills.map(s=>`<span class='pill bad'>${esc(s)}</span>`).join('')}</div></div>` : ''}
          </div>`
        : '';

      const scoreRow = `
        <div class='grid3'>
          <div class='card'><div class='small'>Overall</div><div class='big'>${badgeScore(a.scores.overall)}</div></div>
          <div class='card'><div class='small'>Fit</div><div class='big'>${badgeScore(a.scores.fit)}</div></div>
          <div class='card'><div class='small'>Evidence</div><div class='big'>${badgeScore(a.scores.evidence)}</div></div>
        </div>
        <div class='card' style='margin-top:12px'><div class='small'>Template-Risiko (niedrig ist gut)</div><div class='big'>${badgeScore(a.scores.templateRisk, false)}</div></div>
        ${summaryCard}
        ${semanticCard}
        <div class='card' style='margin-top:12px'><h3>LLM</h3><div class='row'>${llmPill}</div><div class='small'>LLM aktiviert semantisches Matching, Zusammenfassung und Score-Boost. Heuristik funktioniert auch ohne.</div></div>
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

      return scoreRow + mustHaveCard + claimsCard + followUpCard + assessmentCard;
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
  const sidebarSections = sections.map(s => `
    <div style='margin-top:${s.label ? '20' : '8'}px'>
      ${s.label ? `<div style='padding:4px 14px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-tertiary);margin-bottom:2px'>${esc(s.label)}</div>` : ''}
      ${s.items.map(([id, label]) => `<button data-route='${id}'>${esc(label)}</button>`).join('')}
    </div>
  `).join('');

  const pageInfo = routeDescriptions[current];
  const breadcrumb = current === 'home'
    ? ''
    : `<div class='small' style='display:flex;align-items:center;gap:6px'>
        <span class='click' id='backHome' style='color:var(--primary);cursor:pointer'>Uebersicht</span>
        <span style='color:var(--text-tertiary)'>/</span>
        <span>${esc(pageInfo?.label || current)}</span>
      </div>`;

  app.innerHTML = `
    <div class='layout'>
      <aside class='sidebar'>
        <div data-route='home' style='cursor:pointer;padding:6px 14px;display:flex;align-items:center;gap:8px'>
          <img src='/assets/logo.svg' alt='Logo' style='width:28px;height:28px;border-radius:6px'/>
          <span style='font-size:15px;font-weight:700;color:var(--text)'>RecruiterIQ</span>
        </div>
        ${sidebarSections}
      </aside>
      <main class='main'>
        <div class='row' style='justify-content:space-between;align-items:center'>
          ${breadcrumb}
          <div class='row' style='margin-top:0'>
            <select id='userSelect' style='max-width:260px'></select>
            <button class='btn' id='logoutBtn'>Logout</button>
          </div>
        </div>
        <div id='view'>Lade...</div>
      </main>
    </div>
  `;
  app.querySelectorAll('[data-route]').forEach(el=>el.onclick=()=>{
    const id = el.dataset.route;
    if (!id || id === current) return;
    current = id;
    history.pushState({}, '', id === 'home' ? '/' : '/' + id);
    render();
  });
  const $back = document.getElementById('backHome');
  if ($back) $back.onclick = () => {
    current = 'home';
    history.pushState({}, '', '/');
    render();
  };

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

  // Highlight active sidebar button
  app.querySelectorAll('.sidebar button[data-route]').forEach(btn => {
    if (btn.dataset.route === current) btn.classList.add('active');
  });

  const views={
    home:loadHome,
    dashboard:loadDashboard,
    inbox:loadInbox,
    nachrichten:loadNachrichten,
    hm:loadHm,
    analytics:loadAnalytics,
    sequences:loadSequences,
    integrations:loadIntegrations,
    assessment:loadAssessment,
    triage:loadTriage,
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
