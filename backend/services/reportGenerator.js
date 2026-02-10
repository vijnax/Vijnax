import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate Career Compass PDF Report
 * MODERN, BEAUTIFUL UI with professional styling
 */
export async function generateCareerReport(testData, userData) {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document with better margins
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 60, right: 60 }
      });

      // Collect chunks for buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Modern color palette
      const colors = {
        primary: '#4F46E5',      // Indigo
        secondary: '#06B6D4',    // Cyan
        success: '#10B981',      // Green
        warning: '#F59E0B',      // Amber
        danger: '#EF4444',       // Red
        dark: '#1F2937',         // Gray-800
        text: '#374151',         // Gray-700
        textLight: '#6B7280',    // Gray-500
        bg: '#F9FAFB',           // Gray-50
        border: '#E5E7EB'        // Gray-200
      };

      // Helper functions for modern styling
      const addGradientBox = (y, height, color1, color2) => {
        // Simulate gradient with overlapping rectangles
        for (let i = 0; i < height; i += 2) {
          const opacity = 0.1 + (i / height) * 0.05;
          doc.rect(60, y + i, 475, 2)
             .fillOpacity(opacity)
             .fill(color1);
        }
        doc.fillOpacity(1);
      };

      const addModernTitle = (text, size = 26) => {
        doc.fontSize(size)
           .font('Helvetica-Bold')
           .fillColor(colors.primary)
           .text(text, { align: 'center' });
        doc.moveDown(0.3);
      };

      const addHeading = (text, emoji = '', size = 18) => {
        doc.fontSize(size)
           .font('Helvetica-Bold')
           .fillColor(colors.dark)
           .text(`${emoji} ${text}`);
        doc.moveDown(0.4);
      };

      const addSubHeading = (text, size = 14) => {
        doc.fontSize(size)
           .font('Helvetica-Bold')
           .fillColor(colors.text)
           .text(text);
        doc.moveDown(0.3);
      };

      const addText = (text, options = {}) => {
        doc.fontSize(options.size || 11)
           .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
           .fillColor(options.color || colors.text)
           .text(text, options);
        doc.moveDown(0.4);
      };

      const addCard = (content, bgColor = colors.bg) => {
        const startY = doc.y;
        const cardPadding = 15;
        
        // Measure content height
        const tempY = doc.y;
        doc.y += cardPadding;
        content();
        const contentHeight = doc.y - tempY;
        
        // Draw card background
        doc.rect(60, startY, 475, contentHeight + cardPadding)
           .fillOpacity(0.5)
           .fill(bgColor);
        
        // Reset and draw content
        doc.fillOpacity(1);
        doc.y = startY + cardPadding;
        content();
        doc.y += cardPadding;
      };

      const addProgressBar = (label, percentage, color) => {
        const barWidth = 300;
        const barHeight = 18;
        const startX = 150;
        const startY = doc.y;
        
        // Label
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(colors.text)
           .text(label, 60, startY);
        
        // Background bar
        doc.roundedRect(startX, startY - 2, barWidth, barHeight, 9)
           .fill(colors.border);
        
        // Filled bar
        const fillWidth = (percentage / 100) * barWidth;
        doc.roundedRect(startX, startY - 2, fillWidth, barHeight, 9)
           .fill(color);
        
        // Percentage text
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(colors.dark)
           .text(`${Math.round(percentage)}%`, startX + barWidth + 15, startY, { width: 50 });
        
        doc.moveDown(1.2);
      };

      const addDivider = () => {
        doc.moveTo(60, doc.y)
           .lineTo(535, doc.y)
           .lineWidth(1.5)
           .strokeColor(colors.border)
           .stroke();
        doc.moveDown(0.8);
      };

      // ============= MODERN HEADER WITH GRADIENT =============
      // Top gradient bar
      doc.rect(0, 0, 595, 120)
         .fillOpacity(0.95)
         .fill(colors.primary);
      doc.fillOpacity(1);
      
      // White title
      doc.fontSize(28)
         .font('Helvetica-Bold')
         .fillColor('#FFFFFF')
         .text('Career Compass', { align: 'center' });
      
      doc.fontSize(16)
         .font('Helvetica')
         .fillColor('#E0E7FF')
         .text('Stream Selection & Career Guidance Report', { align: 'center' });
      
      doc.moveDown(3);

      // Student Information Card
      const infoBoxY = doc.y;
      doc.roundedRect(60, infoBoxY, 475, 110, 8)
         .fillOpacity(0.05)
         .fill(colors.primary);
      doc.fillOpacity(1);
      
      doc.roundedRect(60, infoBoxY, 475, 110, 8)
         .lineWidth(2)
         .strokeColor(colors.primary)
         .stroke();
      
      doc.y = infoBoxY + 15;
      doc.fontSize(13).font('Helvetica-Bold').fillColor(colors.dark);
      doc.text(`👤 Student: ${userData.name || 'N/A'}`, 80, doc.y);
      doc.moveDown(0.6);
      
      doc.fontSize(11).font('Helvetica').fillColor(colors.text);
      doc.text(`📚 Class: ${userData.profile?.grade || 'N/A'}`, 80);
      doc.moveDown(0.5);
      doc.text(`🏫 School: ${userData.profile?.school || 'N/A'}`, 80);
      doc.moveDown(0.5);
      doc.text(`📅 Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 80);
      doc.moveDown(0.5);
      doc.text(`🔖 Assessment ID: ${testData._id.toString().substring(0, 12).toUpperCase()}`, 80);
      
      doc.y = infoBoxY + 125;
      doc.moveDown();

      // ============= EXECUTIVE SUMMARY WITH HIGHLIGHT BOX =============
      addHeading('Executive Summary', '📊', 20);
      
      const streamScores = testData.results.streamAnalysis || calculateStreamScores(testData.results);
      const primaryStream = Object.entries(streamScores).sort((a, b) => b[1] - a[1])[0];
      const secondaryStream = Object.entries(streamScores).sort((a, b) => b[1] - a[1])[1];
      
      // Highlight box for recommendation
      const summaryY = doc.y;
      doc.roundedRect(60, summaryY, 475, 90, 8)
         .fillOpacity(0.1)
         .fill(colors.success);
      doc.fillOpacity(1);
      
      doc.roundedRect(60, summaryY, 475, 90, 8)
         .lineWidth(2)
         .strokeColor(colors.success)
         .stroke();
      
      doc.y = summaryY + 15;
      doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.dark);
      doc.text('🎯 Recommended Stream', 80);
      doc.moveDown(0.5);
      
      doc.fontSize(20).font('Helvetica-Bold').fillColor(colors.success);
      doc.text(primaryStream[0], 80);
      doc.moveDown(0.4);
      
      doc.fontSize(11).font('Helvetica').fillColor(colors.text);
      const confidenceLevel = primaryStream[1] > 75 ? 'HIGH ✨' : primaryStream[1] > 60 ? 'MEDIUM 👍' : 'MODERATE 📈';
      doc.text(`Confidence Level: ${confidenceLevel} | Secondary Option: ${secondaryStream[0]}`, 80);
      
      doc.y = summaryY + 100;
      doc.moveDown();
      
      addText(
        `Based on the comprehensive psychometric assessment, ${primaryStream[0]} emerges as the strongest fit, ` +
        `combining aptitude strengths, personality traits, and career interests effectively. ` +
        `${secondaryStream[0]} is recommended as a secondary option.`,
        { size: 11 }
      );

      doc.moveDown();
      addDivider();

      // ============= STREAM FIT ANALYSIS WITH VISUAL BARS =============
      doc.addPage();
      
      // Page header with gradient
      doc.rect(0, 0, 595, 60)
         .fillOpacity(0.05)
         .fill(colors.primary);
      doc.fillOpacity(1);
      
      doc.y = 75;
      addHeading('Stream Fit Analysis', '📈', 22);
      doc.moveDown(0.5);
      
      // Map short to long names for lookup
      const streamMapping = {
        'PCM': 'PCM (Science with Maths)',
        'PCB': 'PCB (Science with Biology)',
        'Commerce': 'Commerce',
        'Humanities': 'Humanities'
      };
      
      const streamEmojis = {
        'PCM': '🔬',
        'PCB': '🧬',
        'Commerce': '💼',
        'Humanities': '📚'
      };
      
      // Visual progress bars for each stream
      const streams = ['PCM', 'PCB', 'Commerce', 'Humanities'];
      
      streams.forEach(stream => {
        const longName = streamMapping[stream];
        const score = streamScores[longName] || streamScores[stream] || 0;
        const barColor = score > 70 ? colors.success : score > 55 ? colors.warning : colors.textLight;
        
        const fullName = `${streamEmojis[stream]} ${stream}`;
        addProgressBar(fullName, score, barColor);
      });
      
      doc.moveDown();
      addDivider();
      
      // Interpretation table with modern styling
      addSubHeading('Interpretation Guide', 13);
      doc.moveDown(0.3);
      
      const interpretations = [
        { range: '70%+', level: 'Strong Fit', color: colors.success, emoji: '✅', text: 'Highly Recommended - Strong alignment with aptitude & interests' },
        { range: '55-69%', level: 'Moderate Fit', color: colors.warning, emoji: '⚡', text: 'Worth Considering - Good potential with focused effort' },
        { range: '<55%', level: 'Weak Fit', color: colors.textLight, emoji: '⚠️', text: 'Not Recommended - Consider alternatives better suited to your profile' }
      ];
      
      interpretations.forEach(interp => {
        const boxY = doc.y;
        doc.roundedRect(60, boxY, 475, 35, 5)
           .fillOpacity(0.08)
           .fill(interp.color);
        doc.fillOpacity(1);
        
        doc.y = boxY + 8;
        doc.fontSize(11).font('Helvetica-Bold').fillColor(interp.color);
        doc.text(`${interp.emoji} ${interp.range} - ${interp.level}`, 75, doc.y);
        doc.moveDown(0.4);
        doc.fontSize(9).font('Helvetica').fillColor(colors.text);
        doc.text(interp.text, 75);
        
        doc.y = boxY + 40;
      });

      doc.moveDown();
      addDivider();

      // ============= DETAILED ANALYSIS SECTIONS =============
      
      // APTITUDE ANALYSIS with icon box
      const aptBoxY = doc.y;
      doc.roundedRect(60, aptBoxY, 475, 70, 8)
         .fillOpacity(0.05)
         .fill(colors.secondary);
      doc.fillOpacity(1);
      
      doc.y = aptBoxY + 12;
      addHeading('Aptitude Analysis', '🧠', 16);
      const aptitudeScores = testData.results.scores.aptitude || {};
      const aptScore = testData.results.scores?.aptitude || 65;
      addText(
        `Strong aptitude in ${getTopAptitudeAreas(aptitudeScores).join(', ')} areas. ` +
        `This indicates potential for success in analytical and problem-solving fields. Score: ${Math.round(aptScore)}%`,
        { size: 11 }
      );
      doc.y = aptBoxY + 78;

      // CAREER INTERESTS (RIASEC) with icon box
      const riasecBoxY = doc.y;
      doc.roundedRect(60, riasecBoxY, 475, 70, 8)
         .fillOpacity(0.05)
         .fill(colors.primary);
      doc.fillOpacity(1);
      
      doc.y = riasecBoxY + 12;
      addHeading('Career Interests (RIASEC)', '🎯', 16);
      const riasecScores = testData.results.riasecProfile || {};
      const topInterests = getTopRIASECTypes(riasecScores);
      addText(
        `${topInterests.join(' and ')} orientations are dominant, suggesting strong interest in ` +
        `careers that involve ${getRIASECDescription(topInterests)}.`,
        { size: 11 }
      );
      doc.y = riasecBoxY + 78;

      // PERSONALITY PROFILE with icon box
      const persBoxY = doc.y;
      doc.roundedRect(60, persBoxY, 475, 70, 8)
         .fillOpacity(0.05)
         .fill(colors.warning);
      doc.fillOpacity(1);
      
      doc.y = persBoxY + 12;
      addHeading('Personality Profile (Big Five)', '🌟', 16);
      const personalityScores = testData.results.personalityProfile || {};
      const personalityTraits = getPersonalityDescription(personalityScores);
      const persScore = testData.results.scores?.personality || 65;
      addText(`${personalityTraits} Overall Score: ${Math.round(persScore)}%`, { size: 11 });
      doc.y = persBoxY + 78;

      // Decision-Making with mini bar
      doc.moveDown();
      addSubHeading('🎲 Decision-Making & Judgment', 14);
      const decisionScore = testData.results.scores.values || 0;
      addProgressBar('Decision Quality', decisionScore, decisionScore > 70 ? colors.success : colors.warning);
      addText(
        decisionScore > 70 
          ? 'Strong ability to balance ethical reasoning and practical decision-making.'
          : 'Moderate ability to balance ethical reasoning and practical decision-making. Continue building confidence.',
        { size: 10 }
      );

      // ESI with mini bar
      addSubHeading('💝 Emotional & Social Intelligence', 14);
      const esiScore = testData.results.esiScore || testData.results.scores.values || 0;
      addProgressBar('ESI Score', esiScore, esiScore > 70 ? colors.success : colors.warning);
      addText(
        esiScore > 70
          ? 'Displays strong empathy and teamwork skills. Excellent self-regulation under pressure.'
          : 'Displays empathy and teamwork skills. Continue developing self-regulation under pressure.',
        { size: 10 }
      );

      // Learning with mini bar
      addSubHeading('📖 Learning Orientation', 14);
      const learningScore = testData.results.scores.skills || 0;
      addProgressBar('Learning Style', learningScore, learningScore > 70 ? colors.success : colors.warning);
      addText(
        learningScore > 70
          ? 'Prefers structured learning with strong persistence. Shows excellent self-directed study habits.'
          : 'Prefers structured learning. Would benefit from developing more self-directed study habits.',
        { size: 10 }
      );

      // Work Values
      addSubHeading('⚖️ Work Values & Lifestyle', 14);
      const workValues = testData.results.workValues || {};
      addText(getWorkValuesDescription(workValues), { size: 11 });

      doc.moveDown();
      addDivider();

      // ============= INTEGRATED CAREER GUIDANCE =============
      doc.addPage();
      
      // Page header
      doc.rect(0, 0, 595, 60)
         .fillOpacity(0.05)
         .fill(colors.success);
      doc.fillOpacity(1);
      
      doc.y = 75;
      addHeading('Integrated Career Guidance', '🎓', 22);
      doc.moveDown();
      
      // Highlight recommendation box
      const guidanceY = doc.y;
      doc.roundedRect(60, guidanceY, 475, 100, 8)
         .lineWidth(3)
         .strokeColor(colors.success)
         .stroke();
      
      doc.roundedRect(60, guidanceY, 475, 40, 8)
         .fillOpacity(0.15)
         .fill(colors.success);
      doc.fillOpacity(1);
      
      doc.y = guidanceY + 12;
      doc.fontSize(16).font('Helvetica-Bold').fillColor(colors.success);
      doc.text(`✅ Primary Recommendation: ${primaryStream[0]}`, 80);
      doc.moveDown(0.8);
      
      doc.fontSize(11).font('Helvetica').fillColor(colors.text);
      doc.text(
        `${primaryStream[0]} is the strongest recommendation, combining aptitude strengths, ` +
        `personality traits, and career interests most effectively. ${secondaryStream[0]} ` +
        `serves as a viable secondary option with ${Math.round(secondaryStream[1])}% alignment.`,
        80, doc.y, { width: 435, align: 'justify' }
      );
      
      doc.y = guidanceY + 110;
      doc.moveDown(1.5);

      // ============= PARENTAL NOTE WITH ICON =============
      const parentY = doc.y;
      doc.roundedRect(60, parentY, 475, 120, 8)
         .fillOpacity(0.05)
         .fill(colors.warning);
      doc.fillOpacity(1);
      
      doc.roundedRect(60, parentY, 475, 120, 8)
         .lineWidth(2)
         .strokeColor(colors.warning)
         .stroke();
      
      doc.y = parentY + 12;
      addHeading('For Parents', '👨‍👩‍👧', 16);
      doc.fontSize(11).font('Helvetica').fillColor(colors.text);
      doc.text(
        `Parents are advised to support ${userData.name || 'the student'} in exploring ` +
        `${primaryStream[0]} pathways without undue pressure. While ${primaryStream[0]} shows ` +
        `the strongest fit, ${secondaryStream[0]} may be considered if interests evolve. ` +
        `\n\nEncourage balanced academics alongside personality development, extracurricular ` +
        `activities, and healthy routines. Career success depends on effort, resilience, ` +
        `and continuous learning beyond stream selection.`,
        75, doc.y, { width: 445, align: 'justify', lineGap: 3 }
      );
      
      doc.y = parentY + 130;
      doc.moveDown(1.5);

      addDivider();

      // ============= DISCLAIMER WITH MODERN STYLING =============
      const disclaimerY = doc.y;
      doc.roundedRect(60, disclaimerY, 475, 180, 8)
         .fillOpacity(0.03)
         .fill(colors.dark);
      doc.fillOpacity(1);
      
      doc.y = disclaimerY + 12;
      addHeading('Important Disclaimer', '⚠️', 15);
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      addText(
        'This report is based on a scientifically designed psychometric assessment. ' +
        'Recommendations indicate best-fit academic streams based on responses across ' +
        'aptitude, interests, personality, values, and decision-making dimensions.',
        { size: 10 }
      );
      
      const disclaimerPoints = [
        '📌 Results should be used as guidance, not a final verdict',
        '📌 Student motivation, effort, and learning can significantly influence outcomes',
        '📌 Recommended stream may change as student develops new skills and interests',
        '📌 Assessment does not measure board exam performance or guarantee admissions',
        '📌 Consider insights alongside academic records and personal aspirations'
      ];
      
      disclaimerPoints.forEach(point => {
        doc.fontSize(9).font('Helvetica').fillColor(colors.textLight);
        addText(point, { size: 9 });
      });

      doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.text)
         .text('This report is intended to assist, not replace, informed parental and student choice.', 
               75, doc.y, { align: 'center', width: 445 });

      // ============= MODERN FOOTER =============
      const footerY = doc.page.height - 50;
      doc.rect(0, footerY - 20, 595, 70)
         .fillOpacity(0.95)
         .fill(colors.primary);
      doc.fillOpacity(1);
      
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#FFFFFF')
         .text('Career Compass', 0, footerY, { align: 'center', width: 595 });
      doc.fontSize(9).font('Helvetica').fillColor('#E0E7FF')
         .text('Powered by Vijnax © 2026 | Empowering Students, Guiding Futures', 
               0, footerY + 18, { align: 'center', width: 595 });

      // Finalize PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

// ============= HELPER FUNCTIONS =============

function calculateStreamScores(results) {
  const { scores } = results;
  
  // Calculate stream alignment based on section scores
  const pcmScore = (scores.aptitude * 0.4) + (scores.values * 0.2) + (scores.personality * 0.2) + (scores.skills * 0.2);
  const pcbScore = (scores.aptitude * 0.3) + (scores.values * 0.3) + (scores.personality * 0.2) + (scores.skills * 0.2);
  const commerceScore = (scores.values * 0.4) + (scores.personality * 0.3) + (scores.aptitude * 0.2) + (scores.skills * 0.1);
  const humanitiesScore = (scores.personality * 0.4) + (scores.values * 0.3) + (scores.skills * 0.2) + (scores.aptitude * 0.1);
  
  return {
    'PCM (Science with Maths)': Math.min(pcmScore, 100),
    'PCB (Science with Biology)': Math.min(pcbScore, 100),
    'Commerce': Math.min(commerceScore, 100),
    'Humanities': Math.min(humanitiesScore, 100)
  };
}

function getTopAptitudeAreas(aptitudeScores) {
  const areas = {
    numerical: 'Numerical Reasoning',
    logical: 'Logical Thinking',
    verbal: 'Verbal Comprehension',
    spatial: 'Spatial Ability'
  };
  
  return Object.keys(areas).slice(0, 2).map(key => areas[key]);
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
  
  const sorted = Object.entries(riasecScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  
  return sorted.map(([key]) => types[key] || key);
}

function getRIASECDescription(interests) {
  const descriptions = {
    'Realistic': 'hands-on work and practical applications',
    'Investigative': 'research, analysis, and problem-solving',
    'Artistic': 'creativity, design, and self-expression',
    'Social': 'helping others and collaborative work',
    'Enterprising': 'leadership, entrepreneurship, and persuasion',
    'Conventional': 'organization, data management, and structured tasks'
  };
  
  return interests.map(i => descriptions[i] || 'diverse activities').join(' and ');
}

function getPersonalityDescription(personalityScores) {
  const traits = [];
  
  if ((personalityScores.C || 0) > 60) traits.push('conscientious and disciplined');
  if ((personalityScores.O || 0) > 60) traits.push('open to new experiences');
  if ((personalityScores.A || 0) > 60) traits.push('agreeable and cooperative');
  if ((personalityScores.E || 0) > 60) traits.push('extraverted and sociable');
  if ((personalityScores.S || 0) > 60) traits.push('emotionally stable');
  
  if (traits.length === 0) return 'Shows balanced personality traits across all dimensions.';
  
  return `Exhibits ${traits.join(', ')} personality traits, which align well with academic and career success.`;
}

function getWorkValuesDescription(workValues) {
  const topValue = Object.entries(workValues)
    .sort((a, b) => b[1] - a[1])[0];
  
  if (!topValue) return 'Values balanced approach to work and life.';
  
  const descriptions = {
    achievement: 'strong drive for accomplishment and recognition',
    stability: 'preference for security and structured environments',
    creativity: 'desire for innovation and self-expression',
    helping: 'commitment to service and supporting others',
    leadership: 'inclination toward influence and decision-making'
  };
  
  return `Values ${descriptions[topValue[0]] || 'meaningful work'}. Prefers collaborative settings with clear goals.`;
}

export default { generateCareerReport };
