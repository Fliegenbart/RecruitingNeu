const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const DEFAULT_WEIGHTS = { fit: 0.5, evidence: 0.3, antiTemplate: 0.2 };

const JOB_FAMILIES = {
  software: {
    id: 'software',
    label: 'Software',
    mustHave: [
      { id: 'js_ts', label: 'JavaScript oder TypeScript' },
      { id: 'react_node', label: 'React oder Node.js' }
    ],
    niceToHave: [
      { id: 'sql', label: 'SQL / Datenbank' },
      { id: 'testing', label: 'Testing / Qualität' },
      { id: 'cloud_devops', label: 'Cloud / DevOps' }
    ],
    microAssessment: {
      timeboxMinutes: 12,
      tasks: [
        {
          title: 'Debugging in 8 Minuten',
          prompt:
            'Unten ist ein kleiner Code-Ausschnitt. Finde den Bug und beschreibe kurz den Fix.\n\n' +
            "```js\n" +
            "export function pickTop(scores, n) {\n" +
            "  return scores.sort((a,b)=>a-b).slice(0, n);\n" +
            "}\n" +
            "```\n\n" +
            'Erwartung: "Top" meint die höchsten Scores.',
          rubric: [
            'Erkennt, dass sort aufsteigend ist (falsch für "top").',
            'Fix: absteigend sortieren oder slice(-n) nach aufsteigendem Sort.',
            'Hinweis auf Mutationsrisiko: sort() mutiert Array; ggf. copy via [...scores].'
          ]
        },
        {
          title: 'Tradeoff-Entscheidung (Architektur)',
          prompt:
            'Du sollst ein Bewerbungs-Triage Modul bauen: 10.000 Bewerbungen/Tag, ' +
            'Erklärbarkeit ist Pflicht, Latenz < 2s für "Analyze". ' +
            'Würdest du (A) rein heuristisch starten oder (B) sofort LLM-first? Begründe kurz.',
          rubric: [
            'Berücksichtigt Erklärbarkeit/Compliance und False-Positives.',
            'Schlägt "Heuristik + optional LLM-Enrichment" vor.',
            'Denkt an Messbarkeit (A/B, Monitoring, Drift).'
          ]
        }
      ]
    }
  },
  sales: {
    id: 'sales',
    label: 'Sales',
    mustHave: [
      { id: 'crm', label: 'CRM Erfahrung (z.B. Salesforce/HubSpot)' },
      { id: 'quota_pipeline', label: 'Quota/Pipeline Zahlen oder Prozess' }
    ],
    niceToHave: [
      { id: 'b2b', label: 'B2B Kontext' },
      { id: 'method', label: 'Methodik (MEDDIC/SPIN/Challenger)' }
    ],
    microAssessment: {
      timeboxMinutes: 10,
      tasks: [
        {
          title: 'Einwandbehandlung (schriftlich)',
          prompt:
            'Schreibe eine kurze Antwort (max. 8 Sätze) auf den Einwand: ' +
            '"Wir haben aktuell kein Budget und keine Zeit für ein neues Tool." ' +
            'Ziel: nächster Termin (15 Min) für Qualifizierung.',
          rubric: [
            'Spiegelt Einwand + fragt nach Kontext (Budgetzyklus/Impact).',
            'Bietet niedrige Hürde (15 Min, konkretes Outcome).',
            'Kein Druck, klare CTA.'
          ]
        },
        {
          title: 'Pipeline-Mathe',
          prompt:
            'Du brauchst 6 Deals in 60 Tagen. Conversion von SQL->Won ist 20%. ' +
            'Wie viele SQLs brauchst du im Zeitraum? Welche 2 Hebel würdest du zuerst verbessern?',
          rubric: [
            'Rechnet korrekt: 6 / 0.2 = 30 SQLs.',
            'Hebel: mehr SQLs (Top-of-funnel), Conversion verbessern (Qualifizierung, Enablement).',
            'Denkt an Zykluszeit und Segmentierung.'
          ]
        }
      ]
    }
  },
  pm: {
    id: 'pm',
    label: 'Product',
    mustHave: [
      { id: 'roadmap_prioritization', label: 'Roadmap/Priorisierung' },
      { id: 'kpi_okr', label: 'KPIs/OKRs (Outcome statt Output)' },
      { id: 'stakeholders', label: 'Stakeholder-Management' }
    ],
    niceToHave: [
      { id: 'discovery', label: 'Discovery / User Research' },
      { id: 'experiments', label: 'Experiment/A-B Testing' }
    ],
    microAssessment: {
      timeboxMinutes: 15,
      tasks: [
        {
          title: 'Priorisierung',
          prompt:
            'Du bekommst 4 Initiativen und 1 KPI: "Activation Rate". Wähle 2, die du in den ' +
            'nächsten 2 Wochen priorisierst, und begründe kurz (Impact/Confidence/Effort).\n\n' +
            '- Onboarding Schritt 3 vereinfachen\n' +
            '- Neue Integrations-Partnerschaft\n' +
            '- Performance-Optimierung Landing Page\n' +
            '- Neue Admin-Analytics Ansicht',
          rubric: [
            'Nutzt klares Framework (ICE/RICE) oder ähnlich.',
            'Bezieht sich auf KPI und Zeitbox.',
            'Benennt Unsicherheiten und benötigte Daten.'
          ]
        },
        {
          title: 'Follow-up Fragen an den Hiring Manager',
          prompt:
            'Formuliere 5 Fragen, die du vor Screening-Start klären musst, um Fehl-Screenings zu vermeiden.',
          rubric: [
            'Fragen zu Must-haves vs nice-to-haves, Seniorität, KPI des Jobs.',
            'Fragen zu Ausschlusskriterien (Standort, Sprache, Arbeitsrecht).',
            'Fragen zur Bewertung (Rubrik) und Prozess.'
          ]
        }
      ]
    }
  }
};

