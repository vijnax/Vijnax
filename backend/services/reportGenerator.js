import PDFDocument from 'pdfkit';

const PAGE = { w: 595, h: 842 };
const MARGIN = 56;
const CONTENT_W = PAGE.w - MARGIN * 2;
const BOTTOM_SAFE = PAGE.h - MARGIN - 40;

const colors = {
  ink: '#111827',
  muted: '#4B5563',
  line: '#E5E7EB',
  accent: '#1F2937'
};

function clampPct(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function assessmentId(testData) {
  const id = testData?._id;
  if (!id) return 'N/A';
  const s = typeof id === 'string' ? id : id.toString();
  return s.length >= 12 ? s.slice(0, 12).toUpperCase() : s.toUpperCase();
}

/** Same weighting as routes/reports.js when stream votes are unavailable */
function computeStreamScoresFromDomains(results) {
  const s = results?.scores || {};
  const aptitude = s.aptitude || 0;
  const values = s.values || 0;
  const personality = s.personality || 0;
  const skills = s.skills || 0;

  return {
    'PCM (Science with Maths)': Math.min(
      Math.round(aptitude * 0.4 + values * 0.2 + personality * 0.2 + skills * 0.2),
      100
    ),
    'PCB (Science with Biology)': Math.min(
      Math.round(aptitude * 0.3 + values * 0.3 + personality * 0.2 + skills * 0.2),
      100
    ),
    Commerce: Math.min(
      Math.round(values * 0.4 + personality * 0.3 + aptitude * 0.2 + skills * 0.1),
      100
    ),
    Humanities: Math.min(
      Math.round(personality * 0.4 + values * 0.3 + skills * 0.2 + aptitude * 0.1),
      100
    )
  };
}

function getStreamScores(results) {
  const raw = results?.streamAnalysis;
  if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
    return raw;
  }
  return computeStreamScoresFromDomains(results);
}

function sortedStreams(streamScores) {
  return Object.entries(streamScores)
    .filter(([, v]) => typeof v === 'number' && !Number.isNaN(v))
    .sort((a, b) => b[1] - a[1]);
}

function riasecPercentages(riasecProfile) {
  const p = riasecProfile && typeof riasecProfile === 'object' ? riasecProfile : {};
  const total = Object.values(p).reduce((a, b) => a + (Number(b) || 0), 0);
  if (total <= 0) return null;
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    out[k] = Math.round(((Number(v) || 0) / total) * 100);
  }
  return out;
}

const RIASEC_LABELS = {
  R: 'Realistic',
  I: 'Investigative',
  A: 'Artistic',
  S: 'Social',
  E: 'Enterprising',
  C: 'Conventional'
};

function topRiasecLabels(riasecProfile, n = 2) {
  const pct = riasecPercentages(riasecProfile);
  if (!pct) return [];
  return Object.entries(pct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => RIASEC_LABELS[k] || k);
}

function riasecNarrative(riasecProfile) {
  const top = topRiasecLabels(riasecProfile, 2);
  if (!top.length) {
    return 'Career-interest profile reflects the mix of responses across RIASEC dimensions.';
  }
  const desc = getRIASECDescription(top);
  return `Strongest interest themes: ${top.join(' and ')} — ${desc}.`;
}

const BIG_FIVE_LABELS = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  S: 'Emotional stability'
};

function personalityNarrative(personalityProfile) {
  const p = personalityProfile && typeof personalityProfile === 'object' ? personalityProfile : {};
  const entries = Object.entries(p).filter(([, v]) => typeof v === 'number' && v > 0);
  if (!entries.length) {
    return 'Personality pattern is balanced across the assessed Big Five dimensions.';
  }
  const max = Math.max(...entries.map(([, v]) => v));
  const threshold = max * 0.85;
  const strong = entries
    .filter(([, v]) => v >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => BIG_FIVE_LABELS[k] || k)
    .slice(0, 3);
  if (!strong.length) {
    return 'Personality scores are relatively even across dimensions.';
  }
  return `Relatively elevated themes: ${strong.join(', ')} (based on weighted responses).`;
}

