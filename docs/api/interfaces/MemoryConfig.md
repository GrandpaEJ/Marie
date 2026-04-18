[**@grandpaej/marie**](../README.md)

***

## Properties

### categories?

> `optional` **categories?**: [`FactCategory`](../type-aliases/FactCategory.md)[]

***

### contextPreamble?

> `optional` **contextPreamble?**: `string`

***

### extract?

> `optional` **extract?**: (`text`) => `Promise`\<`Omit`\<[`MemoryNode`](MemoryNode.md), `"id"` \| `"createdAt"` \| `"lastAccessedAt"` \| `"accessCount"`\>[]\>

#### Parameters

##### text

`string`

#### Returns

`Promise`\<`Omit`\<[`MemoryNode`](MemoryNode.md), `"id"` \| `"createdAt"` \| `"lastAccessedAt"` \| `"accessCount"`\>[]\>

***

### maxContextFacts?

> `optional` **maxContextFacts?**: `number`

***

### maxLtmNodes?

> `optional` **maxLtmNodes?**: `number`

***

### maxStmSummaries?

> `optional` **maxStmSummaries?**: `number`

***

### persist?

> `optional` **persist?**: [`MemoryPersist`](MemoryPersist.md)

***

### recentTurns?

> `optional` **recentTurns?**: `number`

***

### summarize?

> `optional` **summarize?**: (`messages`) => `Promise`\<`string`\>

#### Parameters

##### messages

[`Message`](Message.md)[]

#### Returns

`Promise`\<`string`\>

***

### summaryStrategy?

> `optional` **summaryStrategy?**: `SummaryStrategy`
