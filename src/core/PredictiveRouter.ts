import { Agent } from '../agents/Agent.js';
import { SkillsMatchAnalysis } from './AgentSkillsAnalyzer.js';
import { UserBehaviorModel } from './FeedbackLearner.js';
import { ExecutionState } from './InterruptibleExecutor.js';

export interface RoutingPrediction {
  primaryRoute: {
    agents: Agent[];
    pattern: string;
    confidence: number;
    estimatedSatisfaction: number;
    estimatedDuration: number;
  };
  alternativeRoutes: Array<{
    agents: Agent[];
    pattern: string;
    confidence: number;
    reason: string;
  }>;
  riskFactors: string[];
  optimizationOpportunities: string[];
  predictedInterruptionPoints: number[];
}

export interface RoutingMetrics {
  agentUtilization: Map<string, number>;
  patternSuccessRates: Map<string, number>;
  averageResponseTimes: Map<string, number>;
  userSatisfactionScores: Map<string, number>;
  interruptionRates: Map<string, number>;
}

export interface PredictiveModel {
  modelId: string;
  accuracy: number;
  lastTrainedOn: Date;
  dataPoints: number;
  features: string[];
  predictions: Map<string, RoutingPrediction>;
}

/**
 * PredictiveRouter - ML-inspired routing optimization
 * 
 * Uses historical data and patterns to:
 * - Predict optimal agent combinations
 * - Anticipate user needs
 * - Minimize interruptions
 * - Maximize satisfaction
 * - Balance agent workload
 * - Adapt to changing patterns
 */
export class PredictiveRouter {
  private routingHistory: Map<string, {
    request: string;
    route: Agent[];
    pattern: string;
    outcome: 'success' | 'partial' | 'failure';
    satisfaction: number;
    duration: number;
    interruptions: number;
  }[]> = new Map();
  
  private routingMetrics: RoutingMetrics = {
    agentUtilization: new Map(),
    patternSuccessRates: new Map(),
    averageResponseTimes: new Map(),
    userSatisfactionScores: new Map(),
    interruptionRates: new Map()
  };

  private predictiveModels: Map<string, PredictiveModel> = new Map();
  private confidenceThreshold: number = 0.7;
  private adaptationRate: number = 0.1; // How quickly to adapt to new patterns

  constructor() {
    console.log('[🔮 PredictiveRouter] Initialized with predictive routing optimization');
  }

  /**
   * Predict optimal routing based on request and user history
   */
  predictOptimalRoute(
    userRequest: string,
    userId: string,
    availableAgents: Agent[],
    skillsAnalyses: SkillsMatchAnalysis[],
    userModel: UserBehaviorModel | null,
    recentHistory: ExecutionState[]
  ): RoutingPrediction {
    console.log(`[🔮 PredictiveRouter] 🎯 Predicting optimal route for user: ${userId}`);
    console.log(`[🔮 PredictiveRouter] 📝 Request: "${userRequest.substring(0, 50)}..."`);

    // Calculate feature vector for prediction
    const features = this.extractFeatures(userRequest, userId, skillsAnalyses, userModel);
    
    // Get or create predictive model for user
    const model = this.getOrCreateModel(userId);
    
    // Generate primary routing prediction
    const primaryRoute = this.generatePrimaryRoute(
      features,
      availableAgents,
      skillsAnalyses,
      userModel,
      model
    );

    // Generate alternative routes
    const alternativeRoutes = this.generateAlternativeRoutes(
      features,
      availableAgents,
      skillsAnalyses,
      primaryRoute
    );

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(
      primaryRoute,
      userModel,
      recentHistory
    );

    // Find optimization opportunities
    const optimizationOpportunities = this.findOptimizationOpportunities(
      primaryRoute,
      skillsAnalyses,
      this.routingMetrics
    );

    // Predict interruption points
    const predictedInterruptionPoints = this.predictInterruptionPoints(
      primaryRoute,
      userModel,
      features
    );

    const prediction: RoutingPrediction = {
      primaryRoute,
      alternativeRoutes,
      riskFactors,
      optimizationOpportunities,
      predictedInterruptionPoints
    };

    // Store prediction for learning
    model.predictions.set(userRequest, prediction);

    console.log(`[🔮 PredictiveRouter] ✅ Prediction complete:`);
    console.log(`  Primary Route: ${primaryRoute.agents.map(a => a.name).join(' → ')}`);
    console.log(`  Pattern: ${primaryRoute.pattern}`);
    console.log(`  Confidence: ${Math.round(primaryRoute.confidence * 100)}%`);
    console.log(`  Predicted Satisfaction: ${Math.round(primaryRoute.estimatedSatisfaction * 100)}%`);

    return prediction;
  }

