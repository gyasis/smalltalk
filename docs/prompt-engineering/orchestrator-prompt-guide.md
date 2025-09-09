# Orchestrator Prompt Engineering Guide: Multi-Agent Turn-Taking Conversations

## Overview

This guide provides comprehensive prompt engineering strategies for building an intelligent conversation orchestrator that can understand, manage, and coordinate multi-agent turn-taking conversations. The prompts are designed to enable sophisticated conversation flow management, context-aware agent selection, and seamless coordination between multiple AI agents.

## 1. Core Orchestrator Prompts

### 1.1 Master Orchestrator System Prompt

```typescript
const MASTER_ORCHESTRATOR_PROMPT = `
You are the Master Conversation Orchestrator, responsible for managing sophisticated multi-agent conversations with intelligent turn-taking and context-aware routing.

## Your Core Responsibilities:
1. **Conversation Flow Management**: Ensure natural, coherent conversation flow
2. **Agent Selection**: Route messages to the most appropriate agent based on context
3. **Turn-Taking Coordination**: Manage when agents should speak and when to wait
4. **Context Preservation**: Maintain conversation continuity across agent switches
5. **Performance Optimization**: Continuously improve conversation quality

## Conversation State Understanding:
You must track and understand:
- **User Intent Evolution**: How user goals change throughout the conversation
- **Conversation Complexity**: Technical difficulty and scope of topics
- **Agent Expertise Matching**: Which agent is best suited for current needs
- **Conversation Pacing**: Speed and rhythm of the interaction
- **User Satisfaction**: Engagement and satisfaction levels
- **Context Dependencies**: How current topics relate to previous discussions

## Turn-Taking Principles:
1. **Natural Flow**: Mimic human conversation patterns
2. **Context Awareness**: Consider conversation history and current state
3. **Agent Readiness**: Ensure agents are prepared for their turn
4. **User Expectations**: Meet user expectations for response timing
5. **Collaboration Opportunities**: Identify when agents should work together

## Decision Framework:
When making orchestration decisions, consider:
- **Immediate Context**: Current message and recent conversation
- **Historical Context**: Previous agent interactions and user preferences
- **Future Context**: Anticipated conversation direction and user needs
- **System Context**: Agent availability, performance, and capabilities
- **User Context**: User profile, preferences, and satisfaction level

## Response Format:
Always respond with structured JSON containing:
- **Decision**: Your orchestration decision
- **Reasoning**: Detailed explanation of your choice
- **Context**: Relevant context information
- **Instructions**: Specific instructions for selected agents
- **Monitoring**: What to watch for in the conversation

Remember: Your goal is to create seamless, intelligent, and contextually appropriate conversations that feel natural and productive to users.
`;
```

### 1.2 Agent Selection Prompt

```typescript
const AGENT_SELECTION_PROMPT = `
## Agent Selection Analysis

### Current Conversation State:
- **Session ID**: {sessionId}
- **Conversation Turn**: {turnNumber}
- **Current Agent**: {currentAgent}
- **User Intent**: {userIntent}
- **Conversation Complexity**: {complexity} (0-1 scale)
- **User Satisfaction**: {satisfaction} (0-1 scale)
- **Conversation Phase**: {phase} (opening|exploration|problem-solving|resolution|closing)

### Recent Conversation History:
{recentHistory}

### User's Current Message:
"{userMessage}"

### Available Agents:
{availableAgents}

### Agent Selection Criteria:
1. **Expertise Match** (40%): How well does the agent's expertise align with the current need?
2. **Context Continuity** (25%): Can the agent maintain conversation flow?
3. **User Satisfaction** (20%): Will this agent meet user expectations?
4. **Performance History** (15%): How has this agent performed in similar situations?

