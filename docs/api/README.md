**@grandpaej/marie**

***

## Classes

- [Agent](classes/Agent.md)
- [BudgetExceededError](classes/BudgetExceededError.md)
- [JSONAdapter](classes/JSONAdapter.md)
- [LLMClient](classes/LLMClient.md)
- [LLMError](classes/LLMError.md)
- [LLMTimeoutError](classes/LLMTimeoutError.md)
- [Memory](classes/Memory.md)
- [MemoryCache](classes/MemoryCache.md)
- [ModelRouter](classes/ModelRouter.md)
- [Parallel](classes/Parallel.md)
- [Pipeline](classes/Pipeline.md)
- [SafeModeError](classes/SafeModeError.md)
- [SilviError](classes/SilviError.md)
- [SlidingWindowMemory](classes/SlidingWindowMemory.md)
- [SQLiteAdapter](classes/SQLiteAdapter.md)
- [Supervisor](classes/Supervisor.md)
- [ToolRegistry](classes/ToolRegistry.md)
- [ToolTimeoutError](classes/ToolTimeoutError.md)
- [ToolValidationError](classes/ToolValidationError.md)

## Interfaces

- [AgentConfig](interfaces/AgentConfig.md)
- [Budget](interfaces/Budget.md)
- [Cache](interfaces/Cache.md)
- [ChatOptions](interfaces/ChatOptions.md)
- [CostMetrics](interfaces/CostMetrics.md)
- [MemoryConfig](interfaces/MemoryConfig.md)
- [MemoryNode](interfaces/MemoryNode.md)
- [MemoryPersist](interfaces/MemoryPersist.md)
- [MemorySnapshot](interfaces/MemorySnapshot.md)
- [Message](interfaces/Message.md)
- [Middleware](interfaces/Middleware.md)
- [MiddlewareContext](interfaces/MiddlewareContext.md)
- [TokenUsage](interfaces/TokenUsage.md)
- [Tool](interfaces/Tool.md)

## Type Aliases

- [AgentEvent](type-aliases/AgentEvent.md)
- [EventHandler](type-aliases/EventHandler.md)
- [FactCategory](type-aliases/FactCategory.md)

## Variables

- [MODEL\_COSTS](variables/MODEL_COSTS.md)

## Functions

- [createCostTracker](functions/createCostTracker.md)
- [createLogger](functions/createLogger.md)
- [createMemoryMiddleware](functions/createMemoryMiddleware.md)
- [estimateCost](functions/estimateCost.md)
- [getModel](functions/getModel.md)
- [registerModel](functions/registerModel.md)
