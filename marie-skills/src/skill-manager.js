import { z } from 'zod';

/**
 * Universal Skill Manager for Marie.
 * Handles tool registration and execution.
 */
export class SkillManager {
  constructor() {
    this.skills = new Map();
  }

  /**
   * Registers a new skill.
   * @param {Object} skill - { name, description, schema, handler }
   */
  register(skill) {
    if (!skill.name || !skill.handler) {
      throw new Error(`[SkillManager] Invalid skill definition for ${skill.name}`);
    }
    this.skills.set(skill.name.toLowerCase(), {
      ...skill,
      schema: skill.schema || z.any()
    });
    console.log(`[SkillManager] Registered skill: ${skill.name}`);
  }

  /**
   * Executes a skill by name.
   */
  async execute(name, params = {}, context = {}) {
    const skill = this.skills.get(name.toLowerCase());
    if (!skill) throw new Error(`[SkillManager] Skill not found: ${name}`);

    // Validate params if schema exists
    let validated = params;
    if (skill.schema) {
      validated = skill.schema.parse(params);
    }

    return await skill.handler(validated, context);
  }

  /**
   * Returns a list of skills in OpenAI tool format.
   */
  getTools() {
    return Array.from(this.skills.values()).map(s => ({
      type: 'function',
      function: {
        name: s.name,
        description: s.description,
        parameters: s.parameters || { // Fallback if no JSON schema provided
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));
  }
}
