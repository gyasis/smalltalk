import { EventEmitter } from 'events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  ListToolsRequest,
  CallToolRequest,
  ListResourcesRequest,
  ReadResourceRequest,
  ListPromptsRequest,
  GetPromptRequest
} from '@modelcontextprotocol/sdk/types.js';
import {
  MCPServerConfig,
  ToolDefinition,
  PromptTemplate
} from '../types/index.js';

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export class MCPClient extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private isConnected = false;

  constructor() {
    super();
  }

  public async connect(serverConfig: MCPServerConfig): Promise<void> {
    if (this.clients.has(serverConfig.name)) {
      throw new Error(`MCP server '${serverConfig.name}' is already connected`);
    }

    try {
      const client = await this.createClient(serverConfig);
      this.clients.set(serverConfig.name, client);
      this.serverConfigs.set(serverConfig.name, serverConfig);

      this.emit('server_connected', {
        serverName: serverConfig.name,
        serverType: serverConfig.type
      });

      console.log(`[MCPClient] Connected to server: ${serverConfig.name}`);
    } catch (error) {
      console.error(`[MCPClient] Failed to connect to server ${serverConfig.name}:`, error);
      throw error;
    }
  }

  private async createClient(config: MCPServerConfig): Promise<Client> {
    let transport;

    if (config.type === 'stdio') {
      if (!config.command) {
        throw new Error(`Command is required for stdio MCP server: ${config.name}`);
      }

      transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: config.env
      });
    } else if (config.type === 'http') {
      if (!config.url) {
        throw new Error(`URL is required for HTTP MCP server: ${config.name}`);
      }

      transport = new SSEClientTransport(new URL(config.url));
    } else {
      throw new Error(`Unsupported MCP server type: ${config.type}`);
    }

    const client = new Client({
      name: 'smalltalk-framework',
      version: '0.1.0'
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });

    await client.connect(transport);
    return client;
  }

  public async disconnect(serverName?: string): Promise<void> {
    if (serverName) {
      const client = this.clients.get(serverName);
      if (client) {
        await client.close();
        this.clients.delete(serverName);
        this.serverConfigs.delete(serverName);
        
        this.emit('server_disconnected', { serverName });
        console.log(`[MCPClient] Disconnected from server: ${serverName}`);
      }
    } else {
      // Disconnect all servers
      for (const [name, client] of this.clients) {
        try {
          await client.close();
          this.emit('server_disconnected', { serverName: name });
          console.log(`[MCPClient] Disconnected from server: ${name}`);
        } catch (error) {
          console.error(`[MCPClient] Error disconnecting from ${name}:`, error);
        }
      }
      this.clients.clear();
      this.serverConfigs.clear();
    }

    this.isConnected = this.clients.size > 0;
  }

  public async getAvailableTools(): Promise<ToolDefinition[]> {
    const allTools: ToolDefinition[] = [];

    for (const [serverName, client] of this.clients) {
      try {
        const request: ListToolsRequest = {
          method: 'tools/list',
          params: {}
        };

        const response = await client.request(request);
        
        if (response.tools) {
          for (const tool of response.tools) {
            const toolDef: ToolDefinition = {
              name: `${serverName}:${tool.name}`,
              description: tool.description || '',
              parameters: tool.inputSchema || {},
              handler: async (params: Record<string, unknown>) => {
                return await this.executeTool(serverName, tool.name, params);
              }
            };
            allTools.push(toolDef);
          }
        }
      } catch (error) {
        console.error(`[MCPClient] Failed to list tools from ${serverName}:`, error);
      }
    }

    return allTools;
  }

  public async executeTool(
    serverName: string, 
    toolName: string, 
    parameters: Record<string, unknown>
  ): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server '${serverName}' is not connected`);
    }

    try {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: parameters
        }
      };

      const response = await client.request(request);
      
      this.emit('tool_executed', {
        serverName,
        toolName,
        parameters,
        result: response.content
      });

      return response.content;
    } catch (error) {
      console.error(`[MCPClient] Tool execution failed (${serverName}:${toolName}):`, error);
      throw error;
    }
  }

  public async getAvailableResources(): Promise<MCPResource[]> {
    const allResources: MCPResource[] = [];

    for (const [serverName, client] of this.clients) {
      try {
        const request: ListResourcesRequest = {
          method: 'resources/list',
          params: {}
        };

        const response = await client.request(request);
        
        if (response.resources) {
          for (const resource of response.resources) {
            allResources.push({
              uri: resource.uri,
              name: resource.name,
              description: resource.description,
              mimeType: resource.mimeType
            });
          }
        }
      } catch (error) {
        console.error(`[MCPClient] Failed to list resources from ${serverName}:`, error);
      }
    }

    return allResources;
  }

  public async readResource(uri: string): Promise<string | undefined> {
    // Find which server can handle this resource
    for (const [serverName, client] of this.clients) {
      try {
        const request: ReadResourceRequest = {
          method: 'resources/read',
          params: { uri }
        };

        const response = await client.request(request);
        
        if (response.contents && response.contents.length > 0) {
          const content = response.contents[0];
          if (content.text) {
            this.emit('resource_read', { serverName, uri, content: content.text });
            return content.text;
          } else if (content.blob) {
            // Handle binary content
            this.emit('resource_read', { serverName, uri, content: 'Binary content' });
            return 'Binary content (not displayed)';
          }
        }
      } catch (error) {
        // Continue to next server if this one can't handle the resource
        continue;
      }
    }

    throw new Error(`No MCP server can read resource: ${uri}`);
  }

  public async getAvailablePrompts(): Promise<MCPPrompt[]> {
    const allPrompts: MCPPrompt[] = [];

    for (const [serverName, client] of this.clients) {
      try {
        const request: ListPromptsRequest = {
          method: 'prompts/list',
          params: {}
        };

        const response = await client.request(request);
        
        if (response.prompts) {
          for (const prompt of response.prompts) {
            allPrompts.push({
              name: `${serverName}:${prompt.name}`,
              description: prompt.description,
              arguments: prompt.arguments
            });
          }
        }
      } catch (error) {
        console.error(`[MCPClient] Failed to list prompts from ${serverName}:`, error);
      }
    }

    return allPrompts;
  }

  public async getPrompt(
    serverName: string, 
    promptName: string, 
    arguments_?: Record<string, string>
  ): Promise<PromptTemplate | undefined> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server '${serverName}' is not connected`);
    }

    try {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: promptName,
          arguments: arguments_
        }
      };

      const response = await client.request(request);
      
      if (response.messages && response.messages.length > 0) {
        const message = response.messages[0];
        if (message.content.type === 'text') {
          const template: PromptTemplate = {
            name: `${serverName}:${promptName}`,
            template: message.content.text,
            variables: Object.keys(arguments_ || {}),
            description: response.description
          };

          this.emit('prompt_retrieved', {
            serverName,
            promptName,
            template
          });

          return template;
        }
      }
    } catch (error) {
      console.error(`[MCPClient] Failed to get prompt (${serverName}:${promptName}):`, error);
      throw error;
    }

    return undefined;
  }

  public getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  public isServerConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }

  public getServerConfig(serverName: string): MCPServerConfig | undefined {
    return this.serverConfigs.get(serverName);
  }

  public async testConnection(serverName: string): Promise<boolean> {
    const client = this.clients.get(serverName);
    if (!client) {
      return false;
    }

    try {
      // Try to list tools as a simple health check
      const request: ListToolsRequest = {
        method: 'tools/list',
        params: {}
      };
      
      await client.request(request);
      return true;
    } catch (error) {
      console.error(`[MCPClient] Connection test failed for ${serverName}:`, error);
      return false;
    }
  }

  public getStats(): {
    connectedServers: number;
    serverNames: string[];
    isConnected: boolean;
  } {
    return {
      connectedServers: this.clients.size,
      serverNames: this.getConnectedServers(),
      isConnected: this.isConnected
    };
  }

  public async reconnect(serverName: string): Promise<void> {
    const config = this.serverConfigs.get(serverName);
    if (!config) {
      throw new Error(`No configuration found for server: ${serverName}`);
    }

    // Disconnect if already connected
    if (this.clients.has(serverName)) {
      await this.disconnect(serverName);
    }

    // Reconnect
    await this.connect(config);
  }

  public async reconnectAll(): Promise<void> {
    const configs = Array.from(this.serverConfigs.values());
    
    // Disconnect all
    await this.disconnect();

    // Reconnect all
    for (const config of configs) {
      try {
        await this.connect(config);
      } catch (error) {
        console.error(`[MCPClient] Failed to reconnect to ${config.name}:`, error);
      }
    }
  }
}