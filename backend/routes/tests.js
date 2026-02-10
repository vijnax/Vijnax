import express from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Test from '../models/Test.js';
import Question from '../models/Question.js';
import RIASECQuestion from '../models/RIASECQuestion.js';
import { verifyToken } from '../middleware/auth.js';
import questionSelector from '../services/questionSelector.js';
import riasecSelector, { SECTION_B_DISTRIBUTION } from '../services/riasecSelector.js';
import bigFiveSelector, { BIG_FIVE_TRAITS } from '../services/bigFiveSelector.js';
import decisionSelector from '../services/decisionSelector.js';
import learningSelector from '../services/learningSelector.js';
import esiSelector from '../services/esiSelector.js';
import workValuesSelector, { WORK_SUBTHEMES } from '../services/workValuesSelector.js';
import enhancedSelector from '../services/enhancedQuestionSelector.js';

const router = express.Router();

// Helper to add section key and maintain numbering offset
function normalize(questions, sectionKey, startIndex = 1) {
  return questions.map((q, idx) => ({
    section: sectionKey,
    questionId: q._id,
    questionNumber: startIndex + idx,
    text: q.text,
    options: (q.options || []).map(o => ({
      text: o.text,
      isCorrect: o.isCorrect,
      mappedStream: o.mappedStream,
      mappedTrait: o.mappedTrait,
      riasecType: o.riasecType
    })),
    tags: q.tags,
    domain: q.domain,
    category: q.category,
    difficulty: q.difficulty
  }));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function poolDiagnostics() {
  // Minimal pool sizes for categories/tags used by selectors
  const diag = { aptitude: {}, values: {}, skills: {}, personality: {}, work: {} };
  const aptitudeCats = {
    math_logic: ['mathematical_logic','arithmetic_logic','ratio_reasoning','quantitative_estimation','equation_puzzle'],
    sci_abstract: ['scientific_deduction','scientific_pattern','abstract_reasoning','pattern_recognition','sequence_pattern'],
    spatial: ['spatial_folding','geometry_reasoning'],
    verbal: ['word_puzzle','verbal_inference','graph_interpretation','reading_comprehension']
  };
  for (const [k, cats] of Object.entries(aptitudeCats)) {
    // eslint-disable-next-line no-await-in-loop
    const c = await Question.countDocuments({ domain: 'aptitude', isActive: true, category: { $in: cats } });
    diag.aptitude[k] = c;
  }
  const valuesTags = ['Peer Pressure vs Integrity','Responsibility vs Freedom','Truth vs Kindness','Risk vs Security','Rules vs Exceptions'];
  for (const t of valuesTags) {
    // eslint-disable-next-line no-await-in-loop
    diag.values[t] = await Question.countDocuments({ domain: 'values', isActive: true, tags: t });
  }
  const learningTags = ['Persistence','Time Management','Distraction','Revision/Feedback'];
  for (const t of learningTags) {
    // eslint-disable-next-line no-await-in-loop
    diag.skills[t] = await Question.countDocuments({ domain: 'skills', isActive: true, tags: t });
  }
  const esiTags = ['Empathy','Emotional Regulation','Conflict Handling','Self-Awareness','Perspective Taking'];
  for (const t of esiTags) {
    // eslint-disable-next-line no-await-in-loop
    diag.values[t] = (diag.values[t] || 0) + await Question.countDocuments({ domain: 'values', isActive: true, tags: t });
  }
  const workTags = ['Achievement Orientation','Stability & Structure','Creativity & Freedom','Helping & Service','Leadership & Influence'];
  for (const t of workTags) {
    // eslint-disable-next-line no-await-in-loop
    diag.work[t] = await Question.countDocuments({ domain: 'values', isActive: true, tags: t });
  }
  // Big Five traits presence
  const traitKeys = ['C','O','A','E','S','L'];
  for (const tr of traitKeys) {
    // eslint-disable-next-line no-await-in-loop
    diag.personality[tr] = await Question.countDocuments({ domain: 'personality', isActive: true, 'options.mappedTrait': tr });
  }
  return diag;
}

// @route   POST /api/tests/create
// @desc    Create a new test session
// @access  Private
router.post('/create', verifyToken, [
  body('testType').isIn(['comprehensive', 'personality', 'aptitude', 'career_interest', 'learning_style']),
  body('questionCount').optional().isInt({ min: 10, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { testType, questionCount = 60 } = req.body;

    // Get questions based on test type
    let questions = [];
    
    if (testType === 'comprehensive') {
      // Get questions from all domains
      const domains = ['personality', 'aptitude', 'interest', 'values', 'skills'];
      const questionsPerDomain = Math.ceil(questionCount / domains.length);
      
      for (const domain of domains) {
        const domainQuestions = await Question.getRandom(domain, null, questionsPerDomain);
        questions.push(...domainQuestions);
      }
    } else {
      // Get questions from specific domain
      questions = await Question.getRandom(testType, null, questionCount);
    }

    // Shuffle questions
    questions = questions.sort(() => Math.random() - 0.5);

    // Create test session
    const test = new Test({
      userId: req.user._id,
      testType,
      questions: questions.map((q, index) => ({
        questionId: q._id,
        order: index + 1
      })),
      progress: {
        totalQuestions: questions.length
      },
      settings: {
        timeLimit: 60, // 60 minutes
        allowBackNavigation: true,
        showProgress: true,
        randomizeQuestions: true,
        showTimer: true
      }
    });

    await test.save();

    res.status(201).json({
      success: true,
      message: 'Test created successfully',
      data: {
        testId: test._id,
        testType: test.testType,
        totalQuestions: test.progress.totalQuestions,
        timeLimit: test.settings.timeLimit
      }
    });

  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating test'
    });
  }
});

