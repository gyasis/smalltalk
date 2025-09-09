import * as yaml from 'yaml';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { AgentConfig } from '../types/index.js';

export interface AgentManifest {
  config: AgentConfig;
  capabilities?: {
    expertise?: string[];
    tools?: string[];
    personalityTraits?: string[];
    taskTypes?: string[];
    complexity?: 'basic' | 'intermediate' | 'advanced' | 'expert';
    contextAwareness?: number;
    collaborationStyle?: string;
  };
  metadata?: {
    version?: string;
    author?: string;
    description?: string;
    tags?: string[];
    created?: string;
    updated?: string;
  };
}

export interface ManifestValidationError {
  field: string;
  message: string;
  value?: any;
}

export class ManifestParser {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  /**
   * Parse agent manifest from file (YAML or JSON)
   */
  public parseManifestFile(filePath: string): AgentManifest {
    const absolutePath = resolve(this.baseDir, filePath);
    
    if (!existsSync(absolutePath)) {
      throw new Error(`Manifest file not found: ${absolutePath}`);
    }

    try {
      const content = readFileSync(absolutePath, 'utf-8');
      const manifest = this.parseManifestContent(content, absolutePath);
      
      // Resolve file paths relative to manifest location
      this.resolveFilePaths(manifest, dirname(absolutePath));
      
      // Validate the manifest
      this.validateManifest(manifest);
      
      return manifest;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse manifest ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Parse manifest content (auto-detects YAML/JSON)
   */
  private parseManifestContent(content: string, filePath: string): AgentManifest {
    const ext = filePath.toLowerCase();
    
    if (ext.endsWith('.json')) {
      return JSON.parse(content);
    } else if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
      return yaml.parse(content);
    } else {
      // Try to auto-detect format
      try {
        // Try JSON first
        return JSON.parse(content);
      } catch {
        // Fall back to YAML
        return yaml.parse(content);
      }
    }
  }

  /**
   * Resolve relative file paths in the manifest
   */
  private resolveFilePaths(manifest: AgentManifest, manifestDir: string): void {
    const config = manifest.config;
    
    // Resolve system prompt file
    if (config.systemPromptFile) {
      config.systemPromptFile = this.resolveFilePath(config.systemPromptFile, manifestDir);
    }
    
    // Resolve prompt template files
    if (config.promptTemplateFiles) {
      for (const [key, filePath] of Object.entries(config.promptTemplateFiles)) {
        config.promptTemplateFiles[key] = this.resolveFilePath(filePath, manifestDir);
      }
    }
  }

  /**
   * Resolve a single file path relative to manifest directory
   */
  private resolveFilePath(filePath: string, manifestDir: string): string {
    if (filePath.startsWith('/')) {
      // Absolute path
      return filePath;
    } else if (filePath.startsWith('./') || filePath.startsWith('../')) {
      // Relative to manifest directory
      return resolve(manifestDir, filePath);
    } else {
      // Relative to manifest directory (no prefix)
      return resolve(manifestDir, filePath);
    }
  }

  /**
   * Validate agent manifest structure
   */
  private validateManifest(manifest: AgentManifest): void {
    const errors: ManifestValidationError[] = [];

    // Validate required config fields
    if (!manifest.config) {
      errors.push({ field: 'config', message: 'Agent config is required' });
      throw new Error(`Invalid manifest: ${errors.map(e => e.message).join(', ')}`);
    }

    if (!manifest.config.name) {
      errors.push({ field: 'config.name', message: 'Agent name is required' });
    }

    // Validate file references exist
    if (manifest.config.systemPromptFile && !existsSync(manifest.config.systemPromptFile)) {
      errors.push({ 
        field: 'config.systemPromptFile', 
        message: `System prompt file not found: ${manifest.config.systemPromptFile}`,
        value: manifest.config.systemPromptFile
      });
    }

    // Validate prompt template files exist
    if (manifest.config.promptTemplateFiles) {
      for (const [key, filePath] of Object.entries(manifest.config.promptTemplateFiles)) {
        if (!existsSync(filePath)) {
          errors.push({ 
            field: `config.promptTemplateFiles.${key}`, 
            message: `Prompt template file not found: ${filePath}`,
            value: filePath
          });
        }
      }
    }

    // Validate capabilities if present
    if (manifest.capabilities) {
      const validComplexityLevels = ['basic', 'intermediate', 'advanced', 'expert'];
      if (manifest.capabilities.complexity && !validComplexityLevels.includes(manifest.capabilities.complexity)) {
        errors.push({ 
          field: 'capabilities.complexity', 
          message: `Invalid complexity level. Must be one of: ${validComplexityLevels.join(', ')}`,
          value: manifest.capabilities.complexity
        });
      }

      if (manifest.capabilities.contextAwareness !== undefined) {
        const awareness = manifest.capabilities.contextAwareness;
        if (typeof awareness !== 'number' || awareness < 0 || awareness > 1) {
          errors.push({ 
            field: 'capabilities.contextAwareness', 
            message: 'Context awareness must be a number between 0 and 1',
            value: awareness
          });
        }
      }
    }

    if (errors.length > 0) {
      const errorMessage = errors.map(e => `${e.field}: ${e.message}`).join('\n');
      throw new Error(`Invalid manifest:\n${errorMessage}`);
    }
  }

  /**
   * Create a basic manifest template
   */
  public static createTemplate(agentName: string): AgentManifest {
    return {
      config: {
        name: agentName,
        model: 'gpt-4o-mini',
        personality: 'helpful and knowledgeable',
        temperature: 0.7,
        maxTokens: 2048,
        tools: [],
        mcpServers: [],
        promptTemplates: {},
        promptTemplateFiles: {}
      },
      capabilities: {
        expertise: [],
        tools: [],
        personalityTraits: ['helpful', 'knowledgeable'],
        taskTypes: ['conversation'],
        complexity: 'intermediate',
        contextAwareness: 0.8,
        collaborationStyle: 'collaborative'
      },
      metadata: {
        version: '1.0.0',
        author: '',
        description: `${agentName} agent configuration`,
        tags: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }
    };
  }

  /**
   * Convert manifest to YAML string
   */
  public static toYaml(manifest: AgentManifest): string {
    return yaml.stringify(manifest, {
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0
    });
  }

  /**
   * Convert manifest to JSON string
   */
  public static toJson(manifest: AgentManifest, pretty: boolean = true): string {
    return JSON.stringify(manifest, null, pretty ? 2 : 0);
  }
}

export default ManifestParser;