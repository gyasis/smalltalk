import { EventEmitter } from 'events';
import { UserFeedback, AdaptiveLearning } from './AdaptivePlanningEngine.js';

export interface FeedbackPattern {
  patternId: string;
  patternType: 'agent-preference' | 'timing-preference' | 'detail-preference' | 'interruption-pattern' | 'satisfaction-driver';
  description: string;
  occurrences: number;
  confidence: number;
  lastSeen: Date;
  associatedOutcomes: {
    positive: number;
    negative: number;
    neutral: number;
  };
  recommendations: string[];
}

export interface UserBehaviorModel {
  userId: string;
  preferredAgents: Map<string, number>; // agent name -> preference score
  preferredPatterns: Map<string, number>; // pattern name -> preference score
  interruptionFrequency: number;
  averageSessionDuration: number;
  satisfactionDrivers: string[];
  frustrationTriggers: string[];
  learningConfidence: number;
  lastUpdated: Date;
}

export interface LearningInsight {
  insightType: 'trend' | 'anomaly' | 'preference-shift' | 'performance-correlation';
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedAction?: string;
  confidence: number;
  dataPoints: number;
}

/**
 * FeedbackLearner - Continuous learning from user interactions
 * 
 * Analyzes feedback patterns to:
 * - Build user behavior models
 * - Identify satisfaction drivers
 * - Detect frustration triggers
 * - Learn timing preferences
 * - Optimize future interactions
 * - Generate actionable insights
 */
export class FeedbackLearner extends EventEmitter {
  private feedbackHistory: Map<string, UserFeedback[]> = new Map();
  private behaviorModels: Map<string, UserBehaviorModel> = new Map();
  private feedbackPatterns: Map<string, FeedbackPattern> = new Map();
  private learningInsights: LearningInsight[] = [];
  private patternThreshold: number = 3; // Minimum occurrences to consider a pattern
  private decayFactor: number = 0.95; // How quickly old patterns lose relevance

  constructor() {
    super();
    console.log('[📖 FeedbackLearner] Initialized with continuous learning capabilities');
  }

  /**
   * Process new user feedback and update learning models
   */
  processFeedback(
    userId: string,
    feedback: UserFeedback,
    context: {
      agentUsed: string;
      pattern: string;
      duration: number;
      interruptionOccurred: boolean;
    }
  ): void {
    console.log(`[📖 FeedbackLearner] 📝 Processing ${feedback.feedbackType} feedback from user: ${userId}`);

    // Store feedback
    this.storeFeedback(userId, feedback);

    // Update behavior model
    this.updateBehaviorModel(userId, feedback, context);

    // Detect patterns
    this.detectPatterns(userId, feedback, context);

    // Generate insights
    this.generateInsights(userId);

    // Emit learning event
    this.emit('learning-updated', {
      userId,
      feedbackType: feedback.feedbackType,
      patternsDetected: this.getActivePatterns(userId).length,
      modelConfidence: this.behaviorModels.get(userId)?.learningConfidence || 0
    });
  }

  /**
   * Get user behavior model
   */
  getUserModel(userId: string): UserBehaviorModel | null {
    return this.behaviorModels.get(userId) || null;
  }

