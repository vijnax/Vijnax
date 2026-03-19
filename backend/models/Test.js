import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  testType: {
    type: String,
    required: [true, 'Test type is required'],
    enum: ['comprehensive', 'personality', 'aptitude', 'career_interest', 'learning_style'],
    default: 'comprehensive'
  },
  status: {
    type: String,
    enum: ['created', 'started', 'in_progress', 'completed', 'abandoned', 'expired'],
    default: 'created'
  },
  questions: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    answer: {
      type: String,
      default: null
    },
    responseTime: {
      type: Number, // in seconds
      default: 0
    },
    answeredAt: {
      type: Date,
      default: null
    },
    isCorrect: {
      type: Boolean,
      default: null
    }
  }],
  settings: {
    timeLimit: {
      type: Number, // in minutes
      default: 60
    },
    allowBackNavigation: {
      type: Boolean,
      default: true
    },
    showProgress: {
      type: Boolean,
      default: true
    },
    randomizeQuestions: {
      type: Boolean,
      default: true
    },
    showTimer: {
      type: Boolean,
      default: true
    }
  },
  progress: {
    currentQuestion: {
      type: Number,
      default: 1
    },
    answeredCount: {
      type: Number,
      default: 0
    },
    totalQuestions: {
      type: Number,
      required: true
    },
    timeSpent: {
      type: Number, // in seconds
      default: 0
    },
    timeRemaining: {
      type: Number, // in seconds
      default: 3600 // 60 minutes
    }
  },
  results: {
    scores: {
      personality: {
        type: Number,
        default: 0
      },
      aptitude: {
        type: Number,
        default: 0
      },
      interest: {
        type: Number,
        default: 0
      },
      values: {
        type: Number,
        default: 0
      },
      skills: {
        type: Number,
        default: 0
      }
    },
    totalScore: {
      type: Number,
      default: 0
    },
    percentile: {
      type: Number,
      default: 0
    },
    recommendations: [{
      category: {
        type: String,
        enum: ['career', 'subject', 'skill', 'personality_development']
      },
      title: String,
      description: String,
      priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium'
      }
    }],
    insights: [{
      domain: String,
      strength: String,
      area: String,
      description: String
    }],
    generatedAt: {
      type: Date,
      default: null
    }
  },
  metadata: {
    deviceInfo: {
      userAgent: String,
      platform: String,
      screenResolution: String
    },
    ipAddress: String,
    location: {
      country: String,
      region: String,
      city: String
    },
    sessionId: String,
    paymentId: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    paidAmount: Number
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
testSchema.index({ userId: 1, status: 1 });
testSchema.index({ status: 1 });
testSchema.index({ testType: 1 });
testSchema.index({ createdAt: -1 });
testSchema.index({ expiresAt: 1 });

// Virtual for test duration
testSchema.virtual('duration').get(function() {
  if (!this.startedAt || !this.completedAt) return 0;
  return Math.round((this.completedAt - this.startedAt) / 1000 / 60); // in minutes
});

// Virtual for completion percentage
testSchema.virtual('completionPercentage').get(function() {
  if (!this.progress.totalQuestions) return 0;
  return Math.round((this.progress.answeredCount / this.progress.totalQuestions) * 100);
});

// Pre-save middleware to set expiration
testSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Set expiration to 24 hours from creation
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

// Method to start the test
testSchema.methods.startTest = function() {
  this.status = 'started';
  this.startedAt = new Date();
  this.progress.timeRemaining = this.settings.timeLimit * 60; // Convert to seconds
  return this.save();
};

// Method to answer a question
testSchema.methods.answerQuestion = function(questionId, answer, responseTime) {
  const question = this.questions.find(q => q.questionId.toString() === questionId.toString());
  if (question) {
    question.answer = answer;
    question.responseTime = responseTime;
    question.answeredAt = new Date();
    
    // Update progress
    if (!question.answer) {
      this.progress.answeredCount += 1;
    }
    
    // Update current question
    const currentIndex = this.questions.findIndex(q => q.questionId.toString() === questionId.toString());
    if (currentIndex < this.questions.length - 1) {
      this.progress.currentQuestion = currentIndex + 2;
    }
  }
  return this.save();
};

// Method to complete the test
testSchema.methods.completeTest = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.progress.timeSpent = this.settings.timeLimit * 60 - this.progress.timeRemaining;
  return this.save();
};

// Method to abandon the test
testSchema.methods.abandonTest = function() {
  this.status = 'abandoned';
  this.completedAt = new Date();
  return this.save();
};

// Method to update timer
testSchema.methods.updateTimer = function(timeRemaining) {
  this.progress.timeRemaining = timeRemaining;
  this.progress.timeSpent = this.settings.timeLimit * 60 - timeRemaining;
  
  // Auto-expire if time runs out
  if (timeRemaining <= 0 && this.status === 'in_progress') {
    this.status = 'expired';
    this.completedAt = new Date();
  }
  
  return this.save();
};

// Static method to get active tests for a user
testSchema.statics.getActiveTests = function(userId) {
  return this.find({
    userId,
    status: { $in: ['created', 'started', 'in_progress'] }
  }).sort({ createdAt: -1 });
};

// Static method to get completed tests for a user
testSchema.statics.getCompletedTests = function(userId, limit = 10) {
  return this.find({
    userId,
    status: { $in: ['completed', 'abandoned', 'expired'] }
  })
  .sort({ completedAt: -1 })
  .limit(limit);
};

// Static method to clean up expired tests
testSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    {
      expiresAt: { $lt: new Date() },
      status: { $in: ['created', 'started', 'in_progress'] }
    },
    {
      $set: { status: 'expired' }
    }
  );
};

const Test = mongoose.model('Test', testSchema);

export default Test;