  /**
   * Update routing metrics based on execution outcome
   */
  updateRoutingMetrics(
    userId: string,
    request: string,
    route: Agent[],
    pattern: string,
    outcome: {
      success: boolean;
      satisfaction: number;
      duration: number;
      interruptions: number;
    }
  ): void {
    console.log(`[🔮 PredictiveRouter] 📊 Updating metrics for user: ${userId}`);

    // Store routing history
    const history = this.routingHistory.get(userId) || [];
    history.push({
      request,
      route,
      pattern,
      outcome: outcome.success ? 'success' : 'partial',
      satisfaction: outcome.satisfaction,
      duration: outcome.duration,
      interruptions: outcome.interruptions
    });
    
    // Keep last 100 entries per user
    if (history.length > 100) {
      history.shift();
    }
    this.routingHistory.set(userId, history);

    // Update agent utilization
    for (const agent of route) {
      const utilization = this.routingMetrics.agentUtilization.get(agent.name) || 0;
      this.routingMetrics.agentUtilization.set(agent.name, utilization + 1);
    }

    // Update pattern success rates
    const patternSuccess = this.routingMetrics.patternSuccessRates.get(pattern) || 0.5;
    const newPatternSuccess = patternSuccess * (1 - this.adaptationRate) + 
                             (outcome.success ? 1 : 0) * this.adaptationRate;
    this.routingMetrics.patternSuccessRates.set(pattern, newPatternSuccess);

    // Update average response times
    for (const agent of route) {
      const avgTime = this.routingMetrics.averageResponseTimes.get(agent.name) || outcome.duration;
      const newAvgTime = avgTime * (1 - this.adaptationRate) + outcome.duration * this.adaptationRate;
      this.routingMetrics.averageResponseTimes.set(agent.name, newAvgTime);
    }

    // Update user satisfaction scores
    const userSatisfaction = this.routingMetrics.userSatisfactionScores.get(userId) || 0.5;
    const newSatisfaction = userSatisfaction * (1 - this.adaptationRate) + 
                           outcome.satisfaction * this.adaptationRate;
    this.routingMetrics.userSatisfactionScores.set(userId, newSatisfaction);

    // Update interruption rates
    const interruptionRate = this.routingMetrics.interruptionRates.get(pattern) || 0;
    const newInterruptionRate = interruptionRate * (1 - this.adaptationRate) + 
                                (outcome.interruptions > 0 ? 1 : 0) * this.adaptationRate;
    this.routingMetrics.interruptionRates.set(pattern, newInterruptionRate);

    console.log(`[🔮 PredictiveRouter] ✅ Metrics updated`);
    console.log(`  Pattern Success Rate: ${Math.round(newPatternSuccess * 100)}%`);
    console.log(`  User Satisfaction: ${Math.round(newSatisfaction * 100)}%`);
  }

