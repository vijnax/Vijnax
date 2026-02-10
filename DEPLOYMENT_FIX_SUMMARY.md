# Deployment Fix Summary - January 19, 2026

## 🔴 Issues Identified

### 1. MSG91 OTP Delivery Issue
**Problem**: Users weren't receiving OTP SMS, despite backend logs showing "success"

**Root Cause**: MSG91 template variable mismatch
- **Template content**: `Hi, your OTP for Vijna Academy login is ##number##`
- **Code was sending**: `otp: "123456"` (wrong variable name)
- **MSG91 expected**: `number: "123456"` (to match `##number##`)

**Solution**: 
- ✅ Updated `smsService.js` to use MSG91 Flow API
- ✅ Changed API endpoint from `/api/v5/otp` to `/api/v5/flow/`
- ✅ Updated payload format to send `number: otp` (matches template variable)
- ✅ Added detailed request logging with `requestId` tracking

### 2. Frontend Questions Not Loading (405 Error)
**Problem**: `POST /api/tests/generate/randomized` returning 405 Method Not Allowed

**Root Cause**: Frontend/Backend URL mismatch in production
- **Frontend**: `vijnax.com` (static hosting)
- **Backend**: `vijnax.onrender.com` (API server)
- **Issue**: Frontend was calling `/api/tests/generate/randomized` as a relative path, which went to `vijnax.com` (no backend there!)

**Solution**:
- ✅ Updated `src/services/api.js` to default to `https://vijnax.onrender.com/api` in production
- ✅ Created `testAPI.generateRandomized()` method in API service
- ✅ Updated `src/pages/test/page.tsx` to use the API service instead of direct `fetch()` calls
- ✅ Removed unused `authHeaders()` function

---

## 📝 Changes Made

### Backend: `backend/services/smsService.js`
```javascript
// Before
const msg91Url = 'https://api.msg91.com/api/v5/otp';
const payload = {
  template_id: process.env.MSG91_TEMPLATE_ID,
  mobile: cleanMobile,
  authkey: process.env.MSG91_AUTH_KEY,
  otp: otp,  // ❌ Wrong variable name
  otp_expiry: 10
};

// After
const msg91Url = 'https://control.msg91.com/api/v5/flow/';
const payload = {
  template_id: process.env.MSG91_TEMPLATE_ID,
  short_url: '0',
  recipients: [
    {
      mobiles: `91${cleanMobile}`,
      number: otp  // ✅ Matches ##number## in template
    }
  ]
};
```

### Frontend: `src/services/api.js`
```javascript
// Before
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL 
  || (import.meta.env.MODE === 'production' 
    ? import.meta.env.VITE_API_BASE_URL_PROD || 'https://your-production-api.com/api'  // ❌ Placeholder
    : 'http://localhost:5001/api');

// After
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL 
  || (import.meta.env.MODE === 'production' 
    ? import.meta.env.VITE_API_BASE_URL_PROD || 'https://vijnax.onrender.com/api'  // ✅ Correct URL
    : 'http://localhost:5001/api');

// Added method
export const testAPI = {
  // ... other methods ...
  generateRandomized: (userStream = 'PCM') => 
    api.post('/tests/generate/randomized', { userStream }),
};
```

### Frontend: `src/pages/test/page.tsx`
```javascript
// Before
const res = await fetch('/api/tests/generate/randomized', {  // ❌ Relative path
  method: 'POST', 
  headers: authHeaders(), 
  body: JSON.stringify({ userStream: 'PCM' }) 
});

// After
import { testAPI } from '../../services/api';  // ✅ Import API service
const json = await testAPI.generateRandomized('PCM');  // ✅ Uses correct backend URL
```

---

## 🚀 Deployment Steps