const STOPWORDS = new Set([
  // DE
  'und','oder','aber','dass','der','die','das','ein','eine','einer','einem','einen','den','dem','des',
  'ich','du','er','sie','es','wir','ihr','sie','mir','mich','mein','meine','meinen','meiner',
  'in','im','am','an','auf','aus','bei','mit','von','zu','zum','zur','für','fuer','über','ueber',
  'als','ist','sind','war','waren','sein','habe','haben','hat','auch','nicht','nur','mehr','sehr',
  // EN
  'and','or','but','the','a','an','to','for','in','on','at','of','with','from','as','is','are','was','were',
  'i','you','he','she','they','we','my','our','your'
]);

const GENERIC_PHRASES = [
  /sehr geehrte[^\n]{0,40}(damen und herren|team)/i,
  /hiermit bewerbe ich mich/i,
  /mit gro(s|ß)em interesse/i,
  /team\s*player|teamplayer/i,
  /schnelle auffassungsgabe/i,
  /hohe lernbereitschaft/i,
  /kommunikationsstark/i,
  /detail(orientiert|oriented)/i,
  /highly motivated|motiviert/i,
  /passionate|begeistert|excited|thrilled|eager/i
];

const KEYWORDS = {
  software: [
    { id: 'typescript', label: 'TypeScript', rx: /\btypescript\b|\bts\b/i },
    { id: 'javascript', label: 'JavaScript', rx: /\bjavascript\b|\bjs\b/i },
    { id: 'react', label: 'React', rx: /\breact\b/i },
    { id: 'node', label: 'Node.js', rx: /\bnode(\.js|js)?\b/i },
    { id: 'sql', label: 'SQL', rx: /\bsql\b|\bpostgres\b|\bmysql\b/i },
    { id: 'testing', label: 'Testing', rx: /\btest(ing)?\b|\bjest\b|\bplaywright\b|\bcypress\b/i },
    { id: 'cloud_devops', label: 'Cloud/DevOps', rx: /\baws\b|\bgcp\b|\bazure\b|\bdocker\b|\bkubernetes\b|\bk8s\b|\bcicd\b/i },
    { id: 'api', label: 'APIs', rx: /\brest\b|\bgraphql\b|\bapi\b/i }
  ],
  sales: [
    { id: 'crm', label: 'CRM', rx: /\bcrm\b|\bsalesforce\b|\bhubspot\b|\bpipedrive\b/i },
    { id: 'quota_pipeline', label: 'Quota/Pipeline', rx: /\bquota\b|\bpipeline\b|\bfunnel\b|\btarget\b|\bziel\b|\barr\b|\bmrr\b/i },
    { id: 'b2b', label: 'B2B', rx: /\bb2b\b/i },
    { id: 'method', label: 'Methodik', rx: /\bmeddic\b|\bspin\b|\bchallenger\b/i },
    { id: 'outbound', label: 'Outbound', rx: /\boutbound\b|\bcold\b|\bkaltakquise\b/i }
  ],
  pm: [
    { id: 'roadmap_prioritization', label: 'Roadmap/Priorisierung', rx: /\broadmap\b|\bbacklog\b|\bpriori(t|s)ier/i },
    { id: 'kpi_okr', label: 'KPI/OKR', rx: /\bkpi\b|\bokrs?\b|\bmetric(s)?\b|\boutcome\b/i },
    { id: 'stakeholders', label: 'Stakeholder', rx: /\bstakeholder\b/i },
    { id: 'discovery', label: 'Discovery', rx: /\bdiscovery\b|\buser research\b|\binterview(s)?\b/i },
    { id: 'experiments', label: 'Experimente', rx: /\ba\/b\b|\bexperiment\b|\btest\b/i }
  ]
};