  /**
   * Get routing recommendations based on current metrics
   */
  getRoutingRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze agent utilization
    const utilizationEntries = Array.from(this.routingMetrics.agentUtilization.entries());
    if (utilizationEntries.length > 0) {
      const maxUtilization = Math.max(...utilizationEntries.map(e => e[1]));
      const minUtilization = Math.min(...utilizationEntries.map(e => e[1]));
      
      if (maxUtilization > minUtilization * 3) {
        const overutilized = utilizationEntries.find(e => e[1] === maxUtilization)?.[0];
        const underutilized = utilizationEntries.find(e => e[1] === minUtilization)?.[0];
        recommendations.push(`Balance workload: ${overutilized} is overutilized, consider ${underutilized}`);
      }
    }

    // Analyze pattern success rates
    const patternEntries = Array.from(this.routingMetrics.patternSuccessRates.entries());
    const topPattern = patternEntries.sort((a, b) => b[1] - a[1])[0];
    if (topPattern && topPattern[1] > 0.8) {
      recommendations.push(`Prioritize ${topPattern[0]} pattern (${Math.round(topPattern[1] * 100)}% success)`);
    }

    // Analyze interruption rates
    const highInterruptionPatterns = Array.from(this.routingMetrics.interruptionRates.entries())
      .filter(([_, rate]) => rate > 0.3);
    if (highInterruptionPatterns.length > 0) {
      recommendations.push(`Add more checkpoints for: ${highInterruptionPatterns.map(p => p[0]).join(', ')}`);
    }

    // Analyze response times
    const slowAgents = Array.from(this.routingMetrics.averageResponseTimes.entries())
      .filter(([_, time]) => time > 60000) // Over 1 minute
      .map(([agent, _]) => agent);
    if (slowAgents.length > 0) {
      recommendations.push(`Optimize or replace slow agents: ${slowAgents.join(', ')}`);
    }

