[**@grandpaej/marie**](../index.md)

***

## Constructors

### Constructor

> **new Memory**(`opts?`): `Memory`

#### Parameters

##### opts?

[`MemoryConfig`](../interfaces/MemoryConfig.md) = `{}`

#### Returns

`Memory`

## Methods

### add()

> **add**(`message`, `userId?`): `Promise`\<`void`\>

Add a single message to STM and extract facts into LTM.
Isolates memory by userId to prevent data leakage between users.

#### Parameters

##### message

[`Message`](../interfaces/Message.md)

##### userId?

`string`

#### Returns

`Promise`\<`void`\>

***

### addTurn()

> **addTurn**(`userMsg`, `assistantMsg`, `userId?`): `Promise`\<`void`\>

Add a user + assistant exchange and trigger STM consolidation for that user.

#### Parameters

##### userMsg

[`Message`](../interfaces/Message.md)

##### assistantMsg

[`Message`](../interfaces/Message.md)

##### userId?

`string`

#### Returns

`Promise`\<`void`\>

***

### clearAll()

> **clearAll**(`userId?`): `void`

#### Parameters

##### userId?

`string`

#### Returns

`void`

***

### forget()

> **forget**(`id`): `void`

#### Parameters

##### id

`string`

#### Returns

`void`

***

### getContext()

> **getContext**(`currentQuery?`, `userId?`): [`Message`](../interfaces/Message.md)[]

Build the complete history to inject into an agent call.
layout: [LTM facts] + [STM summaries] + [raw turns]
Always scoped to the provided userId.

#### Parameters

##### currentQuery?

`string`

##### userId?

`string`

#### Returns

[`Message`](../interfaces/Message.md)[]

***

### getStats()

> **getStats**(`userId?`): `object`

#### Parameters

##### userId?

`string`

#### Returns

`object`

##### ltmNodes

> **ltmNodes**: `number`

##### stmRaw

> **stmRaw**: `number`

***

### load()

> **load**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

***

### query()

> **query**(`text`, `opts?`): [`MemoryNode`](../interfaces/MemoryNode.md)[]

Query LTM for a specific user.

#### Parameters

##### text

`string`

##### opts?

`MemoryQueryOptions` = `{}`

#### Returns

[`MemoryNode`](../interfaces/MemoryNode.md)[]

***

### remember()

> **remember**(`content`, `category`, `userId?`, `importance?`): [`MemoryNode`](../interfaces/MemoryNode.md)

#### Parameters

##### content

`string`

##### category

[`FactCategory`](../type-aliases/FactCategory.md)

##### userId?

`string`

##### importance?

`number` = `7`

#### Returns

[`MemoryNode`](../interfaces/MemoryNode.md)

***

### save()

> **save**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
