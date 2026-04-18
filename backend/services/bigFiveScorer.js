import Question from '../models/Question.js';

export const TRAITS = ['C', 'O', 'A', 'E', 'S', 'L'];

class BigFiveScorer {
  scoreResponses(responses = []) {
    const scores = { C: 0, O: 0, A: 0, E: 0, S: 0 };

    for (const r of responses) {
      const trait = r.mappedTrait || r.selectedTrait; // allow pre-resolved
      if (!trait) continue;
      if (trait === 'L') {
        scores.S -= 1; // reverse score Low Stability
      } else if (scores.hasOwnProperty(trait)) {
        scores[trait] += 1;
      }
    }

    const normalized = this.normalize(scores);
    const recommendation = this.recommendStream(normalized);

    return { scores, normalized, recommendation };
  }

  async resolveTraitsFromAnswers(answers = []) {
    // answers: [{ questionId, selectedOptionText }]
    const ids = answers.map(a => a.questionId).filter(Boolean);
    const byId = new Map();
    if (ids.length) {
      const qs = await Question.find({ _id: { $in: ids } }).lean();
      qs.forEach(q => byId.set(String(q._id), q));
    }

    const responses = [];
    for (const a of answers) {
      const q = byId.get(String(a.questionId));
      if (!q) continue;
      const opt = (q.options || []).find(o => o.text === a.selectedOption || o.text === a.selectedOptionText);
      if (!opt) continue;
      responses.push({ mappedTrait: opt.mappedTrait });
    }
    return responses;
  }

  normalize(scores) {
    // Simple normalization to 10-point scale based on max observed among traits, floor at 0 for Stability
    const safeS = Math.max(0, scores.S);
    const base = Math.max(1, ...Object.values({ ...scores, S: safeS }));
    const out = { ...scores };
    out.S = safeS;
    const norm = {};
    for (const k of Object.keys(out)) {
      norm[k] = Math.round((out[k] / base) * 10 * 10) / 10;
    }
    return norm;
  }

  recommendStream(norm) {
    // Decision thresholds (tunable)
    const c = norm.C, o = norm.O, a = norm.A, e = norm.E, s = norm.S;

    const candidates = [];
    if (c > 7 && o > 7) candidates.push('PCM');
    if (a > 7 && c > 6) candidates.push('PCB');
    if (o > 7 && a > 6) candidates.push('Humanities');
    if (e > 7 && c > 6) candidates.push('Commerce');

    // Ranking by composite fit
    const fit = {
      PCM: c * 0.6 + o * 0.4 + s * 0.2,
      PCB: a * 0.5 + c * 0.3 + s * 0.4,
      Humanities: o * 0.6 + a * 0.4 + s * 0.2,
      Commerce: e * 0.6 + c * 0.3 + o * 0.2
    };

    const sorted = Object.entries(fit).sort(([,x],[,y]) => y - x).map(([k,v]) => ({ stream: k, fit: Math.round(v*10) }));
    const primary = sorted[0];
    const secondary = sorted[1];

    // Tie-breaking per spec
    const lead = primary.fit - secondary.fit;
    let suggestion;
    if (lead >= 5) suggestion = [primary.stream];
    else if (lead <= 3) suggestion = [primary.stream, secondary.stream];
    else suggestion = [primary.stream];

    // Counseling flag
    const totalLow = (norm.C + norm.O + norm.A + norm.E + norm.S) < 20 ? true : false;

    return {
      suggestions: suggestion,
      ranking: sorted,
      counselingFlag: totalLow
    };
  }

  /** Map normalized Big Five scores to stream alignment % (when options lack mappedStream). */
  streamFitPercentagesFromNormalized(norm) {
    const c = norm.C, o = norm.O, a = norm.A, e = norm.E, s = norm.S;
    const fit = {
      PCM: c * 0.6 + o * 0.4 + s * 0.2,
      PCB: a * 0.5 + c * 0.3 + s * 0.4,
      Humanities: o * 0.6 + a * 0.4 + s * 0.2,
      Commerce: e * 0.6 + c * 0.3 + o * 0.2
    };
    const maxF = Math.max(...Object.values(fit), 1e-6);
    return {
      PCM: Math.min(100, Math.round((fit.PCM / maxF) * 100)),
      PCB: Math.min(100, Math.round((fit.PCB / maxF) * 100)),
      Commerce: Math.min(100, Math.round((fit.Commerce / maxF) * 100)),
      Humanities: Math.min(100, Math.round((fit.Humanities / maxF) * 100))
    };
  }
}

export default new BigFiveScorer();





