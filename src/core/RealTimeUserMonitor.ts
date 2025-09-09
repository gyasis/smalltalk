import { EventEmitter } from 'events';
import { createInterface, Interface } from 'readline';

export interface UserInterruption {
  sessionId: string;
  type: InterruptionType;
  message: string;
  timestamp: Date;
  targetAgent?: string;
  newDirection?: string;
}

export type InterruptionType = 'STOP' | 'REDIRECT' | 'AGENT_SWITCH' | 'NEW_PLAN' | 'CLARIFICATION' | 'PAUSE';

export interface MonitoringState {
  isActive: boolean;
  sessionId: string | null;
  startTime: Date | null;
  interruptionCount: number;
}

/**
 * RealTimeUserMonitor - Always-aware orchestrator component
 * 
 * Continuously monitors for user input during agent execution to enable:
 * - Real-time interruptions (stop, redirect, agent switch)
 * - Plan modifications mid-execution
 * - Context-aware user steering
 * 
 * Core capability for interactive orchestration architecture.
 */
export class RealTimeUserMonitor extends EventEmitter {
  private monitoringState: MonitoringState = {
    isActive: false,
    sessionId: null,
    startTime: null,
    interruptionCount: 0
  };

  private readline: Interface | null = null;
  private inputBuffer: string = '';
  private lastInputTime: Date = new Date();

  // Configurable patterns for detecting different types of interruptions
  private interruptionPatterns = {
    STOP: [/^stop/i, /^halt/i, /^pause/i, /^wait/i],
    REDIRECT: [/^change/i, /^instead/i, /^redirect/i, /^no,?\s/i, /^actually/i],
    AGENT_SWITCH: [/^@(\w+)/i, /^switch to/i, /^talk to/i],
    NEW_PLAN: [/^new direction/i, /^start over/i, /^forget that/i, /^different approach/i],
    CLARIFICATION: [/^what/i, /^why/i, /^how/i, /^explain/i],
    PAUSE: [/^pause/i, /^hold on/i, /^give me a second/i]
  };

  constructor() {
    super();
    this.setupSignalHandlers();
    console.log('[🔍 RealTimeUserMonitor] Initialized with interruption detection capabilities');
  }

  /**
   * Start monitoring for user input during agent execution
   */
  startMonitoring(sessionId: string): void {
    if (this.monitoringState.isActive) {
      console.log(`[🔍 RealTimeUserMonitor] Already monitoring session: ${this.monitoringState.sessionId}`);
      return;
    }

    this.monitoringState = {
      isActive: true,
      sessionId,
      startTime: new Date(),
      interruptionCount: 0
    };

    this.setupReadlineInterface();
    console.log(`[🔍 RealTimeUserMonitor] 🚀 Started monitoring session: ${sessionId}`);
    console.log('[🔍 RealTimeUserMonitor] 💡 You can interrupt at any time with: stop, redirect, @agent, etc.');
  }

  /**
   * Stop monitoring user input
   */
  stopMonitoring(sessionId?: string): void {
    if (!this.monitoringState.isActive) {
      return;
    }

    if (sessionId && sessionId !== this.monitoringState.sessionId) {
      console.log(`[🔍 RealTimeUserMonitor] ⚠️ Session mismatch: expected ${this.monitoringState.sessionId}, got ${sessionId}`);
      return;
    }

    const duration = this.monitoringState.startTime ? 
      Date.now() - this.monitoringState.startTime.getTime() : 0;

    console.log(`[🔍 RealTimeUserMonitor] 🛑 Stopped monitoring session: ${this.monitoringState.sessionId}`);
    console.log(`[🔍 RealTimeUserMonitor] 📊 Duration: ${duration}ms, Interruptions: ${this.monitoringState.interruptionCount}`);

    this.cleanup();
  }

  /**
   * Check if currently monitoring for interruptions
   */
  isMonitoring(): boolean {
    return this.monitoringState.isActive;
  }

  /**
   * Get current monitoring state
   */
  getMonitoringState(): MonitoringState {
    return { ...this.monitoringState };
  }

