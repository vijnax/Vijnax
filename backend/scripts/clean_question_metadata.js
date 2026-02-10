/**
 * Clean Question Metadata Script
 * Removes subthemes, themes, and other metadata from question and option text
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Question from '../models/Question.js';
import RIASECQuestion from '../models/RIASECQuestion.js';

dotenv.config({ path: './backend/.env' });

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;

/**
 * Clean text by removing metadata patterns
 */
function cleanText(text) {
  if (!text) return text;
  
  let cleaned = text;
  
  // Remove "Subtheme X: Description" patterns
  cleaned = cleaned.replace(/Subtheme \d+:.*?(?=Q\d|$)/gi, '');
  
  // Remove "Theme X: Description" patterns
  cleaned = cleaned.replace(/Theme \d+:.*?(?=[A-D]\)|$)/gi, '');
  
  // Remove "-- X of Y --" patterns
  cleaned = cleaned.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '');
  
  // Remove stream indicators like "(PCM – description)" or just "(PCM)"
  cleaned = cleaned.replace(/\((?:PCM|PCB|Commerce|Humanities)(?:\s*[–-].*?)?\)/gi, '');
  
  // Also remove stream labels at start of text
  cleaned = cleaned.replace(/^(?:PCM|PCB|Commerce|Humanities)\s*[–-]?\s*/gi, '');
  
  // Remove "Evaluates..." or "Assesses..." standalone phrases
  cleaned = cleaned.replace(/(?:Evaluates|Assesses|Measures)\s+[a-z\s,]+?(?=[A-Z]|$)/gi, '');
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

async function cleanAllQuestions() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clean regular questions
    console.log('\n📝 Cleaning regular questions...');
    const questions = await Question.find({});
    let cleanedCount = 0;

    for (const question of questions) {
      let modified = false;

      // Clean question text
      const cleanedText = cleanText(question.text);
      if (cleanedText !== question.text) {
        question.text = cleanedText;
        modified = true;
      }

      // Clean option text
      question.options.forEach(option => {
        const cleanedOptionText = cleanText(option.text);
        if (cleanedOptionText !== option.text) {
          option.text = cleanedOptionText;
          modified = true;
        }
      });

      if (modified) {
        await question.save();
        cleanedCount++;
        console.log(`✅ Cleaned question ${question.questionNumber}`);
      }
    }

    console.log(`\n✅ Cleaned ${cleanedCount} regular questions`);

    // Clean RIASEC questions
    console.log('\n📝 Cleaning RIASEC questions...');
    const riasecQuestions = await RIASECQuestion.find({});
    let riasecCleanedCount = 0;

    for (const question of riasecQuestions) {
      let modified = false;

      // Clean question text
      const cleanedText = cleanText(question.text);
      if (cleanedText !== question.text) {
        question.text = cleanedText;
        modified = true;
      }

      // Clean option text
      question.options.forEach(option => {
        const cleanedOptionText = cleanText(option.text);
        if (cleanedOptionText !== option.text) {
          option.text = cleanedOptionText;
          modified = true;
        }
      });

      if (modified) {
        await question.save();
        riasecCleanedCount++;
        console.log(`✅ Cleaned RIASEC question ${question.questionNumber}`);
      }
    }

    console.log(`\n✅ Cleaned ${riasecCleanedCount} RIASEC questions`);

    console.log('\n🎉 All questions cleaned successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Regular questions cleaned: ${cleanedCount}`);
    console.log(`   - RIASEC questions cleaned: ${riasecCleanedCount}`);
    console.log(`   - Total cleaned: ${cleanedCount + riasecCleanedCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the cleaning
cleanAllQuestions();
