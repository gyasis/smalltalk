/**
 * GroupConversationManager Contract Tests
 *
 * Shared contract test suite that validates ANY GroupConversationManager implementation
 * against the defined interface requirements.
 *
 * TDD Phase: RED - These tests are designed to FAIL until implementation
 *
 * @see specs/001-production-robustness/contracts/GroupConversationManager.contract.ts
 * @see specs/001-production-robustness/spec.md FR-017 to FR-021
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';
import {
  GroupConversationManager,
  CreateGroupOptions,
  SpeakerSelectionContext,
  SpeakerSelectionResult,
  GroupConversationStats,
} from '../../specs/001-production-robustness/contracts/GroupConversationManager.contract';
import { Agent } from '../../src/agents/Agent';

// Type definitions needed for Phase 6 (to be added to src/types/robustness.ts)
/**
 * Message entity for group conversations
 */
export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  agentId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Speaker selection strategy enumeration
 */
export enum SpeakerSelectionStrategy {
  ROUND_ROBIN = 'round-robin',
  LLM_BASED = 'llm-based',
  PRIORITY = 'priority',
}

/**
 * Workflow task status
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Workflow task entity
 */
export interface WorkflowTask {
  id: string;
  description: string;
  assignedAgentId?: string;
  status: TaskStatus;
  createdAt: Date;
  completedAt?: Date;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

/**
 * Group conversation entity
 */
export interface GroupConversation {
  id: string;
  agentIds: string[];
  conversationHistory: Message[];
  sharedContext: Record<string, any>;
  speakerSelection: SpeakerSelectionStrategy;
  lastSpeakerId?: string;
  workflowState: {
    tasks: WorkflowTask[];
    currentTaskId?: string;
    completedTaskIds: string[];
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    speakerSelections: number;
    [key: string]: any;
  };
  consecutiveSpeakerTurns: Map<string, number>;
}

/**
 * Test Helper: Create mock agent
 */
function createMockAgent(
  id: string,
  overrides?: Record<string, any>
): any {
  return {
    id,
    name: `Agent ${id}`,
    personality: 'helpful',
    ...overrides,
  };
}

/**
 * Test Helper: Create mock message
 */
function createMockMessage(
  role: 'user' | 'agent' | 'system',
  content: string,
  agentId?: string
): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    agentId,
    timestamp: Date.now(),
    metadata: {},
  };
}

/**
 * Test Helper: Create workflow task
 */
