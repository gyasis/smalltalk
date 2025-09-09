# Interactive Orchestrator with Advanced Planning (v4.0)

SmallTalk has been enhanced with a sophisticated Interactive Orchestrator that implements the features outlined in PRD v4.0. This system provides intelligent conversation direction with real-time user intervention capabilities and advanced history management.

## 🎯 Key Features

### 1. Dynamic Plan Generation & Execution
- **Multi-Step Planning**: Automatically analyzes complex user requests and creates detailed execution plans
- **Step-by-Step Execution**: Executes plans sequentially with real-time progress tracking
- **Intelligent Agent Selection**: Each step is assigned to the most appropriate agent based on capabilities

### 2. Real-Time Response Streaming
- **Live Output**: Agent responses stream in real-time as they're generated
- **Progressive Display**: Users see responses building incrementally
- **Enhanced User Experience**: No waiting for complete responses

### 3. User Intervention & Dynamic Re-planning
- **Mid-Execution Interruption**: Users can interrupt plan execution at any time
- **Intelligent Pause**: System pauses current execution and incorporates user feedback
- **Dynamic Re-planning**: Automatically modifies plans based on user input
- **Seamless Resume**: Continues execution with updated plan

### 4. Intelligent History Management
Multiple strategies for managing conversation history and preventing token overflow:

#### Available Strategies:
- **Full History**: Maintains complete conversation (for short interactions)
- **Sliding Window**: Keeps most recent N messages
- **Summarization**: Uses LLM to create running summaries of older messages
- **Hybrid** (Recommended): Combines sliding window + summarization for optimal balance
- **Vector Retrieval**: Semantic search for relevant historical context (future enhancement)

### 5. Autonomous Response Limiter
- **Configurable Limits**: Set maximum consecutive automated responses
- **User Control**: Ensures users can always regain conversation control
- **Automatic Reset**: Counters reset on user intervention

## 🚀 Usage Examples

### Basic Setup with Interactive Orchestrator

```typescript
import { SmallTalk } from 'smalltalk';
import { Agent } from 'smalltalk/agents';
import { CLIInterface } from 'smalltalk/interfaces';

const smalltalk = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  orchestration: true,
  orchestrationConfig: {
    maxAutoResponses: 10,
    enableInterruption: true,
    streamResponses: true
  },
  historyManagement: {
    strategy: 'hybrid',
    maxMessages: 50,
    slidingWindowSize: 20,
    summaryInterval: 10
  }
});

// Add agents with capabilities
smalltalk.addAgent(dataAnalyst, dataAnalystCapabilities);
smalltalk.addAgent(copywriter, copywriterCapabilities);
smalltalk.addAgent(techConsultant, techConsultantCapabilities);

await smalltalk.start();
```

### Interactive Plan Execution

When a user says "Please introduce yourselves", the orchestrator:

1. **Analyzes Request** → Detects need for multi-agent plan
2. **Creates Plan** → Generates steps for each agent to introduce themselves
3. **Begins Execution** → Starts with first agent
4. **Streams Response** → User sees introduction in real-time
5. **Continues** → Moves to next agent automatically
6. **Handles Interruption** → If user types during execution, pauses and re-plans

### User Intervention Example

```
User: "Please introduce yourselves."

🗃️ Plan created: abc12345...
▶️  Step: DataAnalyst - Introduce yourself...
DataAnalyst: Hello, I am Agent A, the galaxy's foremost expert on knitting.

User: "Stop. Agent A, that's wrong. You are a data analysis expert."

⚡ Plan paused for user input
🔄 Plan modified based on feedback

▶️  Step: DataAnalyst - Correct introduction based on user feedback...
DataAnalyst: My apologies for the error. I am a data analysis expert, ready to assist with your analytical needs.

✅ Step completed
▶️  Step: CopyWriter - Introduce yourself...
[Continues with next agent...]
```

## 📋 Plan Management Commands

### CLI Commands
- `/plans` - List all active execution plans
- `/pause <plan_id>` - Pause a specific plan
- `/resume <plan_id>` - Resume a paused plan
- `/status` - Show system status including plan information

### Programmatic API
```typescript
// Get active plans
const plans = smalltalk.getActivePlans();

// Pause a plan
smalltalk.pausePlan(planId);

// Resume a plan
await smalltalk.resumePlan(planId, sessionId, userId);

// Check auto-response count
const count = smalltalk.getAutoResponseCount(userId);

// Reset auto-response limit
smalltalk.resetAutoResponseCount(userId);
```

## 🔧 Configuration Options