const DEMO_APPLICATIONS = [
  {
    id: 'app_sw_1',
    jobFamily: 'software',
    label: 'Generisch (template)',
    text:
      'Sehr geehrte Damen und Herren,\n\n' +
      'mit großem Interesse bewerbe ich mich als Software Engineer. Ich bin hoch motiviert, ' +
      'teamfähig und bringe eine schnelle Auffassungsgabe mit. Ich freue mich darauf, meine ' +
      'Fähigkeiten in einem dynamischen Team einzubringen.\n\n' +
      'Mit freundlichen Grüßen'
  },
  {
    id: 'app_sw_2',
    jobFamily: 'software',
    label: 'Generisch (nahezu identisch)',
    text:
      'Sehr geehrte Damen und Herren,\n\n' +
      'hiermit bewerbe ich mich als Software Engineer. Ich bin motiviert, teamplayer und ' +
      'lernbereit. Ich freue mich sehr darauf, meine Kenntnisse in einem modernen Umfeld einzusetzen.\n\n' +
      'Mit freundlichen Grüßen'
  },
  {
    id: 'app_sw_3',
    jobFamily: 'software',
    label: 'Evidenzreich',
    text:
      'In meinem letzten Projekt habe ich ein TypeScript/Node.js API (REST) für ein B2B-Produkt gebaut.\n' +
      '- Latenz von 420ms auf 180ms reduziert (p95) durch Query-Optimierung (Postgres) und Caching.\n' +
      '- CI/CD Pipeline mit Tests (Jest) eingeführt; Regression-Bugs -35% in 2 Quartalen.\n' +
      'Stack: TypeScript, Node.js, React, Postgres, Docker. Zeitraum: 2023-2025.'
  },
  {
    id: 'app_sales_1',
    jobFamily: 'sales',
    label: 'Generisch (template)',
    text:
      'Ich bin sehr begeistert von der Position im Sales und möchte meine Kommunikationsstärke ' +
      'und Teamfähigkeit einbringen. Ich arbeite zielorientiert und freue mich auf neue Herausforderungen.'
  },
  {
    id: 'app_sales_2',
    jobFamily: 'sales',
    label: 'Evidenzreich',
    text:
      'Letztes Jahr habe ich 1.2M EUR Neugeschäft (ARR) abgeschlossen (Quota 1.0M, 120%).\n' +
      'Ich arbeite in Salesforce, baue Pipeline via Outbound und Partner, und verbessere Conversion ' +
      'durch saubere Discovery (MEDDIC). Durchschnittlicher Sales Cycle: 42 Tage.'
  },
  {
    id: 'app_sales_3',
    jobFamily: 'sales',
    label: 'Evidenzreich (Duplikat-Cluster)',
    text:
      'Letztes Jahr habe ich 1.2M EUR Neugeschäft (ARR) abgeschlossen (Quota 1.0M, 120%).\n' +
      'Ich arbeite in Salesforce, baue Pipeline via Outbound und Partner, und verbessere Conversion ' +
      'durch saubere Discovery (MEDDIC). Durchschnittlicher Sales Cycle: 42 Tage.'
  },
  {
    id: 'app_pm_1',
    jobFamily: 'pm',
    label: 'Generisch (template)',
    text:
      'Ich bin passionate über Produktentwicklung und möchte in einem dynamischen Team arbeiten. ' +
      'Ich bin detailorientiert, lerne schnell und bringe eine positive Einstellung mit.'
  },
  {
    id: 'app_pm_2',
    jobFamily: 'pm',
    label: 'Evidenzreich',
    text:
      'Als Product Manager habe ich eine Onboarding-Roadmap geliefert, die die Activation Rate von 18% auf 27% ' +
      'innerhalb von 8 Wochen verbessert hat (A/B Test).\n' +
      'Ich arbeite mit OKRs, priorisiere mit RICE, und moderiere Stakeholder-Workshops (Sales, Support, Engineering).'
  }
];