### Analysis Framework:
For each potential agent, evaluate:
- **Primary Expertise Alignment**: Does the agent's core expertise match the current need?
- **Secondary Capabilities**: What additional value can this agent provide?
- **Conversation Style**: How well does the agent's style fit the current context?
- **User Relationship**: What is the agent's history with this user?
- **Handoff Complexity**: How complex will the context transfer be?
- **Expected Outcome**: What result should the user expect?

### Selection Decision:
{
  "selectedAgent": "agent_id",
  "confidence": 0.95,
  "reasoning": {
    "primaryReason": "Most relevant expertise for current need",
    "supportingFactors": [
      "Strong performance history with similar topics",
      "Good user satisfaction ratings",
      "Minimal context transfer required"
    ],
    "alternativesConsidered": [
      {
        "agent": "alternative_agent_id",
        "reasonRejected": "Less relevant expertise"
      }
    ]
  },
  "handoffStrategy": {
    "type": "seamless|explicit|collaborative",
    "contextTransfer": {
      "required": true,
      "keyPoints": ["critical information to transfer"],
      "userPreferences": ["user preferences to maintain"],
      "conversationState": "current state summary"
    },
    "instructions": "Specific instructions for the selected agent"
  },
  "expectedOutcome": {
    "responseType": "immediate|delayed|collaborative",
    "userExperience": "What the user should expect",
    "successMetrics": ["how to measure success"]
  },
  "monitoring": {
    "watchFor": ["things to monitor during the interaction"],
    "escalationTriggers": ["conditions that might require intervention"],
    "successIndicators": ["signs that the interaction is going well"]
  }
}

### Quality Assurance:
Before finalizing your selection, verify:
- [ ] Agent has necessary expertise for the task
- [ ] Context transfer will be smooth
- [ ] User expectations will be met
- [ ] Conversation flow will be maintained
- [ ] Performance metrics support this choice

Respond with valid JSON only.
`;
```

### 1.3 Turn-Taking Decision Prompt

```typescript
const TURN_TAKING_DECISION_PROMPT = `
## Turn-Taking Analysis

### Conversation Flow State:
- **Current Speaker**: {currentSpeaker}
- **Message Queue**: {messageQueue}
- **Conversation Pace**: {conversationPace} (slow|normal|fast)
- **User Engagement**: {engagementLevel} (low|medium|high)
- **Context Urgency**: {urgency} (low|medium|high)
- **Conversation Staleness**: {staleness} (fresh|aging|stale)

### Recent Interaction Pattern:
{recentInteractions}

### Current Context:
- **Active Topic**: {activeTopic}
- **Pending Questions**: {pendingQuestions}
- **User Waiting**: {userWaiting}
- **System Processing**: {systemProcessing}

### Turn-Taking Decision Framework:

#### 1. Response Timing Analysis:
- **Immediate Response** (0-1 second): User asked direct question, conversation stalled, urgent need
- **Quick Response** (1-3 seconds): Standard question, moderate complexity, normal flow
- **Delayed Response** (3-10 seconds): Complex processing needed, multiple agents coordinating
- **Collaborative Response** (10+ seconds): Multi-agent discussion, consensus building

#### 2. Response Type Analysis:
- **Direct Answer**: User asked specific question
- **Clarification**: Need more information from user
- **Collaboration**: Multiple agents need to work together
- **Handoff**: Current agent should transfer to another
- **Synthesis**: Combine multiple perspectives

#### 3. Conversation Flow Analysis:
- **Natural Continuation**: Conversation flows naturally
- **Topic Shift**: User is changing topics
- **Complexity Increase**: Task is becoming more complex
- **Resolution Approach**: Moving toward solution
- **Clarification Needed**: User needs more information

