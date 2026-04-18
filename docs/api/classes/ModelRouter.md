[**@grandpaej/marie**](../README.md)

***

## Constructors

### Constructor

> **new ModelRouter**(`cfg?`): `ModelRouter`

#### Parameters

##### cfg?

`RouterConfig` = `{}`

#### Returns

`ModelRouter`

## Methods

### classify()

> **classify**(`message`, `hasTools`): `"nano"` \| `"fast"` \| `"frontier"`

#### Parameters

##### message

`string`

##### hasTools

`boolean`

#### Returns

`"nano"` \| `"fast"` \| `"frontier"`

***

### route()

> **route**(`message`, `hasTools`, `fallback`): `string`

#### Parameters

##### message

`string`

##### hasTools

`boolean`

##### fallback

`string`

#### Returns

`string`