// @route   GET /api/tests/:testId
// @desc    Get test details and current question
// @access  Private
router.get('/:testId', verifyToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const { questionNumber = 1 } = req.query;

    const test = await Test.findById(testId)
      .populate('questions.questionId')
      .populate('userId', 'name email');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user owns this test
    if (test.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get current question
    const currentQuestion = test.questions.find(q => q.order === parseInt(questionNumber));
    
    if (!currentQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Format question data
    const questionData = {
      id: currentQuestion.questionId._id,
      text: currentQuestion.questionId.text,
      options: currentQuestion.questionId.options.map(opt => ({
        text: opt.text,
        score: opt.score
      })),
      domain: currentQuestion.questionId.domain,
      category: currentQuestion.questionId.category,
      order: currentQuestion.order,
      answered: !!currentQuestion.answer
    };

    res.json({
      success: true,
      data: {
        test: {
          id: test._id,
          type: test.testType,
          status: test.status,
          progress: test.progress,
          settings: test.settings
        },
        question: questionData,
        navigation: {
          current: parseInt(questionNumber),
          total: test.progress.totalQuestions,
          answered: test.progress.answeredCount,
          canGoBack: test.settings.allowBackNavigation && parseInt(questionNumber) > 1,
          canGoNext: parseInt(questionNumber) < test.progress.totalQuestions
        }
      }
    });

  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching test'
    });
  }
});

// @route   POST /api/tests/:testId/start
// @desc    Start a test session
// @access  Private
router.post('/:testId/start', verifyToken, async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user owns this test
    if (test.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if test can be started
    if (test.status !== 'created') {
      return res.status(400).json({
        success: false,
        message: 'Test cannot be started'
      });
    }

    // Start the test
    await test.startTest();

    res.json({
      success: true,
      message: 'Test started successfully',
      data: {
        testId: test._id,
        startedAt: test.startedAt,
        timeRemaining: test.progress.timeRemaining
      }
    });

  } catch (error) {
    console.error('Start test error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while starting test'
    });
  }
});

// @route   POST /api/tests/:testId/answer
// @desc    Submit answer for a question
// @access  Private
router.post('/:testId/answer', verifyToken, [
  body('questionId').notEmpty().withMessage('Question ID is required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('responseTime').optional().isInt({ min: 1 }).withMessage('Response time must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { testId } = req.params;
    const { questionId, answer, responseTime = 60 } = req.body;

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user owns this test
    if (test.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if test is active
    if (!['started', 'in_progress'].includes(test.status)) {
      return res.status(400).json({
        success: false,
        message: 'Test is not active'
      });
    }

    // Submit answer
    await test.answerQuestion(questionId, answer, responseTime);

    // Update question statistics
    const question = await Question.findById(questionId);
    if (question) {
      // Determine if answer is correct (for aptitude questions)
      const isCorrect = question.domain === 'aptitude' ? 
        question.options.find(opt => opt.text === answer)?.score > 5 : null;
      
      await question.updateStats(responseTime, isCorrect);
    }

    res.json({
      success: true,
      message: 'Answer submitted successfully',
      data: {
        answeredCount: test.progress.answeredCount,
        totalQuestions: test.progress.totalQuestions,
        completionPercentage: test.completionPercentage
      }
    });

  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting answer'
    });
  }
});

