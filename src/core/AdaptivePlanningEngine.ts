import { EventEmitter } from 'events';
import { TokenJSWrapper } from '../utils/TokenJSWrapper.js';
import { Agent } from '../agents/Agent.js';
import { ExecutionPlan, ExecutionState, AgentStep, InterruptionPoint } from './InterruptibleExecutor.js';
import { SkillsMatchAnalysis } from './AgentSkillsAnalyzer.js';
import { CollaborationRecommendation } from './CollaborationPatternEngine.js';
import { OptimizedSequence } from './SequencePlanner.js';

export interface PlanAdaptation {
  adaptationType: 'reorder' | 'replace' | 'insert' | 'remove' | 'modify' | 'complete-redesign';
  reason: string;
  confidence: number;
  affectedSteps: string[];
  newSteps?: AgentStep[];
  alternativeAgents?: Agent[];
  estimatedImprovement: number; // percentage
  riskLevel: 'low' | 'medium' | 'high';
  userSatisfactionPrediction: number; // 0-1
}

export interface UserFeedback {
  feedbackType: 'explicit' | 'implicit' | 'interruption' | 'satisfaction' | 'completion';
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  content?: string;
  timestamp: Date;
  planId: string;
  stepId?: string;
  agentName?: string;
  confidence: number;
}

export interface AdaptiveLearning {
  pattern: string;
  frequency: number;
  successRate: number;
  averageUserSatisfaction: number;
  recommendedAction: string;
  confidence: number;
  lastOccurred: Date;
}

export interface PlanOptimizationHistory {
  originalPlan: ExecutionPlan;
  adaptations: PlanAdaptation[];
  userFeedback: UserFeedback[];
  finalSatisfaction: number;
  totalDuration: number;
  interruptionCount: number;
  successMetrics: Record<string, number>;
}

/**
 * AdaptivePlanningEngine - Dynamic plan adaptation based on user feedback
 * 
 * Provides real-time plan adjustments through:
 * - User feedback analysis (explicit and implicit)
 * - Pattern recognition from interaction history
 * - Predictive satisfaction modeling
 * - Dynamic step reordering and agent substitution
 * - Continuous learning from outcomes
 * - Proactive plan optimization
 */
export class AdaptivePlanningEngine extends EventEmitter {
  private llm: TokenJSWrapper;
  private adaptationHistory: Map<string, PlanOptimizationHistory> = new Map();
  private learningPatterns: Map<string, AdaptiveLearning> = new Map();
  private userPreferences: Map<string, Record<string, any>> = new Map();
  private agentPerformanceMetrics: Map<string, {
    successRate: number;
    averageResponseTime: number;
    userSatisfaction: number;
    interruptionRate: number;
  }> = new Map();

  constructor(llmConfig: { provider: string; model: string }) {
    super();
    
    this.llm = new TokenJSWrapper({
      llmProvider: llmConfig.provider,
      model: llmConfig.model,
      temperature: 0.3, // Low temperature for consistent adaptations
      maxTokens: 2500
    });

    console.log('[🔄 AdaptivePlanningEngine] Initialized with dynamic plan adaptation capabilities');
  }

