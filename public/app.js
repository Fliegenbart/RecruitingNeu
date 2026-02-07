const routes = [
  ['dashboard','Dashboard'],['pipeline','Pipeline'],['copilot','Copilot'],['market','Markt'],['agent','Agent'],['talent-pool','Talent Pool'],['companies','Unternehmen'],['interviews','Interviews']
];

const app = document.getElementById('app');
let current='dashboard';
let state={};

const fetchJSON = (url, opts) => fetch(url, opts).then(r=>r.json());
const badge = (v)=> v>70?'<span class="badge green">🟢 '+v+'</span>':v>=40?'<span class="badge yellow">🟡 '+v+'</span>':'<span class="badge red">🔴 '+v+'</span>';

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

async function render(){
  app.innerHTML = `<div class='layout'><aside class='sidebar'><h3>RecruiterIQ</h3>${routes.map(([id,l])=>`<button data-route='${id}'>${l}</button>`).join('')}</aside><main class='main'><div class='small'>/${current}</div><div id='view'>Lade...</div></main></div>`;
  app.querySelectorAll('button[data-route]').forEach(btn=>btn.onclick=()=>{current=btn.dataset.route;render();});
  const views={dashboard:loadDashboard,pipeline:loadPipeline,copilot:loadCopilot,market:loadMarket,agent:loadAgent,'talent-pool':loadSilver,companies:loadCompanies,interviews:loadInterviews};
  document.getElementById('view').innerHTML = await views[current]();
}

render();