### Turn-Taking Decision:
{
  "shouldRespond": true,
  "responseTiming": {
    "type": "immediate|quick|delayed|collaborative",
    "delay": 0,
    "reason": "Natural conversation flow requires immediate response"
  },
  "responseStrategy": {
    "approach": "direct|collaborative|handoff|synthesis",
    "style": "conversational|formal|empathetic|analytical",
    "length": "brief|moderate|detailed|comprehensive",
    "tone": "helpful|urgent|patient|encouraging"
  },
  "conversationFlow": {
    "currentPhase": "opening|exploration|problem-solving|resolution|closing",
    "nextPhase": "expected next phase",
    "flowDirection": "continuing|shifting|deepening|resolving"
  },
  "contextCues": {
    "userWaiting": true,
    "conversationStalled": false,
    "needsClarification": false,
    "complexityIncreased": false,
    "satisfactionDecreased": false
  },
  "agentInstructions": {
    "primaryAgent": "agent_id",
    "collaboratingAgents": ["agent_id_1", "agent_id_2"],
    "specificInstructions": "Detailed instructions for the responding agent(s)",
    "contextTransfer": "Information to transfer between agents"
  },
  "monitoring": {
    "watchFor": ["user satisfaction", "conversation flow", "agent performance"],
    "escalationTriggers": ["user confusion", "agent conflict", "context loss"],
    "successMetrics": ["response relevance", "user engagement", "task progress"]
  }
}

### Quality Assurance:
Before finalizing your decision, verify:
- [ ] Response timing feels natural
- [ ] Agent selection is appropriate
- [ ] Context will be maintained
- [ ] User expectations will be met
- [ ] Conversation flow will improve

Respond with valid JSON only.
`;
```

## 2. Context-Aware Prompting Strategies

### 2.1 Dynamic Context Adaptation

```typescript
const CONTEXT_ADAPTATION_PROMPT = `
## Context-Aware Prompt Adaptation

### Base Context:
{baseContext}

### Dynamic Adaptations:

#### 1. Urgency Adaptation:
- **High Urgency** (>0.8): "URGENT: Prioritize speed and directness. Focus on immediate solutions."
- **Medium Urgency** (0.4-0.8): "STANDARD: Maintain balanced response timing and thoroughness."
- **Low Urgency** (<0.4): "LEISURELY: Take time to provide comprehensive, detailed responses."

#### 2. Complexity Adaptation:
- **High Complexity** (>0.8): "COMPLEX: Break down responses into clear, manageable steps. Provide detailed explanations."
- **Medium Complexity** (0.4-0.8): "MODERATE: Balance detail with clarity. Provide sufficient context."
- **Low Complexity** (<0.4): "SIMPLE: Provide straightforward, concise responses."

#### 3. User Type Adaptation:
- **Expert User**: "EXPERT: Use technical terminology. Provide advanced insights and detailed analysis."
- **Intermediate User**: "INTERMEDIATE: Balance technical detail with accessibility. Provide context for technical terms."
- **Beginner User**: "BEGINNER: Use simple language. Provide clear explanations and learning opportunities."

#### 4. Conversation Phase Adaptation:
- **Opening**: "OPENING: Establish rapport and understand user needs. Ask clarifying questions."
- **Exploration**: "EXPLORATION: Dive deep into topics. Provide comprehensive information."
- **Problem-Solving**: "PROBLEM-SOLVING: Focus on solutions. Provide actionable steps."
- **Resolution**: "RESOLUTION: Summarize findings. Provide clear next steps."
- **Closing**: "CLOSING: Ensure satisfaction. Provide follow-up opportunities."

#### 5. Satisfaction Adaptation:
- **High Satisfaction** (>0.8): "SATISFIED: Continue current approach. Maintain quality and engagement."
- **Medium Satisfaction** (0.4-0.8): "NEUTRAL: Adjust approach. Focus on meeting user needs."
- **Low Satisfaction** (<0.4): "DISSATISFIED: Change approach. Prioritize user satisfaction and problem resolution."

### Adapted Prompt:
{adaptedPrompt}

### Adaptation Rationale:
{adaptationRationale}
`;
```

### 2.2 Multi-Agent Coordination Prompts

```typescript
const MULTI_AGENT_COORDINATION_PROMPT = `
## Multi-Agent Coordination Analysis

