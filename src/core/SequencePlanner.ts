import { Agent } from '../agents/Agent.js';
import { TokenJSWrapper } from '../utils/TokenJSWrapper.js';
import { CollaborationRecommendation, ExecutionStep } from './CollaborationPatternEngine.js';
import { SkillsMatchAnalysis } from './AgentSkillsAnalyzer.js';
import { InterruptionPoint } from './InterruptibleExecutor.js';

export interface OptimizedSequence {
  steps: SequenceStep[];
  totalDuration: number;
  interruptionPoints: InterruptionPoint[];
  riskAssessment: SequenceRisk[];
  alternativeSequences: OptimizedSequence[];
  optimizationReasons: string[];
}

export interface SequenceStep {
  stepId: string;
  agentName: string;
  action: string;
  parameters: Record<string, unknown>;
  dependencies: string[]; // stepIds this step depends on
  estimatedDuration: number;
  priority: number; // 1-10, higher is more critical
  interruptionSafety: 'safe' | 'warning' | 'dangerous';
  contextRequirements: string[];
  expectedOutput: string;
  qualityCheckpoints: string[];
}

export interface SequenceRisk {
  riskType: 'dependency' | 'timing' | 'context-loss' | 'agent-overload' | 'interruption-damage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
  affectedSteps: string[];
}

export interface SequenceOptimizationOptions {
  prioritizeSpeed: boolean;
  prioritizeQuality: boolean;
  allowParallelization: boolean;
  minimizeInterruptions: boolean;
  preserveContext: boolean;
  agentWorkloadBalance: boolean;
}

/**
 * SequencePlanner - Optimal sequence planning with interruption points
 * 
 * Creates optimized execution sequences that:
 * - Maximize agent skill utilization
 * - Identify safe interruption points
 * - Minimize context loss during handoffs
 * - Balance workload across agents
 * - Optimize for speed vs quality tradeoffs
 * - Plan for contingencies and alternatives
 */
export class SequencePlanner {
  private llm: TokenJSWrapper;
  private sequenceHistory: Array<{
    userRequest: string;
    sequence: OptimizedSequence;
    actualDuration: number;
    success: boolean;
    interruptionCount: number;
  }> = [];

  constructor(llmConfig: { provider: string; model: string }) {
    this.llm = new TokenJSWrapper({
      llmProvider: llmConfig.provider,
      model: llmConfig.model,
      temperature: 0.2, // Low temperature for precise planning
      maxTokens: 3000
    });

    console.log('[📋 SequencePlanner] Initialized with optimal sequence planning capabilities');
  }