const normalizeWeights = (w) => {
  const fit = Number(w?.fit);
  const evidence = Number(w?.evidence);
  const antiTemplate = Number(w?.antiTemplate);
  const rawFit = Number.isFinite(fit) ? fit : DEFAULT_WEIGHTS.fit;
  const rawEvidence = Number.isFinite(evidence) ? evidence : DEFAULT_WEIGHTS.evidence;
  const rawAnti = Number.isFinite(antiTemplate) ? antiTemplate : DEFAULT_WEIGHTS.antiTemplate;
  const sum = rawFit + rawEvidence + rawAnti;
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  return {
    fit: rawFit / sum,
    evidence: rawEvidence / sum,
    antiTemplate: rawAnti / sum
  };
};

const resolveRubric = (jobFamily, rubric = {}) => {
  const def = JOB_FAMILIES[jobFamily] || JOB_FAMILIES.software;
  const mustHaveIds = Array.isArray(rubric?.mustHaveIds) && rubric.mustHaveIds.length ? rubric.mustHaveIds.map(String) : def.mustHave.map((x) => x.id);
  const niceToHaveIds = Array.isArray(rubric?.niceToHaveIds) && rubric.niceToHaveIds.length ? rubric.niceToHaveIds.map(String) : def.niceToHave.map((x) => x.id);
  const weights = normalizeWeights(rubric?.weights);
  const clusterThreshold = Number.isFinite(Number(rubric?.clusterThreshold)) ? Number(rubric.clusterThreshold) : 0.82;
  const shingleSize = Number.isFinite(Number(rubric?.shingleSize)) ? Number(rubric.shingleSize) : 3;
  const microAssessment = rubric?.microAssessment && typeof rubric.microAssessment === 'object' ? rubric.microAssessment : def.microAssessment;
  return { mustHaveIds, niceToHaveIds, weights, clusterThreshold, shingleSize, microAssessment };
};

const tokenize = (text) => {
  const cleaned = (text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff]+/gi, ' ')
    .trim();
  if (!cleaned) return [];
  return cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .filter((t) => !STOPWORDS.has(t));
};

const makeShingles = (tokens, n = 3) => {
  const out = new Set();
  for (let i = 0; i + n <= tokens.length; i++) {
    out.add(tokens.slice(i, i + n).join(' '));
  }
  return out;
};

const jaccard = (a, b) => {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let small = a;
  let big = b;
  if (a.size > b.size) {
    small = b;
    big = a;
  }
  let inter = 0;
  for (const x of small) if (big.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
};

const countRegex = (text, rx) => {
  if (!text) return 0;
  const m = text.match(rx);
  return m ? m.length : 0;
};

const extractEvidenceBits = (sentence) => {
  const bits = [];
  const raw = sentence || '';
  for (const m of raw.matchAll(/\b\d{4}\b/g)) bits.push(m[0]);
  for (const m of raw.matchAll(/\b\d+(?:[.,]\d+)?\s*%/g)) bits.push(m[0].replace(/\s+/g, ''));
  for (const m of raw.matchAll(/(?:€|\bEUR\b)\s*\d+(?:[.,]\d+)?\s*(?:k|m)?/gi)) bits.push(m[0].replace(/\s+/g, ''));
  for (const m of raw.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:ms|s|sek|sec|min|h|std|tage|days|wochen|weeks|monate|months|quartal|quarter)\b/gi)) bits.push(m[0].replace(/\s+/g, ' '));
  return Array.from(new Set(bits)).slice(0, 6);
};