  /**
   * Analyze user feedback and adapt execution plan dynamically
   */
  async adaptPlanBasedOnFeedback(
    currentPlan: ExecutionPlan,
    userFeedback: UserFeedback,
    executionState: ExecutionState,
    availableAgents: Agent[]
  ): Promise<PlanAdaptation> {
    console.log(`[🔄 AdaptivePlanningEngine] 🧠 Analyzing feedback for plan: ${currentPlan.id}`);
    console.log(`[🔄 AdaptivePlanningEngine] 📝 Feedback type: ${userFeedback.feedbackType}, Sentiment: ${userFeedback.sentiment}`);

    const prompt = `
ADAPTIVE PLAN OPTIMIZATION TASK

Analyze user feedback and adapt the execution plan accordingly:

CURRENT PLAN:
- Plan ID: ${currentPlan.id}
- Current Step: ${executionState.currentStep}/${currentPlan.executionSequence.length}
- Agents: ${currentPlan.selectedAgents.map(a => a.name).join(', ')}
- Collaboration Pattern: ${currentPlan.collaborationPattern}
- User Intent: "${currentPlan.userIntent}"

USER FEEDBACK:
- Type: ${userFeedback.feedbackType}
- Sentiment: ${userFeedback.sentiment}
- Content: "${userFeedback.content || 'No explicit content'}"
- Agent: ${userFeedback.agentName || 'N/A'}
- Step: ${userFeedback.stepId || 'N/A'}

EXECUTION STATE:
- Status: ${executionState.status}
- Completed Steps: ${executionState.currentStep || 0}
- Interruptions: ${executionState.interruptionHistory?.length || 0}
- Duration So Far: ${Date.now() - executionState.startTime.getTime()}ms

AVAILABLE AGENTS FOR ADAPTATION:
${availableAgents.map(a => `- ${a.name}`).join('\n')}

HISTORICAL PATTERNS:
${this.getRelevantPatterns(userFeedback.feedbackType).join('\n')}

Provide adaptation recommendation:

ADAPTATION_TYPE: [reorder|replace|insert|remove|modify|complete-redesign]
REASON: [Clear explanation of why this adaptation is needed]
CONFIDENCE: [0-100] - Confidence in this adaptation
AFFECTED_STEPS: [List of step IDs that will be affected]
ESTIMATED_IMPROVEMENT: [0-100] - Expected improvement percentage
RISK_LEVEL: [low|medium|high]
USER_SATISFACTION_PREDICTION: [0-100] - Predicted satisfaction after adaptation

SPECIFIC_CHANGES: [Detailed description of what changes to make]

NEW_AGENT_SEQUENCE: [If agents need to be changed, list the new sequence]

ALTERNATIVE_APPROACH: [If complete redesign, describe the new approach]
`;

    try {
      const response = await this.llm.generateResponse([{ 
        id: 'adaptation-' + Date.now(),
        role: 'user',
        content: prompt,
        timestamp: new Date()
      }]);
      
      const adaptation = this.parseAdaptationResponse(response.content, currentPlan, userFeedback);
      
      // Store feedback for learning
      this.recordUserFeedback(currentPlan.id, userFeedback);
      
      // Update learning patterns
      this.updateLearningPatterns(userFeedback, adaptation);
      
      // Emit adaptation event
      this.emit('plan-adapted', {
        planId: currentPlan.id,
        adaptation,
        userFeedback
      });

      console.log(`[🔄 AdaptivePlanningEngine] ✅ Adaptation recommended: ${adaptation.adaptationType}`);
      console.log(`[🔄 AdaptivePlanningEngine] 📈 Expected improvement: ${adaptation.estimatedImprovement}%`);
      
      return adaptation;
      
    } catch (error) {
      console.error(`[🔄 AdaptivePlanningEngine] ❌ Adaptation analysis failed:`, error);
      return this.createFallbackAdaptation(currentPlan, userFeedback);
    }
  }