  /**
   * Create optimized execution sequence from collaboration recommendation
   */
  async createOptimalSequence(
    userRequest: string,
    recommendation: CollaborationRecommendation,
    skillsAnalyses: SkillsMatchAnalysis[],
    options: SequenceOptimizationOptions = this.getDefaultOptions()
  ): Promise<OptimizedSequence> {
    console.log(`[📋 SequencePlanner] 🚀 Planning optimal sequence for: "${userRequest.substring(0, 50)}..."`);

    const prompt = `
OPTIMAL SEQUENCE PLANNING

Create an optimized execution sequence for this collaboration:

USER REQUEST: "${userRequest}"

COLLABORATION PATTERN: ${recommendation.pattern.name}
SELECTED AGENTS: ${recommendation.selectedAgents.map(a => a.name).join(', ')}
PATTERN DESCRIPTION: ${recommendation.pattern.description}

AGENT CAPABILITIES:
${recommendation.selectedAgents.map(agent => {
  const analysis = skillsAnalyses.find(a => a.agent.name === agent.name);
  return `${agent.name}:
- Overall Match: ${Math.round((analysis?.overallMatch || 0) * 100)}%
- Performance: ${Math.round((analysis?.estimatedPerformance || 0) * 100)}%
- Collaboration Potential: ${analysis?.collaborationPotential.join(', ') || 'General'}
- Risk Factors: ${analysis?.riskFactors.join(', ') || 'None identified'}`;
}).join('\n')}

OPTIMIZATION PREFERENCES:
- Prioritize Speed: ${options.prioritizeSpeed}
- Prioritize Quality: ${options.prioritizeQuality}
- Allow Parallelization: ${options.allowParallelization}
- Minimize Interruptions: ${options.minimizeInterruptions}
- Preserve Context: ${options.preserveContext}
- Balance Workload: ${options.agentWorkloadBalance}

ORIGINAL EXECUTION FLOW:
${recommendation.executionPlan.map((step, i) => `
Step ${i + 1}: ${step.stepType}
Participants: ${step.participants.join(', ')}
Description: ${step.description}
Duration: ${step.duration}ms
Interruptible: ${step.interruptible}
`).join('')}

Create an optimized sequence plan:

SEQUENCE_STEPS: [For each step, provide:]
Step_ID: [unique identifier]
Agent: [agent name]
Action: [specific action description]
Duration: [estimated milliseconds]
Priority: [1-10, critical to optional]
Interruption_Safety: [safe|warning|dangerous]
Dependencies: [comma-separated step IDs this depends on, or 'none']
Context_Requirements: [what context is needed from previous steps]
Expected_Output: [what this step should produce]

INTERRUPTION_POINTS: [List step IDs where interruption is safe]
RISK_ASSESSMENT: [List potential risks and their severity]
OPTIMIZATION_REASONS: [Explain key optimizations made]
TOTAL_DURATION: [estimated total milliseconds]

Focus on creating an efficient, interruptible sequence that maximizes the strengths of each agent.
`;

    try {
      const response = await this.llm.generateResponse([{ 
        id: 'sequence-' + Date.now(), 
        role: 'user', 
        content: prompt,
        timestamp: new Date()
      }]);
      return this.parseSequencePlan(response.content, recommendation);
    } catch (error) {
      console.error(`[📋 SequencePlanner] ❌ Sequence planning failed:`, error);
      return this.createFallbackSequence(recommendation, options);
    }
  }

  /**
   * Parse LLM sequence planning response
   */
  private parseSequencePlan(response: string, recommendation: CollaborationRecommendation): OptimizedSequence {
    const steps = this.parseSequenceSteps(response);
    const interruptionPoints = this.parseInterruptionPoints(response, steps);
    const risks = this.parseRiskAssessment(response);
    const optimizationReasons = this.extractList(response, 'OPTIMIZATION_REASONS');
    const totalDuration = this.extractScore(response, 'TOTAL_DURATION') || 
                         steps.reduce((sum, step) => sum + step.estimatedDuration, 0);

    // Generate alternative sequences
    const alternativeSequences = this.generateAlternativeSequences(steps, recommendation);

    return {
      steps,
      totalDuration,
      interruptionPoints,
      riskAssessment: risks,
      alternativeSequences,
      optimizationReasons
    };
  }

  /**
   * Parse sequence steps from LLM response
   */
  private parseSequenceSteps(response: string): SequenceStep[] {
    const steps: SequenceStep[] = [];
    const stepMatches = response.match(/Step_ID:\s*([^\n]+)/g);
    
    if (!stepMatches) {
      // Fallback parsing
      return this.createDefaultSteps();
    }

    const stepSections = response.split(/Step_ID:\s*/);
    
    for (let i = 1; i < stepSections.length; i++) {
      const section = stepSections[i];
      const lines = section.split('\n');
      
      const stepId = lines[0].trim();
      const agent = this.extractFromSection(section, 'Agent') || 'unknown';
      const action = this.extractFromSection(section, 'Action') || 'Process request';
      const duration = parseInt(this.extractFromSection(section, 'Duration') || '30000');
      const priority = parseInt(this.extractFromSection(section, 'Priority') || '5');
      const interruptionSafety = this.extractFromSection(section, 'Interruption_Safety') as SequenceStep['interruptionSafety'] || 'warning';
      const dependencies = this.extractFromSection(section, 'Dependencies')?.split(',').map(d => d.trim()).filter(d => d !== 'none') || [];
      const contextRequirements = this.extractFromSection(section, 'Context_Requirements')?.split(',').map(c => c.trim()) || [];
      const expectedOutput = this.extractFromSection(section, 'Expected_Output') || 'Agent response';

      steps.push({
        stepId,
        agentName: agent,
        action,
        parameters: { userRequest: 'from_context' },
        dependencies,
        estimatedDuration: duration,
        priority,
        interruptionSafety,
        contextRequirements,
        expectedOutput,
        qualityCheckpoints: this.generateQualityCheckpoints(action)
      });
    }

    return steps;
  }