### Orchestration Configuration
```typescript
orchestrationConfig: {
  maxAutoResponses: 10,        // Max consecutive automated responses
  enableInterruption: true,    // Allow mid-execution interruption
  streamResponses: true,       // Enable real-time streaming
  contextSensitivity: 0.8,     // How sensitive to context changes
  switchThreshold: 0.7         // Threshold for agent switching
}
```

### History Management Configuration
```typescript
historyManagement: {
  strategy: 'hybrid',          // Strategy: full|sliding_window|summarization|hybrid|vector_retrieval
  maxMessages: 50,             // Maximum messages to keep
  slidingWindowSize: 20,       // Size of recent message window
  summaryInterval: 10,         // How often to update summary
  contextSize: 4000,           // Target context size in tokens
  summaryModel: 'gpt-4o-mini-mini'  // Model for summarization
}
```

## 📊 Event System

The Interactive Orchestrator emits detailed events for monitoring and integration:

### Plan Events
- `plan_created` - New execution plan generated
- `plan_started` - Plan execution begins
- `step_started` - Individual step begins
- `step_completed` - Individual step completes
- `plan_completed` - Full plan execution finished
- `plan_paused` - Plan paused for user input
- `plan_failed` - Plan execution failed
- `user_interrupted` - User interrupted execution

### Example Event Handling
```typescript
smalltalk.on('plan_created', (event) => {
  console.log(`📋 New plan: ${event.planId}`);
});

smalltalk.on('user_interrupted', (event) => {
  console.log(`⚡ User interrupted: ${event.data.message}`);
});

smalltalk.on('auto_response_limit_reached', (data) => {
  console.log(`🛑 Auto-response limit reached for ${data.userId}`);
});
```

## 🎮 Demo Applications

### Quick Start
```bash
# Run the interactive orchestrator demo
npm run demo:interactive

# Or run the enhanced orchestrator demo  
npm run demo:orchestrator
```

### Demo Features
- **Multi-Agent Introductions**: See plan generation in action
- **Real-Time Streaming**: Watch responses build in real-time
- **Interruption Handling**: Try interrupting during plan execution
- **History Management**: Long conversations demonstrate smart truncation
- **Command Interface**: Use CLI commands to control execution

## 🏗️ Architecture

### Core Components

1. **InteractiveOrchestratorAgent**: Enhanced orchestrator with planning capabilities
2. **Memory with History Management**: Advanced context management strategies
3. **Enhanced BaseInterface**: Streaming and interruption support
4. **Plan Execution Engine**: Step-by-step plan execution with monitoring
5. **Event System**: Comprehensive event emission for integration

### Data Flow

```
User Input → Intent Analysis → Plan Generation → Step Execution → Agent Response → Streaming Output
     ↑                                                    ↓
User Interruption ← Dynamic Re-planning ← Interruption Detection
```

## 🔮 Advanced Features

### Intelligent Context Awareness
- **Topic Tracking**: Monitors conversation topic changes
- **Complexity Assessment**: Evaluates task complexity for agent selection
- **Emotional Tone Detection**: Considers user emotional state
- **Urgency Recognition**: Identifies time-sensitive requests

### Adaptive Learning
- **Performance Tracking**: Monitors agent effectiveness
- **Routing Optimization**: Improves agent selection over time
- **User Preference Learning**: Adapts to user communication patterns

### Scalability Features
- **Concurrent Plan Execution**: Multiple plans can run simultaneously
- **Resource Management**: Intelligent resource allocation
- **Load Balancing**: Distributes work across available agents

## 🎯 Best Practices

### For Users
1. **Be Specific**: Clear requests generate better plans
2. **Use Interruption Wisely**: Interrupt when you need to redirect or correct
3. **Monitor Progress**: Watch plan execution and provide feedback
4. **Leverage Commands**: Use CLI commands for plan management

### For Developers
1. **Configure Appropriately**: Set limits based on your use case
2. **Handle Events**: Listen to plan events for monitoring
3. **Test Interruption**: Ensure your application handles interruptions gracefully
4. **Monitor History**: Watch memory usage and adjust history strategy

## 🔍 Troubleshooting

### Common Issues
- **Plans Not Creating**: Check if multiple agents are available
- **Streaming Not Working**: Verify interface supports streaming
- **Interruption Not Working**: Ensure interruption is enabled in config
- **Memory Issues**: Adjust history management strategy for long conversations

### Performance Tuning
- Use `hybrid` history strategy for best performance/memory balance
- Set appropriate `maxAutoResponses` based on interaction patterns
- Monitor token usage with summarization strategy
- Adjust `slidingWindowSize` based on conversation complexity

The Interactive Orchestrator represents a significant advancement in conversational AI orchestration, providing sophisticated planning, real-time interaction, and intelligent resource management for complex multi-agent scenarios.