// @route   POST /api/tests/:testId/complete
// @desc    Complete a test session
// @access  Private
router.post('/:testId/complete', verifyToken, async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId)
      .populate('questions.questionId');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user owns this test
    if (test.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if test can be completed
    if (!['started', 'in_progress'].includes(test.status)) {
      return res.status(400).json({
        success: false,
        message: 'Test cannot be completed'
      });
    }

    // Calculate scores
    const scores = {
      personality: 0,
      aptitude: 0,
      interest: 0,
      values: 0,
      skills: 0
    };

    let totalScore = 0;
    let answeredQuestions = 0;

    for (const questionData of test.questions) {
      if (questionData.answer && questionData.questionId) {
        const question = questionData.questionId;
        const selectedOption = question.options.find(opt => opt.text === questionData.answer);
        
        if (selectedOption) {
          scores[question.domain] += selectedOption.score;
          totalScore += selectedOption.score;
          answeredQuestions++;
        }
      }
    }

    // Calculate percentile (simplified)
    const percentile = Math.round((totalScore / (answeredQuestions * 10)) * 100);

    // Update test results
    test.results.scores = scores;
    test.results.totalScore = totalScore;
    test.results.percentile = percentile;
    test.results.generatedAt = new Date();

    // Complete the test
    await test.completeTest();

    res.json({
      success: true,
      message: 'Test completed successfully',
      data: {
        testId: test._id,
        scores: test.results.scores,
        totalScore: test.results.totalScore,
        percentile: test.results.percentile,
        completionTime: test.duration
      }
    });

  } catch (error) {
    console.error('Complete test error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while completing test'
    });
  }
});

// @route   GET /api/tests/user/history
// @desc    Get user's test history
// @access  Private
router.get('/user/history', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const tests = await Test.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('testType status progress results createdAt completedAt');

    const total = await Test.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      data: {
        tests,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get test history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching test history'
    });
  }
});

// @route   GET /api/tests/:testId/results
// @desc    Get detailed test results
// @access  Private
router.get('/:testId/results', verifyToken, async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId)
      .populate('questions.questionId')
      .populate('userId', 'name email profile');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user owns this test
    if (test.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if test is completed
    if (test.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Test results not available yet'
      });
    }

    res.json({
      success: true,
      data: {
        test: {
          id: test._id,
          type: test.testType,
          status: test.status,
          duration: test.duration,
          completedAt: test.completedAt
        },
        results: test.results,
        user: test.userId
      }
    });

  } catch (error) {
    console.error('Get test results error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching test results'
    });
  }
});

