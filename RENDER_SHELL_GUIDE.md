# 🖥️ Render Shell Quick Guide

## How to Run Cleaning Script on Render

Since your local IP isn't whitelisted in MongoDB Atlas, you need to run the script on Render where it IS whitelisted.

---

## 📋 Step-by-Step Visual Guide

### Step 1: Deploy Latest Code

```bash
# In your local terminal
cd /Users/animesh/Documents/BoostMySites/Vijnax

git add .
git commit -m "Add clean-questions script"
git push origin main
```

Wait ~2-3 minutes for Render to deploy.

---

### Step 2: Open Render Shell

1. **Go to Render Dashboard**
   ```
   https://dashboard.render.com/
   ```

2. **Click on your service** (`vijnax` or `career-compass-backend`)

3. **Click the "Shell" tab** at the top
   ```
   [Overview] [Events] [Logs] [Metrics] [Shell] [Environment]
                                            ^^^^^ Click here
   ```

4. **Wait for connection**
   ```
   Connecting to shell...
   Connected!
   
   $
   ```

---

### Step 3: Run the Cleaning Script

In the Render Shell terminal, type:

```bash
npm run clean-questions
```

Press ENTER.

---

### Step 4: Watch the Output

You should see:

```
> career-compass-backend@1.0.0 clean-questions
> node scripts/clean_question_metadata.js

🔌 Connecting to MongoDB...
✅ Connected to MongoDB

📝 Cleaning regular questions...
✅ Cleaned question 1
✅ Cleaned question 2
✅ Cleaned question 3
...

(this will continue for all questions)

✅ Cleaned 350 regular questions

📝 Cleaning RIASEC questions...
✅ Cleaned RIASEC question 1
...
✅ Cleaned 90 RIASEC questions

🎉 All questions cleaned successfully!
📊 Summary:
   - Regular questions cleaned: 350
   - RIASEC questions cleaned: 90
   - Total cleaned: 440

🔌 Disconnected from MongoDB
```

---

### Step 5: Verify It Worked

#### Method A: Check in MongoDB Atlas

1. Go to https://cloud.mongodb.com/
2. Click on your cluster
3. Click "Browse Collections"
4. Select `career_compass` database
5. Click on `questions` collection
6. Look at a few questions
7. **They should have NO metadata** (no "Subtheme X:", "Theme X:", etc.)

#### Method B: Test on Frontend

1. Go to your website: https://vijnax.com/test
2. Take a test
3. Look at the questions
4. **They should display clean text** without metadata

---

## 🎯 What If Shell Doesn't Work?

### Alternative: Use Render Logs

If Shell tab is not available:

1. Go to **Logs** tab
2. Watch for server startup
3. Add this to your `server.js` **temporarily**:

```javascript
// At the very end of server.js, after server starts
if (process.env.RUN_CLEAN_QUESTIONS === 'true') {
  console.log('🧹 Running one-time question cleaning...');
  import('./scripts/clean_question_metadata.js')
    .then(() => console.log('✅ Cleaning complete'))
    .catch(err => console.error('❌ Cleaning failed:', err));
}
```

4. Add environment variable in Render:
   ```
   RUN_CLEAN_QUESTIONS=true
   ```

5. Deploy and watch logs
6. After it runs once, **remove** the env variable or set it to `false`

---

## 🚨 Important Notes

### DO:
✅ Run the script ONCE  
✅ Verify questions are cleaned  
✅ Test on frontend  
✅ Deploy the code first  

### DON'T:
❌ Run it multiple times (once is enough)  
❌ Add it to server startup permanently  
❌ Forget to verify it worked  

---

## 🔧 Troubleshooting

### Issue: "Command not found: npm"

**Solution:** Render uses Node.js, npm should be available. Try:
```bash
node --version
npm --version
```

If missing, contact Render support.

---

### Issue: "Cannot find module './scripts/clean_question_metadata.js'"

**Solution:** Make sure you deployed the latest code:
```bash
# Check in Render Shell
ls -la scripts/
# Should show clean_question_metadata.js
```

If missing, deploy again:
```bash
git push origin main --force
```

---

### Issue: "MongoDB connection timeout"

**Solution:** 
1. Check MongoDB Atlas is running
2. Verify Render IP is whitelisted
3. Check connection string in Environment Variables

---

## 📊 Success Indicators

You'll know it worked when you see:

1. ✅ **Console Output:** "🎉 All questions cleaned successfully!"
2. ✅ **MongoDB:** Questions have clean text
3. ✅ **Frontend:** Test questions display without metadata
4. ✅ **PDF Reports:** Downloaded reports have clean questions

---

## 🎬 Quick Copy-Paste Commands

For Render Shell:

```bash
# Check current directory
pwd

# List files
ls -la

# Check if script exists
ls -la scripts/clean_question_metadata.js

# Run cleaning
npm run clean-questions

# Check server is running
pm2 status

# View recent logs
pm2 logs --lines 50
```

---

**Ready to run!** 🚀

Just deploy your code, open Render Shell, and type `npm run clean-questions`!
