# SmallTalk Framework Examples

This directory contains comprehensive examples showcasing the power and flexibility of the SmallTalk framework for building sophisticated LLM applications with multiple specialized agents.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# List all available examples
npm run examples

# Run any example
npm run example:basic      # Basic multi-agent chat
npm run example:language   # Language learning tutor
npm run example:medical    # Medical education system
npm run example:business   # Multi-agent business meeting
```

## 📚 Example Applications

### 1. 🗣️ Basic Chat (`basic-chat.ts`)

A simple multi-agent chat application demonstrating core SmallTalk features.

**Features:**
- Multiple agent personalities (Helper, Coder, Writer)
- Agent switching via `/agent <name>` commands
- CLI interface with colored output
- Basic conversation management

**Agents:**
- **Helper**: Friendly general-purpose assistant
- **CodeBot**: Coding expert for JavaScript, TypeScript, Python
- **Writer**: Creative writing assistant

**Try it:**
```bash
npm run example:basic
```

---

### 2. 🌍 Language Tutor (`language-tutor.ts`)

A comprehensive language learning system with specialized tutoring agents.

**Features:**
- Specialized language learning agents
- Custom prompt templates for lessons and corrections
- Vocabulary quizzes and pronunciation guides
- Progress tracking tools
- Multi-language support

**Agents:**
- **Professor**: Main language tutor for structured lessons
- **ChatBuddy**: Conversation partner for practice
- **GrammarGuru**: Grammar expert with detailed explanations
- **SpeechCoach**: Pronunciation and speaking coach

**Custom Tools:**
- `vocabulary_quiz`: Generate practice quizzes
- `phonetic_guide`: Pronunciation assistance
- `track_progress`: Learning progress monitoring

**Try it:**
```bash
npm run example:language

# Example interactions:
"I want to learn Spanish for beginners"
"/agent ChatBuddy"
"Let's have a conversation about food in Italian"
"/agent GrammarGuru"
"Explain the past tense in French"
```

---

### 3. 🏥 Medical Tutor (`medical-tutor.ts`)

A sophisticated medical education platform with expert clinical instructors.

**Features:**
- Evidence-based medical education
- Case-based learning scenarios
- Diagnostic reasoning training
- Pharmacology and anatomy education
- Exam preparation with practice questions

**Agents:**
- **DrMedTeach**: Clinical instructor for case studies
- **AnatomyPro**: Detailed anatomy expert
- **PharmGuide**: Pharmacology specialist
- **DiagnosticDoc**: Diagnostic reasoning expert
- **ExamMentor**: Exam preparation mentor

**Custom Tools:**
- `differential_diagnosis`: Generate differential diagnoses
- `drug_interactions`: Check drug interactions
- `lab_interpretation`: Interpret laboratory values
- `study_plan`: Generate personalized study plans

**Safety Features:**
- Lower temperature for medical accuracy
- Educational disclaimers
- Evidence-based information

**Try it:**
```bash
npm run example:medical

# Example interactions:
"Create a cardiology case study for a 3rd year student"
"/agent AnatomyPro"
"Explain the anatomy of the heart with clinical correlations"
"/agent PharmGuide"
"Tell me about metformin pharmacology"
```

---

### 4. 💼 Business Meeting (`business-meeting.ts`)

A multi-agent business collaboration system simulating executive team meetings.

**Features:**
- Executive team simulation
- Business strategy development
- Market research and analysis
- Technical feasibility assessment
- Project planning and financial analysis

**Agents:**
- **CEO**: Strategic leadership and vision
- **MarketingLead**: Marketing strategy and branding
- **TechLead**: Technical architecture and feasibility
- **SalesChief**: Sales strategy and customer focus
- **ResearchPro**: Market research and competitive analysis
- **ProjectManager**: Project planning and coordination
- **FinanceAdvisor**: Financial analysis and ROI

**Business Tools:**
- `competitor_analysis`: Analyze market competitors
- `market_sizing`: Calculate TAM/SAM/SOM
- `budget_calculator`: Project cost and ROI calculations
- `risk_assessment`: Business and project risk analysis
- `swot_analysis`: Strategic SWOT analysis

**Use Cases:**
- Product launch planning
- Market entry strategies
- Technical project assessment
- Business opportunity evaluation
- Strategic decision making

**Try it:**
```bash
npm run example:business