const splitSentences = (text) => {
  const raw = (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!raw) return [];
  return raw
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((s) => s.trim())
    .filter(Boolean);
};

const extractClaimsHeuristic = (text) => {
  const sentences = splitSentences(text);
  const actionRx = /\b(steiger|erh[oö]h|verbesser|reduzier|senk|optimi|increase|improve|reduce|decreas|grow|lift|raise|cut)\w*/i;
  const claims = [];
  for (const s of sentences) {
    const evidence = extractEvidenceBits(s);
    const hasAction = actionRx.test(s);
    const hasDigits = /\d/.test(s);
    if (!hasDigits && !hasAction) continue;
    if (!evidence.length && !hasAction) continue;
    const confidence = clamp(0.35 + (hasAction ? 0.2 : 0) + (evidence.length >= 2 ? 0.25 : evidence.length ? 0.15 : 0), 0, 1);
    const hasTime = /\b(20\d{2}|\d+\s*(wochen|weeks|monate|months|quartal|quarter))\b/i.test(s);
    const risk = evidence.length >= 2 && hasTime ? 'low' : evidence.length ? 'medium' : 'high';
    const followUpQuestion =
      risk === 'low'
        ? 'Was war dein konkreter Anteil (Ownership/Teamgroesse) und wie wurde das Ergebnis gemessen?'
        : risk === 'medium'
          ? 'Welcher Zeitraum/Scope gilt hier genau (Baseline, Vergleich, Messmethode)?'
          : 'Kannst du ein konkretes Beispiel nennen (Projekt, Zeitraum, messbares Ergebnis)?';
    claims.push({
      claim: s.length > 220 ? `${s.slice(0, 217)}...` : s,
      evidence,
      confidence: Number(confidence.toFixed(2)),
      risk,
      followUpQuestion
    });
  }
  return claims.slice(0, 12);
};

const extractSkillMatches = (text, jobFamily) => {
  const items = KEYWORDS[jobFamily] || [];
  const matches = [];
  const counts = {};
  for (const k of items) {
    const c = countRegex(text, new RegExp(k.rx.source, k.rx.flags.includes('g') ? k.rx.flags : `${k.rx.flags}g`));
    if (c > 0) {
      matches.push(k.id);
      counts[k.id] = c;
    }
  }
  return { matches, counts };
};

const requirementMet = (id, matched) => {
  if (id === 'react_node') return matched.includes('react') || matched.includes('node');
  if (id === 'js_ts') return matched.includes('javascript') || matched.includes('typescript');
  return matched.includes(id);
};

const mustHaveGate = (jobFamily, matchedSkills, rubricResolved) => {
  const def = JOB_FAMILIES[jobFamily];
  if (!def) return { passed: false, missingRequired: ['jobFamily_unbekannt'], missingNiceToHave: [], reasons: ['Unbekannte Job-Familie'] };

  const required = rubricResolved?.mustHaveIds || def.mustHave.map((m) => m.id);
  const optional = rubricResolved?.niceToHaveIds || def.niceToHave.map((m) => m.id);

  const missingRequired = required.filter((id) => !requirementMet(id, matchedSkills));
  const missingNiceToHave = optional.filter((id) => !requirementMet(id, matchedSkills));

  const passed = missingRequired.length === 0;

  const idToLabel = {};
  for (const x of [...def.mustHave, ...def.niceToHave]) idToLabel[x.id] = x.label;

  const reasons = [];
  for (const id of required) {
    const label = idToLabel[id] || id;
    reasons.push(`${label}: ${missingRequired.includes(id) ? 'fehlend' : 'ok'}`);
  }
  for (const id of optional) {
    const label = idToLabel[id] || id;
    reasons.push(`${label}: ${missingNiceToHave.includes(id) ? 'fehlend' : 'ok'}`);
  }

  return { passed, missingRequired, missingNiceToHave, reasons };
};