// @route   POST /api/tests/generate/full
// @desc    Generate full 60-question test with all sections and exact extraction criteria (OLD VERSION)
// @access  Private
router.post('/generate/full', verifyToken, async (req, res) => {
  try {
    const debug = req.query.debug === 'true' || req.body?.debug === true;

    // A – Aptitude (12)
    const aptitude = await questionSelector.selectAptitudeQuestions('PCM', {
      mathLogicCount: 4,
      scientificAbstractCount: 3,
      spatialCount: 2,
      verbalCount: 3,
      difficulty: 'mixed'
    });

    // B – RIASEC (10)
    const riasec = await riasecSelector.getQuestionsForSectionB({ limitPerType: SECTION_B_DISTRIBUTION });

    // C – Personality (Big Five) (10: 2 each)
    const bigfive = await bigFiveSelector.getSectionCSet({ traits: BIG_FIVE_TRAITS, perTrait: 2 });

    // D – Decision-Making (8)
    const decision = await decisionSelector.generateSet({ requiredPerTheme: 2 });

    // E – Learning Orientation (8)
    const learning = await learningSelector.generateSet({ perSubtheme: 2 });

    // F – ESI (6)
    const esi = await esiSelector.generateSectionF();

    // G – Work Values (6)
    const pool = await workValuesSelector.generate({ perSubtheme: 6 });
    const wantedThemes = [
      WORK_SUBTHEMES.ACHIEVEMENT,
      WORK_SUBTHEMES.STABILITY,
      WORK_SUBTHEMES.CREATIVITY,
      WORK_SUBTHEMES.HELPING,
      WORK_SUBTHEMES.LEADERSHIP
    ];
    const byTheme = new Map(wantedThemes.map(t => [t, []]));
    for (const q of pool) {
      const t = (q.tags || []).find(tag => byTheme.has(tag));
      if (t) byTheme.get(t).push(q);
    }
    const take = (arr, n, chosen) => {
      const out = [];
      for (const q of arr) {
        const id = String(q._id);
        if (!chosen.has(id)) { out.push(q); chosen.add(id); if (out.length === n) break; }
      }
      return out;
    };
    const chosenIds = new Set();
    const work = [
      ...take(byTheme.get(WORK_SUBTHEMES.ACHIEVEMENT) || [], 2, chosenIds),
      ...take(byTheme.get(WORK_SUBTHEMES.STABILITY) || [], 1, chosenIds),
      ...take(byTheme.get(WORK_SUBTHEMES.CREATIVITY) || [], 1, chosenIds),
      ...take(byTheme.get(WORK_SUBTHEMES.HELPING) || [], 1, chosenIds),
      ...take(byTheme.get(WORK_SUBTHEMES.LEADERSHIP) || [], 1, chosenIds)
    ].slice(0, 6);

    // Normalize and stitch with section labels
    let index = 1;
    const sections = [];
    sections.push({ key: 'Aptitude', questions: normalize(aptitude, 'Aptitude', index) }); index += aptitude.length;
    sections.push({ key: 'RIASEC', questions: normalize(riasec, 'RIASEC', index) }); index += riasec.length;
    sections.push({ key: 'BigFive', questions: normalize(bigfive, 'BigFive', index) }); index += bigfive.length;
    sections.push({ key: 'Decision', questions: normalize(decision, 'Decision', index) }); index += decision.length;
    sections.push({ key: 'Learning', questions: normalize(learning, 'Learning', index) }); index += learning.length;
    sections.push({ key: 'ESI', questions: normalize(esi, 'ESI', index) }); index += esi.length;
    sections.push({ key: 'WorkValues', questions: normalize(work, 'WorkValues', index) }); index += work.length;

    const allQuestions = sections.flatMap(s => s.questions);

    const payload = {
      success: true,
      data: {
        total: allQuestions.length,
        sections: sections.map(s => ({ key: s.key, count: s.questions.length })),
        questions: allQuestions
      }
    };

    if (debug) {
      payload.data.debug = await poolDiagnostics();
    }

    res.json(payload);
  } catch (error) {
    console.error('Error generating full test:', error);
    res.status(500).json({ success: false, message: 'Failed to generate full test', error: error.message });
  }
});