# Example scenarios:
"We want to launch a new mobile app for food delivery"
"/agent ResearchPro"
"Analyze the market for AI-powered customer service tools"
"/agent TechLead"
"Assess technical feasibility of blockchain integration"
"/agent MarketingLead"
"Create a marketing strategy for our SaaS product launch"
```

## 🛠️ Technical Features Demonstrated

### Agent Specialization
- **Custom Personalities**: Each agent has specialized knowledge and communication style
- **Temperature Control**: Different creativity levels for different roles
- **Prompt Templates**: Structured prompts for consistent, high-quality responses

### Advanced Tooling
- **Custom Tools**: Domain-specific functions for each application
- **Parameter Validation**: Type-safe tool parameters
- **Async Handlers**: Non-blocking tool execution

### Interface Customization
- **Colored CLI**: Role-specific color schemes
- **Custom Prompts**: Application-specific CLI prompts
- **Agent Switching**: Seamless switching between specialized agents

### Memory Management
- **Context Awareness**: Agents maintain conversation context
- **Session Management**: Persistent conversation sessions
- **Smart Truncation**: Automatic context window management

## 🎨 Customization Examples

### Creating Custom Agents

```typescript
// Specialist agent with custom tools
const dataScientist = new Agent({
  name: 'DataScientist',
  personality: 'A data analysis expert who explains complex statistics simply',
  temperature: 0.4, // Lower for precision
  maxTokens: 3500
});

// Add domain-specific tools
dataScientist.addTool({
  name: 'statistical_analysis',
  description: 'Perform statistical analysis on datasets',
  parameters: { /* ... */ },
  handler: async (params) => { /* analysis logic */ }
});
```

### Custom Prompt Templates

```typescript
const analysisTemplate: PromptTemplate = {
  name: 'data_analysis',
  template: `Analyze the dataset: {{dataset_name}}
  
Variables: {{variables}}
Sample size: {{sample_size}}
Analysis type: {{analysis_type}}

Provide:
1. Descriptive statistics
2. Key findings
3. Visualizations recommended
4. Statistical significance
5. Business implications`,
  variables: ['dataset_name', 'variables', 'sample_size', 'analysis_type']
};

agent.setPromptTemplate('data_analysis', analysisTemplate);
```

### Integration with MCP

```typescript
// Connect to external data sources
await app.enableMCP([
  {
    name: 'database',
    type: 'stdio',
    command: 'mcp-server-postgres',
    env: { DATABASE_URL: process.env.DATABASE_URL }
  },
  {
    name: 'files',
    type: 'stdio', 
    command: 'mcp-server-filesystem',
    args: ['/data/directory']
  }
]);
```

## 🧪 Environment Setup

### Required Environment Variables

```bash
# LLM Provider (choose one or more)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key

# Optional: Default settings
SMALLTALK_DEFAULT_PROVIDER=openai
SMALLTALK_DEFAULT_MODEL=gpt-4o
SMALLTALK_DEBUG=true
```

### Development Mode

```bash
# Watch mode for development
npm run dev

# Type checking
npm run lint

# Build for production
npm run build
```

## 🔧 Extending Examples

### Adding New Agents

1. Create agent with specialized personality
2. Define custom prompt templates
3. Add domain-specific tools
4. Integrate with existing framework

### Creating New Examples

1. Copy an existing example as a template
2. Modify agents and personalities for your domain
3. Add custom tools and templates
4. Update CLI interface for your use case
5. Add npm script to package.json

### Integration Patterns

- **Multi-modal**: Add vision, audio, or file processing
- **External APIs**: Integrate with REST APIs, databases, or web services
- **Real-time**: Add WebSocket or streaming capabilities
- **Persistence**: Add database storage for conversations and learning

## 📖 Next Steps

1. **Run the examples** to see SmallTalk in action
2. **Modify agents** to fit your specific use cases
3. **Add custom tools** for your domain expertise
4. **Integrate MCP servers** for external capabilities
5. **Build your own applications** using SmallTalk as a foundation

Each example demonstrates different aspects of the SmallTalk framework, from basic agent management to sophisticated multi-agent collaboration systems. Use them as starting points for building your own LLM-powered applications!

---

**Need help?** Check out the main [README](../README.md) or [documentation](../docs/) for more details about the SmallTalk framework.