# 🎓 Language Learning Tutor

**Build a complete language learning system with multiple specialized AI tutors in under 5 minutes.**

## 🎯 What You'll Build

A sophisticated language learning platform featuring:
- **📚 Professor**: Academic grammar and theory expert
- **💬 Chat Buddy**: Conversational practice partner  
- **✍️ Grammar Guru**: Writing and grammar correction specialist
- **🗣️ Speech Coach**: Pronunciation and speaking practice guide

![Language Tutor Demo](../assets/language-tutor-demo.gif)

---

## 🚀 Quick Start

### **1. Create the Project**
```bash
npx create-smalltalk language-tutor --template=language-tutor
cd language-tutor
echo "OPENAI_API_KEY=your_key_here" > .env
npm start
```

### **2. Start Learning**
```bash
# CLI interface - perfect for quick practice
npm run start:cli

# Web interface - full-featured with file uploads
npm run start:web

# API only - integrate with your own frontend
npm run start:api
```

---

## 💡 Example Interactions

### **Grammar Correction Session**
```
You: "I am go to store yesterday"

Grammar Guru: "Let me help you with that sentence! 

❌ Original: 'I am go to store yesterday'
✅ Corrected: 'I went to the store yesterday'

🔍 Issues found:
• 'am go' → 'went' (past tense of 'go')
• Missing article: 'the store' 
• Verb tense: past actions need past tense

💡 Rule: Past actions use past tense verbs (go → went)"
```

### **Conversation Practice**
```
You: "How was your weekend?"

Chat Buddy: "Oh, it was wonderful! I spent Saturday reading in the park and Sunday cooking with friends. The weather was perfect for outdoor activities. What about you? Did you do anything exciting?"

[Real-time conversation with natural responses and follow-up questions]
```

### **Academic Explanation**
```
You: "Explain the subjunctive mood"

Professor: "The subjunctive mood expresses hypothetical, doubtful, or emotionally charged situations. 

📖 Structure:
• Present subjunctive: base form of verb
• Past subjunctive: 'were' for all persons

🎯 Usage:
• Wishes: 'I wish I were taller'
• Hypotheticals: 'If I were you...'
• Suggestions: 'I suggest he study harder'

📝 Practice exercises available - would you like some?"
```

---

## 🛠️ Code Implementation

### **Basic Setup**
```typescript
import { SmallTalk, Agent } from 'smalltalk';

// Create specialized language tutors
const professor = new Agent({
  name: 'Professor Williams',
  personality: 'academic, thorough, encouraging, patient',
  expertise: ['grammar theory', 'linguistics', 'language structure'],
  systemPrompt: `You are Professor Williams, a linguistics expert who teaches grammar and language theory. 
  
  Provide detailed explanations with:
  - Clear examples
  - Grammar rules
  - Practice exercises
  - Academic context
  
  Use emojis for visual appeal and be encouraging but thorough.`,
  tools: ['grammarCheck', 'exerciseGenerator']
});

const chatBuddy = new Agent({
  name: 'Alex the Chat Buddy', 
  personality: 'friendly, conversational, patient, enthusiastic',
  expertise: ['casual conversation', 'idioms', 'cultural context'],
  systemPrompt: `You are Alex, a friendly conversation partner for language practice.
  
  Your role:
  - Engage in natural conversations
  - Gently correct mistakes in context
  - Ask follow-up questions
  - Share cultural insights
  - Keep conversations flowing naturally`,
  tools: ['conversationStarters', 'culturalContext']
});

// Launch the language tutor
const languageTutor = new SmallTalk({
  agents: [professor, chatBuddy, grammarGuru, speechCoach],
  interface: 'web-chat',
  memory: { maxMessages: 100, truncationStrategy: 'smart' }
});

await languageTutor.start();
```

### **Advanced Agent with Tools**
```typescript
const grammarGuru = new Agent({
  name: 'Grammar Guru',
  personality: 'helpful, precise, encouraging',
  tools: [
    {
      name: 'correctGrammar',
      description: 'Correct grammar and explain mistakes',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to correct' }
        }
      },
      handler: async ({ text }) => {
        // Grammar correction logic
        const corrections = await grammarAPI.analyze(text);
        return {
          original: text,
          corrected: corrections.correctedText,
          mistakes: corrections.errors,
          explanations: corrections.explanations
        };
      }
    },
    {
      name: 'generateExercise',
      description: 'Create practice exercises',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Grammar topic' },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] }
        }
      },
      handler: async ({ topic, difficulty }) => {
        return await exerciseGenerator.create(topic, difficulty);
      }
    }
  ]
});
```

---

## 🎨 Interface Options

### **CLI Interface**
Perfect for quick practice sessions:
```typescript
const cliTutor = new SmallTalk({
  agents: [professor, chatBuddy],
  interface: 'cli',
  config: {
    colors: true,
    agentSwitching: true,
    commandMode: true
  }
});

// Commands available:
// /switch professor  - Switch to Professor Williams
// /correct "text"    - Get grammar correction
// /exercise grammar  - Generate practice exercise
// /stats            - View learning progress
```

### **Web Chat Interface**
Full-featured learning environment:
```typescript
const webTutor = new SmallTalk({
  agents: [professor, chatBuddy, grammarGuru, speechCoach],
  interface: 'web-chat',
  config: {
    port: 3000,
    fileUploads: true,      // Upload documents for review
    voiceInput: true,       // Speech recognition
    agentSwitching: true,   // Switch tutors mid-conversation
    progressTracking: true  // Learning analytics
  }
});
```