  /**
   * Parse interruption points from response
   */
  private parseInterruptionPoints(response: string, steps: SequenceStep[]): InterruptionPoint[] {
    const pointsText = this.extractField(response, 'INTERRUPTION_POINTS');
    const pointStepIds = pointsText?.split(',').map(p => p.trim()) || [];

    return steps
      .filter(step => pointStepIds.includes(step.stepId) || step.interruptionSafety === 'safe')
      .map((step, index) => ({
        stepIndex: steps.indexOf(step),
        agentName: step.agentName,
        interruptionSafety: step.interruptionSafety,
        contextPreservation: this.calculateContextPreservation(step, index, steps.length)
      }));
  }

  /**
   * Parse risk assessment from response
   */
  private parseRiskAssessment(response: string): SequenceRisk[] {
    const risksText = this.extractField(response, 'RISK_ASSESSMENT');
    if (!risksText) return [];

    const riskEntries = risksText.split(',').map(r => r.trim());
    
    return riskEntries.map(riskText => {
      const severity = this.inferRiskSeverity(riskText);
      const riskType = this.inferRiskType(riskText);
      
      return {
        riskType,
        severity,
        description: riskText,
        mitigation: this.suggestMitigation(riskType),
        affectedSteps: [] // Would be populated with more detailed analysis
      };
    });
  }

  /**
   * Generate alternative sequences for comparison
   */
  private generateAlternativeSequences(
    originalSteps: SequenceStep[],
    recommendation: CollaborationRecommendation
  ): OptimizedSequence[] {
    const alternatives: OptimizedSequence[] = [];

    // Alternative 1: Speed-optimized (parallel where possible)
    const speedOptimized = this.createSpeedOptimizedSequence(originalSteps);
    if (speedOptimized.totalDuration < originalSteps.reduce((sum, s) => sum + s.estimatedDuration, 0)) {
      alternatives.push(speedOptimized);
    }

    // Alternative 2: Quality-optimized (more review steps)
    const qualityOptimized = this.createQualityOptimizedSequence(originalSteps);
    if (qualityOptimized.steps.length > originalSteps.length) {
      alternatives.push(qualityOptimized);
    }

    return alternatives;
  }

  /**
   * Create speed-optimized alternative sequence
   */
  private createSpeedOptimizedSequence(originalSteps: SequenceStep[]): OptimizedSequence {
    const optimizedSteps = originalSteps.map(step => ({
      ...step,
      estimatedDuration: Math.round(step.estimatedDuration * 0.8), // 20% faster
      qualityCheckpoints: step.qualityCheckpoints.slice(0, 1) // Fewer checkpoints
    }));

    return {
      steps: optimizedSteps,
      totalDuration: optimizedSteps.reduce((sum, step) => sum + step.estimatedDuration, 0),
      interruptionPoints: this.identifyInterruptionPoints(optimizedSteps),
      riskAssessment: [{
        riskType: 'timing',
        severity: 'medium',
        description: 'Accelerated timeline may compromise quality',
        mitigation: 'Monitor quality checkpoints closely',
        affectedSteps: optimizedSteps.map(s => s.stepId)
      }],
      alternativeSequences: [],
      optimizationReasons: ['Prioritized execution speed', 'Reduced quality checkpoints', 'Compressed timelines']
    };
  }

