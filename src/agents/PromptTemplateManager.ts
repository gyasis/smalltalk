import { PromptTemplate } from '../types/index.js';

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();

  public addTemplate(template: PromptTemplate): void {
    this.templates.set(template.name, template);
  }

  public getTemplate(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  public removeTemplate(name: string): boolean {
    return this.templates.delete(name);
  }

  public listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  public renderTemplate(name: string, variables: Record<string, any>): string {
    const template = this.getTemplate(name);
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }

    return this.render(template.template, variables);
  }

  private render(template: string, variables: Record<string, any>): string {
    let result = template;

    // Handle {{variable}} substitutions
    result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? String(variables[varName]) : match;
    });

    // Handle {{#if variable}} blocks
    result = result.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, varName, content) => {
      return variables[varName] ? content : '';
    });

    // Handle {{#unless variable}} blocks
    result = result.replace(/\{\{#unless\s+(\w+)\}\}(.*?)\{\{\/unless\}\}/gs, (match, varName, content) => {
      return !variables[varName] ? content : '';
    });

    return result.trim();
  }

  public validateTemplate(template: PromptTemplate): boolean {
    try {
      // Check if template can be rendered with empty variables
      const testVariables = template.variables.reduce((acc, varName) => {
        acc[varName] = '';
        return acc;
      }, {} as Record<string, string>);

      this.render(template.template, testVariables);
      return true;
    } catch (error) {
      return false;
    }
  }

  public extractVariables(templateString: string): string[] {
    const variables = new Set<string>();
    
    // Extract {{variable}} patterns
    const simpleMatches = templateString.match(/\{\{(\w+)\}\}/g);
    if (simpleMatches) {
      simpleMatches.forEach(match => {
        const varName = match.match(/\{\{(\w+)\}\}/)?.[1];
        if (varName) variables.add(varName);
      });
    }

    // Extract {{#if variable}} and {{#unless variable}} patterns
    const conditionalMatches = templateString.match(/\{\{#(?:if|unless)\s+(\w+)\}\}/g);
    if (conditionalMatches) {
      conditionalMatches.forEach(match => {
        const varName = match.match(/\{\{#(?:if|unless)\s+(\w+)\}\}/)?.[1];
        if (varName) variables.add(varName);
      });
    }

    return Array.from(variables);
  }

  public createTemplateFromString(name: string, templateString: string, description?: string): PromptTemplate {
    const variables = this.extractVariables(templateString);
    
    return {
      name,
      template: templateString,
      variables,
      description
    };
  }

  public getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  public clear(): void {
    this.templates.clear();
  }
}