const computeEvidenceScore = (text, skillCount) => {
  const numCount = countRegex(text, /\b\d+(?:[.,]\d+)?\b/g);
  const pctCount = countRegex(text, /\b\d+(?:[.,]\d+)?\s*%\b/g);
  const yearCount = countRegex(text, /\b(19\d{2}|20\d{2})\b/g);
  const linkCount = countRegex(text, /https?:\/\/\S+/g);
  const bulletCount = countRegex(text, /(^|\n)\s*[-*•]\s+/g);

  const genericCount = GENERIC_PHRASES.reduce((acc, rx) => acc + (rx.test(text || '') ? 1 : 0), 0);

  const raw =
    Math.log1p(numCount) * 18 +
    Math.log1p(pctCount) * 12 +
    Math.log1p(yearCount) * 10 +
    Math.log1p(linkCount) * 10 +
    Math.log1p(bulletCount) * 8 +
    Math.log1p(skillCount) * 10 -
    genericCount * 12;

  const score = clamp(Math.round(raw), 0, 100);
  return { score, breakdown: { numCount, pctCount, yearCount, linkCount, bulletCount, genericCount } };
};

const computeTemplateRisk = (text, evidenceScore) => {
  const genericHits = GENERIC_PHRASES.reduce((acc, rx) => acc + (rx.test(text || '') ? 1 : 0), 0);
  const tokens = tokenize(text);
  const uniqRatio = tokens.length ? new Set(tokens).size / tokens.length : 0;
  const repetitionPenalty = uniqRatio < 0.35 ? (0.35 - uniqRatio) * 120 : 0;

  const risk = clamp(
    Math.round(60 * (1 - evidenceScore / 100) + genericHits * 10 + repetitionPenalty),
    0,
    100
  );
  return { score: risk, breakdown: { genericHits, uniqRatio: Number(uniqRatio.toFixed(2)) } };
};

const computeEvidencePack = ({ claims = [], mustHave, evidence, templateRisk } = {}) => {
  const sorted = [...(claims || [])].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const strongest = sorted.filter((c) => (c.risk || '') === 'low').slice(0, 4);
  const weakest = sorted.filter((c) => (c.risk || '') !== 'low').slice(0, 4);
  const summary = {
    mustHavePassed: Boolean(mustHave?.passed),
    evidenceScore: Number(evidence?.score || 0),
    templateRiskScore: Number(templateRisk?.score || 0)
  };
  return { summary, strongest, weakest };
};

