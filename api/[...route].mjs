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
  avg_response_time_hours: 8 + (i % 6) * 7
}));
const messages = Array.from({ length: 40 }, (_, i) => ({ id:`msg${i+1}`, pipeline_entry_id:pipelineEntries[i%pipelineEntries.length].id, direction:i%3===0?'inbound':'outbound', tonality:['direct','advisory','visionary'][i%3], response_received:i%3===0 }));
const silverMedals = Array.from({ length: 5 }, (_, i) => ({ id:`sm${i+1}`, candidate_id:candidates[i].id, original_job_id:jobs[i].id, shortlist_position:i+1, rejection_reason:'Stärkerer Cultural Fit', reactivation_eligible:true }));
const interviews = Array.from({length:15},(_,i)=>({id:`int${i+1}`,pipeline_entry_id:pipelineEntries[i].id,notes_summary:'',competency_scores:{},red_flags:[],sentiment_score:0}));
const marketData=[]; regions.forEach((region,i)=>roles.forEach((role,j)=>marketData.push({id:`${region}-${role}`,role_category:role,region,city:cities[(i+j)%cities.length],talent_density:30+((i+j)%10)*12,median_salary:55000+((i+j)%7)*8000,salary_p25:48000+((i+j)%7)*7000,salary_p75:65000+((i+j)%7)*9000,open_positions_count:40+((i+j)%8)*15,competition_index:0.2+((i+j)%7)*0.1,remote_readiness_pct:35+((i+j)%6)*9,switch_readiness_index:0.35+((i+j)%6)*0.08}))); 

const scoreDealProbability = (entry) => {
  const cand = candidates.find(c => c.id === entry.candidate_id); const job = jobs.find(j => j.id === entry.job_id); if (!cand || !job) return { score: 0, breakdown: {} };
  const response_time_factor = Math.max(0,1-entry.avg_response_time_hours/72); const switch_motivation=cand.switch_motivation/10; const salary_fit=Math.max(0,Math.min(1,(job.salary_max-cand.salary_expectation+20000)/40000));
  const notice_period_fit=cand.notice_period_days<30?1:cand.notice_period_days<=90?0.6:0.3; const senGap=Math.abs(seniorityOrder.indexOf(cand.seniority_level)-seniorityOrder.indexOf(job.seniority_level));
  const seniority_match=senGap===0?1:senGap===1?0.5:0.2; const competition_factor=1-Math.min(1,(job.salary_min-cand.salary_current)/50000*-1);
  const weighted=response_time_factor*0.2+switch_motivation*0.2+salary_fit*0.2+notice_period_fit*0.1+seniority_match*0.15+competition_factor*0.15;
  return { score: Math.round(weighted*100), breakdown:{response_time_factor,switch_motivation,salary_fit,notice_period_fit,seniority_match,competition_factor} };
};
const ghostRisk=(entry)=>{const d=Math.floor((Date.now()-new Date(entry.last_response_at).getTime())/86400000); const cand=candidates.find(c=>c.id===entry.candidate_id); const job=jobs.find(j=>j.id===entry.job_id); const gap=Math.max(0,(cand?.salary_expectation||0)-(job?.salary_max||0)); return Math.min(100,Math.round((Math.min(d,10)/10)*30+(entry.avg_response_time_hours/72)*25+(gap>10000?15:6)+15+((hiringManagers.find(h=>h.id===job?.hiring_manager_id)?.avg_feedback_speed_hours||24)/72)*10));};
pipelineEntries.forEach(e=>{e.deal_probability_score=scoreDealProbability(e).score; e.ghosting_risk_score=ghostRisk(e);});

const send=(res,code,payload)=>{res.statusCode=code; res.setHeader('content-type','application/json'); res.end(JSON.stringify(payload));};
const parseBody=(req)=>new Promise(resolve=>{let b=''; req.on('data',c=>b+=c); req.on('end',()=>{try{resolve(JSON.parse(b||'{}'));}catch{resolve({});}});});

