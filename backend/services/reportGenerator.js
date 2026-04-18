import PDFDocument from 'pdfkit';
import { resolveStreamAnalysisFromResults } from './streamCompositeScorer.js';

/**
 * Career Compass PDF — clean layout, safe pagination, data aligned with test results
 */

const PAGE = { w: 595.28, h: 841.89 };
const M = { top: 56, bottom: 56, left: 50, right: 50 };
const CONTENT_W = PAGE.w - M.left - M.right;
const FOOTER_RESERVE = 48;
const COLORS = {
  primary: '#1e3a5f',
  accent: '#2563eb',
  muted: '#64748b',
  text: '#334155',
  border: '#e2e8f0',
  band: '#f1f5f9'
};

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampPct(n) {
  return Math.min(100, Math.max(0, Math.round(num(n, 0))));
}

function testIdShort(testData) {
  try {
    const id = testData?._id;
    const s = id && typeof id.toString === 'function' ? id.toString() : String(id || '');
    return s.replace(/[^a-f0-9]/gi, '').slice(0, 12).toUpperCase() || 'N/A';
  } catch {
    return 'N/A';
  }
}

/** 7-factor composite when sectionStreamScores present; else legacy domain blend. */
function computeStreamAnalysisFromScores(results) {
  return resolveStreamAnalysisFromResults(results || {});
}

function resolveStreamScores(testData) {
  const r = testData?.results || {};
  const existing = r.streamAnalysis;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    const entries = Object.entries(existing).filter(([, v]) => Number.isFinite(Number(v)));
    if (entries.length >= 2) {
      return Object.fromEntries(entries.map(([k, v]) => [k, clampPct(v)]));
    }
  }
  return computeStreamAnalysisFromScores(r);
}

function sortedStreams(streamScores) {
  return Object.entries(streamScores || {})
    .map(([name, v]) => [name, clampPct(v)])
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => b[1] - a[1]);
}

function getTopRIASECTypes(riasecScores) {
  const types = {
    R: 'Realistic',
    I: 'Investigative',
    A: 'Artistic',
    S: 'Social',
    E: 'Enterprising',
    C: 'Conventional'
  };
  const sorted = Object.entries(riasecScores || {})
    .filter(([, v]) => num(v, 0) > 0)
    .sort((a, b) => num(b[1], 0) - num(a[1], 0))
    .slice(0, 2);
  if (sorted.length === 0) {
    return ['Balanced', 'Balanced'];
  }
  return sorted.map(([key]) => types[key] || key);
}

function getRIASECDescription(interests) {
  const descriptions = {
    Realistic: 'hands-on work and practical applications',
    Investigative: 'research, analysis, and problem-solving',
    Artistic: 'creativity, design, and self-expression',
    Social: 'helping others and collaborative work',
    Enterprising: 'leadership, entrepreneurship, and persuasion',
    Conventional: 'organization, data management, and structured tasks',
    Balanced: 'a wide range of career environments'
  };
  return interests.map(i => descriptions[i] || 'diverse activities').join(' and ');
}

/** Personality sums are raw totals from options; compare relatively. */
function getPersonalityDescription(personalityScores) {
  const raw = personalityScores || {};
  const entries = Object.entries(raw).filter(([, v]) => num(v, 0) > 0);
  if (entries.length === 0) {
    return 'Personality responses indicate a balanced profile across measured dimensions.';
  }
  const maxVal = Math.max(...entries.map(([, v]) => num(v, 0)), 1);
  const labels = {
    O: 'openness to experience',
    C: 'conscientiousness',
    E: 'extraversion',
    A: 'agreeableness',
    S: 'emotional stability'
  };
  const ranked = entries
    .map(([k, v]) => ({ k, v: num(v, 0), rel: num(v, 0) / maxVal }))
    .sort((a, b) => b.v - a.v);
  const top = ranked.slice(0, 2).map(x => labels[x.k] || x.k).filter(Boolean);
  if (top.length === 0) {
    return 'Personality responses indicate a balanced profile across measured dimensions.';
  }
  return `Relative strengths appear in ${top.join(' and ')}, compared with your other trait scores in this assessment.`;
}

function getWorkValuesDescription(workValues) {
  const wv = workValues || {};
  const entries = Object.entries(wv).filter(([, v]) => num(v, 0) > 0);
  if (entries.length === 0) {
    return 'Work values themes were not scored separately in this assessment; overall values and judgment scores reflect the values-related items in your test.';
  }
  const topValue = entries.sort((a, b) => num(b[1], 0) - num(a[1], 0))[0];
  const descriptions = {
    achievement: 'accomplishment and recognition',
    stability: 'security and structured environments',
    creativity: 'innovation and self-expression',
    helping: 'service and supporting others',
    leadership: 'influence and decision-making'
  };
  return `Among measured work themes, the strongest signal is ${descriptions[topValue[0]] || 'balanced preferences'}.`;
}

