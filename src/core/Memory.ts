import { EventEmitter } from 'events';
import {
  ChatMessage,
  MemoryConfig,
  SmallTalkConfig
} from '../types/index.js';
import { TokenJSWrapper } from '../utils/TokenJSWrapper.js';

export class Memory extends EventEmitter {
  private config: MemoryConfig;
  private llmWrapper?: TokenJSWrapper;

  constructor(config: MemoryConfig, llmConfig?: SmallTalkConfig) {
    super();
    this.config = {
      maxMessages: 100,
      truncationStrategy: 'sliding_window',
      contextSize: 4000,
      ...config
    };

    if (llmConfig && this.config.truncationStrategy === 'summarization') {
      this.llmWrapper = new TokenJSWrapper(llmConfig);
    }
  }

  public async truncateContext(messages: ChatMessage[]): Promise<ChatMessage[]> {
    if (!this.config.maxMessages || messages.length <= this.config.maxMessages) {
      return messages;
    }

    switch (this.config.truncationStrategy) {
      case 'sliding_window':
        return this.slidingWindowTruncate(messages);
      
      case 'summarization':
        return await this.summarizationTruncate(messages);
      
      case 'hybrid':
        return await this.hybridTruncate(messages);
      
      default:
        return this.slidingWindowTruncate(messages);
    }
  }

  private slidingWindowTruncate(messages: ChatMessage[]): ChatMessage[] {
    const maxMessages = this.config.maxMessages!;
    
    if (messages.length <= maxMessages) {
      return messages;
    }

    // Keep the most recent messages
    const truncated = messages.slice(-maxMessages);
    
    this.emit('context_truncated', {
      strategy: 'sliding_window',
      originalLength: messages.length,
      truncatedLength: truncated.length,
      removedCount: messages.length - truncated.length
    });

    return truncated;
  }

  private async summarizationTruncate(messages: ChatMessage[]): Promise<ChatMessage[]> {
    if (!this.llmWrapper) {
      console.warn('[Memory] LLM wrapper not available for summarization, falling back to sliding window');
      return this.slidingWindowTruncate(messages);
    }

    const maxMessages = this.config.maxMessages!;
    
    if (messages.length <= maxMessages) {
      return messages;
    }

    // Keep recent messages and summarize older ones
    const recentCount = Math.floor(maxMessages * 0.7); // Keep 70% as recent
    const recentMessages = messages.slice(-recentCount);
    const oldMessages = messages.slice(0, -recentCount);

    if (oldMessages.length === 0) {
      return recentMessages;
    }

    try {
      // Create conversation text for summarization
      const conversationText = oldMessages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const summaryPrompt = `Please provide a concise summary of the following conversation that preserves the key context and important details:

${conversationText}

Summary:`;

      const summaryResponse = await this.llmWrapper.generateResponse([
        {
          id: 'summary-request',
          role: 'user',
          content: summaryPrompt,
          timestamp: new Date()
        }
      ], {
        model: this.config.summaryModel,
        maxTokens: 300,
        temperature: 0.3
      });

      // Create summary message
      const summaryMessage: ChatMessage = {
        id: 'context-summary',
        role: 'system',
        content: `[Context Summary]: ${summaryResponse.content}`,
        timestamp: oldMessages[0]?.timestamp || new Date(),
        metadata: {
          type: 'summary',
          originalMessageCount: oldMessages.length,
          summaryCreatedAt: new Date().toISOString()
        }
      };

      const result = [summaryMessage, ...recentMessages];

      this.emit('context_truncated', {
        strategy: 'summarization',
        originalLength: messages.length,
        truncatedLength: result.length,
        summarizedCount: oldMessages.length,
        summaryLength: summaryResponse.content.length
      });

      return result;
    } catch (error) {
      console.error('[Memory] Summarization failed, falling back to sliding window:', error);
      return this.slidingWindowTruncate(messages);
    }
  }

  private async hybridTruncate(messages: ChatMessage[]): Promise<ChatMessage[]> {
    const maxMessages = this.config.maxMessages!;
    
    if (messages.length <= maxMessages) {
      return messages;
    }

    // Use sliding window for moderate overflow, summarization for large overflow
    const overflowRatio = messages.length / maxMessages;
    
    if (overflowRatio < 1.5) {
      // Small overflow, use sliding window
      return this.slidingWindowTruncate(messages);
    } else {
      // Large overflow, use summarization
      return await this.summarizationTruncate(messages);
    }
  }

