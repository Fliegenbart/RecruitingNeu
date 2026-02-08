/**
 * LLM Helper — Zentrales Modul für Ollama-Kommunikation.
 * Alle LLM-Features fallen graceful zurück wenn Ollama nicht läuft.
 */

const getConfig = () => ({
  enabled: process.env.TRIAGE_USE_OLLAMA === '1',
  host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2:3b'
});

const generate = async ({ prompt, system, temperature = 0.3, maxTokens = 2048 } = {}) => {
  const cfg = getConfig();
  if (!cfg.enabled) return { ok: false, reason: 'ollama_disabled' };
  if (!cfg.model) return { ok: false, reason: 'ollama_model_missing' };

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  try {
    const res = await fetch(`${cfg.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        stream: false,
        options: { temperature, num_predict: maxTokens }
      })
    });
    if (!res.ok) return { ok: false, reason: `ollama_http_${res.status}` };
    const data = await res.json();
    const text = data?.message?.content || data?.response || '';
    return { ok: true, text, model: cfg.model, host: cfg.host };
  } catch (e) {
    return { ok: false, reason: 'ollama_error', error: String(e?.message || e) };
  }
};

const generateJSON = async (opts) => {
  const result = await generate(opts);
  if (!result.ok) return { ...result, parsed: null };

  const raw = result.text.trim();
  // Try to extract JSON from markdown code blocks or raw text
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw;

  try {
    const parsed = JSON.parse(jsonStr);
    return { ...result, parsed };
  } catch {
    return { ...result, ok: false, reason: 'invalid_json', parsed: null };
  }
};

// ── Feature: Semantic Skill Matching ──
export const semanticSkillMatch = async ({ applicationText, jobFamily, requiredSkills = [], niceToHaveSkills = [] }) => {
  const allSkills = [...requiredSkills, ...niceToHaveSkills];
  const result = await generateJSON({
    system: 'Du bist ein technischer Recruiting-Analyst. Antworte NUR mit validem JSON. Keine Erklärungen.',
    prompt: `Analysiere diesen Bewerbungstext und extrahiere welche der folgenden Skills der Kandidat hat.
Berücksichtige auch implizite Erfahrung (z.B. "CI/CD Pipeline gebaut" = Cloud/DevOps Erfahrung).

Skills zum Prüfen: ${allSkills.join(', ')}
Job-Familie: ${jobFamily}

Bewerbungstext:
"""
${String(applicationText).slice(0, 4000)}
"""

Antworte als JSON:
{
  "matchedSkills": [{"skill": "SkillName", "confidence": 0.0-1.0, "evidence": "Kurze Begründung aus dem Text"}],
  "implicitSkills": [{"skill": "SkillName", "confidence": 0.0-1.0, "evidence": "Warum implizit vorhanden"}],
  "missingSkills": ["SkillName"]
}`
  });

  if (!result.parsed) return { used: false, reason: result.reason || 'failed' };
  return {
    used: true,
    model: result.model,
    matchedSkills: result.parsed.matchedSkills || [],
    implicitSkills: result.parsed.implicitSkills || [],
    missingSkills: result.parsed.missingSkills || []
  };
};

// ── Feature: Candidate Summary (3 Sätze) ──
export const generateSummary = async ({ applicationText, jobFamily, scores = {} }) => {
  const result = await generate({
    system: 'Du bist ein präziser Recruiting-Analyst. Schreibe klar, direkt und auf Deutsch.',
    prompt: `Fasse diese Bewerbung in genau 3 Sätzen zusammen.
Satz 1: Was kann die Person (Kernkompetenz + stärkstes Ergebnis)?
Satz 2: Was fehlt oder ist unklar (Gaps, fehlende Belege)?
Satz 3: Klare Empfehlung (Einladen / Rückfragen / Absage) mit Begründung.

Job-Familie: ${jobFamily}
Scores: Overall ${scores.overall || '?'}, Evidence ${scores.evidence || '?'}, Fit ${scores.fit || '?'}

Bewerbungstext:
"""
${String(applicationText).slice(0, 4000)}
"""

Deine 3-Satz-Zusammenfassung:`,
    temperature: 0.2
  });

  if (!result.ok) return { used: false, reason: result.reason };
  return { used: true, model: result.model, summary: result.text.trim() };
};

// ── Feature: Copilot Message Generation ──
export const generateMessage = async ({ candidateName, jobTitle, companyName, tonality = 'advisory', context = '' }) => {
  const toneInstructions = {
    direct: 'Direkt und auf den Punkt. Keine Floskeln. Klares Ask: 15 Minuten Gespräch diese Woche.',
    advisory: 'Beratend und wertschätzend. Zeige Verständnis für die aktuelle Situation. Biete Flexibilität. Sanftes Ask.',
    visionary: 'Inspirierend und ambitioniert. Male ein Bild der Rolle und des Impacts. Betone Gestaltungsspielraum und Wachstum.'
  };

  const result = await generate({
    system: `Du bist ein erfahrener Tech-Recruiter der personalisierte Nachrichten schreibt.
Stil: ${toneInstructions[tonality] || toneInstructions.advisory}
Schreibe auf Deutsch. Max 6 Sätze. Kein "Sehr geehrte Damen und Herren". Persönlich und authentisch.`,
    prompt: `Schreibe eine Recruiting-Nachricht:
- Kandidat: ${candidateName}
- Position: ${jobTitle}
- Unternehmen: ${companyName}
${context ? `- Kontext: ${context}` : ''}

Die Nachricht:`,
    temperature: 0.6
  });

  if (!result.ok) return { used: false, reason: result.reason };
  return { used: true, model: result.model, message: result.text.trim() };
};

export const generateFollowUp = async ({ candidateName, jobTitle, previousMessage = '', daysSince = 7 }) => {
  const result = await generate({
    system: 'Du bist ein erfahrener Tech-Recruiter. Schreibe ein kurzes, charmantes Follow-up auf Deutsch. Max 4 Sätze. Nicht aufdringlich.',
    prompt: `Follow-up Nachricht:
- Kandidat: ${candidateName}
- Position: ${jobTitle}
- Tage seit letzter Nachricht: ${daysSince}
${previousMessage ? `- Letzte Nachricht war: "${previousMessage.slice(0, 200)}"` : ''}

Dein Follow-up:`,
    temperature: 0.5
  });

  if (!result.ok) return { used: false, reason: result.reason };
  return { used: true, model: result.model, message: result.text.trim() };
};

// ── Feature: Assessment Auto-Scoring ──
export const scoreAssessment = async ({ tasks = [], answers = {} }) => {
  const taskResults = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const answer = answers[String(i)] || '';
    if (!answer.trim()) {
      taskResults.push({ taskIndex: i, title: task.title, score: 0, maxScore: 10, feedback: 'Keine Antwort eingereicht.', strengths: [], gaps: ['Keine Antwort'] });
      continue;
    }

    const result = await generateJSON({
      system: 'Du bist ein fairer, präziser Prüfer für Recruiting-Assessments. Bewerte anhand der Rubrik. Antworte NUR mit validem JSON.',
      prompt: `Bewerte diese Assessment-Antwort auf einer Skala von 0-10.

Aufgabe: ${task.title}
Aufgabenstellung: ${task.prompt}

Bewertungskriterien (Rubrik):
${(task.rubric || []).map((r, j) => `${j + 1}. ${r}`).join('\n')}

Antwort des Kandidaten:
"""
${answer.slice(0, 3000)}
"""

Antworte als JSON:
{
  "score": 0-10,
  "feedback": "2-3 Sätze Gesamtbewertung",
  "strengths": ["Was gut war"],
  "gaps": ["Was fehlt oder verbessert werden könnte"],
  "rubricScores": [{"criterion": "Kriterium", "met": true/false, "note": "Kurze Begründung"}]
}`,
      temperature: 0.15
    });

    if (!result.parsed) {
      taskResults.push({ taskIndex: i, title: task.title, score: null, maxScore: 10, feedback: 'Automatische Bewertung fehlgeschlagen.', strengths: [], gaps: [], llmError: result.reason });
    } else {
      const p = result.parsed;
      taskResults.push({
        taskIndex: i,
        title: task.title,
        score: Math.min(10, Math.max(0, Number(p.score) || 0)),
        maxScore: 10,
        feedback: p.feedback || '',
        strengths: Array.isArray(p.strengths) ? p.strengths : [],
        gaps: Array.isArray(p.gaps) ? p.gaps : [],
        rubricScores: Array.isArray(p.rubricScores) ? p.rubricScores : []
      });
    }
  }

  const totalScore = taskResults.reduce((s, t) => s + (t.score || 0), 0);
  const maxTotal = taskResults.length * 10;
  const percentage = maxTotal ? Math.round((totalScore / maxTotal) * 100) : 0;

  return {
    used: true,
    taskResults,
    totalScore,
    maxTotal,
    percentage,
    recommendation: percentage >= 70 ? 'strong' : percentage >= 40 ? 'moderate' : 'weak'
  };
};

export { getConfig, generate, generateJSON };