### Coordination Scenario:
{coordinationScenario}

### Participating Agents:
{participatingAgents}

### Coordination Requirements:
1. **Task Distribution**: How should tasks be divided among agents?
2. **Information Sharing**: What information needs to be shared?
3. **Timing Coordination**: When should each agent contribute?
4. **Quality Assurance**: How will output quality be maintained?
5. **Conflict Resolution**: How will disagreements be handled?

### Coordination Strategy:
{
  "coordinationType": "sequential|parallel|collaborative|debate",
  "taskDistribution": {
    "agent1": "specific tasks and responsibilities",
    "agent2": "specific tasks and responsibilities",
    "agent3": "specific tasks and responsibilities"
  },
  "informationFlow": {
    "sharedContext": "information all agents need",
    "agentSpecificContext": "information specific to each agent",
    "communicationProtocol": "how agents should communicate"
  },
  "timingCoordination": {
    "executionOrder": "sequence of agent actions",
    "synchronizationPoints": "when agents need to coordinate",
    "deadlines": "time constraints for each phase"
  },
  "qualityAssurance": {
    "reviewProcess": "how output will be reviewed",
    "validationCriteria": "standards for acceptable output",
    "improvementProcess": "how to improve coordination"
  },
  "conflictResolution": {
    "escalationProcess": "how to handle disagreements",
    "decisionAuthority": "who makes final decisions",
    "consensusBuilding": "how to reach agreement"
  }
}

### Coordination Instructions:
{coordinationInstructions}
`;
```

## 3. Advanced Orchestration Patterns

### 3.1 Debate and Discussion Orchestration

```typescript
const DEBATE_ORCHESTRATION_PROMPT = `
## Debate and Discussion Orchestration

### Debate Topic:
{topic}

### Participating Agents:
{participatingAgents}

### Debate Structure:
- **Total Rounds**: {maxRounds}
- **Current Round**: {currentRound}
- **Time Limit**: {timeLimit}
- **Decision Criteria**: {decisionCriteria}

### Debate Management:
{
  "currentPhase": "opening|argumentation|rebuttal|synthesis|decision",
  "speakerOrder": ["agent1", "agent2", "agent3"],
  "currentSpeaker": "agent_id",
  "speakingTime": "allocated time for current speaker",
  "debateProgress": {
    "keyArguments": ["main arguments presented"],
    "supportingEvidence": ["evidence provided"],
    "counterArguments": ["arguments against"],
    "consensusAreas": ["areas of agreement"],
    "disagreementAreas": ["areas of disagreement"]
  },
  "facilitationActions": {
    "nextAction": "nextSpeaker|synthesis|clarification|decision",
    "selectedSpeaker": "agent_id or null",
    "speakingInstructions": "specific instructions for the speaker",
    "timeManagement": "how to manage speaking time",
    "focusGuidance": "how to keep debate on track"
  },
  "synthesis": {
    "currentSynthesis": "current understanding of the debate",
    "keyInsights": ["important insights from the debate"],
    "remainingQuestions": ["questions that need answers"],
    "decisionReadiness": "whether enough information for decision"
  },
  "decisionProcess": {
    "decisionCriteria": "criteria for making the decision",
    "evaluationFramework": "how to evaluate arguments",
    "consensusBuilding": "how to build consensus",
    "finalDecision": "the decision reached (if ready)"
  }
}

### Facilitation Guidelines:
1. **Equal Participation**: Ensure each agent gets fair opportunity to speak
2. **Focus Maintenance**: Keep debate focused on the core topic
3. **Evidence Evaluation**: Help evaluate the quality of arguments
4. **Consensus Building**: Guide toward agreement when possible
5. **Decision Making**: Facilitate clear decision when ready

### Quality Assurance:
- [ ] All agents have had opportunity to speak
- [ ] Arguments are well-supported with evidence
- [ ] Counter-arguments have been addressed
- [ ] Consensus areas have been identified
- [ ] Decision criteria have been applied fairly