### **API Integration**
Integrate with your existing app:
```typescript
const apiTutor = new SmallTalk({
  agents: [professor, chatBuddy, grammarGuru],
  interface: 'web-api'
});

// Available endpoints:
// POST /chat/professor    - Chat with Professor Williams
// POST /correct          - Get grammar corrections  
// POST /exercise         - Generate practice exercises
// GET /progress/:userId  - Get learning analytics
```

---

## 📊 Features Showcase

### **Smart Grammar Correction**
```typescript
// Input: "I have went to store"
// Output:
{
  "original": "I have went to store",
  "corrected": "I have gone to the store",
  "mistakes": [
    {
      "error": "went → gone",
      "rule": "Present perfect uses past participle",
      "explanation": "With 'have/has', use 'gone' not 'went'"
    },
    {
      "error": "missing article",
      "rule": "Definite articles with specific nouns", 
      "explanation": "Use 'the store' when referring to a specific store"
    }
  ],
  "confidence": 0.95
}
```

### **Dynamic Exercise Generation**
```typescript
// Request: Generate intermediate verb tense exercise
// Response:
{
  "type": "fill-in-the-blank",
  "difficulty": "intermediate", 
  "questions": [
    {
      "sentence": "By next year, I _____ (live) here for five years.",
      "answer": "will have lived",
      "tense": "future perfect",
      "explanation": "Future perfect shows action completed before future time"
    }
  ],
  "followUp": "Would you like to practice more future perfect examples?"
}
```

### **Conversation Flow Management**
```typescript
// Automatic conversation steering
const conversationFlow = {
  beginner: [
    "Tell me about your hobbies",
    "Describe your daily routine", 
    "What's your favorite food?"
  ],
  intermediate: [
    "What would you do if you won the lottery?",
    "Describe a challenging situation you faced",
    "Compare your country to others you've visited"
  ],
  advanced: [
    "Discuss the pros and cons of social media",
    "Explain a complex concept from your field",
    "Debate a controversial topic respectfully"
  ]
};
```

---

## 🔧 Customization Options

### **Add Your Own Language**
```typescript
const spanishTutor = new Agent({
  name: 'Profesora María',
  personality: 'patient, encouraging, culturally aware',
  language: 'Spanish',
  systemPrompt: `Eres la Profesora María, especialista en enseñar español.
  
  Tu misión:
  - Ayudar con gramática española
  - Practicar conversación natural
  - Explicar cultura hispana
  - Corregir errores con paciencia`,
  expertise: ['Spanish grammar', 'Latin American culture', 'pronunciation']
});
```

### **Integrate External APIs**
```typescript
const pronunciationCoach = new Agent({
  name: 'Speech Coach',
  tools: [
    {
      name: 'analyzePronunciation',
      handler: async ({ audioData }) => {
        const analysis = await speechAPI.analyze(audioData);
        return {
          accuracy: analysis.score,
          mistakes: analysis.phonemeErrors,
          suggestions: analysis.improvements
        };
      }
    }
  ]
});
```

### **Progress Tracking**
```typescript
const progressTracker = {
  name: 'trackProgress',
  handler: async ({ userId, interaction }) => {
    await database.save({
      user: userId,
      timestamp: new Date(),
      type: interaction.type,
      accuracy: interaction.accuracy,
      topic: interaction.topic
    });
    
    return await generateProgressReport(userId);
  }
};
```

---

## 📈 Advanced Features

### **Adaptive Difficulty**
The system automatically adjusts based on user performance:

```typescript
class AdaptiveDifficulty {
  adjustLevel(userStats) {
    if (userStats.accuracy > 0.85) {
      return 'increase';
    } else if (userStats.accuracy < 0.60) {
      return 'decrease';
    }
    return 'maintain';
  }
}
```

### **Multi-Language Support**
```typescript
const multilingualTutor = new SmallTalk({
  agents: [
    spanishTutor,
    frenchTutor, 
    germanTutor,
    mandarinTutor
  ],
  config: {
    languageSwitching: true,
    translationAssistance: true
  }
});
```

### **Voice Integration**
```typescript
const voiceEnabledTutor = new SmallTalk({
  agents: [speechCoach],
  interface: 'web-chat',
  config: {
    voiceInput: true,
    voiceOutput: true,
    pronunciationFeedback: true
  }
});
```

---

## 🎯 Next Steps

**🎉 You now have a complete language learning system!**

**Extend your tutor:**
- **📱 [Mobile Integration](../guides/mobile-integration.md)** - Build a mobile app
- **🔊 [Voice Features](../guides/voice-integration.md)** - Add speech recognition
- **📊 [Analytics](../guides/analytics.md)** - Track learning progress  
- **🌍 [Deployment](../guides/deployment.md)** - Deploy to production

**Explore more examples:**
- **🏥 [Medical Tutor](./medical-tutor.md)** - Healthcare education
- **💼 [Business Meeting](./business-meeting.md)** - Professional communication
- **👨‍💻 [Code Reviewer](./code-reviewer.md)** - Technical skills training

---

**Ready to teach the world?** Your AI language tutor is ready to help millions learn!