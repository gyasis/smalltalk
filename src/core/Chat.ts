import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import {
  ChatMessage,
  ChatSession,
  SmallTalkConfig,
  FlowContext
} from '../types/index.js';
import { TokenJSWrapper } from '../utils/TokenJSWrapper.js';

export class Chat extends EventEmitter {
  private config: SmallTalkConfig;
  private llmWrapper: TokenJSWrapper;
  private sessions: Map<string, ChatSession> = new Map();

  constructor(config: SmallTalkConfig) {
    super();
    this.config = config;
    this.llmWrapper = new TokenJSWrapper(config);
  }

  public createSession(sessionId?: string): ChatSession {
    const id = sessionId || nanoid();
    const session: ChatSession = {
      id,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.sessions.set(id, session);
    this.emit('session_created', session);
    
    return session;
  }

  public getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  public deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.emit('session_deleted', session);
      return true;
    }
    return false;
  }

  public addMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const fullMessage: ChatMessage = {
      id: nanoid(),
      timestamp: new Date(),
      ...message
    };

    session.messages.push(fullMessage);
    session.updatedAt = new Date();

    this.emit('message_added', { session, message: fullMessage });
    
    return fullMessage;
  }

  public getMessages(sessionId: string, limit?: number): ChatMessage[] {
    const session = this.getSession(sessionId);
    if (!session) {
      return [];
    }

    if (limit && limit > 0) {
      return session.messages.slice(-limit);
    }

    return [...session.messages];
  }

  public clearMessages(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.messages = [];
      session.updatedAt = new Date();
      this.emit('messages_cleared', session);
    }
  }

  public async generateResponse(
    sessionId: string,
    userMessage: string,
    context: FlowContext
  ): Promise<string> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Add user message
    const message = this.addMessage(sessionId, {
      role: 'user',
      content: userMessage
    });

    try {
      // Generate response using the agent if available
      if (context.agent) {
        const response = await context.agent.generateResponse(userMessage, context);
        
        // Add assistant response
        this.addMessage(sessionId, {
          role: 'assistant',
          content: response,
          agentName: context.agent.name
        });

        return response;
      } else {
        // Direct LLM call without agent
        const response = await this.llmWrapper.generateResponse(session.messages);
        
        // Add assistant response
        this.addMessage(sessionId, {
          role: 'assistant',
          content: response.content
        });

        return response.content;
      }
    } catch (error) {
      const errorMessage = `Error generating response: ${error instanceof Error ? error.message : String(error)}`;
      
      // Add error message to session
      this.addMessage(sessionId, {
        role: 'system',
        content: errorMessage
      });

      throw error;
    }
  }

  public async generateStreamResponse(
    sessionId: string,
    userMessage: string,
    context: FlowContext,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Add user message
    this.addMessage(sessionId, {
      role: 'user',
      content: userMessage
    });

    try {
      // For now, streaming is handled directly by TokenJS wrapper
      // TODO: Implement agent streaming support
      const response = await this.llmWrapper.generateStreamResponse(
        session.messages,
        {
          provider: this.config.llmProvider,
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        },
        onChunk
      );

      // Add assistant response
      this.addMessage(sessionId, {
        role: 'assistant',
        content: response,
        agentName: context.agent?.name
      });

      return response;
    } catch (error) {
      const errorMessage = `Error generating stream response: ${error instanceof Error ? error.message : String(error)}`;
      
      // Add error message to session
      this.addMessage(sessionId, {
        role: 'system',
        content: errorMessage
      });

      throw error;
    }
  }

  public exportSession(sessionId: string, format: 'json' | 'text' = 'json'): string {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (format === 'json') {
      return JSON.stringify(session, null, 2);
    } else {
      // Text format
      let text = `Chat Session: ${session.id}\n`;
      text += `Created: ${session.createdAt.toISOString()}\n`;
      text += `Updated: ${session.updatedAt.toISOString()}\n`;
      text += `Messages: ${session.messages.length}\n\n`;

      for (const message of session.messages) {
        const timestamp = message.timestamp.toLocaleString();
        const role = message.role.toUpperCase();
        const agentInfo = message.agentName ? ` (${message.agentName})` : '';
        
        text += `[${timestamp}] ${role}${agentInfo}: ${message.content}\n\n`;
      }

      return text;
    }
  }

  public importSession(data: string, format: 'json' | 'text' = 'json'): ChatSession {
    if (format === 'json') {
      try {
        const sessionData = JSON.parse(data) as ChatSession;
        
        // Validate session data
        if (!sessionData.id || !Array.isArray(sessionData.messages)) {
          throw new Error('Invalid session data format');
        }

        // Ensure timestamps are Date objects
        sessionData.createdAt = new Date(sessionData.createdAt);
        sessionData.updatedAt = new Date(sessionData.updatedAt);
        sessionData.messages = sessionData.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));

        this.sessions.set(sessionData.id, sessionData);
        this.emit('session_imported', sessionData);
        
        return sessionData;
      } catch (error) {
        throw new Error(`Failed to import session: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      throw new Error('Text format import not yet implemented');
    }
  }

  public getSessionStats(sessionId: string): {
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    systemMessages: number;
    duration: number;
    averageMessageLength: number;
  } | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const messages = session.messages;
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant' || m.role === 'agent').length;
    const systemMessages = messages.filter(m => m.role === 'system').length;
    
    const duration = session.updatedAt.getTime() - session.createdAt.getTime();
    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    const averageMessageLength = messages.length > 0 ? totalLength / messages.length : 0;

    return {
      messageCount: messages.length,
      userMessages,
      assistantMessages,
      systemMessages,
      duration,
      averageMessageLength
    };
  }

  public listSessions(): Array<{
    id: string;
    messageCount: number;
    createdAt: Date;
    updatedAt: Date;
    activeAgent?: string;
  }> {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      messageCount: session.messages.length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      activeAgent: session.activeAgent
    }));
  }

  public updateConfig(newConfig: Partial<SmallTalkConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.llmWrapper.updateConfig(this.config);
  }
}