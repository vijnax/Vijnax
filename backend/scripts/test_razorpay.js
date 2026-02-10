/**
 * Razorpay Integration Test Script
 * 
 * This script tests the Razorpay integration by creating a test order
 * Run: node backend/scripts/test_razorpay.js
 */

import dotenv from 'dotenv';
import Razorpay from 'razorpay';

// Load environment variables
dotenv.config({ path: './backend/.env' });

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n`)
};

async function testRazorpayIntegration() {
  try {
    log.section('RAZORPAY INTEGRATION TEST');

    // Check environment variables
    log.info('Checking environment variables...');
    
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      log.error('Razorpay credentials not found in environment variables');
      log.info('Please ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in .env file');
      process.exit(1);
    }

    log.success('Environment variables found');
    log.info(`Key ID: ${keyId.substring(0, 15)}...`);

    // Initialize Razorpay
    log.info('Initializing Razorpay instance...');
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    log.success('Razorpay instance created');

    // Test: Create Order
    log.section('TEST 1: CREATE ORDER');
    log.info('Creating test order for ₹99...');
    
    const orderOptions = {
      amount: 9900, // ₹99 in paise
      currency: 'INR',
      receipt: `test_${Date.now()}`,
      notes: {
        test: true,
        purpose: 'Integration Test'
      }
    };

    const order = await razorpay.orders.create(orderOptions);
    log.success('Order created successfully!');
    console.log('\nOrder Details:');
    console.log(JSON.stringify(order, null, 2));

    // Test: Fetch Order
    log.section('TEST 2: FETCH ORDER');
    log.info(`Fetching order: ${order.id}...`);
    
    const fetchedOrder = await razorpay.orders.fetch(order.id);
    log.success('Order fetched successfully!');
    console.log('\nFetched Order Details:');
    console.log(JSON.stringify(fetchedOrder, null, 2));

    // Summary
    log.section('TEST SUMMARY');
    log.success('All tests passed!');
    log.info('Your Razorpay integration is working correctly.');
    log.info('\nNext steps:');
    console.log('  1. Test the payment flow in the frontend');
    console.log('  2. Complete a test payment using test cards');
    console.log('  3. Verify payment history in MongoDB');
    log.warning('\nRemember: You are using TEST mode. Use test cards only.');
    log.info('Test Card: 4111 1111 1111 1111, CVV: 123, Expiry: Any future date');

  } catch (error) {
    log.section('TEST FAILED');
    log.error('Test failed with error:');
    console.error(error);
    
    if (error.error && error.error.description) {
      log.error(`Description: ${error.error.description}`);
    }
    
    process.exit(1);
  }
}

// Run the test
testRazorpayIntegration();
