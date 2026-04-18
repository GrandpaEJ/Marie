[**@grandpaej/marie**](../README.md)

***

## Implements

- [`MemoryPersist`](../interfaces/MemoryPersist.md)

## Constructors

### Constructor

> **new JSONAdapter**(`filePath`): `JSONAdapter`

#### Parameters

##### filePath

`string`

#### Returns

`JSONAdapter`

## Methods

### load()

> **load**(): `Promise`\<[`MemorySnapshot`](../interfaces/MemorySnapshot.md) \| `null`\>

#### Returns

`Promise`\<[`MemorySnapshot`](../interfaces/MemorySnapshot.md) \| `null`\>

#### Implementation of

[`MemoryPersist`](../interfaces/MemoryPersist.md).[`load`](../interfaces/MemoryPersist.md#load)

***

### save()

> **save**(`snapshot`): `Promise`\<`void`\>

#### Parameters

##### snapshot

[`MemorySnapshot`](../interfaces/MemorySnapshot.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`MemoryPersist`](../interfaces/MemoryPersist.md).[`save`](../interfaces/MemoryPersist.md#save)
