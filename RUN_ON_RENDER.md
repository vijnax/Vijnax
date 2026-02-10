# 🚀 Run Cleaning Script on Render

Since your local IP is not whitelisted in MongoDB Atlas, you need to run the cleaning script directly on Render where it's whitelisted.

---

## Option 1: Via Render Shell (Recommended)

### Step 1: Open Render Shell

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your backend service (`vijnax`)
3. Click on **"Shell"** tab (top menu)
4. Wait for shell to connect

### Step 2: Run Cleaning Script

In the Render Shell, run:

```bash
npm run clean-questions
```

**Expected Output:**
```
> career-compass-backend@1.0.0 clean-questions
> node scripts/clean_question_metadata.js

🔌 Connecting to MongoDB...
✅ Connected to MongoDB

📝 Cleaning regular questions...
✅ Cleaned question 1
✅ Cleaned question 2
...
✅ Cleaned 350 regular questions

📝 Cleaning RIASEC questions...
✅ Cleaned 90 RIASEC questions

🎉 All questions cleaned successfully!
📊 Summary:
   - Regular questions cleaned: 350
   - RIASEC questions cleaned: 90
   - Total cleaned: 440

🔌 Disconnected from MongoDB
```

---

## Option 2: Deploy and Run Manually

### Step 1: Deploy Changes

```bash
cd /Users/animesh/Documents/BoostMySites/Vijnax
git add .
git commit -m "Add clean-questions npm script"
git push origin main
```

Wait for Render to deploy (~2-3 minutes)

### Step 2: SSH into Render

If you have SSH access configured:

```bash
# Check Render docs for SSH instructions
render ssh vijnax

# Then run:
npm run clean-questions
```

---

## Option 3: Manual Execution via Render API

You can also trigger it via a one-time job in Render:

1. Go to Render Dashboard → Your Service
2. Click **"Manual Deploy"** → **"Clear build cache & deploy"**
3. After deployment, go to **Shell** tab
4. Run: `npm run clean-questions`

---

## ✅ Verification

After running, verify in MongoDB Atlas:

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Browse Collections → `career_compass` → `questions`
3. Check a few questions - they should have clean text without metadata

**Example Before:**
```json
{
  "text": "I'm unsure why I'm doing any of this Subtheme 12: Resourcefulness..."
}
```

**Example After:**
```json
{
  "text": "I'm unsure why I'm doing any of this"
}
```

---

## 🔄 Whitelist Your Local IP (Optional)

If you want to run scripts locally in the future:

### Step 1: Get Your Public IP

Visit: https://whatismyipaddress.com/

### Step 2: Add to MongoDB Atlas Whitelist

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Select your cluster
3. Click **"Network Access"** (left sidebar)
4. Click **"Add IP Address"**
5. Enter your IP address from step 1
6. Click **"Confirm"**
7. Wait 1-2 minutes for it to take effect

### Step 3: Test Locally

```bash
cd /Users/animesh/Documents/BoostMySites/Vijnax
npm run clean-questions
```

---

## 📝 Available NPM Scripts

Now you have these convenient scripts:

```bash
# Start server
npm start

# Clean question metadata (remove subthemes, themes, etc.)
npm run clean-questions

# Import questions from markdown files
npm run import-questions

# Development mode with auto-reload
npm run dev

# Run tests
npm test
```

---

## 🚨 Important Notes

1. **Run cleaning script only ONCE** - It's already idempotent (safe to run multiple times) but unnecessary
2. **Deploy first** - Make sure latest code is on Render before running
3. **Verify after** - Check a few questions in MongoDB to confirm cleaning worked
4. **Don't run on every startup** - This is a one-time migration, not a recurring task

---

## 🎯 Quick Command Reference

### On Render Shell:
```bash
# Clean questions
npm run clean-questions

# Check if server is running
pm2 status

# View logs
pm2 logs

# Restart server
pm2 restart all
```

---

**Status:** ✅ READY TO RUN ON RENDER

**Time Required:** ~30 seconds to clean all questions

**Next Step:** Open Render Shell and run `npm run clean-questions`