### 1. Backend (Render) - Already Deployed ✅
- Auto-deployed from GitHub main branch
- Environment variables configured:
  - `MSG91_AUTH_KEY`: `483238Am2RD6mnvb696b3c7dP1`
  - `MSG91_TEMPLATE_ID`: `696dcd7f15741d236e505532` (verified template)
  - `MONGODB_URI`: MongoDB Atlas connection string
  - `JWT_SECRET`: Production secret key
  - `NODE_ENV`: `production`
  - `CORS_ORIGINS`: `https://vijnax.com,https://www.vijnax.com`

### 2. Frontend (Vercel/Netlify) - Needs Redeployment
**Action Required**: Redeploy frontend to pick up the new code changes

#### Option A: Vercel
```bash
vercel --prod
```

#### Option B: Netlify
```bash
netlify deploy --prod
```

#### Option C: Manual Git Deploy (if auto-deploy is configured)
```bash
# Already pushed to main
git log -1  # Verify commit: "Fix API calls to use correct backend URL"
```

### 3. Environment Variables for Frontend (Optional)
If you want to override the default backend URL, add these to your hosting platform:

**Vercel**:
- Dashboard → Project → Settings → Environment Variables
- Add: `VITE_API_BASE_URL_PROD` = `https://vijnax.onrender.com/api`

**Netlify**:
- Dashboard → Site → Site Settings → Environment Variables
- Add: `VITE_API_BASE_URL_PROD` = `https://vijnax.onrender.com/api`

---

## 🧪 Testing Checklist

### Test 1: OTP Delivery ✅
1. Go to `https://vijnax.com/otp-login`
2. Enter: `9530447010`
3. Click "Send Verification Code"
4. **Expected**: SMS received within 30 seconds with 6-digit OTP
5. **Backend logs should show**:
   ```
   📤 [abc123] Attempting to send OTP to 9530447010 via MSG91...
      [abc123] OTP: 623324
      [abc123] Template ID: 696dcd7f15741d236e505532
      [abc123] Payload: {"template_id":"...","recipients":[{"mobiles":"919530447010","number":"623324"}]}
   📥 [abc123] MSG91 Response: {"type":"success","message":"..."}
   ✅ [abc123] OTP 623324 sent successfully to 9530447010 via MSG91
   ```

### Test 2: Question Loading ✅
1. Login with OTP
2. Go to test instructions page
3. Click "Start Test"
4. **Expected**: 60 questions load successfully
5. **Browser console should show**:
   ```
   🔄 Loading randomized test questions...
   ✅ Test data received: { success: true, data: { total: 60, ... } }
   📝 Loaded 60 questions
   ```

### Test 3: Backend Health ✅
1. Visit: `https://vijnax.onrender.com/api/health`
2. **Expected**: `{"success":true,"message":"Career Compass API is running"}`

---

## 📊 System Status

| Component | Status | URL |
|-----------|--------|-----|
| Backend API | ✅ Running | https://vijnax.onrender.com |
| Frontend | 🔄 Needs Redeploy | https://vijnax.com |
| Database | ✅ Connected | MongoDB Atlas |
| SMS Service | ✅ Configured | MSG91 (Template verified) |
| Self-Ping | ✅ Active | Every 30 seconds |

---

## 🔧 Quick Reference

### Backend Logs (Render)
- Dashboard → vijnax → Logs → Real-time logs

### MSG91 Dashboard
- SMS → Templates → View delivery logs
- Expected template: `696dcd7f15741d236e505532` (Verified by DLT)

### Frontend Build
```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## 🎯 Next Steps

1. **Redeploy Frontend** - Push will auto-deploy if configured, or run manual deploy
2. **Test OTP Flow** - Try logging in with your mobile number
3. **Test Questions** - Verify all 60 questions load correctly
4. **Monitor Logs** - Check Render logs for any errors

---

## 📞 Support

If issues persist:
1. Check Render logs: `https://dashboard.render.com`
2. Check MSG91 logs: `https://control.msg91.com/app/m/i/sms/logs`
3. Check browser console: Press F12 → Console tab
4. Verify environment variables are set correctly on both platforms

---

**Last Updated**: January 19, 2026  
**Status**: ✅ Backend fixes deployed, awaiting frontend redeploy
