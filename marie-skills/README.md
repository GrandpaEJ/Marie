# @marie/skills

Universal skill and tool management system for Marie AI Agent.

## Features
- **Structured Skills**: Define skills with Zod schemas for automatic parameter validation.
- **OpenAI Tool Compatibility**: Export skill definitions in standard JSON schema format for LLM tool calling.
- **Universal Execution**: Execute skills with a unified context, making them portable across any interface.

## Usage
```javascript
import { SkillManager } from '@marie/skills';

const skills = new SkillManager();
skills.register({
  name: 'weather',
  description: 'Get current weather',
  handler: async ({ location }) => { ... }
});

const result = await skills.execute('weather', { location: 'London' });
```
