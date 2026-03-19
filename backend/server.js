import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import axios from 'axios';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import testRoutes from './routes/tests.js';
import questionRoutes from './routes/questions.js';
import aptitudeRoutes from './routes/aptitude.js';
import riasecRoutes from './routes/riasec.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import reportRoutes from './routes/reports.js';
import valuesRoutes from './routes/values.js';
import personalityRoutes from './routes/personality.js';
import decisionRoutes from './routes/decision.js';
import learningRoutes from './routes/learning.js';
import esiRoutes from './routes/esi.js';
import valuesWorkRoutes from './routes/valuesWork.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - Required for Render/Heroku and other reverse proxies
// This allows Express to correctly identify client IPs from X-Forwarded-For headers
// Set to 1 to trust only the first proxy (Render's load balancer) - more secure for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration from environment variables
const getCorsOrigins = () => {
  if (process.env.CORS_ORIGINS) {
    // Parse comma-separated list from environment variable
    return process.env.CORS_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  // Fallback to defaults based on environment
  if (process.env.NODE_ENV === 'production') {
    return ['https://yourdomain.com']; // Default production domain
  }
  
  // Development defaults
  return ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'];
};

app.use(cors({
  origin: getCorsOrigins(),
  credentials: true
}));

// Rate limiting
// Using trust proxy: 1 means we only trust the first proxy (Render's load balancer)
// This is secure and prevents IP spoofing while still working with reverse proxies
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Custom key generator to use req.ip (which respects trust proxy: 1)
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});
app.use('/api/', limiter);

// Body parsing middleware
// The verify callback preserves the raw body buffer on webhook requests
// so Razorpay signature verification can HMAC the exact bytes that were signed.
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/payments/webhook') {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// Root endpoint (for platform health checks like Render)
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Career Compass API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      api: '/api'
    }
  });
});

// Health check endpoint (also available at root for convenience)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Career Compass API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Alias for /health (some platforms check this)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Career Compass API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/aptitude', aptitudeRoutes);
app.use('/api/riasec', riasecRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/values', valuesRoutes);
app.use('/api/personality', personalityRoutes);
app.use('/api/decision', decisionRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/esi', esiRoutes);
app.use('/api/values-work', valuesWorkRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/careercompass';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  console.log(`🗄️  MongoDB connected: ${uri}`);
}

// Self-ping mechanism to keep server alive
let selfPingInterval = null;
let pingCount = 0;
let lastPingStatus = 'unknown';

const startSelfPing = (port) => {
  const pingInterval = parseInt(process.env.SELF_PING_INTERVAL_MS) || 30000; // Default: 30 seconds
  
  // Determine the health check URL
  // In production (Render), use the public URL or environment variable
  let healthUrl;
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    // Use public URL from environment variable, or construct from Render service URL
    const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_SERVICE_NAME || 'vijnax'}.onrender.com`;
    healthUrl = `${publicUrl}/api/health`;
    console.log(`🌐 Production self-ping enabled - will ping: ${healthUrl}`);
  } else {
    // Development: use localhost
    healthUrl = `http://localhost:${port}/api/health`;
    console.log(`🔄 Development self-ping enabled - will ping: ${healthUrl}`);
  }
  
  console.log(`🔄 Starting self-ping every ${pingInterval / 1000} seconds...`);
  
  selfPingInterval = setInterval(async () => {
    try {
      const response = await axios.get(healthUrl, { 
        timeout: 10000, // Increased timeout for production
        validateStatus: (status) => status < 500 // Accept 4xx as "server is up"
      });
      pingCount++;
      lastPingStatus = response.status === 200 ? 'healthy' : 'unhealthy';
      
      if (pingCount % 20 === 0) { // Log every 20 pings (10 minutes at 30s interval)
        console.log(`💓 Self-ping #${pingCount}: ${lastPingStatus.toUpperCase()} - ${response.data?.message || 'OK'}`);
      }
    } catch (error) {
      lastPingStatus = 'error';
      // Only log errors periodically to avoid spam
      if (pingCount % 20 === 0) {
        console.error(`❌ Self-ping failed: ${error.message}`);
      }
    }
  }, pingInterval);
  
  // Initial ping
  setTimeout(async () => {
    try {
      const response = await axios.get(healthUrl, { 
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      console.log(`✅ Initial self-ping successful: ${response.data?.message || 'OK'}`);
    } catch (error) {
      console.error(`❌ Initial self-ping failed: ${error.message}`);
      console.log(`   This is normal if the service is still starting up. Will retry every ${pingInterval / 1000}s...`);
    }
  }, 5000); // Wait 5 seconds after server starts (longer for production)
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  if (selfPingInterval) {
    clearInterval(selfPingInterval);
  }
  mongoose.connection.close().then(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  if (selfPingInterval) {
    clearInterval(selfPingInterval);
  }
  mongoose.connection.close().then(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`🚀 Career Compass API server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      
      // Start self-ping after server is ready
      startSelfPing(PORT);
    });
    
    // Enhanced health check with server status
    app.get('/api/health/detailed', (req, res) => {
      res.json({
        status: 'OK',
        message: 'Career Compass API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB'
        },
        database: {
          status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          readyState: mongoose.connection.readyState
        },
        selfPing: {
          count: pingCount,
          lastStatus: lastPingStatus,
          interval: parseInt(process.env.SELF_PING_INTERVAL_MS) || 30000
        }
      });
    });
    
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();

export default app;