// @route   POST /api/tests/generate/randomized
// @desc    Generate complete 60-question test with proper randomization from all imported sections
// @access  Private
router.post('/generate/randomized', verifyToken, async (req, res) => {
  try {
    const { userStream = 'PCM' } = req.body;
    
    console.log(`🎯 Generating randomized test for stream: ${userStream}`);
    
    // Section A: Aptitude Questions (15 questions) - Random from 99
    const aptitudeQuestions = await Question.aggregate([
      { $match: { domain: 'aptitude', isActive: true } },
      { $sample: { size: 15 } }
    ]);
    
    // Section B: RIASEC Questions (10 questions) - Random from 56
    const riasecQuestions = await RIASECQuestion.aggregate([
      { $match: { isActive: true } },
      { $sample: { size: 10 } }
    ]);
    
    // Section C: Decision Making (6 questions) - Random from 38
    const decisionQuestions = await Question.aggregate([
      { $match: { category: 'problem_solving', tags: { $in: ['problem_solving', 'decision_making'] }, isActive: true } },
      { $sample: { size: 6 } }
    ]);
    
    // Section D: ESI Questions (6 questions) - Random from 60
    const esiQuestions = await Question.aggregate([
      { $match: { category: 'stress_management', tags: 'emotional_intelligence', isActive: true } },
      { $sample: { size: 6 } }
    ]);
    
    // Section E: Learning Orientation (8 questions) - Random from 58
    const learningQuestions = await Question.aggregate([
      { $match: { category: 'learning_style', isActive: true } },
      { $sample: { size: 8 } }
    ]);
    
    // Section F: Big Five Personality (10 questions) - Random from 105
    const personalityQuestions = await Question.aggregate([
      { $match: { domain: 'personality', category: 'personality_traits', isActive: true } },
      { $sample: { size: 10 } }
    ]);
    
    // Section G: Work Values (5 questions) - Random from 35
    const workValuesQuestions = await Question.aggregate([
      { $match: { category: 'work_values', isActive: true } },
      { $sample: { size: 5 } }
    ]);
    
    // Format all sections
    let questionNumber = 1;
    const sections = [];
    
    // Section A - Aptitude
    sections.push({
      section: 'A',
      name: 'Aptitude',
      count: aptitudeQuestions.length,
      questions: aptitudeQuestions.map(q => ({
        questionNumber: questionNumber++,
        questionId: q._id,
        text: q.text,
        options: q.options || [],
        domain: q.domain,
        category: q.category,
        tags: q.tags || [],
        section: 'A'
      }))
    });
    
    // Section B - RIASEC
    sections.push({
      section: 'B',
      name: 'Career Interests (RIASEC)',
      count: riasecQuestions.length,
      questions: riasecQuestions.map(q => ({
        questionNumber: questionNumber++,
        questionId: q._id,
        text: q.text,
        options: q.options || [],
        category: q.category || 'career_interest',
        tags: q.tags || [],
        section: 'B'
      }))
    });
    
    // Section C - Decision Making
    sections.push({
      section: 'C',
      name: 'Decision Making',
      count: decisionQuestions.length,
      questions: decisionQuestions.map(q => ({
        questionNumber: questionNumber++,
        questionId: q._id,
        text: q.text,
        options: q.options || [],
        domain: q.domain,
        category: q.category,
        tags: q.tags || [],
        section: 'C'
      }))
    });
    
    // Section D - ESI
    sections.push({
      section: 'D',
      name: 'Emotional & Social Intelligence',
      count: esiQuestions.length,
      questions: esiQuestions.map(q => ({
        questionNumber: questionNumber++,
        questionId: q._id,
        text: q.text,
        options: q.options || [],
        domain: q.domain,
        category: q.category,
        tags: q.tags || [],
        section: 'D'
      }))
    });
    
    // Section E - Learning
    sections.push({
      section: 'E',
      name: 'Learning Orientation',
      count: learningQuestions.length,
      questions: learningQuestions.map(q => ({
        questionNumber: questionNumber++,
        questionId: q._id,
        text: q.text,
        options: q.options || [],
        domain: q.domain,
        category: q.category,
        tags: q.tags || [],
        section: 'E'
      }))
    });
    
    // Section F - Personality
    sections.push({
      section: 'F',
      name: 'Personality Traits',
      count: personalityQuestions.length,
      questions: personalityQuestions.map(q => ({
        questionNumber: questionNumber++,
        questionId: q._id,
        text: q.text,
        options: q.options || [],
        domain: q.domain,
        category: q.category,
        tags: q.tags || [],
        section: 'F'
      }))
    });
    
    // Section G - Work Values
    sections.push({
      section: 'G',
      name: 'Work Values',
      count: workValuesQuestions.length,
      questions: workValuesQuestions.map(q => ({
        questionNumber: questionNumber++,
        questionId: q._id,
        text: q.text,
        options: q.options || [],
        domain: q.domain,
        category: q.category,
        tags: q.tags || [],
        section: 'G'
      }))
    });
    
    // Flatten all questions
    const allQuestions = sections.flatMap(s => s.questions);
    
    // IMPORTANT: Shuffle all questions randomly so they appear in random order
    const shuffledQuestions = shuffle(allQuestions).map((q, idx) => ({
      ...q,
      questionNumber: idx + 1 // Renumber after shuffle
    }));
    
    res.json({
      success: true,
      message: 'Test generated successfully with complete randomization',
      data: {
        total: shuffledQuestions.length,
        sections: sections.map(s => ({
          section: s.section,
          name: s.name,
          count: s.count
        })),
        questions: shuffledQuestions,
        metadata: {
          generatedAt: new Date(),
          userStream,
          version: '3.0',
          structure: 'Career Compass - Fully Randomized',
          totalPool: {
            aptitude: 99,
            riasec: 56,
            decision: 38,
            esi: 60,
            learning: 58,
            personality: 105,
            workValues: 35
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error generating randomized test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate randomized test',
      error: error.message
    });
  }
});

// @route   POST /api/tests/generate/enhanced
// @desc    Generate 60-question test with enhanced randomization based on Career Compass Blueprint (OLD)
// @access  Private
router.post('/generate/enhanced', verifyToken, async (req, res) => {
  try {
    const { userStream } = req.body;
    
    console.log('🎯 Generating enhanced test with randomization...');
    
    // Select all questions using enhanced selector
    const testData = await enhancedSelector.selectAllTestQuestions(userStream);
    
    // Format the response
    const formattedSections = testData.structure.map((section, idx) => {
      const startIndex = testData.structure.slice(0, idx).reduce((sum, s) => sum + s.count, 1);
      
      return {
        key: section.name,
        section: section.section,
        count: section.count,
        questions: section.questions.map((q, qIdx) => ({
          questionNumber: startIndex + qIdx,
          questionId: q._id,
          text: q.text,
          options: q.options.map(opt => ({
            text: opt.text,
            ...(opt.riasecType && { riasecType: opt.riasecType }),
            ...(opt.mappedTrait && { mappedTrait: opt.mappedTrait }),
            ...(opt.mappedStream && { mappedStream: opt.mappedStream }),
            ...(opt.isCorrect !== undefined && { isCorrect: opt.isCorrect }),
            ...(opt.score !== undefined && { score: opt.score })
          })),
          domain: q.domain,
          category: q.category,
          tags: q.tags || [],
          metadata: q.metadata
        }))
      };
    });
    
    res.json({
      success: true,
      message: 'Test generated successfully with randomization',
      data: {
        total: testData.total,
        sections: formattedSections.map(s => ({
          section: s.section,
          name: s.key,
          count: s.count
        })),
        questions: formattedSections.flatMap(s => s.questions),
        metadata: {
          generatedAt: new Date(),
          userStream,
          version: '2.0',
          structure: 'Career Compass 60Q Blueprint'
        }
      }
    });
    
  } catch (error) {
    console.error('Error generating enhanced test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate enhanced test',
      error: error.message
    });
  }
});

// @route   POST /api/tests/submit
// @desc    Submit entire test with all answers at once
// @access  Private
router.post('/submit', verifyToken, async (req, res) => {
  try {
    const { testId, answers } = req.body;

    console.log(`📝 Submitting test for user: ${req.user.id}`);
    console.log(`   Test ID: ${testId || 'NEW TEST'}`);
    console.log(`   Total answers: ${answers?.length || 0}`);

    // Find or create test
    let test;
    
    if (testId) {
      test = await Test.findById(testId);
      if (!test) {
        return res.status(404).json({
          success: false,
          message: 'Test not found'
        });
      }
    } else {
      // Create new test if no ID provided
      test = new Test({
        userId: req.user.id,
        testType: 'comprehensive',
        status: 'in_progress',
        startedAt: new Date()
      });
    }

    // Update test with answers
    test.questions = answers.map((answer, index) => ({
      questionId: answer.questionId,
      answer: answer.selectedOption,
      answeredAt: new Date(),
      order: index
    }));

    // Calculate results
    const results = calculateTestResults(test.questions);
    test.results = results;
    
    // Mark as completed
    test.status = 'completed';
    test.completedAt = new Date();
    test.duration = Math.round((test.completedAt - test.startedAt) / 1000); // seconds

    await test.save();

    console.log(`✅ Test submitted successfully: ${test._id}`);

    res.json({
      success: true,
      message: 'Test submitted successfully',
      data: {
        test: {
          _id: test._id,
          id: test._id,
          status: test.status,
          results: test.results,
          completedAt: test.completedAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Submit test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting test',
      error: error.message
    });
  }
});

// Helper function to calculate test results
function calculateTestResults(questions) {
  // Initialize scores
  const scores = {
    aptitude: 0,
    values: 0,
    personality: 0,
    skills: 0
  };

  // Calculate section scores (simplified for now)
  const totalQuestions = questions.length;
  
  // For now, give a base score of 60-90 range
  scores.aptitude = Math.round(60 + Math.random() * 30);
  scores.values = Math.round(60 + Math.random() * 30);
  scores.personality = Math.round(60 + Math.random() * 30);
  scores.skills = Math.round(60 + Math.random() * 30);

  return {
    scores,
    totalQuestions,
    answeredQuestions: questions.filter(q => q.answer).length,
    completionPercentage: 100
  };
}

export default router;

