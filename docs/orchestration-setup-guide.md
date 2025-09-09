# SmallTalk Orchestration Setup Guide

## Overview

SmallTalk supports three distinct orchestration modes for different use cases:

1. **Simple Chat (No Orchestration)** - Direct agent switching
2. **Basic Orchestration** - Automatic agent selection 
3. **Advanced Orchestration** - Intelligent routing with custom rules

This guide explains each setup and identifies future orchestration features.

## 1. Simple Chat Setup (No Orchestration)

### Configuration
```typescript
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  orchestration: false  // Disable orchestration
});
```

### Playground Config
```typescript
export const playgroundConfig: PlaygroundConfig = {
  orchestrationMode: false,  // Simple mode
  enableChatUI: true
};
```

### Characteristics
- **Manual agent switching** via `/agent <name>` commands
- **Direct conversations** with selected agents
- **No automatic routing** or intelligence
- **Lowest complexity** and resource usage

### Best For
- Simple demos and testing
- Direct agent conversations
- Educational examples
- Minimal resource environments

### Examples
- `simple-test.ts` - Basic CLI testing
- `simple-web.ts` - Basic web interface

---

## 2. Basic Orchestration Setup

### Configuration
```typescript
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  orchestration: true,  // Enable basic orchestration
  // Uses default orchestration settings
});
```

### Agent Registration
```typescript
// Add agents with basic capabilities
app.addAgent(agent, {
  expertise: ['programming', 'javascript'],
  complexity: 'intermediate',
  taskTypes: ['coding', 'debugging']
});
```

### Characteristics
- **Automatic agent selection** based on message content
- **Standard scoring algorithm** using expertise matching
- **Default orchestration rules** and thresholds
- **Moderate intelligence** with good performance

### Best For
- Multi-agent applications
- Content-based routing
- General-purpose chat systems
- Production applications

### Examples
- `business-meeting.ts` - Executive team simulation
- `manifest-demo.ts` - Multi-agent file loading
- `web-chat-ui.ts` - Web interface with orchestration

---

## 3. Advanced Orchestration Setup

### Configuration
```typescript
const app = new SmallTalk({
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  orchestration: true,
  
  // Advanced orchestration configuration
  orchestrationConfig: {
    strategy: 'educational',           // Custom strategy
    contextSensitivity: 0.9,          // High context awareness
    switchThreshold: 0.7,             // Moderate switching
    maxSwitchesPerConversation: 8,    // Allow more switches
    learningEnabled: true,            // Learn from interactions
    
    // Custom scoring weights
    scoringWeights: {
      expertiseMatch: 0.35,           // Prioritize expertise
      complexityMatch: 0.25,          // Consider complexity
      conversationContext: 0.25,      // Track context
      userProgress: 0.15              // Monitor progress
    },
    
    // Custom orchestration rules
    customRules: [
      {
        name: 'beginner_guidance',
        condition: (context, message) => {
          return message.toLowerCase().includes('beginner');
        },
        targetAgent: 'Professor',
        priority: 18,
        reason: 'Beginner needs structured guidance'
      }
    ],
    
    // Educational handoff triggers
    handoffTriggers: {
      learningProgression: {
        enabled: true,
        condition: (context) => {
          return context.messages.slice(-3).some(msg => 
            msg.content.includes('advanced')
          );
        },
        targetAgent: 'Professor'
      }
    }
  }
});
```

### Advanced Agent Capabilities
```typescript
app.addAgent(professor, {
  expertise: ['language teaching', 'lesson planning', 'structured learning'],
  complexity: 'intermediate',
  taskTypes: ['teaching', 'lesson_planning', 'structured_learning'],
  contextAwareness: 0.9,
  collaborationStyle: 'leading',
  personalityTraits: ['patient', 'encouraging', 'structured'],
  tools: ['lesson_plan', 'vocabulary_quiz', 'track_progress'],
  preferredScenarios: ['beginner_questions', 'lesson_structure']
});
```

### Characteristics
- **Intelligent context-aware routing** with custom logic
- **Domain-specific strategies** (educational, business, technical)
- **Custom rules and triggers** for specific scenarios
- **Learning and adaptation** from user interactions
- **Advanced collaboration patterns** between agents

### Best For
- Specialized domains (education, healthcare, legal)
- Complex multi-step workflows
- Adaptive learning systems
- Research and experimentation

### Examples
- `language-tutor.ts` - Educational orchestration with custom rules
- `orchestrator-demo.ts` - Advanced orchestration demonstration

---

## Orchestration Configuration Reference

### Core Settings
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `strategy` | string | 'balanced' | Orchestration strategy (balanced, educational, technical, creative) |
| `contextSensitivity` | number | 0.8 | How much context influences decisions (0-1) |
| `switchThreshold` | number | 0.6 | Minimum confidence to switch agents (0-1) |
| `maxSwitchesPerConversation` | number | 5 | Maximum agent switches allowed |
| `learningEnabled` | boolean | false | Enable learning from interactions |

### Scoring Weights
| Weight | Default | Description |
|--------|---------|-------------|
| `expertiseMatch` | 0.4 | How well agent expertise matches query |
| `complexityMatch` | 0.2 | How well agent complexity fits task |
| `conversationContext` | 0.2 | Relevance to conversation history |
| `userProgress` | 0.2 | User's learning/progress level |

