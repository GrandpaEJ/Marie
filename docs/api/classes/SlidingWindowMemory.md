[**@grandpaej/marie**](../README.md)

***

## Constructors

### Constructor

> **new SlidingWindowMemory**(`opts?`): `SlidingWindowMemory`

#### Parameters

##### opts?

`SlidingWindowOptions` = `{}`

#### Returns

`SlidingWindowMemory`

## Accessors

### hasSummary

#### Get Signature

> **get** **hasSummary**(): `boolean`

##### Returns

`boolean`

***

### length

#### Get Signature

> **get** **length**(): `number`

##### Returns

`number`

## Methods

### add()

> **add**(`message`): `void`

#### Parameters

##### message

[`Message`](../interfaces/Message.md)

#### Returns

`void`

***

### addAll()

> **addAll**(`messages`): `void`

#### Parameters

##### messages

[`Message`](../interfaces/Message.md)[]

#### Returns

`void`

***

### clear()

> **clear**(): `void`

#### Returns

`void`

***

### getHistory()

> **getHistory**(): `Promise`\<[`Message`](../interfaces/Message.md)[]\>

#### Returns

`Promise`\<[`Message`](../interfaces/Message.md)[]\>

***

### getHistorySync()

> **getHistorySync**(`maxMessages?`): [`Message`](../interfaces/Message.md)[]

#### Parameters

##### maxMessages?

`number`

#### Returns

[`Message`](../interfaces/Message.md)[]
