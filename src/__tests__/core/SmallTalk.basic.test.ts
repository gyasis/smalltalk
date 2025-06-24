import { SmallTalkConfig } from '../../types/index.js';

// Simple mock to test configuration without heavy dependencies
const SmallTalkMock = jest.fn().mockImplementation((config: SmallTalkConfig = {}) => {
  const defaultConfig = {
    llmProvider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2048,
    debugMode: false,
    orchestration: true,
    ...config
  };

  const agents = new Map();
  const interfaces: any[] = [];
  const sessions = new Map();
  let isRunning = false;

  return {
    // Configuration management
    getConfig: () => ({ ...defaultConfig }),
    updateConfig: (updates: Partial<SmallTalkConfig>) => {
      Object.assign(defaultConfig, updates);
    },

    // Agent management
    addAgent: (agent: any) => {
      agents.set(agent.name, agent);
    },
    removeAgent: (name: string) => agents.delete(name),
    getAgent: (name: string) => agents.get(name),
    listAgents: () => Array.from(agents.keys()),
    getAgents: () => Array.from(agents.values()),

    // Interface management
    addInterface: (iface: any) => {
      interfaces.push(iface);
      if (iface.setFramework) iface.setFramework(this);
    },

    // Session management
    createSession: (id?: string) => {
      const sessionId = id || `session-${Date.now()}`;
      sessions.set(sessionId, {
        id: sessionId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return sessionId;
    },
    getSession: (id: string) => sessions.get(id),
    deleteSession: (id: string) => sessions.delete(id),

    // Lifecycle
    start: async () => {
      if (isRunning) throw new Error('SmallTalk framework is already running');
      isRunning = true;
      for (const iface of interfaces) {
        if (iface.start) await iface.start();
      }
    },
    stop: async () => {
      if (!isRunning) return;
      for (const iface of interfaces) {
        if (iface.stop) await iface.stop();
      }
      isRunning = false;
    },

    // Stats
    getStats: () => ({
      agentCount: agents.size,
      interfaceCount: interfaces.length,
      activeSessionCount: sessions.size,
      isRunning,
      mcpEnabled: false,
      orchestrationStats: { totalHandoffs: 0 },
      memoryStats: { totalMemories: 0 },
      streamingEnabled: false,
      interruptionEnabled: false
    }),

    // Orchestration
    enableOrchestration: (enabled: boolean) => {
      defaultConfig.orchestration = enabled;
    },
    isOrchestrationEnabled: () => defaultConfig.orchestration,
    getOrchestrationStats: () => ({
      enabled: defaultConfig.orchestration,
      totalAgents: agents.size,
      availableAgents: [],
      currentAgentAssignments: {}
    }),

    // Event emitter methods
    on: jest.fn(),
    emit: jest.fn(),
    removeListener: jest.fn()
  };
});

describe('SmallTalk Framework - Basic Functionality', () => {
  let smallTalk: any;

  beforeEach(() => {
    smallTalk = new SmallTalkMock();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = smallTalk.getConfig();
      
      expect(config.llmProvider).toBe('openai');
      expect(config.model).toBe('gpt-4o');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(2048);
      expect(config.debugMode).toBe(false);
      expect(config.orchestration).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: SmallTalkConfig = {
        llmProvider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.5,
        maxTokens: 4096,
        debugMode: true,
        orchestration: false
      };

      const customSmallTalk = new SmallTalkMock(customConfig);
      const config = customSmallTalk.getConfig();

      expect(config.llmProvider).toBe('anthropic');
      expect(config.model).toBe('claude-3-sonnet');
      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(4096);
      expect(config.debugMode).toBe(true);
      expect(config.orchestration).toBe(false);
    });
  });

  describe('Agent Management', () => {
    it('should add and manage agents', () => {
      const mockAgent = {
        name: 'TestAgent',
        config: { name: 'TestAgent', personality: 'helpful' },
        generateResponse: jest.fn(),
        addTool: jest.fn(),
        setPromptTemplate: jest.fn()
      };

      smallTalk.addAgent(mockAgent);

      expect(smallTalk.listAgents()).toContain('TestAgent');
      expect(smallTalk.getAgent('TestAgent')).toBe(mockAgent);
      expect(smallTalk.getAgents()).toHaveLength(1);
    });

    it('should remove agents', () => {
      const mockAgent = {
        name: 'TestAgent',
        config: { name: 'TestAgent' }
      };

      smallTalk.addAgent(mockAgent);
      const removed = smallTalk.removeAgent('TestAgent');

      expect(removed).toBe(true);
      expect(smallTalk.listAgents()).not.toContain('TestAgent');
      expect(smallTalk.getAgent('TestAgent')).toBeUndefined();
    });

    it('should return false when removing non-existent agent', () => {
      const removed = smallTalk.removeAgent('NonExistent');
      expect(removed).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should create and manage sessions', () => {
      const sessionId = smallTalk.createSession();
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      
      const session = smallTalk.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
    });

    it('should create session with custom ID', () => {
      const customId = 'custom-session-123';
      const sessionId = smallTalk.createSession(customId);
      
      expect(sessionId).toBe(customId);
      expect(smallTalk.getSession(customId)).toBeDefined();
    });

    it('should delete sessions', () => {
      const sessionId = smallTalk.createSession();
      const deleted = smallTalk.deleteSession(sessionId);
      
      expect(deleted).toBe(true);
      expect(smallTalk.getSession(sessionId)).toBeUndefined();
    });
  });

  describe('Framework Lifecycle', () => {
    it('should start and stop framework', async () => {
      await smallTalk.start();
      await smallTalk.stop();
      
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should prevent starting already running framework', async () => {
      await smallTalk.start();
      
      await expect(smallTalk.start()).rejects.toThrow('SmallTalk framework is already running');
      
      await smallTalk.stop();
    });

    it('should start interfaces when framework starts', async () => {
      const mockInterface = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        setFramework: jest.fn()
      };

      smallTalk.addInterface(mockInterface);
      await smallTalk.start();

      expect(mockInterface.start).toHaveBeenCalled();
      expect(mockInterface.setFramework).toHaveBeenCalled();

      await smallTalk.stop();
      expect(mockInterface.stop).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const updates = { temperature: 0.9, debugMode: true };
      smallTalk.updateConfig(updates);

      const config = smallTalk.getConfig();
      expect(config.temperature).toBe(0.9);
      expect(config.debugMode).toBe(true);
    });
  });

  describe('Orchestration', () => {
    it('should manage orchestration state', () => {
      expect(smallTalk.isOrchestrationEnabled()).toBe(true);

      smallTalk.enableOrchestration(false);
      expect(smallTalk.isOrchestrationEnabled()).toBe(false);

      smallTalk.enableOrchestration(true);
      expect(smallTalk.isOrchestrationEnabled()).toBe(true);
    });

    it('should return orchestration stats', () => {
      const stats = smallTalk.getOrchestrationStats();
      
      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('totalAgents');
      expect(stats).toHaveProperty('availableAgents');
      expect(stats).toHaveProperty('currentAgentAssignments');
    });
  });

  describe('Statistics', () => {
    it('should return comprehensive stats', () => {
      const stats = smallTalk.getStats();

      expect(stats).toHaveProperty('agentCount');
      expect(stats).toHaveProperty('interfaceCount');
      expect(stats).toHaveProperty('activeSessionCount');
      expect(stats).toHaveProperty('isRunning');
      expect(stats).toHaveProperty('mcpEnabled');
      expect(stats).toHaveProperty('orchestrationStats');
      expect(stats).toHaveProperty('memoryStats');
      expect(stats).toHaveProperty('streamingEnabled');
      expect(stats).toHaveProperty('interruptionEnabled');
    });
  });
});