const contradictionChecks = (text) => {
  const t = String(text || '');
  const flags = [];

  // Very common "too generic" and low-signal patterns.
  const buzzwordCount = countRegex(t, /\b(innovativ|dynamisch|passionate|motiviert|teamplayer|detailorientiert|schnelle auffassungsgabe|zielorientiert)\b/gi);
  const numCount = countRegex(t, /\b\d+(?:[.,]\d+)?\b/g);
  if (buzzwordCount >= 4 && numCount <= 1) flags.push({ id: 'buzzwords_no_evidence', severity: 'medium', message: 'Viele Buzzwords, wenig messbare Evidenz.' });

  // Timeline: too many different years without context can indicate fabricated/templated narrative.
  const years = Array.from(t.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((m) => Number(m[1]));
  const uniqYears = Array.from(new Set(years)).sort((a, b) => a - b);
  if (uniqYears.length >= 6) flags.push({ id: 'many_years', severity: 'low', message: 'Viele Jahreszahlen; Timeline/Zeiträume im Interview verifizieren.' });

  // Link presence can be good; absence is not bad. But "portfolio mentioned" without link is a flag.
  const mentionsPortfolio = /\b(portfolio|github|gitlab|projekt)\b/i.test(t);
  const hasLink = /https?:\/\/\S+/i.test(t);
  if (mentionsPortfolio && !hasLink) flags.push({ id: 'portfolio_no_link', severity: 'low', message: 'Portfolio/Projekt erwähnt, aber kein Link angegeben.' });

  return flags;
};

const computeFitScore = (jobFamily, matchedSkillIds, rubricResolved) => {
  const def = JOB_FAMILIES[jobFamily];
  if (!def) return { score: 0, breakdown: {} };

  const required = rubricResolved?.mustHaveIds || def.mustHave.map((x) => x.id);
  const optional = rubricResolved?.niceToHaveIds || def.niceToHave.map((x) => x.id);

  const reqMet = required.reduce((acc, id) => acc + (requirementMet(id, matchedSkillIds) ? 1 : 0), 0);
  const optMet = optional.reduce((acc, id) => acc + (requirementMet(id, matchedSkillIds) ? 1 : 0), 0);

  const reqRatio = required.length ? reqMet / required.length : 0;
  const optRatio = optional.length ? optMet / optional.length : 0;

  const score = clamp(Math.round(reqRatio * 70 + optRatio * 30), 0, 100);
  return { score, breakdown: { reqMet, reqTotal: required.length, optMet, optTotal: optional.length } };
};

const followUpFromMissing = (jobFamily, missingRequired, missingNiceToHave) => {
  const def = JOB_FAMILIES[jobFamily];
  if (!def) return [];

  const idToLabel = {};
  for (const x of [...def.mustHave, ...def.niceToHave]) idToLabel[x.id] = x.label;

  const questions = [];
  for (const id of missingRequired) {
    const label = idToLabel[id] || id;
    questions.push(`Kannst du deine Erfahrung zu "${label}" konkret belegen (Projekt, Zeitraum, Ergebnis)?`);
  }
  for (const id of missingNiceToHave.slice(0, 2)) {
    const label = idToLabel[id] || id;
    questions.push(`Optional: Hast du Beruehrungspunkte mit "${label}"? Wenn ja: wo genau?`);
  }
  return questions.slice(0, 6);
};

export const getTriageDemo = () => {
  const ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || '';
  const ollamaEnabled = process.env.TRIAGE_USE_OLLAMA === '1';
  return {
    jobFamilies: Object.values(JOB_FAMILIES).map((j) => ({
      id: j.id,
      label: j.label,
      mustHave: j.mustHave,
      niceToHave: j.niceToHave
    })),
    applications: DEMO_APPLICATIONS,
    llm: {
      ollama: {
        enabled: ollamaEnabled,
        configured: Boolean(ollamaEnabled && ollamaModel),
        host: ollamaHost,
        model: ollamaModel
      }
    }
  };
};

export const clusterApplications = ({ applications = [], threshold = 0.82, shingleSize = 3 } = {}) => {
  const apps = (applications || [])
    .filter((a) => a && typeof a.id === 'string')
    .map((a) => ({ id: a.id, text: String(a.text || '') }));

  const sets = apps.map((a) => makeShingles(tokenize(a.text), shingleSize));
  const n = apps.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = jaccard(sets[i], sets[j]);
      if (sim >= threshold) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r) || [];
    g.push(apps[i].id);
    groups.set(r, g);
  }

  const clusters = [];
  const unclustered = [];
  for (const ids of groups.values()) {
    if (ids.length <= 1) {
      unclustered.push(ids[0]);
      continue;
    }

    // Representative = longest text among cluster items.
    let rep = ids[0];
    let bestLen = 0;
    for (const id of ids) {
      const a = apps.find((x) => x.id === id);
      const len = a?.text.length || 0;
      if (len > bestLen) {
        bestLen = len;
        rep = id;
      }
    }

    // Avg similarity within cluster (small n only)
    let sum = 0;
    let pairs = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const ai = apps.findIndex((x) => x.id === ids[i]);
        const aj = apps.findIndex((x) => x.id === ids[j]);
        if (ai >= 0 && aj >= 0) {
          sum += jaccard(sets[ai], sets[aj]);
          pairs++;
        }
      }
    }
    const avgSimilarity = pairs ? Number((sum / pairs).toFixed(2)) : 1;

    clusters.push({ clusterId: `cl_${clusters.length + 1}`, representativeId: rep, items: ids, avgSimilarity });
  }

  return { threshold, shingleSize, clusters, unclustered };
};