    return recommendations;
  }

  /**
   * Get current routing metrics
   */
  getMetrics(): RoutingMetrics {
    return {
      agentUtilization: new Map(this.routingMetrics.agentUtilization),
      patternSuccessRates: new Map(this.routingMetrics.patternSuccessRates),
      averageResponseTimes: new Map(this.routingMetrics.averageResponseTimes),
      userSatisfactionScores: new Map(this.routingMetrics.userSatisfactionScores),
      interruptionRates: new Map(this.routingMetrics.interruptionRates)
    };
  }

  // Private helper methods

  private extractFeatures(
    request: string,
    userId: string,
    skillsAnalyses: SkillsMatchAnalysis[],
    userModel: UserBehaviorModel | null
  ): Record<string, any> {
    return {
      requestLength: request.length,
      requestComplexity: this.calculateComplexity(request),
      topSkillMatch: skillsAnalyses[0]?.overallMatch || 0,
      skillVariance: this.calculateSkillVariance(skillsAnalyses),
      userInterruptionTendency: userModel?.interruptionFrequency || 0,
      userPreferredDetailLevel: userModel?.satisfactionDrivers?.includes('detailed') ? 1 : 0,
      historicalSatisfaction: this.routingMetrics.userSatisfactionScores.get(userId) || 0.5,
      timeOfDay: new Date().getHours(),
      requestType: this.classifyRequestType(request)
    };
  }

  private calculateComplexity(request: string): number {
    // Simple complexity calculation based on length and keywords
    const complexKeywords = ['analyze', 'comprehensive', 'detailed', 'multiple', 'complex'];
    const complexity = request.length / 100; // Base complexity from length
    const keywordBonus = complexKeywords.filter(k => request.toLowerCase().includes(k)).length * 0.2;
    return Math.min(1, complexity + keywordBonus);
  }

  private calculateSkillVariance(analyses: SkillsMatchAnalysis[]): number {
    if (analyses.length < 2) return 0;
    const scores = analyses.map(a => a.overallMatch);
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return variance;
  }

  private classifyRequestType(request: string): string {
    const types = {
      'analysis': ['analyze', 'examine', 'investigate', 'study'],
      'creation': ['create', 'build', 'develop', 'design'],
      'optimization': ['optimize', 'improve', 'enhance', 'refine'],
      'troubleshooting': ['fix', 'debug', 'solve', 'troubleshoot'],
      'planning': ['plan', 'strategy', 'roadmap', 'organize']
    };

    for (const [type, keywords] of Object.entries(types)) {
      if (keywords.some(k => request.toLowerCase().includes(k))) {
        return type;
      }
    }
    return 'general';
  }

  private getOrCreateModel(userId: string): PredictiveModel {
    let model = this.predictiveModels.get(userId);
    if (!model) {
      model = {
        modelId: `model-${userId}-${Date.now()}`,
        accuracy: 0.5,
        lastTrainedOn: new Date(),
        dataPoints: 0,
        features: [],
        predictions: new Map()
      };
      this.predictiveModels.set(userId, model);
    }
    return model;
  }

  private generatePrimaryRoute(
    features: Record<string, any>,
    availableAgents: Agent[],
    skillsAnalyses: SkillsMatchAnalysis[],
    userModel: UserBehaviorModel | null,
    model: PredictiveModel
  ): RoutingPrediction['primaryRoute'] {
    // Select top agents based on skills analysis
    const topAnalyses = skillsAnalyses.slice(0, 3);
    const selectedAgents = topAnalyses.map(a => a.agent);

    // Determine pattern based on features and history
    let pattern = 'sequential'; // Default
    if (features['requestComplexity'] > 0.7) {
      pattern = 'parallel-synthesis';
    } else if (features['skillVariance'] > 0.2) {
      pattern = 'specialist-consultation';
    } else if (userModel?.preferredPatterns?.has('debate')) {
      pattern = 'debate';
    }

    // Calculate confidence based on model accuracy and feature strength
    const confidence = model.accuracy * 0.5 + 
                      (topAnalyses[0]?.confidence || 0.5) * 0.3 +
                      (userModel?.learningConfidence || 0.5) * 0.2;

    // Estimate satisfaction based on historical data and agent match
    const historicalSatisfaction = this.routingMetrics.userSatisfactionScores.get(features['userId']) || 0.5;
    const skillMatchBonus = topAnalyses[0]?.overallMatch || 0.5;
    const estimatedSatisfaction = historicalSatisfaction * 0.6 + skillMatchBonus * 0.4;

    // Estimate duration based on pattern and agent count
    const baseTime = 30000; // 30 seconds
    const agentTime = selectedAgents.length * 15000; // 15 seconds per agent
    const patternMultiplier = pattern === 'parallel-synthesis' ? 0.7 : 
                              pattern === 'debate' ? 1.5 : 1;
    const estimatedDuration = (baseTime + agentTime) * patternMultiplier;

    return {
      agents: selectedAgents,
      pattern,
      confidence,
      estimatedSatisfaction,
      estimatedDuration
    };
  }

  private generateAlternativeRoutes(
    features: Record<string, any>,
    availableAgents: Agent[],
    skillsAnalyses: SkillsMatchAnalysis[],
    primaryRoute: RoutingPrediction['primaryRoute']
  ): RoutingPrediction['alternativeRoutes'] {
    const alternatives: RoutingPrediction['alternativeRoutes'] = [];

    // Alternative 1: Single expert agent
    if (skillsAnalyses[0]?.overallMatch > 0.8) {
      alternatives.push({
        agents: [skillsAnalyses[0].agent],
        pattern: 'single-expert',
        confidence: skillsAnalyses[0].confidence,
        reason: 'High skill match allows single agent handling'
      });
    }

    // Alternative 2: Different collaboration pattern
    if (primaryRoute.pattern !== 'debate' && features['requestComplexity'] > 0.5) {
      alternatives.push({
        agents: skillsAnalyses.slice(0, 2).map(a => a.agent),
        pattern: 'debate',
        confidence: 0.6,
        reason: 'Complex request may benefit from debate pattern'
      });
    }

    // Alternative 3: Extended team for thoroughness
    if (availableAgents.length > 3 && features['requestComplexity'] > 0.6) {
      alternatives.push({
        agents: skillsAnalyses.slice(0, 4).map(a => a.agent),
        pattern: 'workshop',
        confidence: 0.5,
        reason: 'Comprehensive coverage with extended team'
      });
    }

    return alternatives;
  }

  private identifyRiskFactors(
    primaryRoute: RoutingPrediction['primaryRoute'],
    userModel: UserBehaviorModel | null,
    recentHistory: ExecutionState[]
  ): string[] {
    const risks: string[] = [];

    // Check confidence level
    if (primaryRoute.confidence < this.confidenceThreshold) {
      risks.push(`Low confidence (${Math.round(primaryRoute.confidence * 100)}%) in routing prediction`);
    }

    // Check user model alignment
    if (userModel) {
      const preferredPattern = userModel.preferredPatterns ? 
        Array.from(userModel.preferredPatterns.entries()).sort((a, b) => b[1] - a[1])[0] : 
        null;
      if (preferredPattern && preferredPattern[0] !== primaryRoute.pattern) {
        risks.push(`Pattern mismatch with user preference (prefers ${preferredPattern[0]})`);
      }
    }

    // Check recent failures
    const recentFailures = recentHistory.filter(h => h.status === 'failed').length;
    if (recentFailures > recentHistory.length * 0.3) {
      risks.push('High recent failure rate may indicate systematic issues');
    }

    // Check agent overload
    for (const agent of primaryRoute.agents) {
      const utilization = this.routingMetrics.agentUtilization.get(agent.name) || 0;
      const avgUtilization = Array.from(this.routingMetrics.agentUtilization.values())
        .reduce((a, b) => a + b, 0) / this.routingMetrics.agentUtilization.size;
      
      if (utilization > avgUtilization * 2) {
        risks.push(`${agent.name} is heavily utilized and may be slower`);
      }
    }

    return risks;
  }

  private findOptimizationOpportunities(
    primaryRoute: RoutingPrediction['primaryRoute'],
    skillsAnalyses: SkillsMatchAnalysis[],
    metrics: RoutingMetrics
  ): string[] {
    const opportunities: string[] = [];

    // Check for skill overlap that could be consolidated
    const collaborationPotential = skillsAnalyses[0]?.collaborationPotential || [];
    if (collaborationPotential.length > 0) {
      opportunities.push(`Consider involving: ${collaborationPotential.slice(0, 2).join(', ')}`);
    }

    // Check for pattern optimization
    const patternSuccess = metrics.patternSuccessRates.get(primaryRoute.pattern) || 0.5;
    const bestPattern = Array.from(metrics.patternSuccessRates.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (bestPattern && bestPattern[0] !== primaryRoute.pattern && bestPattern[1] > patternSuccess + 0.2) {
      opportunities.push(`${bestPattern[0]} pattern has ${Math.round((bestPattern[1] - patternSuccess) * 100)}% higher success rate`);
    }

    // Check for parallelization opportunities
    if (primaryRoute.pattern === 'sequential' && primaryRoute.agents.length > 2) {
      opportunities.push('Consider parallel execution for faster results');
    }

    return opportunities;
  }

  private predictInterruptionPoints(
    primaryRoute: RoutingPrediction['primaryRoute'],
    userModel: UserBehaviorModel | null,
    features: Record<string, any>
  ): number[] {
    const points: number[] = [];

    // Always allow interruption at the beginning
    points.push(0);

    // Add points based on user interruption frequency
    if (userModel && userModel.interruptionFrequency > 0.2) {
      // Add interruption point after each agent
      for (let i = 1; i < primaryRoute.agents.length; i++) {
        points.push(i);
      }
    } else {
      // Add minimal interruption points
      if (primaryRoute.agents.length > 2) {
        points.push(Math.floor(primaryRoute.agents.length / 2));
      }
    }

    // Add point before final synthesis in parallel patterns
    if (primaryRoute.pattern === 'parallel-synthesis') {
      points.push(primaryRoute.agents.length - 1);
    }

    return [...new Set(points)].sort((a, b) => a - b);
  }
}