function aptitudeNarrative(aptitudePct, results) {
  const pct = clampPct(aptitudePct);
  const breakdown = results?.scores?.aptitudeBreakdown;
  if (breakdown && typeof breakdown === 'object') {
    const top = Object.entries(breakdown)
      .sort((a, b) => num(b[1], 0) - num(a[1], 0))
      .slice(0, 2)
      .map(([k]) => k);
    if (top.length) {
      return `Aptitude performance is estimated at ${pct}% overall, with relatively stronger areas in ${top.join(' and ')}.`;
    }
  }
  return `Aptitude-related items in this assessment are summarized at ${pct}% (normalized against your answered aptitude questions).`;
}

export async function generateCareerReport(testData, userData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
        autoFirstPage: true,
        bufferPages: true
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const results = testData?.results || {};
      const scores = {
        aptitude: clampPct(results.scores?.aptitude),
        values: clampPct(results.scores?.values),
        personality: clampPct(results.scores?.personality),
        skills: clampPct(results.scores?.skills),
        interest: clampPct(results.scores?.interest)
      };

      const streamScores = resolveStreamScores(testData);
      const ranked = sortedStreams(streamScores);
      const primary = ranked[0] || ['PCM (Science with Maths)', 0];
      const secondary = ranked[1] || ranked[0] || ['PCB (Science with Biology)', 0];

      const bottomLimit = () => PAGE.h - M.bottom - FOOTER_RESERVE;

      /** Single-line footer; drawn once per page after all content (see flushFooters). */
      const FOOTER_TEXT = 'Career Compass · Powered by Vijnax · Confidential';

      const ensureSpace = minHeight => {
        if (doc.y + minHeight > bottomLimit()) {
          doc.addPage();
          doc.x = M.left;
          doc.y = M.top;
        }
      };

      const heading = (text, size = 14) => {
        ensureSpace(size + 28);
        doc.fontSize(size)
          .font('Helvetica-Bold')
          .fillColor(COLORS.primary)
          .text(text, M.left, doc.y, { width: CONTENT_W });
        doc.moveDown(0.35);
      };

      const subheading = (text, size = 11) => {
        ensureSpace(size + 20);
        doc.fontSize(size)
          .font('Helvetica-Bold')
          .fillColor(COLORS.text)
          .text(text, M.left, doc.y, { width: CONTENT_W });
        doc.moveDown(0.25);
      };

      const paragraph = (text, opts = {}) => {
        const size = opts.size || 10;
        const lineGap = opts.lineGap ?? 2;
        ensureSpace(36);
        doc.fontSize(size)
          .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(opts.color || COLORS.text)
          .text(text, M.left, doc.y, {
            width: CONTENT_W,
            align: opts.align || 'left',
            lineGap
          });
        doc.moveDown(0.5);
      };

      const divider = () => {
        ensureSpace(16);
        const y = doc.y;
        doc.moveTo(M.left, y)
          .lineTo(PAGE.w - M.right, y)
          .strokeColor(COLORS.border)
          .lineWidth(0.5)
          .stroke();
        doc.moveDown(0.6);
      };

      const progressRow = (label, pct) => {
        const rowH = 22;
        ensureSpace(rowH + 8);
        const y = doc.y;
        const barW = Math.min(240, CONTENT_W - 130);
        const barX = M.left + 115;
        const p = clampPct(pct);
        const fillColor = p >= 70 ? '#15803d' : p >= 50 ? '#ca8a04' : COLORS.muted;

        doc.fontSize(9)
          .font('Helvetica')
          .fillColor(COLORS.text)
          .text(label, M.left, y + 4, { width: 108 });

        doc.roundedRect(barX, y + 2, barW, 12, 2).fill('#e2e8f0');
        doc.roundedRect(barX, y + 2, (p / 100) * barW, 12, 2).fill(fillColor);

        doc.fontSize(9)
          .font('Helvetica-Bold')
          .fillColor(COLORS.primary)
          .text(`${p}%`, barX + barW + 8, y + 4, { width: 40, align: 'right' });

        doc.y = y + rowH;
      };

      // ---- Cover band ----
      doc.rect(0, 0, PAGE.w, 72).fill(COLORS.primary);
      doc.fontSize(22)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('Career Compass', M.left, 26, { width: CONTENT_W, align: 'center' });
      doc.fontSize(11)
        .font('Helvetica')
        .fillColor('#cbd5e1')
        .text('Stream selection & career guidance report', M.left, 50, { width: CONTENT_W, align: 'center' });

      doc.y = 88;
      doc.x = M.left;

      // Student block
      heading('Student details', 12);
      const profile = userData?.profile || {};
      paragraph(
        [
          `Name: ${userData?.name || 'N/A'}`,
          `Class: ${profile.grade || 'N/A'}`,
          `School: ${profile.school || 'N/A'}`,
          `Report date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `Assessment ID: ${testIdShort(testData)}`
        ].join('\n'),
        { size: 10, lineGap: 3 }
      );

      divider();

      // Executive summary
      heading('Executive summary', 13);
      const conf =
        primary[1] >= 75 ? 'High' : primary[1] >= 60 ? 'Medium' : 'Moderate';
      paragraph(
        `Primary stream: ${primary[0]} (${primary[1]}%). ` +
          `Secondary option: ${secondary[0]} (${secondary[1]}%). ` +
          `Confidence band: ${conf}, based on your assessment scores and stream fit model used in this product.`,
        { size: 10, lineGap: 3 }
      );

      divider();

      // Stream fit
      heading('Stream fit scores', 13);
      paragraph(
        'Percentages reflect either direct stream mapping from your answers (when available) or the weighted score model used by the Career Compass report API.',
        { size: 9, color: COLORS.muted }
      );

      const streamOrder = [
        'PCM (Science with Maths)',
        'PCB (Science with Biology)',
        'Commerce',
        'Humanities'
      ];
      streamOrder.forEach(name => {
        const v = streamScores[name];
        progressRow(name, v != null ? v : 0);
      });

      doc.moveDown(0.3);
      divider();

      // Domain scores (correct fields — no duplicate “ESI” = values twice mislabeled)
      heading('Score overview', 13);
      progressRow('Aptitude', scores.aptitude);
      progressRow('Personality', scores.personality);
      progressRow('Values & judgment', scores.values);
      progressRow('Learning / skills', scores.skills);
      if (scores.interest > 0) {
        progressRow('Interest (aggregate)', scores.interest);
      }

      doc.moveDown(0.2);
      divider();

      // Narrative sections — dynamic height, paginate
      heading('Interpretation', 13);

      subheading('Aptitude');
      paragraph(aptitudeNarrative(scores.aptitude, results), { size: 10 });

      subheading('Career interests (RIASEC)');
      const riasecScores = results.riasecProfile || {};
      const topRI = getTopRIASECTypes(riasecScores);
      paragraph(
        `${topRI.join(' and ')} themes rank highest among your RIASEC responses: ${getRIASECDescription(topRI)}.`,
        { size: 10 }
      );

      subheading('Personality (Big Five)');
      paragraph(getPersonalityDescription(results.personalityProfile || {}), { size: 10 });

      subheading('Values, learning, and work preferences');
      paragraph(
        `Values-related and judgment items contribute to the values score (${scores.values}%). ` +
          `Learning orientation and related habits are reflected in the learning/skills score (${scores.skills}%).`,
        { size: 10 }
      );
      paragraph(getWorkValuesDescription(results.workValues), { size: 10 });

      ensureSpace(80);
      divider();

      heading('Guidance for parents', 12);
      paragraph(
        `Support ${userData?.name || 'the student'} in exploring ${primary[0]} without pressure. ` +
          `Interests can evolve; ${secondary[0]} remains a reasonable secondary path at ${secondary[1]}% in this model. ` +
          `Balance academics with wellbeing, routines, and activities the student enjoys.`,
        { size: 10, lineGap: 3 }
      );

      ensureSpace(100);
      divider();

      heading('Disclaimer', 11);
      paragraph(
        'This report summarizes psychometric-style questionnaire results. It is guidance only, not a medical or psychological diagnosis, ' +
          'not a prediction of exam results, and not a guarantee of admission or outcomes. Use it together with school records, conversations, and professional advice where appropriate.',
        { size: 9, color: COLORS.muted, lineGap: 2 }
      );

      const bullets = [
        'Results depend on honest responses and question coverage in this test version.',
        'Recommended streams may change as skills and interests develop.',
        'Does not replace informed student and family choice.'
      ];
      bullets.forEach(b => paragraph(`• ${b}`, { size: 9, color: COLORS.muted }));

      // One footer per page only (avoids stacking from ensureSpace + end)
      const footerY = PAGE.h - M.bottom - 10;
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
          .font('Helvetica')
          .fillColor(COLORS.muted)
          .text(FOOTER_TEXT, M.left, footerY, {
            width: CONTENT_W,
            align: 'center',
            lineBreak: false
          });
      }
      doc.flushPages();
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default { generateCareerReport };