  /**
   * Create quality-optimized alternative sequence  
   */
  private createQualityOptimizedSequence(originalSteps: SequenceStep[]): OptimizedSequence {
    const enhancedSteps: SequenceStep[] = [];
    
    originalSteps.forEach((step, index) => {
      enhancedSteps.push({
        ...step,
        qualityCheckpoints: [...step.qualityCheckpoints, 'Quality review checkpoint']
      });

      // Add review step after each major step
      if (step.priority >= 7) {
        enhancedSteps.push({
          stepId: `${step.stepId}-review`,
          agentName: 'Quality Reviewer',
          action: `Review and validate output from ${step.agentName}`,
          parameters: { reviewTarget: step.stepId },
          dependencies: [step.stepId],
          estimatedDuration: 15000,
          priority: 8,
          interruptionSafety: 'safe',
          contextRequirements: [step.expectedOutput],
          expectedOutput: 'Quality validation report',
          qualityCheckpoints: ['Output quality assessment']
        });
      }
    });

    return {
      steps: enhancedSteps,
      totalDuration: enhancedSteps.reduce((sum, step) => sum + step.estimatedDuration, 0),
      interruptionPoints: this.identifyInterruptionPoints(enhancedSteps),
      riskAssessment: [{
        riskType: 'timing',
        severity: 'low',
        description: 'Extended timeline for quality assurance',
        mitigation: 'Quality improvements justify additional time',
        affectedSteps: enhancedSteps.map(s => s.stepId)
      }],
      alternativeSequences: [],
      optimizationReasons: ['Prioritized output quality', 'Added review checkpoints', 'Enhanced validation']
    };
  }

  /**
   * Identify interruption points in a sequence
   */
  private identifyInterruptionPoints(steps: SequenceStep[]): InterruptionPoint[] {
    return steps
      .filter(step => step.interruptionSafety === 'safe')
      .map((step, index) => ({
        stepIndex: steps.indexOf(step),
        agentName: step.agentName,
        interruptionSafety: step.interruptionSafety,
        contextPreservation: this.calculateContextPreservation(step, index, steps.length)
      }));
  }

  /**
   * Calculate context preservation score for interruption point
   */
  private calculateContextPreservation(step: SequenceStep, index: number, totalSteps: number): number {
    // Higher preservation for later steps and high-priority steps
    const positionFactor = index / totalSteps;
    const priorityFactor = step.priority / 10;
    return Math.min(1, (positionFactor + priorityFactor) / 2);
  }

  /**
   * Create fallback sequence when LLM planning fails
   */
  private createFallbackSequence(
    recommendation: CollaborationRecommendation,
    options: SequenceOptimizationOptions
  ): OptimizedSequence {
    const steps = recommendation.selectedAgents.map((agent, index) => ({
      stepId: `step-${index + 1}`,
      agentName: agent.name,
      action: `Process request from ${agent.name} perspective`,
      parameters: { userRequest: 'from_context' },
      dependencies: index > 0 ? [`step-${index}`] : [],
      estimatedDuration: 30000,
      priority: Math.max(8 - index, 1),
      interruptionSafety: 'safe' as const,
      contextRequirements: index > 0 ? ['Previous agent output'] : [],
      expectedOutput: `${agent.name} analysis and response`,
      qualityCheckpoints: ['Output completeness', 'Relevance check']
    }));

    return {
      steps,
      totalDuration: steps.reduce((sum, step) => sum + step.estimatedDuration, 0),
      interruptionPoints: this.identifyInterruptionPoints(steps),
      riskAssessment: [{
        riskType: 'context-loss',
        severity: 'medium',
        description: 'Fallback sequence may not be optimally structured',
        mitigation: 'Monitor execution closely for issues',
        affectedSteps: steps.map(s => s.stepId)
      }],
      alternativeSequences: [],
      optimizationReasons: ['Fallback to sequential execution', 'Conservative interruption points']
    };
  }

  /**
   * Record sequence execution results for learning
   */
  recordSequenceExecution(
    userRequest: string,
    sequence: OptimizedSequence,
    actualDuration: number,
    success: boolean,
    interruptionCount: number
  ): void {
    this.sequenceHistory.push({
      userRequest,
      sequence,
      actualDuration,
      success,
      interruptionCount
    });

    console.log(`[📋 SequencePlanner] 📊 Recorded sequence execution: ${success ? 'success' : 'failure'}, ${interruptionCount} interruptions`);
  }

  /**
   * Get sequence planning statistics
   */
  getSequenceStatistics(): Record<string, any> {
    const executions = this.sequenceHistory;
    const successes = executions.filter(e => e.success);

    return {
      totalExecutions: executions.length,
      successRate: executions.length > 0 ? successes.length / executions.length : 0,
      avgDurationAccuracy: this.calculateDurationAccuracy(),
      avgInterruptions: executions.reduce((sum, e) => sum + e.interruptionCount, 0) / executions.length || 0,
      commonOptimizations: this.getMostCommonOptimizations()
    };
  }