function workValuesLine(workValues) {
  const w = workValues && typeof workValues === 'object' ? workValues : {};
  const keys = Object.keys(w).filter((k) => typeof w[k] === 'number');
  if (!keys.length) {
    return 'Work-values subscores were not stored separately for this assessment; values-related responses contribute to the Values domain score above.';
  }
  return getWorkValuesDescription(w);
}

function getRIASECDescription(interests) {
  const descriptions = {
    Realistic: 'hands-on and practical work',
    Investigative: 'analysis, inquiry, and problem-solving',
    Artistic: 'creativity and expressive work',
    Social: 'helping people and collaboration',
    Enterprising: 'leadership and persuasion',
    Conventional: 'structure, systems, and organization'
  };
  return interests.map((i) => descriptions[i] || 'varied activities').join(' and ');
}

function getWorkValuesDescription(workValues) {
  const topValue = Object.entries(workValues)
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => b[1] - a[1])[0];

  if (!topValue) return 'Balanced orientation across assessed work-value themes.';

  const descriptions = {
    achievement: 'achievement and mastery',
    stability: 'stability and structure',
    creativity: 'creativity and autonomy',
    helping: 'service and collaboration',
    leadership: 'influence and responsibility'
  };

  return `Leading theme: ${descriptions[topValue[0]] || topValue[0].replace(/_/g, ' ')}.`;
}

/**
 * Career Compass PDF — minimal layout, wrapped text, pagination, data aligned to test.results.
 */
