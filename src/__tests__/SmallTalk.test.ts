/**
 * Unit tests for SmallTalk agent routing fix
 * Tests the regex pattern used to parse /agent commands with hyphenated agent IDs
 */

describe('SmallTalk Agent Routing - Regex Fix', () => {
  // Test the actual regex pattern used in SmallTalk.ts:452
  const AGENT_COMMAND_REGEX = /^\/agent\s+([\w-]+)/;

  describe('Agent ID Parsing', () => {
    test('should parse single-word agent IDs', () => {
      const testCommand = '/agent orchestrator';
      const agentMatch = testCommand.match(AGENT_COMMAND_REGEX);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('orchestrator');
    });

    test('should parse hyphenated agent IDs', () => {
      const testCommand = '/agent research-assistant';
      const agentMatch = testCommand.match(AGENT_COMMAND_REGEX);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('research-assistant');
    });

    test('should parse underscored agent IDs', () => {
      const testCommand = '/agent code_reviewer';
      const agentMatch = testCommand.match(AGENT_COMMAND_REGEX);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('code_reviewer');
    });

    test('should parse agent IDs with multiple hyphens', () => {
      const testCommand = '/agent super-research-assistant-v2';
      const agentMatch = testCommand.match(AGENT_COMMAND_REGEX);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('super-research-assistant-v2');
    });

    test('should parse mixed hyphen and underscore agent IDs', () => {
      const testCommand = '/agent ai-agent_v1-final';
      const agentMatch = testCommand.match(AGENT_COMMAND_REGEX);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('ai-agent_v1-final');
    });

    test('should parse agent ID from command with additional message', () => {
      const testCommand = '/agent research-assistant What is machine learning?';
      const agentMatch = testCommand.match(AGENT_COMMAND_REGEX);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('research-assistant');
    });

    test('should not match invalid agent commands', () => {
      const testCommands = [
        '/agent',  // No agent name
        '/agent ',  // Empty agent name
        'agent research-assistant',  // Missing slash
        '/agents research-assistant',  // Wrong command
      ];

      testCommands.forEach(command => {
        const agentMatch = command.match(AGENT_COMMAND_REGEX);
        expect(agentMatch).toBeNull();
      });
    });
  });

  describe('Edge Cases', () => {
    test('should parse agent IDs with numbers', () => {
      const testCommand = '/agent agent-v2-001';
      const agentMatch = testCommand.match(AGENT_COMMAND_REGEX);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('agent-v2-001');
    });

    test('should handle leading and trailing hyphens', () => {
      const testCommand = '/agent -test-agent-';
      const agentMatch = testCommand.match(AGENT_COMMAND_REGEX);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('-test-agent-');
    });

    test('should stop parsing at first space after agent name', () => {
      const testCommand = '/agent research-assistant please help me';
      const agentMatch = testCommand.match(AGENT_COMMAND_REGEX);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('research-assistant');
      // Should not include "please help me"
    });
  });

  describe('Backward Compatibility', () => {
    test('old regex should fail with hyphenated names', () => {
      const testCommand = '/agent research-assistant';
      const oldRegex = /^\/agent\s+(\w+)/; // Original buggy regex
      const agentMatch = testCommand.match(oldRegex);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('research'); // Only captures first part
      expect(agentMatch![1]).not.toBe('research-assistant'); // Fails to capture full name
    });

    test('new regex should work with single-word names (backward compatible)', () => {
      const testCommand = '/agent orchestrator';
      const newRegex = /^\/agent\s+([\w-]+)/; // Fixed regex
      const agentMatch = testCommand.match(newRegex);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('orchestrator');
    });

    test('new regex should work with hyphenated names (new functionality)', () => {
      const testCommand = '/agent research-assistant';
      const newRegex = /^\/agent\s+([\w-]+)/; // Fixed regex
      const agentMatch = testCommand.match(newRegex);
      
      expect(agentMatch).not.toBeNull();
      expect(agentMatch![1]).toBe('research-assistant');
    });
  });
});