  /**
   * Utility methods
   */
  private getDefaultOptions(): SequenceOptimizationOptions {
    return {
      prioritizeSpeed: false,
      prioritizeQuality: true,
      allowParallelization: true,
      minimizeInterruptions: true,
      preserveContext: true,
      agentWorkloadBalance: true
    };
  }

  private createDefaultSteps(): SequenceStep[] {
    return [{
      stepId: 'default-step',
      agentName: 'Primary',
      action: 'Process user request',
      parameters: {},
      dependencies: [],
      estimatedDuration: 30000,
      priority: 5,
      interruptionSafety: 'safe',
      contextRequirements: [],
      expectedOutput: 'Agent response',
      qualityCheckpoints: ['Completeness check']
    }];
  }

  private generateQualityCheckpoints(action: string): string[] {
    if (action.toLowerCase().includes('analyze')) {
      return ['Analysis completeness', 'Data accuracy', 'Conclusion validity'];
    }
    if (action.toLowerCase().includes('review')) {
      return ['Review thoroughness', 'Feedback quality', 'Improvement suggestions'];
    }
    return ['Output completeness', 'Relevance check', 'Quality assessment'];
  }

  private extractFromSection(section: string, field: string): string | null {
    const regex = new RegExp(`${field}:\\s*([^\n]+)`, 'i');
    const match = section.match(regex);
    return match ? match[1].trim() : null;
  }

  private inferRiskSeverity(riskText: string): SequenceRisk['severity'] {
    if (riskText.toLowerCase().includes('critical') || riskText.toLowerCase().includes('major')) {
      return 'critical';
    }
    if (riskText.toLowerCase().includes('high') || riskText.toLowerCase().includes('significant')) {
      return 'high';
    }
    if (riskText.toLowerCase().includes('medium') || riskText.toLowerCase().includes('moderate')) {
      return 'medium';
    }
    return 'low';
  }

  private inferRiskType(riskText: string): SequenceRisk['riskType'] {
    const text = riskText.toLowerCase();
    if (text.includes('dependency') || text.includes('depend')) return 'dependency';
    if (text.includes('timing') || text.includes('duration')) return 'timing';
    if (text.includes('context') || text.includes('handoff')) return 'context-loss';
    if (text.includes('overload') || text.includes('capacity')) return 'agent-overload';
    if (text.includes('interrupt')) return 'interruption-damage';
    return 'dependency';
  }

  private suggestMitigation(riskType: SequenceRisk['riskType']): string {
    switch (riskType) {
      case 'dependency': return 'Validate dependencies before execution';
      case 'timing': return 'Monitor execution timeline closely';
      case 'context-loss': return 'Implement context preservation mechanisms';
      case 'agent-overload': return 'Balance workload distribution';
      case 'interruption-damage': return 'Use safe interruption points only';
      default: return 'Monitor execution and adjust as needed';
    }
  }

  private calculateDurationAccuracy(): number {
    const executions = this.sequenceHistory.filter(e => e.success);
    if (executions.length === 0) return 0;

    const accuracies = executions.map(e => {
      const estimated = e.sequence.totalDuration;
      const actual = e.actualDuration;
      return Math.abs(estimated - actual) / estimated;
    });

    return 1 - (accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length);
  }

  private getMostCommonOptimizations(): string[] {
    const optimizations: Record<string, number> = {};
    
    this.sequenceHistory.forEach(e => {
      e.sequence.optimizationReasons.forEach(reason => {
        optimizations[reason] = (optimizations[reason] || 0) + 1;
      });
    });

    return Object.entries(optimizations)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([reason]) => reason);
  }

  private extractScore(response: string, field: string): number {
    const regex = new RegExp(`${field}:\\s*\\[?(\\d+)`, 'i');
    const match = response.match(regex);
    return match ? parseInt(match[1]) : 0;
  }

  private extractField(response: string, field: string): string | null {
    const regex = new RegExp(`${field}:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = response.match(regex);
    return match ? match[1].trim().replace(/^\[|\]$/g, '') : null;
  }

  private extractList(response: string, field: string): string[] {
    const fieldContent = this.extractField(response, field);
    if (!fieldContent) return [];
    
    return fieldContent
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
}