import { randomUUID } from 'node:crypto';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const firstNames = [
  'Luca','Emma','Noah','Mia','Paul','Lina','Elias','Hannah','Felix','Clara','Jonas','Sofia','Ben','Lea','Max','Nina','Tom','Mila'
];
const lastNames = [
  'Fischer','Richter','Hofmann','Becker','Wagner','Schulz','Neumann','Wolf','Klein','Schreiber','Krueger','Vogt','Hartmann','Braun'
];

const makeName = () => `${pick(firstNames)} ${pick(lastNames)}`;

const genericOpeners = [
  'Sehr geehrte Damen und Herren,',
  'Hallo Recruiting-Team,',
  'Mit grossem Interesse bewerbe ich mich auf die ausgeschriebene Position.'
];

const genericTraits = [
  'Ich bin hoch motiviert und bringe eine schnelle Auffassungsgabe mit.',
  'Als Teamplayer arbeite ich strukturiert und detailorientiert.',
  'Ich freue mich darauf, meine Staerken in einem dynamischen Umfeld einzubringen.'
];

const softwareEvidenceSnippets = [
  'TypeScript, Node.js, React, Postgres, Docker',
  'REST API, GraphQL, CI/CD, Jest',
  'AWS, Kubernetes, Monitoring (p95)'
];
const salesEvidenceSnippets = [
  'Salesforce CRM, Outbound Sequenzen, Partnerkanal',
  'MEDDIC Discovery, Pipeline Hygiene, Forecasting',
  'ARR, MRR, Quota attainment, Win/Loss Reviews'
];
const pmEvidenceSnippets = [
  'OKRs, KPI Ownership, RICE Priorisierung',
  'A/B Tests, Activation Rate, Funnel Analyse',
  'Stakeholder Workshops (Sales/Support/Eng), Discovery Interviews'
];

const makeMetricLine = () => {
  const base = pick([
    { what: 'p95 Latenz', from: 420, to: 180, unit: 'ms' },
    { what: 'Activation Rate', from: 18, to: 27, unit: '%' },
    { what: 'Conversion', from: 12, to: 19, unit: '%' },
    { what: 'Regression Bugs', from: 23, to: 15, unit: '%' }
  ]);
  return `${base.what} von ${base.from}${base.unit} auf ${base.to}${base.unit} verbessert (2024).`;
};

const makeSalesNumbers = () => {
  const quota = pick([800000, 1000000, 1200000]);
  const attained = Math.round(quota * pick([1.05, 1.12, 1.2, 0.92]));
  return `Letztes Jahr habe ich ${Math.round(attained / 1000)}k EUR ARR abgeschlossen (Quota ${Math.round(quota / 1000)}k, ${Math.round((attained / quota) * 100)}%).`;
};

const makeTemplateText = (family) => {
  const closer = 'Mit freundlichen Gruessen';
  const familyLine =
    family === 'software'
      ? 'Ich bringe Erfahrung in moderner Softwareentwicklung mit.'
      : family === 'sales'
        ? 'Ich bringe starke Kommunikationsfaehigkeiten und Zielorientierung mit.'
        : 'Ich bin passionate ueber Produktentwicklung und Nutzermehrwert.';
  return [
    pick(genericOpeners),
    '',
    familyLine,
    pick(genericTraits),
    pick(genericTraits),
    '',
    closer
  ].join('\n');
};

const makeEvidenceText = (family) => {
  const year1 = pick([2022, 2023, 2024]);
  const year2 = year1 + 1;

  if (family === 'software') {
    return [
      `Projektzeitraum: ${year1}-${year2}.`,
      `Stack: ${pick(softwareEvidenceSnippets)}.`,
      `- ${makeMetricLine()}`,
      '- CI/CD Pipeline eingefuehrt; Testabdeckung verbessert (Jest).',
      '- API Design: REST + Auth; Debugging und Performance-Optimierung.',
      `Portfolio: https://github.com/${randomUUID().slice(0, 8)}`
    ].join('\n');
  }
  if (family === 'sales') {
    return [
      makeSalesNumbers(),
      `Tooling: ${pick(salesEvidenceSnippets)}.`,
      '- Pipeline Aufbau via Outbound + Partner.',
      '- Discovery nach MEDDIC; Conversion Verbesserungen in 2 Quartalen.',
      `Sales Cycle: ${pick([35, 42, 55])} Tage (Median).`
    ].join('\n');
  }
  return [
    `Als Product Manager habe ich OKRs verantwortet und mit RICE priorisiert (${year1}-${year2}).`,
    `- ${makeMetricLine()}`,
    `- ${pick(pmEvidenceSnippets)}.`,
    '- Ich habe Stakeholder aligned und klare Experimente definiert (A/B).'
  ].join('\n');
};

// Produce deliberate duplicates to demonstrate clustering.
const DUPLICATE_POOL = {
  software: [
    makeTemplateText('software'),
    makeTemplateText('software')
  ],
  sales: [
    makeTemplateText('sales'),
    makeTemplateText('sales'),
    makeSalesNumbers() + '\n' + 'Ich arbeite in Salesforce und baue Pipeline via Outbound.'
  ],
  pm: [
    makeTemplateText('pm'),
    makeTemplateText('pm')
  ]
};

export const generateDemoApplication = ({ family }) => {
  const f = family === 'sales' || family === 'pm' ? family : 'software';
  const variant = Math.random();

  const candidateName = makeName();

  // 35% duplicates/templates, 50% evidence, 15% mixed.
  let text;
  if (variant < 0.35) text = pick(DUPLICATE_POOL[f]);
  else if (variant < 0.85) text = makeEvidenceText(f);
  else text = makeTemplateText(f) + '\n\n' + makeEvidenceText(f).split('\n').slice(0, 2).join('\n');

  return { candidateName, text };
};