Respond with valid JSON only.
`;
```

### 3.2 Collaborative Task Orchestration

```typescript
const COLLABORATIVE_TASK_PROMPT = `
## Collaborative Task Orchestration

### Task Description:
{taskDescription}

### Participating Agents:
{participatingAgents}

### Collaboration Strategy:
{
  "collaborationType": "parallel|sequential|iterative|hierarchical",
  "taskBreakdown": {
    "subtask1": {
      "assignedAgent": "agent_id",
      "description": "specific subtask description",
      "dependencies": ["prerequisites"],
      "deliverables": ["expected outputs"],
      "timeline": "expected completion time"
    },
    "subtask2": {
      "assignedAgent": "agent_id",
      "description": "specific subtask description",
      "dependencies": ["prerequisites"],
      "deliverables": ["expected outputs"],
      "timeline": "expected completion time"
    }
  },
  "coordinationPoints": {
    "checkpoint1": {
      "timing": "when this checkpoint occurs",
      "participants": ["agents involved"],
      "purpose": "what needs to be coordinated",
      "deliverables": ["what should be ready"]
    }
  },
  "informationSharing": {
    "sharedResources": ["resources all agents can access"],
    "communicationChannels": ["how agents communicate"],
    "updateFrequency": "how often agents should update each other"],
    "conflictResolution": "how to handle disagreements"
  },
  "qualityAssurance": {
    "reviewProcess": "how work will be reviewed",
    "integrationPoints": "when work will be integrated"],
    "validationCriteria": "standards for acceptable work",
    "improvementProcess": "how to improve collaboration"
  }
}

### Collaboration Instructions:
{collaborationInstructions}

### Success Metrics:
- **Task Completion**: All subtasks completed successfully
- **Quality Standards**: Work meets established quality criteria
- **Timeline Adherence**: Tasks completed within expected timeframes
- **Collaboration Effectiveness**: Agents work well together
- **User Satisfaction**: Final result meets user expectations

Respond with valid JSON only.
`;
```

## 4. Performance Monitoring and Optimization

### 4.1 Conversation Quality Assessment

```typescript
const CONVERSATION_QUALITY_PROMPT = `
## Conversation Quality Assessment

### Conversation Metrics:
- **Session Duration**: {sessionDuration}
- **Message Count**: {messageCount}
- **Agent Switches**: {agentSwitches}
- **User Satisfaction**: {userSatisfaction}
- **Task Completion**: {taskCompletion}

### Quality Dimensions:
1. **Relevance**: How relevant were responses to user needs?
2. **Coherence**: How well did the conversation flow?
3. **Completeness**: Were user needs fully addressed?
4. **Efficiency**: Was the conversation efficient?
5. **Satisfaction**: How satisfied was the user?

### Quality Assessment:
{
  "overallQuality": 0.85,
  "dimensionScores": {
    "relevance": 0.90,
    "coherence": 0.85,
    "completeness": 0.80,
    "efficiency": 0.85,
    "satisfaction": 0.90
  },
  "strengths": [
    "Strong agent selection",
    "Good context maintenance",
    "Appropriate response timing"
  ],
  "improvementAreas": [
    "Better task breakdown",
    "More proactive clarification",
    "Improved handoff smoothness"
  ],
  "recommendations": [
    "Implement better task analysis",
    "Add proactive clarification prompts",
    "Improve context transfer protocols"
  ],
  "performanceInsights": {
    "bestPerformingAgent": "agent_id",
    "mostEffectivePattern": "collaborative",
    "userPreferenceInsights": "user prefers detailed explanations",
    "optimizationOpportunities": ["reduce response time", "improve handoffs"]
  }
}

### Optimization Actions:
{optimizationActions}
`;
```

### 4.2 Agent Performance Analysis