  /**
   * Setup readline interface for capturing user input
   */
  private setupReadlineInterface(): void {
    if (this.readline) {
      this.readline.close();
    }

    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false // Don't echo input to avoid interfering with agent output
    });

    this.readline.on('line', (input: string) => {
      this.handleUserInput(input.trim());
    });

    this.readline.on('SIGINT', () => {
      this.handleUserInput('stop');
    });
  }

  /**
   * Process user input and detect interruptions
   */
  private handleUserInput(input: string): void {
    if (!this.monitoringState.isActive || !input) {
      return;
    }

    this.lastInputTime = new Date();
    this.inputBuffer += input + '\n';

    // Check if this input represents an interruption
    if (this.isInterruption(input)) {
      const interruption = this.createInterruption(input);
      this.monitoringState.interruptionCount++;

      console.log(`\n[🔍 RealTimeUserMonitor] 🚨 INTERRUPTION DETECTED: ${interruption.type}`);
      console.log(`[🔍 RealTimeUserMonitor] 📝 Message: "${interruption.message}"`);
      
      this.emit('user-interruption', interruption);
      
      // Clear buffer after processing interruption
      this.inputBuffer = '';
    } else {
      // Store non-interruption input for context
      this.emit('user-input', {
        sessionId: this.monitoringState.sessionId,
        message: input,
        timestamp: new Date(),
        isInterruption: false
      });
    }
  }

  /**
   * Determine if user input represents an interruption
   */
  private isInterruption(input: string): boolean {
    const inputLower = input.toLowerCase().trim();
    
    // Check against all interruption patterns
    for (const [type, patterns] of Object.entries(this.interruptionPatterns)) {
      if (patterns.some(pattern => pattern.test(inputLower))) {
        return true;
      }
    }

    // Additional heuristics for interruption detection
    if (this.hasInterruptionKeywords(inputLower)) {
      return true;
    }

    return false;
  }

  /**
   * Check for additional interruption keywords
   */
  private hasInterruptionKeywords(input: string): boolean {
    const interruptionKeywords = [
      'interrupt', 'break', 'abort', 'cancel', 'switch', 'change course',
      'hold up', 'wait up', 'time out', 'different', 'wrong direction'
    ];

    return interruptionKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Create a structured interruption object
   */
  private createInterruption(input: string): UserInterruption {
    const type = this.classifyInterruption(input);
    const interruption: UserInterruption = {
      sessionId: this.monitoringState.sessionId!,
      type,
      message: input,
      timestamp: new Date()
    };

    // Extract additional context based on interruption type
    switch (type) {
      case 'AGENT_SWITCH':
        interruption.targetAgent = this.extractTargetAgent(input);
        break;
      case 'REDIRECT':
        interruption.newDirection = this.extractNewDirection(input);
        break;
    }

    return interruption;
  }

  /**
   * Classify the type of interruption
   */
  private classifyInterruption(input: string): InterruptionType {
    const inputLower = input.toLowerCase().trim();

    for (const [type, patterns] of Object.entries(this.interruptionPatterns)) {
      if (patterns.some(pattern => pattern.test(inputLower))) {
        return type as InterruptionType;
      }
    }

    // Default classification
    if (inputLower.includes('?')) return 'CLARIFICATION';
    return 'REDIRECT';
  }

  /**
   * Extract target agent from agent switch command
   */
  private extractTargetAgent(input: string): string | undefined {
    const agentMatch = input.match(/@(\w+)/i);
    if (agentMatch) {
      return agentMatch[1];
    }

    // Try to extract from "switch to" or "talk to" patterns
    const switchMatch = input.match(/(?:switch to|talk to)\s+(\w+)/i);
    if (switchMatch) {
      return switchMatch[1];
    }

    return undefined;
  }

  /**
   * Extract new direction from redirect command
   */
  private extractNewDirection(input: string): string | undefined {
    // Remove interruption keywords to get the actual direction
    const cleaned = input
      .replace(/^(change|instead|redirect|no,?\s|actually)\s*/i, '')
      .trim();

    return cleaned.length > 0 ? cleaned : undefined;
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    process.on('SIGINT', () => {
      if (this.monitoringState.isActive) {
        console.log('\n[🔍 RealTimeUserMonitor] 🛑 Received SIGINT, stopping monitoring...');
        this.stopMonitoring();
      }
    });

    process.on('SIGTERM', () => {
      if (this.monitoringState.isActive) {
        console.log('\n[🔍 RealTimeUserMonitor] 🛑 Received SIGTERM, stopping monitoring...');
        this.stopMonitoring();
      }
    });
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    this.monitoringState = {
      isActive: false,
      sessionId: null,
      startTime: null,
      interruptionCount: 0
    };

    this.inputBuffer = '';
  }

  /**
   * Get statistics about monitoring activity
   */
  getStatistics() {
    const currentTime = new Date();
    const uptime = this.monitoringState.startTime ? 
      currentTime.getTime() - this.monitoringState.startTime.getTime() : 0;

    return {
      isActive: this.monitoringState.isActive,
      sessionId: this.monitoringState.sessionId,
      uptime,
      interruptionCount: this.monitoringState.interruptionCount,
      lastInputTime: this.lastInputTime,
      bufferSize: this.inputBuffer.length
    };
  }
}