function createWorkflowTask(
  description: string,
  overrides?: Partial<WorkflowTask>
): WorkflowTask {
  return {
    id: crypto.randomUUID(),
    description,
    status: TaskStatus.PENDING,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Test Helper: Measure execution time
 */
async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Test Helper: Validate UUID v4 format
 */
function isValidUUIDv4(id: string): boolean {
  const uuidv4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(id);
}

/**
 * Contract Test Suite Factory
 *
 * This function creates a complete contract test suite for any GroupConversationManager
 * implementation. Import this function and call it with your implementation's
 * factory function.
 *
 * @param createManager Factory function that creates a GroupConversationManager instance
 *
 * @example
 * ```typescript
 * import { runGroupConversationManagerContractTests } from './group-conversation-manager.shared.test.js';
 * import { DefaultGroupConversationManager } from './DefaultGroupConversationManager.js';
 *
 * describe('DefaultGroupConversationManager', () => {
 *   runGroupConversationManagerContractTests(() => new DefaultGroupConversationManager());
 * });
 * ```
 */
export function runGroupConversationManagerContractTests(
  createManager: () => GroupConversationManager
) {
  let manager: GroupConversationManager;

  beforeEach(async () => {
    manager = createManager();
  });

  afterEach(async () => {
    // Cleanup - implementations should handle cleanup in their own lifecycle
  });

  // =========================================================================
  // Part 1: Group Creation and Basic Operations
  // =========================================================================

  describe('GroupConversationManager Contract - Group Creation', () => {
    describe('createGroup()', () => {
      it('should create group with 2 agents minimum (FR-017)', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        const group = await manager.createGroup(agents);

        expect(group).toBeDefined();
        expect(group.id).toBeDefined();
        expect(isValidUUIDv4(group.id)).toBe(true);
        expect(group.agentIds).toEqual(['agent1', 'agent2']);
        expect(group.agentIds.length).toBeGreaterThanOrEqual(2);
      });

      it('should support up to 10 agents maximum (FR-036)', async () => {
        const agents = Array.from({ length: 10 }, (_, i) =>
          createMockAgent(`agent${i + 1}`)
        );

        const group = await manager.createGroup(agents);

        expect(group).toBeDefined();
        expect(group.agentIds.length).toBe(10);
      });

      it('should reject groups with more than 10 agents (FR-036)', async () => {
        const agents = Array.from({ length: 11 }, (_, i) =>
          createMockAgent(`agent${i + 1}`)
        );

        await expect(manager.createGroup(agents)).rejects.toThrow();
      });

      it('should reject groups with fewer than 2 agents', async () => {
        const singleAgent = [createMockAgent('agent1')];

        await expect(manager.createGroup(singleAgent)).rejects.toThrow();
      });

      it('should initialize with default round-robin speaker selection (FR-018)', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        const group = await manager.createGroup(agents);

        expect(group.speakerSelection).toBe(SpeakerSelectionStrategy.ROUND_ROBIN);
      });

      it('should accept custom speaker selection strategy', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const options: CreateGroupOptions = {
          speakerSelection: SpeakerSelectionStrategy.LLM_BASED,
        };

        const group = await manager.createGroup(agents, options);

        expect(group.speakerSelection).toBe(SpeakerSelectionStrategy.LLM_BASED);
      });

      it('should initialize empty conversation history (FR-019)', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        const group = await manager.createGroup(agents);

        expect(group.conversationHistory).toBeDefined();
        expect(Array.isArray(group.conversationHistory)).toBe(true);
        expect(group.conversationHistory.length).toBe(0);
      });

      it('should initialize empty shared context (FR-019)', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        const group = await manager.createGroup(agents);

        expect(group.sharedContext).toBeDefined();
        expect(typeof group.sharedContext).toBe('object');
        expect(Object.keys(group.sharedContext).length).toBe(0);
      });

      it('should accept initial shared context', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const options: CreateGroupOptions = {
          initialContext: { topic: 'test', priority: 'high' },
        };

        const group = await manager.createGroup(agents, options);

        expect(group.sharedContext).toEqual({ topic: 'test', priority: 'high' });
      });

      it('should initialize workflow state (FR-021)', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        const group = await manager.createGroup(agents);

        expect(group.workflowState).toBeDefined();
        expect(group.workflowState.tasks).toBeDefined();
        expect(Array.isArray(group.workflowState.tasks)).toBe(true);
        expect(group.workflowState.completedTaskIds).toBeDefined();
        expect(Array.isArray(group.workflowState.completedTaskIds)).toBe(true);
      });

      it('should set creation and update timestamps', async () => {
        const beforeCreate = Date.now();
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        const group = await manager.createGroup(agents);
        const afterCreate = Date.now();

        expect(group.metadata.createdAt).toBeInstanceOf(Date);
        expect(group.metadata.updatedAt).toBeInstanceOf(Date);
        expect(group.metadata.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
        expect(group.metadata.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);
      });

      it('should initialize metadata counters', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        const group = await manager.createGroup(agents);

        expect(group.metadata.messageCount).toBe(0);
        expect(group.metadata.speakerSelections).toBe(0);
      });
    });

    describe('addAgent()', () => {
      it('should add agent to existing group', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const newAgent = createMockAgent('agent3');
        await manager.addAgent(group.id, newAgent);

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.agentIds).toContain('agent3');
        expect(updated!.agentIds.length).toBe(3);
      });

      it('should reject adding agent beyond 10 agent limit (FR-036)', async () => {
        const agents = Array.from({ length: 10 }, (_, i) =>
          createMockAgent(`agent${i + 1}`)
        );
        const group = await manager.createGroup(agents);

        const newAgent = createMockAgent('agent11');

        await expect(manager.addAgent(group.id, newAgent)).rejects.toThrow();
      });

      it('should prevent duplicate agent IDs', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const duplicateAgent = createMockAgent('agent1');

        await expect(manager.addAgent(group.id, duplicateAgent)).rejects.toThrow();
      });

      it('should update metadata.updatedAt timestamp', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);
        const originalUpdatedAt = group.metadata.updatedAt.getTime();

        await new Promise((resolve) => setTimeout(resolve, 10));

        const newAgent = createMockAgent('agent3');
        await manager.addAgent(group.id, newAgent);

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.metadata.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
      });
    });

    describe('removeAgent()', () => {
      it('should remove agent from group', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
          createMockAgent('agent3'),
        ];
        const group = await manager.createGroup(agents);

        await manager.removeAgent(group.id, 'agent3');

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.agentIds).not.toContain('agent3');
        expect(updated!.agentIds.length).toBe(2);
      });

      it('should reject removal if it would leave fewer than 2 agents', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        await expect(manager.removeAgent(group.id, 'agent1')).rejects.toThrow();
      });

      it('should throw error for non-existent agent', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        await expect(manager.removeAgent(group.id, 'nonexistent')).rejects.toThrow();
      });

      it('should update metadata.updatedAt timestamp', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
          createMockAgent('agent3'),
        ];
        const group = await manager.createGroup(agents);
        const originalUpdatedAt = group.metadata.updatedAt.getTime();

        await new Promise((resolve) => setTimeout(resolve, 10));

        await manager.removeAgent(group.id, 'agent3');

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.metadata.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
      });
    });

    describe('getConversation()', () => {
      it('should retrieve existing conversation', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const retrieved = manager.getConversation(group.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(group.id);
        expect(retrieved!.agentIds).toEqual(['agent1', 'agent2']);
      });

      it('should return null for non-existent conversation', () => {
        const nonExistentId = crypto.randomUUID();

        const retrieved = manager.getConversation(nonExistentId);

        expect(retrieved).toBeNull();
      });
    });

    describe('endConversation()', () => {
      it('should end conversation and cleanup resources', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        await manager.endConversation(group.id);

        const retrieved = manager.getConversation(group.id);
        expect(retrieved).toBeNull();
      });

      it('should handle ending non-existent conversation gracefully', async () => {
        const nonExistentId = crypto.randomUUID();

        await expect(manager.endConversation(nonExistentId)).resolves.not.toThrow();
      });
    });
  });

  // =========================================================================
  // Part 2: Speaker Selection Strategies
  // =========================================================================

  describe('GroupConversationManager Contract - Speaker Selection', () => {
    describe('Round-Robin Strategy (FR-018)', () => {
      it('should select speakers in round-robin order', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
          createMockAgent('agent3'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.ROUND_ROBIN,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const speaker1 = await manager.selectSpeaker(group.id, context);
        const speaker2 = await manager.selectSpeaker(group.id, {
          ...context,
          lastSpeakerId: speaker1.agentId,
        });
        const speaker3 = await manager.selectSpeaker(group.id, {
          ...context,
          lastSpeakerId: speaker2.agentId,
        });
        const speaker4 = await manager.selectSpeaker(group.id, {
          ...context,
          lastSpeakerId: speaker3.agentId,
        });

        expect(speaker1.agentId).toBe('agent1');
        expect(speaker2.agentId).toBe('agent2');
        expect(speaker3.agentId).toBe('agent3');
        expect(speaker4.agentId).toBe('agent1'); // Wraps around
      });

      it('should maintain rotation across multiple calls', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.ROUND_ROBIN,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const selections: string[] = [];
        let lastSpeakerId: string | undefined;

        for (let i = 0; i < 6; i++) {
          const result = await manager.selectSpeaker(group.id, {
            ...context,
            lastSpeakerId,
          });
          selections.push(result.agentId);
          lastSpeakerId = result.agentId;
        }

        expect(selections).toEqual([
          'agent1',
          'agent2',
          'agent1',
          'agent2',
          'agent1',
          'agent2',
        ]);
      });

      it('should complete speaker selection in <100ms (SC-013)', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.ROUND_ROBIN,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const { duration } = await measureTime(() =>
          manager.selectSpeaker(group.id, context)
        );

        expect(duration).toBeLessThan(100);
      });

      it('should measure p95 latency <100ms over 100 selections', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.ROUND_ROBIN,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const durations: number[] = [];
        let lastSpeakerId: string | undefined;

        for (let i = 0; i < 100; i++) {
          const { result, duration } = await measureTime(() =>
            manager.selectSpeaker(group.id, {
              ...context,
              lastSpeakerId,
            })
          );
          durations.push(duration);
          lastSpeakerId = result.agentId;
        }

        durations.sort((a, b) => a - b);
        const p95Index = Math.floor(100 * 0.95);
        const p95Latency = durations[p95Index];

        expect(p95Latency).toBeLessThan(100);
      });
    });

    describe('LLM-Based Strategy (FR-018)', () => {
      it('should select contextually appropriate speaker', async () => {
        const agents = [
          createMockAgent('analyst'),
          createMockAgent('coder'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.LLM_BASED,
        });

        const userMessage = createMockMessage(
          'user',
          'Can you help me debug this Python function?'
        );

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          userMessage,
          sharedContext: {},
        };

        const result = await manager.selectSpeaker(group.id, context);

        // LLM should select 'coder' based on capabilities matching
        expect(result.agentId).toBe('coder');
        expect(result.confidence).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });

      it('should provide reasoning for selection', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.LLM_BASED,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          userMessage: createMockMessage('user', 'Hello'),
          sharedContext: {},
        };

        const result = await manager.selectSpeaker(group.id, context);

        expect(result.reasoning).toBeDefined();
        expect(typeof result.reasoning).toBe('string');
        expect(result.reasoning!.length).toBeGreaterThan(0);
      });

      it('should complete selection in <100ms p95 (SC-013)', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.LLM_BASED,
        });

        const durations: number[] = [];

        for (let i = 0; i < 100; i++) {
          const context: SpeakerSelectionContext = {
            conversationHistory: [],
            availableAgents: agents,
            userMessage: createMockMessage('user', `Message ${i}`),
            sharedContext: {},
          };

          const { duration } = await measureTime(() =>
            manager.selectSpeaker(group.id, context)
          );
          durations.push(duration);
        }

        durations.sort((a, b) => a - b);
        const p95Index = Math.floor(100 * 0.95);
        const p95Latency = durations[p95Index];

        expect(p95Latency).toBeLessThan(100);
      });

      it('should fallback to round-robin on LLM failure', async () => {
        // This test validates graceful degradation when LLM is unavailable
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.LLM_BASED,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        // Should not throw even if LLM fails
        const result = await manager.selectSpeaker(group.id, context);
        expect(result).toBeDefined();
        expect(result.agentId).toBeDefined();
      });
    });

    describe('Priority-Based Strategy (FR-018)', () => {
      it('should select highest priority agent', async () => {
        const agents = [
          createMockAgent('low'),
          createMockAgent('high'),
          createMockAgent('medium'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.PRIORITY,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const result = await manager.selectSpeaker(group.id, context);

        expect(result.agentId).toBe('high');
      });

      it('should use round-robin for agents with equal priority', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
          createMockAgent('agent3'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.PRIORITY,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const selections: string[] = [];
        let lastSpeakerId: string | undefined;

        for (let i = 0; i < 6; i++) {
          const result = await manager.selectSpeaker(group.id, {
            ...context,
            lastSpeakerId,
          });
          selections.push(result.agentId);
          lastSpeakerId = result.agentId;
        }

        // Should rotate through all three
        expect(new Set(selections).size).toBe(3);
      });

      it('should complete selection in <100ms (SC-013)', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.PRIORITY,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const { duration } = await measureTime(() =>
          manager.selectSpeaker(group.id, context)
        );

        expect(duration).toBeLessThan(100);
      });
    });

    describe('Speaker Selection Throttling (FR-020)', () => {
      it('should prevent more than 3 consecutive turns by same speaker', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.PRIORITY,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const selections: string[] = [];
        let lastSpeakerId: string | undefined;

        // Request 6 selections
        for (let i = 0; i < 6; i++) {
          const result = await manager.selectSpeaker(group.id, {
            ...context,
            lastSpeakerId,
          });
          selections.push(result.agentId);
          lastSpeakerId = result.agentId;
        }

        // Count consecutive turns
        let maxConsecutive = 0;
        let currentConsecutive = 1;
        for (let i = 1; i < selections.length; i++) {
          if (selections[i] === selections[i - 1]) {
            currentConsecutive++;
            maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
          } else {
            currentConsecutive = 1;
          }
        }

        expect(maxConsecutive).toBeLessThanOrEqual(3);
      });

      it('should apply 1-turn cooldown after max consecutive turns', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.PRIORITY,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const selections: string[] = [];
        let lastSpeakerId: string | undefined;

        for (let i = 0; i < 5; i++) {
          const result = await manager.selectSpeaker(group.id, {
            ...context,
            lastSpeakerId,
          });
          selections.push(result.agentId);
          lastSpeakerId = result.agentId;
        }

        // After 3 consecutive turns by agent1, should force agent2
        expect(selections[3]).not.toBe(selections[2]);
      });

      it('should allow override for critical events', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.PRIORITY,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: { criticalEvent: true },
        };

        // Even with throttling, critical events can override
        // Implementation should check sharedContext.criticalEvent flag
        const result = await manager.selectSpeaker(group.id, context);

        expect(result).toBeDefined();
        // Should allow selection even if throttled
      });
    });

    describe('setSelectionStrategy()', () => {
      it('should change speaker selection strategy', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.ROUND_ROBIN,
        });

        manager.setSelectionStrategy(group.id, SpeakerSelectionStrategy.PRIORITY);

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.speakerSelection).toBe(SpeakerSelectionStrategy.PRIORITY);
      });

      it('should apply new strategy to subsequent selections', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.ROUND_ROBIN,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        // First selection with round-robin
        const result1 = await manager.selectSpeaker(group.id, context);
        expect(result1.agentId).toBe('agent1'); // Round-robin starts at first

        // Change to priority
        manager.setSelectionStrategy(group.id, SpeakerSelectionStrategy.PRIORITY);

        // Next selection should use priority
        const result2 = await manager.selectSpeaker(group.id, context);
        expect(result2.agentId).toBe('agent2'); // Highest priority
      });
    });
  });

  // =========================================================================
  // Part 3: Shared Context and Conversation History
  // =========================================================================

  describe('GroupConversationManager Contract - Shared Context', () => {
    describe('updateSharedContext() (FR-019)', () => {
      it('should update shared context with new values', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        manager.updateSharedContext(group.id, {
          topic: 'testing',
          priority: 'high',
        });

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.sharedContext.topic).toBe('testing');
        expect(updated!.sharedContext.priority).toBe('high');
      });

      it('should merge with existing context', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          initialContext: { existing: 'value' },
        });

        manager.updateSharedContext(group.id, {
          new: 'data',
        });

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.sharedContext.existing).toBe('value');
        expect(updated!.sharedContext.new).toBe('data');
      });

      it('should overwrite existing keys', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          initialContext: { key: 'old' },
        });

        manager.updateSharedContext(group.id, {
          key: 'new',
        });

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.sharedContext.key).toBe('new');
      });

      it('should support nested objects', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        manager.updateSharedContext(group.id, {
          nested: {
            deep: {
              value: 42,
            },
          },
        });

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.sharedContext.nested.deep.value).toBe(42);
      });

      it('should update metadata.updatedAt timestamp', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);
        const originalUpdatedAt = group.metadata.updatedAt.getTime();

        await new Promise((resolve) => setTimeout(resolve, 10));

        manager.updateSharedContext(group.id, { updated: true });

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.metadata.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt
        );
      });
    });

    describe('handleMessage() (FR-019)', () => {
      it('should add user message to conversation history', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const userMessage = createMockMessage('user', 'Hello agents!');
        await manager.handleMessage(group.id, userMessage);

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.conversationHistory.length).toBeGreaterThan(0);
        expect(updated!.conversationHistory[0].role).toBe('user');
        expect(updated!.conversationHistory[0].content).toBe('Hello agents!');
      });

      it('should trigger speaker selection', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const userMessage = createMockMessage('user', 'Test message');
        const responses = await manager.handleMessage(group.id, userMessage);

        expect(responses).toBeDefined();
        expect(Array.isArray(responses)).toBe(true);
        expect(responses.length).toBeGreaterThan(0);
      });

      it('should add agent response(s) to conversation history', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const userMessage = createMockMessage('user', 'Test message');
        await manager.handleMessage(group.id, userMessage);

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();

        const agentMessages = updated!.conversationHistory.filter(
          (msg) => msg.role === 'agent'
        );
        expect(agentMessages.length).toBeGreaterThan(0);
      });

      it('should preserve message chronological order', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        for (let i = 1; i <= 5; i++) {
          const message = createMockMessage('user', `Message ${i}`);
          await manager.handleMessage(group.id, message);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();

        const userMessages = updated!.conversationHistory.filter(
          (msg) => msg.role === 'user'
        );

        // Verify chronological order
        for (let i = 1; i < userMessages.length; i++) {
          expect(userMessages[i].timestamp).toBeGreaterThanOrEqual(
            userMessages[i - 1].timestamp
          );
        }
      });

      it('should increment metadata.messageCount', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const initialCount = group.metadata.messageCount;

        const userMessage = createMockMessage('user', 'Test');
        await manager.handleMessage(group.id, userMessage);

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.metadata.messageCount).toBeGreaterThan(initialCount);
      });

      it('should make shared context available to all agents', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          initialContext: { sharedData: 'accessible' },
        });

        const userMessage = createMockMessage('user', 'Can you see shared data?');
        const responses = await manager.handleMessage(group.id, userMessage);

        // Implementation should provide sharedContext to agents
        expect(responses).toBeDefined();
        // Agents should have access to sharedContext during processing
      });
    });
  });

  // =========================================================================
  // Part 4: Workflow State Management
  // =========================================================================

  describe('GroupConversationManager Contract - Workflow State', () => {
    describe('Workflow State Tracking (FR-021)', () => {
      it('should track workflow tasks', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        expect(group.workflowState).toBeDefined();
        expect(group.workflowState.tasks).toBeDefined();
        expect(Array.isArray(group.workflowState.tasks)).toBe(true);
      });

      it('should support adding tasks to workflow', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        // Implementation should provide method to add tasks
        // This validates the data structure supports task addition
        const conversation = manager.getConversation(group.id);
        expect(conversation).not.toBeNull();
        expect(conversation!.workflowState.tasks).toBeDefined();
      });

      it('should track task completion status', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        expect(group.workflowState.completedTaskIds).toBeDefined();
        expect(Array.isArray(group.workflowState.completedTaskIds)).toBe(true);
      });

      it('should track current task in workflow', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        expect(group.workflowState.currentTaskId).toBeDefined();
      });

      it('should persist workflow state across operations', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        // Perform operations
        const userMessage = createMockMessage('user', 'Start task');
        await manager.handleMessage(group.id, userMessage);

        // Workflow state should persist
        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.workflowState).toBeDefined();
      });
    });
  });

  // =========================================================================
  // Part 5: Statistics and Metrics
  // =========================================================================

  describe('GroupConversationManager Contract - Statistics', () => {
    describe('getStats()', () => {
      it('should return active conversation count', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        // Create multiple groups
        await manager.createGroup(agents);
        await manager.createGroup(agents);

        const stats = manager.getStats();

        expect(stats.activeConversations).toBeGreaterThanOrEqual(2);
      });

      it('should return total message count', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const userMessage = createMockMessage('user', 'Test');
        await manager.handleMessage(group.id, userMessage);

        const stats = manager.getStats();

        expect(stats.totalMessages).toBeGreaterThan(0);
      });

      it('should track selections by strategy', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.ROUND_ROBIN,
        });

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        await manager.selectSpeaker(group.id, context);

        const stats = manager.getStats();

        expect(stats.selectionsByStrategy).toBeDefined();
        expect(stats.selectionsByStrategy['round-robin']).toBeGreaterThan(0);
      });

      it('should calculate average selection latency', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        // Perform multiple selections
        for (let i = 0; i < 10; i++) {
          await manager.selectSpeaker(group.id, context);
        }

        const stats = manager.getStats();

        expect(stats.avgSelectionLatencyMs).toBeDefined();
        expect(typeof stats.avgSelectionLatencyMs).toBe('number');
        expect(stats.avgSelectionLatencyMs).toBeGreaterThan(0);
      });

      it('should calculate average agents per conversation', async () => {
        const agents2 = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const agents3 = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
          createMockAgent('agent3'),
        ];

        await manager.createGroup(agents2);
        await manager.createGroup(agents3);

        const stats = manager.getStats();

        expect(stats.avgAgentsPerConversation).toBeDefined();
        expect(stats.avgAgentsPerConversation).toBeGreaterThanOrEqual(2);
        expect(stats.avgAgentsPerConversation).toBeLessThanOrEqual(3);
      });

      it('should track successful vs failed conversations', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        await manager.createGroup(agents);

        const stats = manager.getStats();

        expect(stats.successfulConversations).toBeDefined();
        expect(typeof stats.successfulConversations).toBe('number');
        expect(stats.failedConversations).toBeDefined();
        expect(typeof stats.failedConversations).toBe('number');
      });

      it('should calculate success rate', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        await manager.createGroup(agents);

        const stats = manager.getStats();

        expect(stats.successRate).toBeDefined();
        expect(typeof stats.successRate).toBe('number');
        expect(stats.successRate).toBeGreaterThanOrEqual(0);
        expect(stats.successRate).toBeLessThanOrEqual(1);
      });
    });
  });

  // =========================================================================
  // Part 6: Performance and Scalability
  // =========================================================================

  describe('GroupConversationManager Contract - Performance', () => {
    describe('Speaker Selection Performance (SC-013)', () => {
      it('should maintain <100ms p95 latency with 10 agents', async () => {
        const agents = Array.from({ length: 10 }, (_, i) =>
          createMockAgent(`agent${i + 1}`)
        );
        const group = await manager.createGroup(agents, {
          speakerSelection: SpeakerSelectionStrategy.PRIORITY,
        });

        const durations: number[] = [];

        for (let i = 0; i < 100; i++) {
          const context: SpeakerSelectionContext = {
            conversationHistory: [],
            availableAgents: agents,
            sharedContext: {},
          };

          const { duration } = await measureTime(() =>
            manager.selectSpeaker(group.id, context)
          );
          durations.push(duration);
        }

        durations.sort((a, b) => a - b);
        const p95Index = Math.floor(100 * 0.95);
        const p95Latency = durations[p95Index];

        expect(p95Latency).toBeLessThan(100);
      });

      it('should handle concurrent speaker selections', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        // Concurrent selections
        const selections = await Promise.all([
          manager.selectSpeaker(group.id, context),
          manager.selectSpeaker(group.id, context),
          manager.selectSpeaker(group.id, context),
        ]);

        expect(selections.length).toBe(3);
        selections.forEach((result) => {
          expect(result.agentId).toBeDefined();
          expect(result.latencyMs).toBeLessThan(100);
        });
      });
    });

    describe('Message Handling Performance', () => {
      it('should handle rapid message sequences', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const messagePromises = [];
        for (let i = 0; i < 20; i++) {
          const message = createMockMessage('user', `Message ${i}`);
          messagePromises.push(manager.handleMessage(group.id, message));
        }

        await Promise.all(messagePromises);

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.conversationHistory.length).toBeGreaterThanOrEqual(20);
      });

      it('should maintain conversation history integrity under load', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        // Send messages sequentially to ensure order
        for (let i = 1; i <= 50; i++) {
          const message = createMockMessage('user', `Message ${i}`);
          await manager.handleMessage(group.id, message);
        }

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();

        // Verify no messages lost
        const userMessages = updated!.conversationHistory.filter(
          (msg) => msg.role === 'user'
        );
        expect(userMessages.length).toBe(50);

        // Verify order preserved
        for (let i = 0; i < userMessages.length - 1; i++) {
          expect(userMessages[i + 1].timestamp).toBeGreaterThanOrEqual(
            userMessages[i].timestamp
          );
        }
      });
    });

    describe('Scalability', () => {
      it('should support multiple concurrent group conversations', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        const groups = await Promise.all([
          manager.createGroup(agents),
          manager.createGroup(agents),
          manager.createGroup(agents),
          manager.createGroup(agents),
          manager.createGroup(agents),
        ]);

        expect(groups.length).toBe(5);
        groups.forEach((group) => {
          expect(group).toBeDefined();
          expect(group.id).toBeDefined();
        });

        const stats = manager.getStats();
        expect(stats.activeConversations).toBeGreaterThanOrEqual(5);
      });

      it('should handle long conversation histories efficiently', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        // Build long history
        for (let i = 0; i < 100; i++) {
          const message = createMockMessage('user', `Long history message ${i}`);
          await manager.handleMessage(group.id, message);
        }

        // Should still perform well
        const context: SpeakerSelectionContext = {
          conversationHistory: manager.getConversation(group.id)!
            .conversationHistory,
          availableAgents: agents,
          sharedContext: {},
        };

        const { duration } = await measureTime(() =>
          manager.selectSpeaker(group.id, context)
        );

        expect(duration).toBeLessThan(100);
      });
    });
  });

  // =========================================================================
  // Part 7: Error Handling and Edge Cases
  // =========================================================================

  describe('GroupConversationManager Contract - Error Handling', () => {
    describe('Validation Errors', () => {
      it('should throw error for invalid conversation ID', async () => {
        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: [],
          sharedContext: {},
        };

        await expect(
          manager.selectSpeaker('invalid-id', context)
        ).rejects.toThrow();
      });

      it('should throw error for empty agent list', async () => {
        await expect(manager.createGroup([])).rejects.toThrow();
      });

      it('should throw error when adding non-existent conversation', async () => {
        const agent = createMockAgent('agent1');
        const nonExistentId = crypto.randomUUID();

        await expect(manager.addAgent(nonExistentId, agent)).rejects.toThrow();
      });

      it('should throw error when removing from non-existent conversation', async () => {
        const nonExistentId = crypto.randomUUID();

        await expect(
          manager.removeAgent(nonExistentId, 'agent1')
        ).rejects.toThrow();
      });

      it('should handle null/undefined in updateSharedContext', () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        expect(async () => {
          const group = await manager.createGroup(agents);
          manager.updateSharedContext(group.id, null as any);
        }).rejects.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle agent with no capabilities', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];

        const group = await manager.createGroup(agents);

        expect(group).toBeDefined();
        expect(group.agentIds.length).toBe(2);
      });

      it('should handle empty conversation history in speaker selection', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const result = await manager.selectSpeaker(group.id, context);

        expect(result).toBeDefined();
        expect(result.agentId).toBeDefined();
      });

      it('should handle empty shared context', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
        ];
        const group = await manager.createGroup(agents);

        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents,
          sharedContext: {},
        };

        const result = await manager.selectSpeaker(group.id, context);

        expect(result).toBeDefined();
      });

      it('should handle conversation with minimum 2 agents throughout lifecycle', async () => {
        const agents = [
          createMockAgent('agent1'),
          createMockAgent('agent2'),
          createMockAgent('agent3'),
        ];
        const group = await manager.createGroup(agents);

        // Remove to minimum
        await manager.removeAgent(group.id, 'agent3');

        const updated = manager.getConversation(group.id);
        expect(updated).not.toBeNull();
        expect(updated!.agentIds.length).toBe(2);

        // Should still function
        const context: SpeakerSelectionContext = {
          conversationHistory: [],
          availableAgents: agents.slice(0, 2),
          sharedContext: {},
        };

        const result = await manager.selectSpeaker(group.id, context);
        expect(result).toBeDefined();
      });
    });
  });
}