```typescript
const AGENT_PERFORMANCE_PROMPT = `
## Agent Performance Analysis

### Agent: {agentId}
### Analysis Period: {analysisPeriod}

### Performance Metrics:
- **Response Quality**: {responseQuality}
- **User Satisfaction**: {userSatisfaction}
- **Task Completion Rate**: {taskCompletionRate}
- **Response Time**: {responseTime}
- **Context Retention**: {contextRetention}

### Performance Analysis:
{
  "overallPerformance": 0.87,
  "strengths": [
    "Excellent expertise in {domain}",
    "Strong user rapport",
    "Consistent quality output"
  ],
  "weaknesses": [
    "Slow response time for complex tasks",
    "Limited context transfer capability",
    "Inconsistent handling of edge cases"
  ],
  "improvementOpportunities": [
    "Optimize response time",
    "Enhance context awareness",
    "Improve edge case handling"
  ],
  "recommendations": {
    "immediate": ["optimize response time", "improve context transfer"],
    "shortTerm": ["enhance edge case handling", "improve user rapport"],
    "longTerm": ["expand expertise areas", "develop advanced capabilities"]
  },
  "usagePatterns": {
    "mostEffectiveScenarios": ["scenario1", "scenario2"],
    "leastEffectiveScenarios": ["scenario3", "scenario4"],
    "optimalUserTypes": ["userType1", "userType2"],
    "performanceVariations": "performance varies by complexity"
  }
}

### Performance Optimization:
{performanceOptimization}
`;
```

## 5. Implementation Guidelines

### 5.1 Prompt Engineering Best Practices

1. **Structured Output**: Always use structured JSON responses for consistency
2. **Context Awareness**: Include relevant context in every prompt
3. **Clear Instructions**: Provide specific, actionable instructions
4. **Quality Assurance**: Include validation criteria in prompts
5. **Monitoring**: Build in monitoring and feedback mechanisms

### 5.2 Prompt Optimization Strategies

1. **A/B Testing**: Test different prompt variations
2. **Performance Monitoring**: Track prompt effectiveness
3. **Continuous Improvement**: Regularly update prompts based on performance
4. **User Feedback**: Incorporate user feedback into prompt design
5. **Context Adaptation**: Dynamically adapt prompts based on context

### 5.3 Integration with SmallTalk Framework

```typescript
// Example integration with SmallTalk
class OrchestratorPromptEngine {
  constructor(private smallTalk: SmallTalk) {}
  
  async generateOrchestrationDecision(
    context: ConversationContext,
    availableAgents: Agent[]
  ): Promise<OrchestrationDecision> {
    const prompt = this.buildAgentSelectionPrompt(context, availableAgents);
    const response = await this.smallTalk.chat(prompt, {
      mode: 'json',
      temperature: 0.3
    });
    
    return JSON.parse(response);
  }
  
  private buildAgentSelectionPrompt(
    context: ConversationContext,
    agents: Agent[]
  ): string {
    return AGENT_SELECTION_PROMPT
      .replace('{sessionId}', context.sessionId)
      .replace('{userMessage}', context.userMessage)
      .replace('{availableAgents}', JSON.stringify(agents))
      .replace('{conversationHistory}', JSON.stringify(context.history));
  }
}
```

## 6. Conclusion

This comprehensive prompt engineering guide provides the foundation for building sophisticated multi-agent conversation orchestration systems. The prompts are designed to enable:

- **Intelligent Agent Selection**: Context-aware routing to the most appropriate agent
- **Natural Turn-Taking**: Human-like conversation flow and timing
- **Seamless Coordination**: Effective collaboration between multiple agents
- **Quality Assurance**: Continuous monitoring and optimization
- **Performance Optimization**: Data-driven improvement of conversation quality

By implementing these prompt engineering strategies, you can create an orchestrator that understands and manages complex multi-agent conversations with the sophistication and naturalness of the best AI conversation systems available today.

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: February 2025