export const analyzeApplication = ({ jobFamily, applicationText, rubric } = {}) => {
  const family = JOB_FAMILIES[jobFamily] ? jobFamily : 'software';
  const text = String(applicationText || '').trim();

  const rubricResolved = resolveRubric(family, rubric);

  const skillSignals = extractSkillMatches(text, family);
  const matchedSkillIds = skillSignals.matches;
  const mustHave = mustHaveGate(family, matchedSkillIds, rubricResolved);

  const fit = computeFitScore(family, matchedSkillIds, rubricResolved);
  const evidence = computeEvidenceScore(text, matchedSkillIds.length);
  const templateRisk = computeTemplateRisk(text, evidence.score);
  const claims = extractClaimsHeuristic(text);
  const flags = contradictionChecks(text);
  const evidencePack = computeEvidencePack({ claims, mustHave, evidence, templateRisk });

  const w = rubricResolved.weights;
  const overall = clamp(
    Math.round(fit.score * w.fit + evidence.score * w.evidence + (100 - templateRisk.score) * w.antiTemplate),
    0,
    100
  );

  const followUps = [
    ...followUpFromMissing(family, mustHave.missingRequired, mustHave.missingNiceToHave),
    ...claims.filter((c) => c.risk !== 'low').slice(0, 2).map((c) => c.followUpQuestion)
  ].slice(0, 8);

  return {
    jobFamily: family,
    rubric: {
      mustHaveIds: rubricResolved.mustHaveIds,
      niceToHaveIds: rubricResolved.niceToHaveIds,
      weights: rubricResolved.weights
    },
    mustHave,
    scores: {
      overall,
      fit: fit.score,
      evidence: evidence.score,
      templateRisk: templateRisk.score
    },
    breakdown: {
      fit: fit.breakdown,
      evidence: evidence.breakdown,
      templateRisk: templateRisk.breakdown,
      skills: { matched: matchedSkillIds, counts: skillSignals.counts }
    },
    claims,
    evidencePack,
    flags,
    followUps,
    microAssessment: rubricResolved.microAssessment,
    llm: { used: false }
  };
};

import { semanticSkillMatch, generateSummary, getConfig } from './llm.mjs';

export const analyzeApplicationWithLLM = async ({ jobFamily, applicationText, rubric } = {}) => {
  const base = analyzeApplication({ jobFamily, applicationText, rubric });
  const cfg = getConfig();

  if (!cfg.enabled) return { ...base, llm: { used: false, reason: 'ollama_disabled' } };

  const def = JOB_FAMILIES[base.jobFamily];
  const allRequired = (def?.mustHave || []).map(s => s.label);
  const allNice = (def?.niceToHave || []).map(s => s.label);

  // Run semantic matching and summary generation in parallel
  const [semantic, summaryResult] = await Promise.all([
    semanticSkillMatch({
      applicationText: String(applicationText || ''),
      jobFamily: base.jobFamily,
      requiredSkills: allRequired,
      niceToHaveSkills: allNice
    }),
    generateSummary({
      applicationText: String(applicationText || ''),
      jobFamily: base.jobFamily,
      scores: base.scores
    })
  ]);

  const semanticData = semantic.used ? {
    matchedSkills: semantic.matchedSkills || [],
    implicitSkills: semantic.implicitSkills || [],
    missingSkills: semantic.missingSkills || []
  } : null;

  // Boost overall score when LLM finds implicit skills missed by regex
  let scoreBoost = 0;
  if (semantic.used && semantic.implicitSkills?.length) {
    scoreBoost = Math.min(15, semantic.implicitSkills.length * 5);
  }
  const boostedOverall = clamp(base.scores.overall + scoreBoost, 0, 100);

  return {
    ...base,
    scores: { ...base.scores, overall: boostedOverall },
    summary: summaryResult.used ? summaryResult.summary : null,
    semanticSkills: semanticData,
    llm: {
      used: semantic.used || summaryResult.used,
      provider: 'ollama',
      host: cfg.host,
      model: cfg.model,
      summary: summaryResult.used ? summaryResult.summary : null,
      semanticMatching: semantic.used,
      scoreBoost
    }
  };
};

export { JOB_FAMILIES };
