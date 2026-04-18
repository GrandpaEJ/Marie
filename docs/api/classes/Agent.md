[**@grandpaej/marie**](../README.md)

***

## Constructors

### Constructor

> **new Agent**(`config`): `Agent`

#### Parameters

##### config

[`AgentConfig`](../interfaces/AgentConfig.md)

#### Returns

`Agent`

## Properties

### cfg

> `readonly` **cfg**: `Required`\<`Omit`\<[`AgentConfig`](../interfaces/AgentConfig.md), `"cache"` \| `"budget"` \| `"middleware"` \| `"onEvent"`\>\> & `Pick`\<[`AgentConfig`](../interfaces/AgentConfig.md), `"cache"` \| `"budget"` \| `"middleware"` \| `"onEvent"`\>

***

### registry

> `readonly` **registry**: [`ToolRegistry`](ToolRegistry.md)

## Methods

### chat()

> **chat**(`userMessage`, `opts?`): `AsyncGenerator`\<`string`\>

#### Parameters

##### userMessage

`string`

##### opts?

[`ChatOptions`](../interfaces/ChatOptions.md) = `{}`

#### Returns

`AsyncGenerator`\<`string`\>

***

### on()

> **on**(`handler`): `this`

#### Parameters

##### handler

(`event`, `data`) => `void`

#### Returns

`this`

***

### register()

> **register**(`tool`): `this`

#### Parameters

##### tool

[`Tool`](../interfaces/Tool.md)

#### Returns

`this`

***

### run()

> **run**(`message`, `opts?`): `Promise`\<`string` & `object`\>

#### Parameters

##### message

`string`

##### opts?

[`ChatOptions`](../interfaces/ChatOptions.md) = `{}`

#### Returns

`Promise`\<`string` & `object`\>

***

### serve()

> **serve**(`port?`): `void`

#### Parameters

##### port?

`number` = `7700`

#### Returns

`void`

***

### use()

> **use**(`middleware`): `this`

#### Parameters

##### middleware

[`Middleware`](../interfaces/Middleware.md)

#### Returns

`this`
