[**@grandpaej/marie**](../README.md)

***

## Constructors

### Constructor

> **new ToolRegistry**(): `ToolRegistry`

#### Returns

`ToolRegistry`

## Methods

### get()

> **get**(`name`): [`Tool`](../interfaces/Tool.md) \| `undefined`

#### Parameters

##### name

`string`

#### Returns

[`Tool`](../interfaces/Tool.md) \| `undefined`

***

### list()

> **list**(`safeOnly?`): [`Tool`](../interfaces/Tool.md)[]

#### Parameters

##### safeOnly?

`boolean` = `false`

#### Returns

[`Tool`](../interfaces/Tool.md)[]

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

> **run**(`name`, `params`): `Promise`\<`string`\>

#### Parameters

##### name

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`string`\>

***

### toOpenAI()

> **toOpenAI**(`safeOnly?`): `object`[]

#### Parameters

##### safeOnly?

`boolean` = `false`

#### Returns

`object`[]
