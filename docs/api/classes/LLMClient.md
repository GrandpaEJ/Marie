[**@grandpaej/marie**](../index.md)

***

## Constructors

### Constructor

> **new LLMClient**(`apiKey`, `baseUrl`, `model`, `opts?`): `LLMClient`

#### Parameters

##### apiKey

`string`

##### baseUrl

`string`

##### model

`string`

##### opts?

###### maxRetries?

`number`

###### timeoutMs?

`number`

#### Returns

`LLMClient`

## Methods

### complete()

> **complete**(`req`): `Promise`\<\{ `content`: `string` \| `null`; `tool_calls?`: `ToolCallRef`[]; `usage`: [`TokenUsage`](../interfaces/TokenUsage.md); \}\>

#### Parameters

##### req

`CompletionReq`

#### Returns

`Promise`\<\{ `content`: `string` \| `null`; `tool_calls?`: `ToolCallRef`[]; `usage`: [`TokenUsage`](../interfaces/TokenUsage.md); \}\>

***

### stream()

> **stream**(`req`, `signal?`): `AsyncGenerator`\<`StreamChunk` & `object`\>

#### Parameters

##### req

`CompletionReq`

##### signal?

`AbortSignal`

#### Returns

`AsyncGenerator`\<`StreamChunk` & `object`\>
