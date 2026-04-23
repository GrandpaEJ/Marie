# @marie/brain

Universal AI agent core, command registry, and event system. This is the "nervous system" of Marie.

## Features
- **Universal Brain**: Message processing engine with Dependency Injection (DI) for storage and logic.
- **Dynamic Command Registry**: Load and match commands from any directory using absolute paths.
- **Event Bus**: Centralized event system for cross-module communication.
- **RBAC Support**: Built-in Role-Based Access Control logic.

## Usage
```javascript
import { Brain, CommandRegistry } from '@marie/brain';

const brain = new Brain(api, registry, llm, config, { userStore, db });
await brain.processMessage(event);
```