  /**
   * Get active patterns for a user
   */
  getActivePatterns(userId: string): FeedbackPattern[] {
    const userFeedback = this.feedbackHistory.get(userId) || [];
    const relevantPatterns: FeedbackPattern[] = [];

    for (const pattern of this.feedbackPatterns.values()) {
      // Check if pattern is relevant to this user
      const userOccurrences = userFeedback.filter(f => 
        this.matchesPattern(f, pattern)
      ).length;

      if (userOccurrences >= this.patternThreshold) {
        relevantPatterns.push(pattern);
      }
    }

    return relevantPatterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get learning insights
   */
  getLearningInsights(userId?: string): LearningInsight[] {
    if (userId) {
      return this.learningInsights.filter(i => 
        i.description.includes(userId) || i.insightType === 'trend'
      );
    }
    return this.learningInsights;
  }

  /**
   * Predict user satisfaction for a proposed plan
   */
  predictSatisfaction(
    userId: string,
    proposedAgents: string[],
    proposedPattern: string,
    estimatedDuration: number
  ): {
    predictedSatisfaction: number;
    confidence: number;
    reasoning: string;
    riskFactors: string[];
  } {
    const model = this.behaviorModels.get(userId);
    if (!model) {
      return {
        predictedSatisfaction: 0.5,
        confidence: 0.1,
        reasoning: 'No behavioral model available for user',
        riskFactors: ['No historical data']
      };
    }

    let satisfaction = 0.5; // Baseline
    let confidence = model.learningConfidence;
    const reasons: string[] = [];
    const risks: string[] = [];

    // Check agent preferences
    for (const agent of proposedAgents) {
      const preference = model.preferredAgents.get(agent) || 0.5;
      satisfaction += (preference - 0.5) * 0.2;
      if (preference > 0.7) {
        reasons.push(`${agent} is a preferred agent`);
      } else if (preference < 0.3) {
        risks.push(`${agent} has low preference score`);
      }
    }

    // Check pattern preferences
    const patternPreference = model.preferredPatterns.get(proposedPattern) || 0.5;
    satisfaction += (patternPreference - 0.5) * 0.3;
    if (patternPreference > 0.7) {
      reasons.push(`${proposedPattern} is a preferred collaboration pattern`);
    } else if (patternPreference < 0.3) {
      risks.push(`${proposedPattern} pattern has low preference`);
    }

    // Check duration preferences
    if (estimatedDuration > model.averageSessionDuration * 1.5) {
      satisfaction -= 0.1;
      risks.push('Duration exceeds typical preference');
    } else if (estimatedDuration < model.averageSessionDuration * 0.5) {
      satisfaction += 0.1;
      reasons.push('Quick execution aligns with preferences');
    }

    // Apply satisfaction drivers and frustration triggers
    for (const driver of model.satisfactionDrivers) {
      if (this.planIncludesDriver(proposedAgents, proposedPattern, driver)) {
        satisfaction += 0.1;
        reasons.push(`Includes satisfaction driver: ${driver}`);
      }
    }

    for (const trigger of model.frustrationTriggers) {
      if (this.planIncludesTrigger(proposedAgents, proposedPattern, trigger)) {
        satisfaction -= 0.15;
        risks.push(`May trigger frustration: ${trigger}`);
      }
    }

    // Normalize satisfaction to 0-1 range
    satisfaction = Math.max(0, Math.min(1, satisfaction));

    return {
      predictedSatisfaction: satisfaction,
      confidence,
      reasoning: reasons.join('; ') || 'Based on historical patterns',
      riskFactors: risks
    };
  }

  /**
   * Get optimization recommendations for a user
   */
  getOptimizationRecommendations(userId: string): string[] {
    const model = this.behaviorModels.get(userId);
    if (!model) return ['Insufficient data for recommendations'];

    const recommendations: string[] = [];

    // Agent recommendations
    const topAgents = Array.from(model.preferredAgents.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (topAgents.length > 0) {
      recommendations.push(`Prioritize agents: ${topAgents.map(a => a[0]).join(', ')}`);
    }

    // Pattern recommendations
    const topPatterns = Array.from(model.preferredPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    
    if (topPatterns.length > 0) {
      recommendations.push(`Use ${topPatterns[0][0]} pattern when possible`);
    }

    // Interruption handling
    if (model.interruptionFrequency > 0.3) {
      recommendations.push('Design for frequent interruptions - add more checkpoints');
    } else if (model.interruptionFrequency < 0.1) {
      recommendations.push('User prefers uninterrupted flow - minimize checkpoints');
    }

    // Duration preferences
    if (model.averageSessionDuration < 60000) {
      recommendations.push('Keep interactions brief and focused');
    } else if (model.averageSessionDuration > 180000) {
      recommendations.push('User comfortable with detailed, thorough responses');
    }

    // Satisfaction drivers
    if (model.satisfactionDrivers.length > 0) {
      recommendations.push(`Focus on: ${model.satisfactionDrivers.slice(0, 2).join(', ')}`);
    }

    // Frustration triggers
    if (model.frustrationTriggers.length > 0) {
      recommendations.push(`Avoid: ${model.frustrationTriggers[0]}`);
    }

    return recommendations;
  }

  // Private helper methods

  private storeFeedback(userId: string, feedback: UserFeedback): void {
    const history = this.feedbackHistory.get(userId) || [];
    history.push(feedback);
    
    // Keep only recent feedback (last 100 items)
    if (history.length > 100) {
      history.shift();
    }
    
    this.feedbackHistory.set(userId, history);
  }

  private updateBehaviorModel(
    userId: string,
    feedback: UserFeedback,
    context: any
  ): void {
    const model = this.behaviorModels.get(userId) || this.createNewModel(userId);

    // Update agent preferences
    const agentScore = model.preferredAgents.get(context.agentUsed) || 0.5;
    const adjustment = feedback.sentiment === 'positive' ? 0.05 : 
                      feedback.sentiment === 'negative' ? -0.05 : 0;
    model.preferredAgents.set(context.agentUsed, Math.max(0, Math.min(1, agentScore + adjustment)));

    // Update pattern preferences
    const patternScore = model.preferredPatterns.get(context.pattern) || 0.5;
    model.preferredPatterns.set(context.pattern, Math.max(0, Math.min(1, patternScore + adjustment)));

    // Update interruption frequency
    if (context.interruptionOccurred) {
      model.interruptionFrequency = model.interruptionFrequency * 0.9 + 0.1;
    } else {
      model.interruptionFrequency = model.interruptionFrequency * 0.95;
    }

    // Update average session duration
    model.averageSessionDuration = model.averageSessionDuration * 0.8 + context.duration * 0.2;

    // Update satisfaction drivers and triggers
    if (feedback.sentiment === 'positive' && feedback.content) {
      this.updateSatisfactionDrivers(model, feedback.content);
    } else if (feedback.sentiment === 'negative' && feedback.content) {
      this.updateFrustrationTriggers(model, feedback.content);
    }

    // Update confidence
    model.learningConfidence = Math.min(0.95, model.learningConfidence + 0.02);
    model.lastUpdated = new Date();

    this.behaviorModels.set(userId, model);
  }

  private createNewModel(userId: string): UserBehaviorModel {
    return {
      userId,
      preferredAgents: new Map(),
      preferredPatterns: new Map(),
      interruptionFrequency: 0,
      averageSessionDuration: 120000, // 2 minutes default
      satisfactionDrivers: [],
      frustrationTriggers: [],
      learningConfidence: 0.1,
      lastUpdated: new Date()
    };
  }

  private detectPatterns(userId: string, feedback: UserFeedback, context: any): void {
    const patternKey = `${feedback.feedbackType}-${context.agentUsed}-${feedback.sentiment}`;
    
    let pattern = this.feedbackPatterns.get(patternKey);
    if (!pattern) {
      pattern = {
        patternId: patternKey,
        patternType: this.classifyPatternType(feedback.feedbackType),
        description: `${feedback.feedbackType} feedback for ${context.agentUsed} with ${feedback.sentiment} sentiment`,
        occurrences: 0,
        confidence: 0.1,
        lastSeen: new Date(),
        associatedOutcomes: { positive: 0, negative: 0, neutral: 0 },
        recommendations: []
      };
    }

    pattern.occurrences++;
    pattern.lastSeen = new Date();
    pattern.confidence = Math.min(0.95, pattern.confidence + 0.05);
    pattern.associatedOutcomes[feedback.sentiment === 'positive' ? 'positive' : 
                               feedback.sentiment === 'negative' ? 'negative' : 'neutral']++;

    // Generate recommendations based on pattern
    if (pattern.occurrences >= this.patternThreshold) {
      pattern.recommendations = this.generatePatternRecommendations(pattern);
    }

    this.feedbackPatterns.set(patternKey, pattern);
  }

  private classifyPatternType(feedbackType: string): FeedbackPattern['patternType'] {
    switch (feedbackType) {
      case 'explicit':
      case 'satisfaction':
        return 'satisfaction-driver';
      case 'interruption':
        return 'interruption-pattern';
      case 'implicit':
        return 'timing-preference';
      default:
        return 'agent-preference';
    }
  }

  private generatePatternRecommendations(pattern: FeedbackPattern): string[] {
    const recommendations: string[] = [];
    
    const positiveRate = pattern.associatedOutcomes.positive / pattern.occurrences;
    const negativeRate = pattern.associatedOutcomes.negative / pattern.occurrences;

    if (positiveRate > 0.7) {
      recommendations.push(`Continue using this pattern - high satisfaction (${Math.round(positiveRate * 100)}%)`);
    } else if (negativeRate > 0.5) {
      recommendations.push(`Avoid this pattern - causing frustration (${Math.round(negativeRate * 100)}% negative)`);
    }

    if (pattern.patternType === 'interruption-pattern' && pattern.occurrences > 5) {
      recommendations.push('User frequently interrupts here - add explicit checkpoint');
    }

    return recommendations;
  }

  private generateInsights(userId: string): void {
    const model = this.behaviorModels.get(userId);
    if (!model || model.learningConfidence < 0.3) return;

    // Check for preference shifts
    const recentFeedback = (this.feedbackHistory.get(userId) || []).slice(-20);
    if (recentFeedback.length >= 10) {
      const recentPositive = recentFeedback.filter(f => f.sentiment === 'positive').length;
      const overallPositive = (this.feedbackHistory.get(userId) || [])
        .filter(f => f.sentiment === 'positive').length;
      
      if (Math.abs(recentPositive / recentFeedback.length - overallPositive / (this.feedbackHistory.get(userId) || []).length) > 0.3) {
        this.learningInsights.push({
          insightType: 'preference-shift',
          description: `User ${userId} showing preference shift in recent interactions`,
          impact: 'high',
          actionable: true,
          suggestedAction: 'Re-evaluate routing strategies for this user',
          confidence: 0.7,
          dataPoints: recentFeedback.length
        });
      }
    }

    // Clean old insights (keep last 50)
    if (this.learningInsights.length > 50) {
      this.learningInsights = this.learningInsights.slice(-50);
    }
  }

  private matchesPattern(feedback: UserFeedback, pattern: FeedbackPattern): boolean {
    return feedback.feedbackType === pattern.patternId.split('-')[0];
  }

  private updateSatisfactionDrivers(model: UserBehaviorModel, content: string): void {
    // Simple keyword extraction - in production would use NLP
    const keywords = ['fast', 'accurate', 'helpful', 'clear', 'detailed', 'perfect'];
    for (const keyword of keywords) {
      if (content.toLowerCase().includes(keyword) && !model.satisfactionDrivers.includes(keyword)) {
        model.satisfactionDrivers.push(keyword);
        if (model.satisfactionDrivers.length > 5) {
          model.satisfactionDrivers.shift();
        }
      }
    }
  }

  private updateFrustrationTriggers(model: UserBehaviorModel, content: string): void {
    // Simple keyword extraction - in production would use NLP
    const keywords = ['slow', 'wrong', 'confused', 'unclear', 'repetitive', 'irrelevant'];
    for (const keyword of keywords) {
      if (content.toLowerCase().includes(keyword) && !model.frustrationTriggers.includes(keyword)) {
        model.frustrationTriggers.push(keyword);
        if (model.frustrationTriggers.length > 5) {
          model.frustrationTriggers.shift();
        }
      }
    }
  }

  private planIncludesDriver(agents: string[], pattern: string, driver: string): boolean {
    // Simple matching - in production would be more sophisticated
    return agents.some(a => a.toLowerCase().includes(driver)) ||
           pattern.toLowerCase().includes(driver);
  }

  private planIncludesTrigger(agents: string[], pattern: string, trigger: string): boolean {
    // Simple matching - in production would be more sophisticated
    return agents.some(a => a.toLowerCase().includes(trigger)) ||
           pattern.toLowerCase().includes(trigger);
  }
}