  /**
   * Learn from user interaction patterns to predict preferences
   */
  async learnFromInteractionPattern(
    userId: string,
    interactions: Array<{
      request: string;
      selectedAgents: string[];
      collaborationPattern: string;
      userSatisfaction: number;
      interruptionCount: number;
      completionTime: number;
    }>
  ): Promise<Record<string, any>> {
    console.log(`[🔄 AdaptivePlanningEngine] 📚 Learning from ${interactions.length} interactions for user: ${userId}`);

    const prompt = `
USER PREFERENCE LEARNING TASK

Analyze user interaction patterns to identify preferences:

USER ID: ${userId}

INTERACTION HISTORY:
${interactions.map((i, idx) => `
Interaction ${idx + 1}:
- Request: "${i.request}"
- Agents Used: ${i.selectedAgents.join(', ')}
- Pattern: ${i.collaborationPattern}
- Satisfaction: ${i.userSatisfaction}/10
- Interruptions: ${i.interruptionCount}
- Duration: ${i.completionTime}ms
`).join('\n')}

Identify patterns and preferences:

AGENT_PREFERENCES: [List preferred agents and why]
COLLABORATION_STYLE: [Preferred collaboration patterns]
INTERRUPTION_TOLERANCE: [low|medium|high]
SPEED_VS_QUALITY: [speed-focused|balanced|quality-focused]
DETAIL_LEVEL: [concise|moderate|detailed]
INTERACTION_STYLE: [hands-off|moderate|hands-on]

KEY_PATTERNS: [List 3-5 observed patterns]

OPTIMIZATION_RECOMMENDATIONS: [How to optimize future interactions for this user]

CONFIDENCE_LEVEL: [0-100] - Confidence in these learned preferences
`;

    try {
      const response = await this.llm.generateResponse([{
        id: 'learning-' + Date.now(),
        role: 'user',
        content: prompt,
        timestamp: new Date()
      }]);
      
      const preferences = this.parsePreferencesResponse(response.content, userId);
      
      // Store learned preferences
      this.userPreferences.set(userId, preferences);
      
      console.log(`[🔄 AdaptivePlanningEngine] ✅ Learned preferences for user ${userId}`);
      console.log(`[🔄 AdaptivePlanningEngine] 🎯 Key patterns: ${preferences['keyPatterns']?.length || 0}`);
      
      return preferences;
      
    } catch (error) {
      console.error(`[🔄 AdaptivePlanningEngine] ❌ Learning failed:`, error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Predict optimal routing based on historical success patterns
   */
  async predictOptimalRouting(
    userRequest: string,
    userId: string,
    availableAgents: Agent[],
    recentHistory: ExecutionState[]
  ): Promise<{
    recommendedAgents: Agent[];
    predictedPattern: string;
    confidenceScore: number;
    reasoning: string;
    alternativeOptions: Array<{
      agents: Agent[];
      pattern: string;
      confidence: number;
    }>;
  }> {
    console.log(`[🔄 AdaptivePlanningEngine] 🔮 Predicting optimal routing for: "${userRequest.substring(0, 50)}..."`);

    const userPrefs = this.userPreferences.get(userId) || {};
    const patterns = Array.from(this.learningPatterns.values())
      .filter(p => p.successRate > 0.7)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    const prompt = `
PREDICTIVE ROUTING OPTIMIZATION

Predict the optimal agent routing based on patterns and preferences:

USER REQUEST: "${userRequest}"

USER PREFERENCES:
${JSON.stringify(userPrefs, null, 2)}

AVAILABLE AGENTS:
${availableAgents.map(a => `- ${a.name}`).join('\n')}

SUCCESSFUL PATTERNS:
${patterns.map(p => `- ${p.pattern}: ${Math.round(p.successRate * 100)}% success, ${Math.round(p.averageUserSatisfaction * 100)}% satisfaction`).join('\n')}

RECENT PERFORMANCE:
${recentHistory.slice(-3).map(h => `- Status: ${h.status}`).join('\n')}

Provide routing prediction:

RECOMMENDED_AGENTS: [List of agent names in order]
PREDICTED_PATTERN: [sequential|parallel|debate|review|specialist-consultation]
CONFIDENCE_SCORE: [0-100]
REASONING: [Why this routing is optimal based on patterns]

ALTERNATIVE_OPTION_1:
- Agents: [List of agents]
- Pattern: [pattern name]
- Confidence: [0-100]

ALTERNATIVE_OPTION_2:
- Agents: [List of agents]
- Pattern: [pattern name]
- Confidence: [0-100]

RISK_FACTORS: [Potential issues with the recommendation]
`;

    try {
      const response = await this.llm.generateResponse([{
        id: 'prediction-' + Date.now(),
        role: 'user',
        content: prompt,
        timestamp: new Date()
      }]);
      
      return this.parsePredictiveRoutingResponse(response.content, availableAgents);
      
    } catch (error) {
      console.error(`[🔄 AdaptivePlanningEngine] ❌ Prediction failed:`, error);
      return this.createFallbackPrediction(availableAgents);
    }
  }

  /**
   * Update agent performance metrics based on execution outcomes
   */
  updateAgentPerformanceMetrics(
    agentName: string,
    executionMetrics: {
      success: boolean;
      responseTime: number;
      userSatisfaction: number;
      wasInterrupted: boolean;
    }
  ): void {
    const current = this.agentPerformanceMetrics.get(agentName) || {
      successRate: 0.5,
      averageResponseTime: 5000,
      userSatisfaction: 0.5,
      interruptionRate: 0
    };

    // Update with exponential moving average
    const alpha = 0.3; // Learning rate
    current.successRate = current.successRate * (1 - alpha) + (executionMetrics.success ? 1 : 0) * alpha;
    current.averageResponseTime = current.averageResponseTime * (1 - alpha) + executionMetrics.responseTime * alpha;
    current.userSatisfaction = current.userSatisfaction * (1 - alpha) + executionMetrics.userSatisfaction * alpha;
    current.interruptionRate = current.interruptionRate * (1 - alpha) + (executionMetrics.wasInterrupted ? 1 : 0) * alpha;

    this.agentPerformanceMetrics.set(agentName, current);
    
    console.log(`[🔄 AdaptivePlanningEngine] 📊 Updated metrics for ${agentName}:`);
    console.log(`  Success Rate: ${Math.round(current.successRate * 100)}%`);
    console.log(`  Satisfaction: ${Math.round(current.userSatisfaction * 100)}%`);
  }

  /**
   * Get agent performance report
   */
  getAgentPerformanceReport(): Map<string, any> {
    return new Map(this.agentPerformanceMetrics);
  }

  /**
   * Get learning patterns
   */
  getLearningPatterns(): Map<string, AdaptiveLearning> {
    return new Map(this.learningPatterns);
  }

  /**
   * Get user preferences
   */
  getUserPreferences(userId: string): Record<string, any> {
    return this.userPreferences.get(userId) || {};
  }

  // Private helper methods

  private parseAdaptationResponse(response: string, plan: ExecutionPlan, feedback: UserFeedback): PlanAdaptation {
    const adaptationType = this.extractField(response, 'ADAPTATION_TYPE') as PlanAdaptation['adaptationType'] || 'modify';
    const reason = this.extractField(response, 'REASON') || 'User feedback indicates adjustment needed';
    const confidence = this.extractScore(response, 'CONFIDENCE') / 100;
    const affectedSteps = this.extractList(response, 'AFFECTED_STEPS');
    const estimatedImprovement = this.extractScore(response, 'ESTIMATED_IMPROVEMENT');
    const riskLevel = this.extractField(response, 'RISK_LEVEL') as PlanAdaptation['riskLevel'] || 'medium';
    const userSatisfactionPrediction = this.extractScore(response, 'USER_SATISFACTION_PREDICTION') / 100;

    return {
      adaptationType,
      reason,
      confidence,
      affectedSteps,
      estimatedImprovement,
      riskLevel,
      userSatisfactionPrediction
    };
  }

  private parsePreferencesResponse(response: string, userId: string): Record<string, any> {
    return {
      agentPreferences: this.extractList(response, 'AGENT_PREFERENCES'),
      collaborationStyle: this.extractField(response, 'COLLABORATION_STYLE'),
      interruptionTolerance: this.extractField(response, 'INTERRUPTION_TOLERANCE'),
      speedVsQuality: this.extractField(response, 'SPEED_VS_QUALITY'),
      detailLevel: this.extractField(response, 'DETAIL_LEVEL'),
      interactionStyle: this.extractField(response, 'INTERACTION_STYLE'),
      keyPatterns: this.extractList(response, 'KEY_PATTERNS'),
      optimizationRecommendations: this.extractField(response, 'OPTIMIZATION_RECOMMENDATIONS'),
      confidenceLevel: this.extractScore(response, 'CONFIDENCE_LEVEL')
    };
  }

  private parsePredictiveRoutingResponse(response: string, availableAgents: Agent[]): any {
    const recommendedAgentNames = this.extractList(response, 'RECOMMENDED_AGENTS');
    const recommendedAgents = recommendedAgentNames
      .map(name => availableAgents.find(a => a.name === name))
      .filter((a): a is Agent => a !== undefined);

    return {
      recommendedAgents,
      predictedPattern: this.extractField(response, 'PREDICTED_PATTERN') || 'sequential',
      confidenceScore: this.extractScore(response, 'CONFIDENCE_SCORE') / 100,
      reasoning: this.extractField(response, 'REASONING') || 'Based on historical patterns',
      alternativeOptions: [] // Would parse alternatives in production
    };
  }

  private recordUserFeedback(planId: string, feedback: UserFeedback): void {
    const history = this.adaptationHistory.get(planId);
    if (history) {
      history.userFeedback.push(feedback);
    }
  }

  private updateLearningPatterns(feedback: UserFeedback, adaptation: PlanAdaptation): void {
    const patternKey = `${feedback.feedbackType}-${adaptation.adaptationType}`;
    const existing = this.learningPatterns.get(patternKey) || {
      pattern: patternKey,
      frequency: 0,
      successRate: 0.5,
      averageUserSatisfaction: 0.5,
      recommendedAction: adaptation.adaptationType,
      confidence: 0.5,
      lastOccurred: new Date()
    };

    existing.frequency++;
    existing.lastOccurred = new Date();
    existing.confidence = Math.min(0.95, existing.confidence + 0.05);

    this.learningPatterns.set(patternKey, existing);
  }

  private getRelevantPatterns(feedbackType: string): string[] {
    return Array.from(this.learningPatterns.values())
      .filter(p => p.pattern.includes(feedbackType))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3)
      .map(p => `Pattern: ${p.pattern}, Success: ${Math.round(p.successRate * 100)}%`);
  }

  private createFallbackAdaptation(plan: ExecutionPlan, feedback: UserFeedback): PlanAdaptation {
    return {
      adaptationType: 'modify',
      reason: 'Fallback adaptation based on user feedback',
      confidence: 0.5,
      affectedSteps: [],
      estimatedImprovement: 10,
      riskLevel: 'low',
      userSatisfactionPrediction: 0.6
    };
  }

  private createFallbackPrediction(agents: Agent[]): any {
    return {
      recommendedAgents: agents.slice(0, 2),
      predictedPattern: 'sequential',
      confidenceScore: 0.5,
      reasoning: 'Fallback prediction based on available agents',
      alternativeOptions: []
    };
  }

  private getDefaultPreferences(): Record<string, any> {
    return {
      collaborationStyle: 'balanced',
      interruptionTolerance: 'medium',
      speedVsQuality: 'balanced',
      detailLevel: 'moderate',
      interactionStyle: 'moderate'
    };
  }

  private extractField(response: string, field: string): string | null {
    const regex = new RegExp(`${field}:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = response.match(regex);
    return match ? match[1].trim() : null;
  }

  private extractScore(response: string, field: string): number {
    const regex = new RegExp(`${field}:\\s*\\[?(\\d+)`, 'i');
    const match = response.match(regex);
    return match ? parseInt(match[1]) : 50;
  }

  private extractList(response: string, field: string): string[] {
    const fieldContent = this.extractField(response, field);
    if (!fieldContent) return [];
    
    return fieldContent
      .split(/[,\n]/)
      .map(item => item.trim().replace(/^-\s*/, ''))
      .filter(item => item.length > 0);
  }
}