export async function generateCareerReport(testData, userData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        bufferPages: true
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const results = testData?.results || {};
      const scores = results.scores || {};
      const streamScores = getStreamScores(results);
      const ranked = sortedStreams(streamScores);
      const primary = ranked[0] || ['Primary stream', 0];
      const secondary = ranked[1] || ['Secondary stream', 0];

      const name = (userData && (userData.name || userData?.profile?.name)) || 'Student';
      const grade = userData?.profile?.grade;
      const school = userData?.profile?.school;

      const aptitudePct = clampPct(scores.aptitude);
      const valuesPct = clampPct(scores.values);
      const personalityPct = clampPct(scores.personality);
      const skillsPct = clampPct(scores.skills);
      const esiPct = clampPct(results.esiScore != null ? results.esiScore : scores.values);

      let y = MARGIN;

      const ensureSpace = (needed) => {
        if (y + needed > BOTTOM_SAFE) {
          doc.addPage();
          y = MARGIN;
        }
      };

      const line = (text, opts = {}) => {
        const fs = opts.size || 10;
        const font = opts.bold ? 'Helvetica-Bold' : 'Helvetica';
        const color = opts.color || colors.ink;
        const leading = opts.leading || fs * 1.35;
        doc.font(font).fontSize(fs).fillColor(color);
        const h = doc.heightOfString(String(text), {
          width: CONTENT_W,
          align: opts.align || 'left',
          lineGap: opts.lineGap ?? 2
        });
        ensureSpace(h + 6);
        doc.text(String(text), MARGIN, y, {
          width: CONTENT_W,
          align: opts.align || 'left',
          lineGap: opts.lineGap ?? 2
        });
        y = doc.y + (opts.after || 10);
      };

      const rule = () => {
        ensureSpace(16);
        doc.moveTo(MARGIN, y).lineTo(PAGE.w - MARGIN, y).strokeColor(colors.line).lineWidth(0.5).stroke();
        y += 14;
      };

      const barRow = (label, pct) => {
        const p = clampPct(pct);
        const barH = 6;
        const barW = CONTENT_W - 120;
        const labelH = 14;
        ensureSpace(28);
        doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(label, MARGIN, y, { width: 110 });
        doc.rect(MARGIN + 115, y + 3, barW, barH).fillColor(colors.line).fill();
        doc.rect(MARGIN + 115, y + 3, (barW * p) / 100, barH).fillColor(colors.accent).fill();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.ink).text(`${p}%`, MARGIN + 115 + barW + 8, y + 1, {
          width: 40,
          align: 'right'
        });
        y += 22;
      };

      // --- Page header block ---
      doc.font('Helvetica-Bold').fontSize(20).fillColor(colors.ink).text('Career Compass', MARGIN, y, {
        width: CONTENT_W,
        align: 'left'
      });
      y = doc.y + 4;
      line('Stream selection report', { size: 11, color: colors.muted, after: 6 });
      rule();

      line(`Student: ${name}`, { size: 11, bold: true });
      if (grade) line(`Class / grade: ${grade}`, { size: 10 });
      if (school) line(`School: ${school}`, { size: 10 });
      line(
        `Report date: ${new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}`,
        { size: 10, color: colors.muted }
      );
      line(`Assessment ID: ${assessmentId(testData)}`, { size: 10, color: colors.muted });
      if (testData.completedAt) {
        line(`Completed: ${new Date(testData.completedAt).toLocaleDateString('en-IN')}`, {
          size: 10,
          color: colors.muted
        });
      }

      rule();
      line('Summary', { size: 12, bold: true, after: 6 });

      const conf =
        primary[1] > 75 ? 'High' : primary[1] > 60 ? 'Medium' : primary[1] > 0 ? 'Moderate' : '—';
      line(
        `Primary recommendation: ${primary[0]} (${clampPct(primary[1])}%). ` +
          `Secondary: ${secondary[0]} (${clampPct(secondary[1])}%). ` +
          `Confidence band: ${conf} (based on stream fit scores in this report).`,
        { size: 10, leading: 14 }
      );

      rule();
      line('Stream fit', { size: 12, bold: true, after: 8 });

      const streamLabels = [
        ['PCM (Science with Maths)', 'PCM'],
        ['PCB (Science with Biology)', 'PCB'],
        ['Commerce', 'Commerce'],
        ['Humanities', 'Humanities']
      ];
      for (const [longKey, shortKey] of streamLabels) {
        const v = streamScores[longKey] ?? streamScores[shortKey];
        barRow(longKey, v ?? 0);
      }

      ensureSpace(40);
      rule();
      line('Domain scores', { size: 12, bold: true, after: 8 });
      line(
        'Percentages reflect your responses within each scored domain. Skills includes learning-orientation items.',
        { size: 9, color: colors.muted, leading: 12 }
      );
      barRow('Aptitude', aptitudePct);
      barRow('Values', valuesPct);
      barRow('Personality (Big Five)', personalityPct);
      barRow('Skills & learning', skillsPct);
      if (results.esiScore != null && results.esiScore !== scores.values) {
        barRow('Emotional & social index (stored)', esiPct);
      } else {
        line('Note: ESI-style items are scored within the Values domain for this test version.', {
          size: 9,
          color: colors.muted,
          leading: 12
        });
      }

      ensureSpace(36);
      rule();
      line('Profile detail', { size: 12, bold: true, after: 6 });
      line(`Aptitude index: ${aptitudePct}% overall.`, { size: 10 });
      line(riasecNarrative(results.riasecProfile), { size: 10, leading: 14 });
      line(personalityNarrative(results.personalityProfile), { size: 10, leading: 14 });
      line(workValuesLine(results.workValues), { size: 10, leading: 14 });

      if (results.overallScore != null) {
        line(`Overall composite: ${clampPct(results.overallScore)}%.`, { size: 10, color: colors.muted });
      }

      ensureSpace(60);
      rule();
      line('Disclaimer', { size: 12, bold: true, after: 6 });
      line(
        'This report summarises automated scores from your assessment. It is guidance only—not a prediction of exam results, admissions, or career outcomes. Discuss results with parents, teachers, or a qualified counsellor.',
        { size: 9, color: colors.muted, leading: 13 }
      );

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(8).fillColor(colors.muted).text('Career Compass · Vijnax', MARGIN, PAGE.h - 32, {
          width: CONTENT_W,
          align: 'center'
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default { generateCareerReport };
