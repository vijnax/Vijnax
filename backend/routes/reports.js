import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import Test from '../models/Test.js';
import User from '../models/User.js';
import { generateCareerReport } from '../services/reportGenerator.js';

const router = express.Router();

// @route   GET /api/reports/:testId
// @desc    Get test report as JSON
// @access  Private
router.get('/:testId', verifyToken, async (req, res) => {
  try {
    const { testId } = req.params;

    // Find test with populated data
    const test = await Test.findById(testId)
      .populate('userId', 'name email mobile profile')
      .populate('questions.questionId');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user owns this test (or is admin)
    const userId = test.userId._id ? test.userId._id.toString() : test.userId.toString();
    const requestUserId = req.user.id || req.user._id;
    
    if (userId !== requestUserId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if test is completed
    if (test.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Test must be completed before generating report'
      });
    }

    // Return report data
    res.json({
      success: true,
      data: {
        test: {
          id: test._id,
          type: test.testType,
          completedAt: test.completedAt,
          duration: test.duration
        },
        user: test.userId,
        results: test.results,
        streamAnalysis: calculateStreamAnalysis(test.results),
        recommendations: generateRecommendations(test.results)
      }
    });

  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching report'
    });
  }
});

// @route   GET /api/reports/:testId/pdf
// @desc    Download test report as PDF
// @access  Private
router.get('/:testId/pdf', verifyToken, async (req, res) => {
  try {
    const { testId } = req.params;

    // Find test with populated data
    const test = await Test.findById(testId)
      .populate('userId', 'name email mobile profile')
      .populate('questions.questionId');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user owns this test (or is admin)
    const pdfUserId = test.userId._id ? test.userId._id.toString() : test.userId.toString();
    const pdfRequestUserId = req.user.id || req.user._id;
    
    if (pdfUserId !== pdfRequestUserId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if test is completed
    if (test.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Test must be completed before generating report'
      });
    }

    console.log(`📄 Generating PDF report for test ${testId}...`);

    // Add stream analysis to results
    test.results.streamAnalysis = calculateStreamAnalysis(test.results);

    // Generate PDF
    const pdfBuffer = await generateCareerReport(test, test.userId);

    // Set headers for PDF download
    const fileName = `Career_Report_${test.userId.name.replace(/\s+/g, '_')}_${testId.substring(0, 8)}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

    console.log(`✅ PDF report generated successfully for ${test.userId.name}`);

  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating PDF report',
      error: error.message
    });
  }
});

// @route   POST /api/reports/:testId/email
// @desc    Email test report to user
// @access  Private
router.post('/:testId/email', verifyToken, async (req, res) => {
  try {
    const { testId } = req.params;

    // Find test
    const test = await Test.findById(testId)
      .populate('userId', 'name email mobile profile');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check access
    const emailUserId = test.userId._id ? test.userId._id.toString() : test.userId.toString();
    const emailRequestUserId = req.user.id || req.user._id;
    
    if (emailUserId !== emailRequestUserId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if test is completed
    if (test.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Test must be completed before emailing report'
      });
    }

    // TODO: Implement email sending
    // For now, return success message
    res.json({
      success: true,
      message: 'Report email feature coming soon'
    });

  } catch (error) {
    console.error('Email report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while emailing report'
    });
  }
});

// ============= HELPER FUNCTIONS =============

function calculateStreamAnalysis(results) {
  const { scores } = results;
  
  // Calculate weighted stream scores
  const pcmScore = Math.round(
    (scores.aptitude || 0) * 0.4 +
    (scores.values || 0) * 0.2 +
    (scores.personality || 0) * 0.2 +
    (scores.skills || 0) * 0.2
  );
  
  const pcbScore = Math.round(
    (scores.aptitude || 0) * 0.3 +
    (scores.values || 0) * 0.3 +
    (scores.personality || 0) * 0.2 +
    (scores.skills || 0) * 0.2
  );
  
  const commerceScore = Math.round(
    (scores.values || 0) * 0.4 +
    (scores.personality || 0) * 0.3 +
    (scores.aptitude || 0) * 0.2 +
    (scores.skills || 0) * 0.1
  );
  
  const humanitiesScore = Math.round(
    (scores.personality || 0) * 0.4 +
    (scores.values || 0) * 0.3 +
    (scores.skills || 0) * 0.2 +
    (scores.aptitude || 0) * 0.1
  );
  
  return {
    'PCM (Science with Maths)': Math.min(pcmScore, 100),
    'PCB (Science with Biology)': Math.min(pcbScore, 100),
    'Commerce': Math.min(commerceScore, 100),
    'Humanities': Math.min(humanitiesScore, 100)
  };
}

function generateRecommendations(results) {
  const streamScores = calculateStreamAnalysis(results);
  const sorted = Object.entries(streamScores).sort((a, b) => b[1] - a[1]);
  
  const primary = sorted[0];
  const secondary = sorted[1];
  
  return {
    primary: {
      stream: primary[0],
      score: primary[1],
      confidence: primary[1] > 75 ? 'HIGH' : primary[1] > 60 ? 'MEDIUM' : 'MODERATE'
    },
    secondary: {
      stream: secondary[0],
      score: secondary[1],
      confidence: secondary[1] > 70 ? 'HIGH' : secondary[1] > 55 ? 'MEDIUM' : 'LOW'
    },
    notRecommended: sorted.slice(2).map(s => ({
      stream: s[0],
      score: s[1],
      reason: 'Weaker alignment in aptitude, interests, and personality'
    }))
  };
}

export default router;