export default async function handler(req,res){
  const url = new URL(req.url, 'http://x'); const path=url.pathname;
  if (req.method==='GET' && path==='/api/dashboard/kpis/r1') { const active=pipelineEntries.filter(p=>['sourced','contacted','responded','screening','interview','offer'].includes(p.stage)); const health=Math.round(active.reduce((a,p)=>a+p.deal_probability_score,0)/active.length); const predicted=active.filter(p=>p.deal_probability_score>70&&['interview','offer'].includes(p.stage)).length; const responseQuality=Math.round((messages.filter(m=>m.response_received).length/messages.length)*50+50); return send(res,200,{success:true,data:{activePipelineHealth:health,predictedPlacements30d:predicted,responseQualityIndex:responseQuality,revenueForecast90d:predicted*18000}}); }
  if (req.method==='GET' && path==='/api/dashboard/funnel/r1') return send(res,200,{success:true,data:stages.map((stage,i)=>({stage,count:pipelineEntries.filter(p=>p.stage===stage).length,conversion:i===0?1:Number((pipelineEntries.filter(p=>p.stage===stage).length/Math.max(1,pipelineEntries.filter(p=>p.stage===stages[i-1]).length)).toFixed(2))}))});
  if (req.method==='GET' && path==='/api/dashboard/bottlenecks/r1') return send(res,200,{success:true,data:stages.map(stage=>({stage,weeks:[1,2,3,4].map(w=>({week:w,stuck:pipelineEntries.filter(p=>p.stage===stage && Math.random()>0.5).length}))}))});
  if (req.method==='GET' && path.startsWith('/api/pipeline/')) { const parts=path.split('/').filter(Boolean); if(parts.length===3){return send(res,200,{success:true,data:pipelineEntries.filter(p=>p.job_id===parts[2]).sort((a,b)=>b.deal_probability_score-a.deal_probability_score)});} if(parts.length===4&&parts[3]==='score'){const e=pipelineEntries.find(p=>p.id===parts[2]); return e?send(res,200,{success:true,data:scoreDealProbability(e)}):send(res,404,{success:false,error:'Eintrag nicht gefunden'});} }
  if (req.method==='POST' && path.startsWith('/api/pipeline/') && path.endsWith('/recalc')) { const e=pipelineEntries.find(p=>p.id===path.split('/')[3]); if(!e) return send(res,404,{success:false,error:'Eintrag nicht gefunden'}); e.deal_probability_score=scoreDealProbability(e).score; return send(res,200,{success:true,data:e}); }
  if (req.method==='POST' && path==='/api/copilot/generate') { const b=await parseBody(req); const cand=candidates.find(c=>c.id===b.candidateId)||candidates[0]; const job=jobs.find(j=>j.id===b.jobId)||jobs[0]; return send(res,200,{success:true,data:{direct:`Hallo ${cand.name}, wir suchen für ${job.title} in ${job.location_city}. Ihr Profil passt sehr gut. Haben Sie diese Woche 15 Minuten Zeit?`,advisory:`Hallo ${cand.name}, Ihre Erfahrung als ${cand.current_role} wirkt sehr passend. Bei ${companies.find(c=>c.id===job.company_id)?.name} hätten Sie klaren Impact und Entwicklungsspielraum. Das Team arbeitet modern und flexibel. Darf ich Ihnen die Rolle unverbindlich vorstellen?`,visionary:`Hallo ${cand.name}, ${companies.find(c=>c.id===job.company_id)?.name} baut aktuell eine Schlüsselrolle im Bereich ${job.title} auf. Sie könnten die Produkt- und Technologieausrichtung aktiv mitprägen. Wollen wir dazu kurz sprechen?`,predicted_response_rate:{direct:0.42,advisory:0.55,visionary:0.39}}}); }
  if (req.method==='POST' && path==='/api/copilot/followup') return send(res,200,{success:true,data:{text:'Kurzes Follow-up: Ist die Rolle weiterhin spannend für Sie?'}});
  if (req.method==='GET' && path==='/api/copilot/analytics') return send(res,200,{success:true,data:[{tone:'direct',responseRate:0.44},{tone:'advisory',responseRate:0.5},{tone:'visionary',responseRate:0.29}]});
  if (req.method==='GET' && path==='/api/alerts/ghosting/r1') return send(res,200,{success:true,data:pipelineEntries.filter(p=>p.ghosting_risk_score>50).map(p=>({entryId:p.id,risk:p.ghosting_risk_score,recommendation:p.ghosting_risk_score>70?'Persönlichen Touchpoint setzen (Anruf/LinkedIn)':'Hiring Manager eskalieren – Feedback ausstehend'}))});
  if (req.method==='GET' && path.startsWith('/api/alerts/ghosting/')) { const e=pipelineEntries.find(p=>p.id===path.split('/').pop()); return e?send(res,200,{success:true,data:{entryId:e.id,risk:e.ghosting_risk_score,recommendation:e.ghosting_risk_score>70?'Gehaltsdiskussion proaktiv führen':'Follow-up senden'}}):send(res,404,{success:false,error:'Nicht gefunden'}); }
  if (req.method==='POST' && path.endsWith('/dismiss')) return send(res,200,{success:true,data:{dismissed:true}});
  if (req.method==='GET' && path.startsWith('/api/hiring-managers/') && path.endsWith('/score')) { const hm=hiringManagers.find(h=>h.id===path.split('/')[3]); if(!hm) return send(res,404,{success:false,error:'Nicht gefunden'}); const score=Math.round((hm.avg_feedback_speed_hours<24?1:hm.avg_feedback_speed_hours<48?0.7:0.3)*25+hm.interview_consistency_score*25+hm.offer_conversion_rate*25+(hm.total_processes>8?0.8:0.5)*15+0.7*10); return send(res,200,{success:true,data:{score,grade:score>80?'A':score>65?'B':score>50?'C':score>40?'D':'F',breakdown:{feedback:hm.avg_feedback_speed_hours,consistency:hm.interview_consistency_score,conversion:hm.offer_conversion_rate}}}); }
  if (req.method==='GET' && path.startsWith('/api/hiring-managers/') && path.endsWith('/trend')) return send(res,200,{success:true,data:[1,2,3,4,5,6].map(m=>({month:m,score:45+Math.round(Math.random()*40)}))});
  if (req.method==='GET' && path.startsWith('/api/companies/') && path.endsWith('/managers')) return send(res,200,{success:true,data:hiringManagers.filter(h=>h.company_id===path.split('/')[3])});
  if (req.method==='GET' && path==='/api/market/heatmap') return send(res,200,{success:true,data:marketData.filter(m=>!url.searchParams.get('role')||m.role_category===url.searchParams.get('role'))});
  if (req.method==='GET' && path.startsWith('/api/market/detail/')) return send(res,200,{success:true,data:marketData.filter(m=>m.region===decodeURIComponent(path.split('/').pop()))});
  if (req.method==='GET' && path.startsWith('/api/market/export/')) return send(res,200,{success:true,data:{url:'/reports/marktbericht.pdf'}});
  if (req.method==='POST' && path==='/api/agent/search') { const b=await parseBody(req); const runId=`run${Date.now()}`; globalThis.agentRuns ||= {}; globalThis.agentRuns[runId]={status:'done',results:candidates.map(c=>({candidate:c,score:Math.round(Math.random()*40+60),reason:`${c.name} erfüllt Must-have Skills und passt zur Region ${b.jobSpec?.region||c.location_city}.`})).sort((a,b)=>b.score-a.score)}; return send(res,200,{success:true,data:{runId}}); }
  if (req.method==='GET' && path.startsWith('/api/agent/status/')) return send(res,200,{success:true,data:{status:globalThis.agentRuns?.[path.split('/').pop()]?.status||'processing'}});
  if (req.method==='GET' && path.startsWith('/api/agent/results/')) return send(res,200,{success:true,data:globalThis.agentRuns?.[path.split('/').pop()]?.results||[]});
  if (req.method==='POST' && path==='/api/interviews') { const b=await parseBody(req); const id=`int${interviews.length+1}`; interviews.push({id,...b}); return send(res,200,{success:true,data:{id}}); }
  if (req.method==='POST' && path.includes('/api/interviews/') && path.endsWith('/analyze')) { const i=interviews.find(x=>x.id===path.split('/')[3]); if(!i) return send(res,404,{success:false,error:'Nicht gefunden'}); i.notes_summary='Kandidat überzeugt fachlich, Kommunikationsstil klar, moderates Risiko bei Führung in großen Teams.'; i.competency_scores={technical_skills:8,leadership:6,communication:7,problem_solving:8,cultural_fit:7}; i.sentiment_score=0.68; i.red_flags=['Leadership in Matrixstrukturen unklar']; return send(res,200,{success:true,data:i}); }
  if (req.method==='GET' && path.startsWith('/api/interviews/compare/')) return send(res,200,{success:true,data:{alignment:'Hoch bei Fachkompetenz, gemischt bei Leadership.',interviews:interviews.filter(i=>i.pipeline_entry_id===path.split('/').pop())}});
  if (req.method==='GET' && path.startsWith('/api/compensation/') && path.endsWith('/predict')) { const e=pipelineEntries.find(p=>p.id===path.split('/')[3]); if(!e) return send(res,404,{success:false,error:'Nicht gefunden'}); const cand=candidates.find(c=>c.id===e.candidate_id); const job=jobs.find(j=>j.id===e.job_id); const gap=(job?.salary_max||0)-(cand?.salary_expectation||0); return send(res,200,{success:true,data:{fit:gap>=5000?'green':gap>=0?'yellow':'red',gap,market_position:gap>0?'below_median':'above_median',negotiation_tips:gap>=0?['Gesamtpaket inkl. Weiterbildung hervorheben']:['Variabler Bonus und Remote-Flexibilität anbieten']}}); }
  if (req.method==='GET' && path==='/api/compensation/benchmark') return send(res,200,{success:true,data:marketData.find(m=>m.role_category===url.searchParams.get('role')&&m.region===url.searchParams.get('region'))||null});
  if (req.method==='GET' && path==='/api/silver-medals') return send(res,200,{success:true,data:silverMedals});
  if (req.method==='GET' && path.startsWith('/api/silver-medals/matches/')) { const job=jobs.find(j=>j.id===path.split('/').pop()); return send(res,200,{success:true,data:silverMedals.map(sm=>({silverMedalId:sm.id,score:72+Math.round(Math.random()*20),message:`Kandidat passt auf neue Rolle ${job?.title}.`})).filter(m=>m.score>70)}); }
  if (req.method==='POST' && path.includes('/api/silver-medals/') && path.endsWith('/reactivate')) return send(res,200,{success:true,data:{message:'Wertschätzende Wiederansprache generiert und Copilot geöffnet.'}});
  return send(res,404,{success:false,error:'Route nicht gefunden'});
}
