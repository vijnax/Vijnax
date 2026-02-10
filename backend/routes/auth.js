import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { generateToken } from '../middleware/auth.js';
import { sendOTP, verifyOTP } from '../services/smsService.js';
import User from '../models/User.js';

const router = express.Router();

// In-memory storage for testing
const users = new Map();
const adminUsers = new Map();

// Initialize with test data
adminUsers.set('admin@careercompass.com', {
  id: 'admin-1',
  email: 'admin@careercompass.com',
  password: bcrypt.hashSync('admin123', 10),
  role: 'admin',
  name: 'Admin User'
});

// @route   POST /api/auth/send-otp
// @desc    Send OTP to mobile number
// @access  Public
router.post('/send-otp', [
  body('mobile').isMobilePhone().withMessage('Please provide a valid mobile number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { mobile } = req.body;
    const requestId = Math.random().toString(36).substring(7);
    
    console.log(`\n🔵 [${requestId}] OTP Request received for mobile: ${mobile}`);
    console.log(`🔵 [${requestId}] Request IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`🔵 [${requestId}] Request body:`, req.body);

    // Send OTP via MSG91
    const result = await sendOTP(mobile, requestId);
    
    if (result.success) {
      const response = {
        success: true,
        message: result.message
      };
      
      // Include OTP in response for development mode only
      if (process.env.NODE_ENV === 'development' && result.otp) {
        response.otp = result.otp;
      }
      
      res.json(response);
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Failed to send OTP'
      });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and login user
// @access  Public
router.post('/verify-otp', [
  body('mobile').isMobilePhone().withMessage('Please provide a valid mobile number'),
  body('otp').isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { mobile, otp } = req.body;

    // Verify OTP
    const verifyResult = await verifyOTP(mobile, otp);
    
    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message
      });
    }

    // Get or create user in MongoDB
    let user = await User.findOne({ mobile });
    
    if (!user) {
      // Create new user in database
      user = await User.create({
        mobile,
        name: `User ${mobile.slice(-4)}`,
        email: `${mobile}@temp.vijnax.com`, // Temporary email
        password: `temp-${mobile}-${Date.now()}`, // Temporary password (will be hashed)
        role: 'user',
        isVerified: true // OTP verified
      });
      console.log(`✅ New user created: ${user.mobile}`);
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
      console.log(`✅ Existing user logged in: ${user.mobile}`);
    }

    // Generate token with real MongoDB _id
    const token = generateToken({
      id: user._id.toString(),
      mobile: user.mobile,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id.toString(),
          mobile: user.mobile,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/admin-login
// @desc    Admin login
// @access  Public
router.post('/admin-login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if admin exists
    const admin = adminUsers.get(email);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(admin);

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        token,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        }
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', (req, res) => {
  try {
    // This would normally use middleware to get user from token
    // For now, return a mock response
    res.json({
      success: true,
      data: {
        user: {
          id: 'user-1',
          mobile: '1234567890',
          name: 'Test User',
          role: 'user'
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;