  public estimateTokenCount(messages: ChatMessage[]): number {
    // Rough estimation: ~4 characters per token
    const totalChars = messages.reduce((sum, msg) => {
      return sum + msg.content.length + msg.role.length + 10; // +10 for metadata
    }, 0);
    
    return Math.ceil(totalChars / 4);
  }

  public async truncateByTokens(messages: ChatMessage[], maxTokens: number): Promise<ChatMessage[]> {
    let currentTokens = 0;
    const result: ChatMessage[] = [];

    // Work backwards from the most recent messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateTokenCount([message]);
      
      if (currentTokens + messageTokens <= maxTokens) {
        result.unshift(message);
        currentTokens += messageTokens;
      } else {
        break;
      }
    }

    if (result.length < messages.length) {
      this.emit('context_truncated', {
        strategy: 'token_limit',
        originalLength: messages.length,
        truncatedLength: result.length,
        removedCount: messages.length - result.length,
        tokenCount: currentTokens,
        maxTokens
      });
    }

    return result;
  }

  public findImportantMessages(
    messages: ChatMessage[],
    criteria: {
      includeFirstMessage?: boolean;
      includeSystemMessages?: boolean;
      includeToolCalls?: boolean;
      keywordFilter?: string[];
      roleFilter?: ChatMessage['role'][];
    } = {}
  ): ChatMessage[] {
    const important: ChatMessage[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      let isImportant = false;

      // First message
      if (criteria.includeFirstMessage && i === 0) {
        isImportant = true;
      }

      // System messages
      if (criteria.includeSystemMessages && message.role === 'system') {
        isImportant = true;
      }

      // Tool calls (based on metadata)
      if (criteria.includeToolCalls && message.metadata?.toolCall) {
        isImportant = true;
      }

      // Keyword filter
      if (criteria.keywordFilter && criteria.keywordFilter.length > 0) {
        const hasKeyword = criteria.keywordFilter.some(keyword =>
          message.content.toLowerCase().includes(keyword.toLowerCase())
        );
        if (hasKeyword) {
          isImportant = true;
        }
      }

      // Role filter
      if (criteria.roleFilter && criteria.roleFilter.includes(message.role)) {
        isImportant = true;
      }

      if (isImportant) {
        important.push(message);
      }
    }

    return important;
  }

  public compressMessages(messages: ChatMessage[]): ChatMessage[] {
    const compressed: ChatMessage[] = [];
    let currentGroup: ChatMessage[] = [];
    let currentRole: string | null = null;

    for (const message of messages) {
      if (message.role === currentRole && currentRole !== 'system') {
        // Group consecutive messages from the same role (except system)
        currentGroup.push(message);
      } else {
        // Finalize previous group
        if (currentGroup.length > 0) {
          if (currentGroup.length === 1) {
            compressed.push(currentGroup[0]);
          } else {
            // Merge multiple messages from the same role
            const mergedContent = currentGroup.map(m => m.content).join('\n\n');
            compressed.push({
              ...currentGroup[0],
              content: mergedContent,
              metadata: {
                ...currentGroup[0].metadata,
                merged: true,
                originalMessageCount: currentGroup.length
              }
            });
          }
        }

        // Start new group
        currentGroup = [message];
        currentRole = message.role;
      }
    }

    // Handle final group
    if (currentGroup.length > 0) {
      if (currentGroup.length === 1) {
        compressed.push(currentGroup[0]);
      } else {
        const mergedContent = currentGroup.map(m => m.content).join('\n\n');
        compressed.push({
          ...currentGroup[0],
          content: mergedContent,
          metadata: {
            ...currentGroup[0].metadata,
            merged: true,
            originalMessageCount: currentGroup.length
          }
        });
      }
    }

    if (compressed.length < messages.length) {
      this.emit('messages_compressed', {
        originalLength: messages.length,
        compressedLength: compressed.length,
        compressionRatio: compressed.length / messages.length
      });
    }

    return compressed;
  }

  public updateConfig(newConfig: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', this.config);
  }

  public getConfig(): Readonly<MemoryConfig> {
    return Object.freeze({ ...this.config });
  }

  public getStats(): {
    strategy: string;
    maxMessages: number;
    contextSize: number;
    hasSummarization: boolean;
  } {
    return {
      strategy: this.config.truncationStrategy || 'sliding_window',
      maxMessages: this.config.maxMessages || 100,
      contextSize: this.config.contextSize || 4000,
      hasSummarization: !!this.llmWrapper
    };
  }
}