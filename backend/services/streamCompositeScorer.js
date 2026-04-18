/**
 * 7-section stream alignment → weighted composite (Career Compass spec).
 * Section weights (rows sum to 100 for PCM/PCB; Commerce 110; Humanities 115 — divisor per stream).
 */

export const STREAM_KEYS = ['PCM', 'PCB', 'Commerce', 'Humanities'];

const STREAM_LABELS = {
  PCM: 'PCM (Science with Maths)',
  PCB: 'PCB (Science with Biology)',
  Commerce: 'Commerce',
  Humanities: 'Humanities'
};

/** Per-stream weights by section (spec table). */
export const STREAM_SECTION_WEIGHTS = {
  PCM: { aptitude: 40, interest: 20, personality: 10, decision: 10, learning: 5, esi: 5, workValues: 10 },
  PCB: { aptitude: 25, interest: 25, personality: 15, decision: 10, learning: 10, esi: 10, workValues: 5 },
  Commerce: { aptitude: 35, interest: 25, personality: 10, decision: 10, learning: 10, esi: 5, workValues: 15 },
  Humanities: { aptitude: 20, interest: 30, personality: 20, decision: 15, learning: 10, esi: 10, workValues: 10 }
};

const SECTIONS = ['aptitude', 'interest', 'personality', 'decision', 'learning', 'esi', 'workValues'];

function normTags(question) {
  const t = question?.tags;
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
}

/**
 * Map a question to one of the 7 spec sections (or null if not used in composite).
 */
export function getQuestionSection(question) {
  if (!question) return null;
  const tags = normTags(question);

  if ((question.domain === undefined || question.domain === null) &&
      (question.options || []).some(o => o.riasecType)) {
    return 'interest';
  }
  if (question.domain === 'interest') return 'interest';
  if (question.domain === 'aptitude') return 'aptitude';

  if (question.category === 'personality_traits' || question.domain === 'personality') {
    return 'personality';
  }

  if (question.category === 'problem_solving' &&
      (tags.includes('problem_solving') || tags.includes('decision_making'))) {
    return 'decision';
  }

  if (question.category === 'learning_style') return 'learning';

  if (question.category === 'stress_management' && tags.includes('emotional_intelligence')) {
    return 'esi';
  }

  if (question.category === 'work_values') return 'workValues';

  return null;
}

export function emptyStreamCounts() {
  return { PCM: 0, PCB: 0, Commerce: 0, Humanities: 0 };
}

/** RIASEC counts → per-stream % for Interest row (spec mapping). */
export function interestStreamPercentagesFromRiasec(riasecProfile) {
  const R = riasecProfile?.R || 0;
  const I = riasecProfile?.I || 0;
  const A = riasecProfile?.A || 0;
  const S = riasecProfile?.S || 0;
  const E = riasecProfile?.E || 0;
  const C = riasecProfile?.C || 0;
  const n = R + I + A + S + E + C;
  if (!n) return emptyStreamCounts();
  return {
    PCM: Math.round(((R + I + C) / n) * 100),
    PCB: Math.round(((I + S + C) / n) * 100),
    Commerce: Math.round(((C + E + I) / n) * 100),
    Humanities: Math.round(((A + S + E) / n) * 100)
  };
}

/** Counts per stream in a section → 0–100 per stream. */
export function streamPercentagesFromCounts(counts, totalAnswered) {
  const out = emptyStreamCounts();
  if (!totalAnswered || totalAnswered <= 0) return out;
  for (const k of STREAM_KEYS) {
    out[k] = Math.min(100, Math.round(((counts[k] || 0) / totalAnswered) * 100));
  }
  return out;
}

/**
 * sectionStreamScores: { aptitude: {PCM,..}, interest: {...}, ... }
 * Returns display keys matching existing API.
 */
export function computeCompositeStreamAnalysis(sectionStreamScores) {
  const sections = sectionStreamScores || {};
  const out = {};

  for (const streamKey of STREAM_KEYS) {
    const weights = STREAM_SECTION_WEIGHTS[streamKey];
    let numerator = 0;
    let denominator = 0;
    for (const sec of SECTIONS) {
      const w = weights[sec];
      if (!w) continue;
      const pct = sections[sec]?.[streamKey] ?? 0;
      numerator += pct * w;
      denominator += w;
    }
    const label = STREAM_LABELS[streamKey];
    out[label] = denominator > 0 ? Math.min(100, Math.round(numerator / denominator)) : 0;
  }
  return out;
}

/** Legacy 4-domain formula when section breakdown is unavailable. */
export function legacyStreamAnalysisFromDomainScores(scores = {}) {
  const aptitude = Number(scores.aptitude) || 0;
  const values = Number(scores.values) || 0;
  const personality = Number(scores.personality) || 0;
  const skills = Number(scores.skills) || 0;

  return {
    [STREAM_LABELS.PCM]: Math.min(100, Math.round(aptitude * 0.4 + values * 0.2 + personality * 0.2 + skills * 0.2)),
    [STREAM_LABELS.PCB]: Math.min(100, Math.round(aptitude * 0.3 + values * 0.3 + personality * 0.2 + skills * 0.2)),
    [STREAM_LABELS.Commerce]: Math.min(100, Math.round(values * 0.4 + personality * 0.3 + aptitude * 0.2 + skills * 0.1)),
    [STREAM_LABELS.Humanities]: Math.min(100, Math.round(personality * 0.4 + values * 0.3 + skills * 0.2 + aptitude * 0.1))
  };
}

/**
 * Resolve final stream analysis: prefer 7-factor composite when section scores exist.
 */
export function resolveStreamAnalysisFromResults(results) {
  const sections = results?.sectionStreamScores;
  if (sections && typeof sections === 'object' && Object.keys(sections).length >= 4) {
    const composite = computeCompositeStreamAnalysis(sections);
    const hasSignal = Object.values(composite).some(v => v > 0);
    if (hasSignal) return composite;
  }
  if (results?.streamAnalysis && typeof results.streamAnalysis === 'object') {
    const entries = Object.entries(results.streamAnalysis);
    if (entries.length >= 2) return results.streamAnalysis;
  }
  return legacyStreamAnalysisFromDomainScores(results?.scores || {});
}
