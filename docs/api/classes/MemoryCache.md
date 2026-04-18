[**@grandpaej/marie**](../index.md)

***

## Implements

- [`Cache`](../interfaces/Cache.md)

## Constructors

### Constructor

> **new MemoryCache**(`maxEntries?`): `MemoryCache`

#### Parameters

##### maxEntries?

`number` = `500`

#### Returns

`MemoryCache`

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Cache`](../interfaces/Cache.md).[`clear`](../interfaces/Cache.md#clear)

***

### delete()

> **delete**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Cache`](../interfaces/Cache.md).[`delete`](../interfaces/Cache.md#delete)

***

### get()

> **get**(`key`): `Promise`\<`string` \| `null`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`string` \| `null`\>

#### Implementation of

[`Cache`](../interfaces/Cache.md).[`get`](../interfaces/Cache.md#get)

***

### set()

> **set**(`key`, `value`, `ttlMs?`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

##### value

`string`

##### ttlMs?

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Cache`](../interfaces/Cache.md).[`set`](../interfaces/Cache.md#set)

***

### size()

> **size**(): `number`

#### Returns

`number`

#### Implementation of

[`Cache`](../interfaces/Cache.md).[`size`](../interfaces/Cache.md#size)