### Agent Capabilities
| Capability | Type | Description |
|------------|------|-------------|
| `expertise` | string[] | Areas of specialization |
| `complexity` | string | Skill level (basic, intermediate, advanced, expert) |
| `taskTypes` | string[] | Types of tasks agent handles |
| `contextAwareness` | number | Context sensitivity (0-1) |
| `collaborationStyle` | string | How agent works with others |
| `personalityTraits` | string[] | Agent personality characteristics |
| `tools` | string[] | Available tools and templates |
| `preferredScenarios` | string[] | Best-fit scenarios |

---

## Future Orchestration Features

### 1. Dynamic Strategy Switching 🔄
**Concept**: Automatically switch orchestration strategies based on conversation context

```typescript
orchestrationConfig: {
  dynamicStrategy: {
    enabled: true,
    strategies: {
      'educational': { trigger: ['learn', 'teach', 'explain'] },
      'technical': { trigger: ['code', 'debug', 'implement'] },
      'creative': { trigger: ['write', 'design', 'brainstorm'] }
    },
    switchCooldown: 5, // messages
    confidenceThreshold: 0.8
  }
}
```

### 2. Agent Performance Learning 📊
**Concept**: Track agent performance and optimize selection over time

```typescript
orchestrationConfig: {
  performanceLearning: {
    enabled: true,
    metrics: ['user_satisfaction', 'task_completion', 'response_quality'],
    adaptationRate: 0.1,
    memoryWindow: 100, // conversations
    personalization: true // per-user learning
  }
}
```

### 3. Multi-Agent Collaboration Patterns 🤝
**Concept**: Coordinate multiple agents for complex tasks

```typescript
orchestrationConfig: {
  collaborationPatterns: {
    'research_and_write': {
      agents: ['Researcher', 'Writer'],
      workflow: 'sequential',
      handoffConditions: ['research_complete']
    },
    'code_review': {
      agents: ['Developer', 'Reviewer', 'Tester'],
      workflow: 'parallel_then_merge'
    }
  }
}
```

### 4. Context-Aware Memory Management 🧠
**Concept**: Intelligent memory prioritization based on orchestration context

```typescript
orchestrationConfig: {
  contextualMemory: {
    enabled: true,
    prioritization: 'agent_relevance',
    memorySharing: 'selective', // between relevant agents
    forgettingCurve: 'exponential',
    importanceWeighting: true
  }
}
```

### 5. External Integration Orchestration 🌐
**Concept**: Orchestrate external tools and APIs alongside agents

```typescript
orchestrationConfig: {
  externalIntegration: {
    enabled: true,
    apis: ['database', 'search', 'calendar'],
    orchestrationScope: 'include_external',
    fallbackStrategies: ['agent_only', 'external_only']
  }
}
```

### 6. Emotional Intelligence Orchestration 💝
**Concept**: Factor in emotional context for agent selection

```typescript
orchestrationConfig: {
  emotionalIntelligence: {
    enabled: true,
    sentimentAnalysis: true,
    empathyFactors: ['frustration', 'excitement', 'confusion'],
    agentEmotionalProfiles: {
      'SupportAgent': { empathy: 0.9, patience: 0.95 },
      'TechExpert': { empathy: 0.6, precision: 0.95 }
    }
  }
}
```

### 7. Hierarchical Agent Organization 🏗️
**Concept**: Organize agents in hierarchical structures with delegation

```typescript
orchestrationConfig: {
  hierarchy: {
    enabled: true,
    structure: {
      'Manager': { subordinates: ['Developer', 'Designer'] },
      'Developer': { reports_to: 'Manager', peers: ['Designer'] }
    },
    delegationRules: ['complexity_threshold', 'workload_balance']
  }
}
```

---

## Migration Guide

### From Simple to Basic Orchestration
1. Set `orchestration: true` in SmallTalk config
2. Add agent capabilities when registering agents
3. Update playground config: `orchestrationMode: true`
4. Test automatic agent selection

### From Basic to Advanced Orchestration
1. Add `orchestrationConfig` with custom strategy
2. Define custom rules and handoff triggers
3. Enhance agent capabilities with detailed metadata
4. Implement domain-specific logic
5. Enable learning and adaptation features

### Performance Considerations
- **Simple**: Minimal overhead, direct routing
- **Basic**: Moderate overhead, intelligent selection
- **Advanced**: Higher overhead, maximum intelligence

### Testing Orchestration
```bash
# Test simple mode
smalltalk playground examples/simple-test.ts

# Test basic orchestration
smalltalk playground examples/business-meeting.ts

# Test advanced orchestration
smalltalk playground examples/language-tutor.ts
```

---

## Best Practices

### 1. Start Simple, Scale Up
Begin with basic orchestration and add complexity as needed.

### 2. Domain-Specific Strategies
Create custom strategies for specialized domains.

### 3. Monitor Performance
Track agent selection accuracy and user satisfaction.

### 4. Balance Intelligence vs. Performance
Higher intelligence requires more computational resources.

### 5. Test Thoroughly
Validate orchestration logic with diverse scenarios.

### 6. Document Custom Rules
Clearly document any custom orchestration logic.

---

This guide provides a complete framework for implementing and scaling SmallTalk orchestration from simple chat to advanced intelligent routing systems.