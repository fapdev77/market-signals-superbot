<!-- Gerado a partir de: https://developers.binance.com/docs/binance-spot-api-docs/README -->

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-api -->

# General - Spot WebSocket API | Binance Developer Docs

Spot WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [WebSocket API](/en/docs/catalog/core-trading-spot-trading/api/ws-api)

# General

Endpoint

wss://ws-api.binance.com:443/ws-api/v3wss://demo-ws-api.binance.com:443/ws-api/v3wss://ws-api.testnet.binance.vision:443/ws-api/v3

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/ws-api/1.0.0/schema.yaml)

---

## Exchange information

Query current exchange trading rules, rate limits, and symbol
information.

WSS

exchangeInfo

wss://ws-api.binance.com:443/ws-api/v3

### Exchange information › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight20

### Exchange information › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

exchangeInfo

Example: exchangeInfo

`params`

​object

`symbol`

​string

Describe a single symbol

Example: BNBUSDT

`symbols`

​string[]

Describe multiple symbols

`permissions`

​string[]

Filter symbols by permissions

`showPermissionSets`

​boolean

Controls whether the content of the `permissionSets` field is populated or not. Defaults to `true`.

Example: true

Default: true

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`. Valid values: `TRADING`, `HALT`, `BREAK`. Cannot be used in combination with `symbol` or `symbols`.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

**Notes:**

* If the value provided to `symbol` or `symbols` do not exist, the endpoint will throw an error saying the symbol is invalid.
* All parameters are optional.
* Only one of `symbol`, `symbols`, `permissions` parameters can be specified.
* Without parameters, `exchangeInfo` displays all symbols with `["SPOT", "MARGIN", "LEVERAGED"]` permissions.
  + In order to list *all* active symbols on the exchange, you need to explicitly request all permissions.
* `permissions` accepts either a list of permissions, or a single permission name. E.g. `"SPOT"`.

**Examples of Symbol Permissions Interpretation from the Response:**

* `[["A","B"]]` means you may place an order if your account has either permission "A" **or** permission "B".
* `[["A"],["B"]]` means you can place an order if your account has permission "A" **and** permission "B".
* `[["A"],["B","C"]]` means you can place an order if your account has permission "A" **and** permission "B" or permission "C". (Inclusive or is applied here, not exclusive or, so your account may have both permission "B" and permission "C".)

### Exchange information › Responses

Successful Response

Exchange information

`id`

​string

Example: 5494febb-d167-46a2-996d-70533eb4d976

`status`

​integer · int64

Example: 200

`result`

​object

`timezone`

​string

Example: UTC

`serverTime`

​integer · int64

Example: 1655969291181

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

`exchangeFilters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| EXCHANGE\_MAX\_NUM\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ORDER\_LISTS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDER\_LISTS" |

**Properties for EXCHANGE\_MAX\_NUM\_ORDERS:**

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 1000

`symbols`

​object[]

`symbol`

​string

Example: BNBBTC

`status`

​string

Example: TRADING

`baseAsset`

​string

Example: BNB

`baseAssetPrecision`

​integer · int64

Example: 8

`quoteAsset`

​string

Example: BTC

`quotePrecision`

​integer · int64

Example: 8

`quoteAssetPrecision`

​integer · int64

Example: 8

`baseCommissionPrecision`

​integer · int64

Example: 8

`quoteCommissionPrecision`

​integer · int64

Example: 8

`orderTypes`

​string[]

`icebergAllowed`

​boolean

Example: true

`ocoAllowed`

​boolean

Example: true

`otoAllowed`

​boolean

Example: true

`opoAllowed`

​boolean

Example: true

`quoteOrderQtyMarketAllowed`

​boolean

Example: true

`allowTrailingStop`

​boolean

Example: true

`cancelReplaceAllowed`

​boolean

Example: true

`amendAllowed`

​boolean

Example: false

`pegInstructionsAllowed`

​boolean

Example: true

`isSpotTradingAllowed`

​boolean

Example: true

`isMarginTradingAllowed`

​boolean

Example: true

`filters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| PRICE\_FILTER | type = object · filterType="PRICE\_FILTER" |
| PERCENT\_PRICE | type = object · filterType="PERCENT\_PRICE" |
| PERCENT\_PRICE\_BY\_SIDE | type = object · filterType="PERCENT\_PRICE\_BY\_SIDE" |
| LOT\_SIZE | type = object · filterType="LOT\_SIZE" |
| MIN\_NOTIONAL | type = object · filterType="MIN\_NOTIONAL" |
| NOTIONAL | type = object · filterType="NOTIONAL" |
| ICEBERG\_PARTS | type = object · filterType="ICEBERG\_PARTS" |
| MARKET\_LOT\_SIZE | type = object · filterType="MARKET\_LOT\_SIZE" |
| MAX\_NUM\_ORDERS | type = object · filterType="MAX\_NUM\_ORDERS" |
| MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="MAX\_NUM\_ALGO\_ORDERS" |
| MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="MAX\_NUM\_ICEBERG\_ORDERS" |
| MAX\_POSITION | type = object · filterType="MAX\_POSITION" |
| TRAILING\_DELTA | type = object · filterType="TRAILING\_DELTA" |
| T\_PLUS\_SELL | type = object · filterType="T\_PLUS\_SELL" |
| MAX\_NUM\_ORDER\_LISTS | type = object · filterType="MAX\_NUM\_ORDER\_LISTS" |
| MAX\_NUM\_ORDER\_AMENDS | type = object · filterType="MAX\_NUM\_ORDER\_AMENDS" |

**Properties for PRICE\_FILTER:**

`filterType`

​string

Example: PRICE\_FILTER

`priceExponent`

​integer

Example: 8

`minPrice`

​string

Example: 0.00000100

`maxPrice`

​string

Example: 100000.00000000

`tickSize`

​string

Example: 0.00000100

`permissions`

​string[]

`permissionSets`

​array[]

`defaultSelfTradePreventionMode`

​string

Example: NONE

`allowedSelfTradePreventionModes`

​string[]

`sors`

​object[]

`baseAsset`

​string

Example: BTC

`symbols`

​string[]

WSSexchangeInfo

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "exchangeInfo"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "exchangeInfo"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "5494febb-d167-46a2-996d-70533eb4d976",
 "status": 200,
 "result": {
 "timezone": "UTC",
 "serverTime": 1655969291181,
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ],
 "exchangeFilters": [
 {
 "filterType": "EXCHANGE_MAX_NUM_ORDERS",
 "maxNumOrders": 1000
 }
 ],
 "symbols": [
 {
 "symbol": "BNBBTC",
 "status": "TRADING",
 "baseAsset": "BNB",
 "baseAssetPrecision": 8,
 "quoteAsset": "BTC",
 "quotePrecision": 8,
 "quoteAssetPrecision": 8,
 "baseCommissionPrecision": 8,
 "quoteCommissionPrecision": 8,
 "orderTypes": [
 "LIMIT"
 ],
 "icebergAllowed": true,
 "ocoAllowed": true,
 "otoAllowed": true,
 "opoAllowed": true,
 "quoteOrderQtyMarketAllowed": true,
 "allowTrailingStop": true,
 "cancelReplaceAllowed": true,
 "amendAllowed": false,
 "pegInstructionsAllowed": true,
 "isSpotTradingAllowed": true,
 "isMarginTradingAllowed": true,
 "filters": [
 {
 "filterType": "PRICE_FILTER",
 "priceExponent": 8,
 "minPrice": "0.00000100",
 "maxPrice": "100000.00000000",
 "tickSize": "0.00000100"
 }
 ],
 "permissions": [
 "SPOT"
 ],
 "permissionSets": [
 [
 "SPOT"
 ]
 ],
 "defaultSelfTradePreventionMode": "NONE",
 "allowedSelfTradePreventionModes": [
 "NONE"
 ]
 }
 ],
 "sors": [
 {
 "baseAsset": "BTC",
 "symbols": [
 "BTCUSDT"
 ]
 }
 ]
 }
}`

json

application/json

---

## Query Execution Rules

Query execution rules for symbols.

WSS

executionRules

wss://ws-api.binance.com:443/ws-api/v3

### Query Execution Rules › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

| Parameter | Weight |
| --- | --- |
| `symbol` | 2 |
| `symbols` | 2 for each `symbol`, capped at a max of 40 |
| `symbolStatus` | 40 |
| None | 40 |

### Query Execution Rules › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

executionRules

Example: executionRules

`params`

​object

`symbol`

​string

Query for specified symbol.

Example: BAZUSD

`symbols`

​string[]

Query for multiple symbols.

`symbolStatus`

​string · enum

Query for all symbols with the specified status. Supported values: `TRADING`, `HALT`, `BREAK`

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

**Note:** No combination of multiple parameters is allowed.

### Query Execution Rules › Responses

Successful Response

Query Execution Rules

`id`

​string

Example: 5162affb-0aba-4821-b475-f2625006eb43

`status`

​integer · int64

Example: 200

`result`

​object

`symbolRules`

​object[]

`symbol`

​string

Example: BAZUSD

`rules`

​object[]

`ruleType`

​string

Example: PRICE\_RANGE

`bidLimitMultUp`

​string

Example: 1.0001

`bidLimitMultDown`

​string

Example: 0.9999

`askLimitMultUp`

​string

Example: 1.0001

`askLimitMultDown`

​string

Example: 0.9999

WSSexecutionRules

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "executionRules"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "executionRules"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "5162affb-0aba-4821-b475-f2625006eb43",
 "status": 200,
 "result": {
 "symbolRules": [
 {
 "symbol": "BAZUSD",
 "rules": [
 {
 "ruleType": "PRICE_RANGE",
 "bidLimitMultUp": "1.0001",
 "bidLimitMultDown": "0.9999",
 "askLimitMultUp": "1.0001",
 "askLimitMultDown": "0.9999"
 }
 ]
 }
 ]
 }
}`

json

application/json

---

## Test connectivity

Test connectivity to the WebSocket API.

Note: You can use regular WebSocket ping frames to test connectivity as well, WebSocket API will respond with pong frames as soon as possible. ping request along with time is a safe way to test request-response handling in your application.

WSS

ping

wss://ws-api.binance.com:443/ws-api/v3

### Test connectivity › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Test connectivity › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

ping

Example: ping

`params`

​object

**Data Source:** Memory

### Test connectivity › Responses

Successful Response

Test connectivity

`id`

​string

Example: 922bcc6e-9de8-440d-9e84-7c80933a8d0d

`status`

​integer · int64

Example: 200

`result`

​object

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSping

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ping"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ping"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "922bcc6e-9de8-440d-9e84-7c80933a8d0d",
 "status": 200,
 "result": {},
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Check server time

Test connectivity to the WebSocket API and get the current server time.

WSS

time

wss://ws-api.binance.com:443/ws-api/v3

### Check server time › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Check server time › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

time

Example: time

`params`

​object

**Data Source:** Memory

### Check server time › Responses

Successful Response

Check server time

`id`

​string

Example: 187d3cb2-942d-484c-8271-4e2141bbadb1

`status`

​integer · int64

Example: 200

`result`

​object

`serverTime`

​integer · int64

Example: 1656400526260

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSStime

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "time"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "time"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "187d3cb2-942d-484c-8271-4e2141bbadb1",
 "status": 200,
 "result": {
 "serverTime": 1656400526260
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas -->

# Schemas | Binance Developer Docs

Spot WebSocket API

Spot WebSocket API

# Schemas

API Information

---

## myFiltersResponse

`exchangeFilters`

​array

`symbolFilters`

​array

`assetFilters`

​array

`rateLimits`

​object[]

## exchangeFilters

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| EXCHANGE\_MAX\_NUM\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ORDER\_LISTS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDER\_LISTS" |

**Properties for EXCHANGE\_MAX\_NUM\_ORDERS:**

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 1000

## symbolFilters

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| PRICE\_FILTER | type = object · filterType="PRICE\_FILTER" |
| PERCENT\_PRICE | type = object · filterType="PERCENT\_PRICE" |
| PERCENT\_PRICE\_BY\_SIDE | type = object · filterType="PERCENT\_PRICE\_BY\_SIDE" |
| LOT\_SIZE | type = object · filterType="LOT\_SIZE" |
| MIN\_NOTIONAL | type = object · filterType="MIN\_NOTIONAL" |
| NOTIONAL | type = object · filterType="NOTIONAL" |
| ICEBERG\_PARTS | type = object · filterType="ICEBERG\_PARTS" |
| MARKET\_LOT\_SIZE | type = object · filterType="MARKET\_LOT\_SIZE" |
| MAX\_NUM\_ORDERS | type = object · filterType="MAX\_NUM\_ORDERS" |
| MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="MAX\_NUM\_ALGO\_ORDERS" |
| MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="MAX\_NUM\_ICEBERG\_ORDERS" |
| MAX\_POSITION | type = object · filterType="MAX\_POSITION" |
| TRAILING\_DELTA | type = object · filterType="TRAILING\_DELTA" |
| T\_PLUS\_SELL | type = object · filterType="T\_PLUS\_SELL" |
| MAX\_NUM\_ORDER\_LISTS | type = object · filterType="MAX\_NUM\_ORDER\_LISTS" |
| MAX\_NUM\_ORDER\_AMENDS | type = object · filterType="MAX\_NUM\_ORDER\_AMENDS" |

**Properties for PRICE\_FILTER:**

`filterType`

​string

Example: PRICE\_FILTER

`priceExponent`

​integer

Example: 8

`minPrice`

​string

Example: 0.00000100

`maxPrice`

​string

Example: 100000.00000000

`tickSize`

​string

Example: 0.00000100

## assetFilters

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| MAX\_ASSET | type = object · filterType="MAX\_ASSET" |

**Properties for MAX\_ASSET:**

`filterType`

​string

Example: MAX\_ASSET

`qtyExponent`

​integer

Example: 8

`limit`

​string

Example: 1000000.00000000

`asset`

​string

Example: JPY

## ExchangeMaxNumOrdersFilter

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 1000

## ExchangeMaxNumAlgoOrdersFilter

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS

`maxNumAlgoOrders`

​integer · int64

Example: 200

## ExchangeMaxNumIcebergOrdersFilter

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS

`maxNumIcebergOrders`

​integer · int64

Example: 10

## ExchangeMaxNumOrderListsFilter

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDER\_LISTS

`maxNumOrderLists`

​integer · int64

Example: 20

## PriceFilter

`filterType`

​string

Example: PRICE\_FILTER

`priceExponent`

​integer

Example: 8

`minPrice`

​string

Example: 0.00000100

`maxPrice`

​string

Example: 100000.00000000

`tickSize`

​string

Example: 0.00000100

## PercentPriceFilter

`filterType`

​string

Example: PERCENT\_PRICE

`multiplierExponent`

​integer

Example: 4

`multiplierUp`

​string

Example: 1.3000

`multiplierDown`

​string

Example: 0.7000

`avgPriceMins`

​integer

Example: 5

## PercentPriceBySideFilter

`filterType`

​string

Example: PERCENT\_PRICE\_BY\_SIDE

`multiplierExponent`

​integer

Example: 4

`bidMultiplierUp`

​string

Example: 1.2000

`bidMultiplierDown`

​string

Example: 0.8000

`askMultiplierUp`

​string

Example: 1.2000

`askMultiplierDown`

​string

Example: 0.8000

`avgPriceMins`

​integer

Example: 5

## LotSizeFilter

`filterType`

​string

Example: LOT\_SIZE

`qtyExponent`

​integer

Example: 8

`minQty`

​string

Example: 0.00010000

`maxQty`

​string

Example: 100000.00000000

`stepSize`

​string

Example: 0.00010000

## MinNotionalFilter

`filterType`

​string

Example: MIN\_NOTIONAL

`priceExponent`

​integer

Example: 8

`minNotional`

​string

Example: 10.00000000

`applyToMarket`

​boolean

Example: true

`avgPriceMins`

​integer

Example: 5

## NotionalFilter

`filterType`

​string

Example: NOTIONAL

`priceExponent`

​integer

Example: 8

`minNotional`

​string

Example: 10.00000000

`applyMinToMarket`

​boolean

Example: true

`maxNotional`

​string

Example: 100000.00000000

`applyMaxToMarket`

​boolean

Example: false

`avgPriceMins`

​integer

Example: 5

## IcebergPartsFilter

`filterType`

​string

Example: ICEBERG\_PARTS

`limit`

​integer · int64

Example: 10

## MarketLotSizeFilter

`filterType`

​string

Example: MARKET\_LOT\_SIZE

`qtyExponent`

​integer

Example: 8

`minQty`

​string

Example: 0.00000000

`maxQty`

​string

Example: 1000.00000000

`stepSize`

​string

Example: 0.00000000

## MaxNumOrdersFilter

`filterType`

​string

Example: MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 200

## MaxNumAlgoOrdersFilter

`filterType`

​string

Example: MAX\_NUM\_ALGO\_ORDERS

`maxNumAlgoOrders`

​integer · int64

Example: 10

## MaxNumIcebergOrdersFilter

`filterType`

​string

Example: MAX\_NUM\_ICEBERG\_ORDERS

`maxNumIcebergOrders`

​integer · int64

Example: 5

## MaxPositionFilter

`filterType`

​string

Example: MAX\_POSITION

`qtyExponent`

​integer

Example: 8

`maxPosition`

​string

Example: 100.00000000

## TrailingDeltaFilter

`filterType`

​string

Example: TRAILING\_DELTA

`minTrailingAboveDelta`

​integer · int64

Example: 10

`maxTrailingAboveDelta`

​integer · int64

Example: 2000

`minTrailingBelowDelta`

​integer · int64

Example: 10

`maxTrailingBelowDelta`

​integer · int64

Example: 2000

## TPlusSellFilter

`filterType`

​string

Example: T\_PLUS\_SELL

`endTime`

​integer · int64

Example: 1741672924895

## MaxNumOrderListsFilter

`filterType`

​string

Example: MAX\_NUM\_ORDER\_LISTS

`maxNumOrderLists`

​integer · int64

Example: 20

## MaxNumOrderAmendsFilter

`filterType`

​string

Example: MAX\_NUM\_ORDER\_AMENDS

`maxNumOrderAmends`

​integer · int64

Example: 10

## MaxAssetFilter

`filterType`

​string

Example: MAX\_ASSET

`qtyExponent`

​integer

Example: 8

`limit`

​string

Example: 1000000.00000000

`asset`

​string

Example: JPY

## rateLimits

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

## exchangeInfoResponse

`timezone`

​string

Example: UTC

`serverTime`

​integer · int64

Example: 1655969291181

`rateLimits`

​object[]

`exchangeFilters`

​array

`symbols`

​object[]

`sors`

​object[]

## balanceUpdate

`e`

​string · enum

Event Type

Enum values:

balanceUpdate

Example: balanceUpdate

`E`

​integer · int64

Event Time

Example: 1573200697110

`a`

​string

Asset

Example: BTC

`d`

​string

Balance Delta

Example: 100.00000000

`T`

​integer · int64

Clear Time

Example: 1573200697068

## eventStreamTerminated

`e`

​string · enum

Event Type

Enum values:

eventStreamTerminated

Example: eventStreamTerminated

`E`

​integer · int64

Event Time

Example: 1728973001334

## executionReport

`e`

​string · enum

Event type

Enum values:

executionReport

Example: executionReport

`E`

​integer · int64

Event time

Example: 1499405658658

`s`

​string

Symbol

Example: ETHBTC

`c`

​string

Client order ID

Example: mUvoqJxFIILMdfAW5iGSOW

`S`

​string

Side

Example: BUY

`o`

​string

Order type

Example: LIMIT

`f`

​string

Time in force

Example: GTC

`q`

​string

Order quantity

Example: 1.00000000

`p`

​string

Order price

Example: 0.10264410

`P`

​string

Stop price

Example: 0.00000000

`F`

​string

Iceberg quantity

Example: 0.00000000

`g`

​integer · int64

OrderListId

Example: -1

`C`

​string

Original client order ID; This is the ID of the order being canceled

Example:

`x`

​string

Current execution type

Example: NEW

`X`

​string

Current order status

Example: NEW

`r`

​string

Order reject reason; Please see Order Reject Reason for more information.

Example: NONE

`i`

​integer · int64

Order ID

Example: 4293153

`l`

​string

Last executed quantity

Example: 0.00000000

`z`

​string

Cumulative filled quantity

Example: 0.00000000

`L`

​string

Last executed price

Example: 0.00000000

`n`

​string

Commission amount

Example: 0

`N`

​string

Commission asset

Example: null

`T`

​integer · int64

Transaction time

Example: 1499405658657

`t`

​integer · int64

Trade ID

Example: -1

`v`

​integer · int64

Prevented Match Id; This is only visible if the order expired due to STP

Example: 3

`I`

​integer · int64

Execution Id

Example: 8641984

`w`

​boolean

Is the order on the book?

Example: true

`m`

​boolean

Is this trade the maker side?

Example: false

`M`

​boolean

Ignore

Example: false

`O`

​integer · int64

Order creation time

Example: 1499405658657

`Z`

​string

Cumulative quote asset transacted quantity

Example: 0.00000000

`Y`

​string

Last quote asset transacted quantity (i.e. lastPrice \* lastQty)

Example: 0.00000000

`Q`

​string

Quote Order Quantity

Example: 0.00000000

`W`

​integer · int64

Working Time; This is only visible if the order has been placed on the book.

Example: 1499405658657

`V`

​string

SelfTradePreventionMode

Example: NONE

`d`

​integer · int64

Trailing Delta

Example: 4

`D`

​integer · int64

Trailing Time

Example: 1668680518494

`j`

​integer · int64

Strategy Id

Example: 1

`J`

​integer · int64

Strategy Type

Example: 1000000

`A`

​string

Prevented Quantity

Example: 3.000000

`B`

​string

Last Prevented Quantity

Example: 3.000000

`u`

​integer · int64

Trade Group Id

Example: 1

`U`

​integer · int64

Counter Order Id

Example: 37

`Cs`

​string

Counter Symbol

Example: BTCUSDT

`pl`

​string

Prevented Execution Quantity

Example: 2.123456

`pL`

​string

Prevented Execution Price

Example: 0.10000001

`pY`

​string

Prevented Execution Quote Qty

Example: 0.21234562

`b`

​string

Match Type

Example: ONE\_PARTY\_TRADE\_REPORT

`a`

​integer · int64

Allocation ID

Example: 1234

`k`

​string

Working Floor

Example: SOR

`uS`

​boolean

UsedSor

Example: true

`gP`

​string

Pegged Price Type

Example: PRIMARY\_PEG

`gOT`

​string

Pegged Offset Type

Example: PRICE\_LEVEL

`gOV`

​integer · int64

Pegged Offset Value

Example: 5

`gp`

​string

Pegged Price

Example: 1.00000000

`eR`

​string

Expiry Reason. Appears when the order has expired.

Example: EXPIRED

## externalLockUpdate

`e`

​string · enum

Event Type

Enum values:

externalLockUpdate

Example: externalLockUpdate

`E`

​integer · int64

Event Time

Example: 1581557507324

`a`

​string

Asset

Example: NEO

`d`

​string

Delta

Example: 10.00000000

`T`

​integer · int64

Transaction Time

Example: 1581557507268

## listStatus

`e`

​string · enum

Event Type

Enum values:

listStatus

Example: listStatus

`E`

​integer · int64

Event Time

Example: 1564035303637

`s`

​string

Symbol

Example: ETHBTC

`g`

​integer · int64

OrderListId

Example: 2

`c`

​string

Contingency Type

Example: OCO

`l`

​string

List Status Type

Example: EXEC\_STARTED

`L`

​string

List Order Status

Example: EXECUTING

`r`

​string

List Reject Reason

Example: NONE

`C`

​string

List Client Order ID

Example: F4QN4G8DlFATFlIUQ0cjdD

`T`

​integer · int64

Transaction Time

Example: 1564035303625

`O`

​object[]

An array of objects

## outboundAccountPosition

`e`

​string · enum

Event type

Enum values:

outboundAccountPosition

Example: outboundAccountPosition

`E`

​integer · int64

Event Time

Example: 1564034571105

`u`

​integer · int64

Time of last account update

Example: 1564034571073

`B`

​object[]

Balances Array

## User Data Stream Events

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| balanceUpdate | type = object · e="balanceUpdate" |
| eventStreamTerminated | type = object · e="eventStreamTerminated" |
| executionReport | type = object · e="executionReport" |
| externalLockUpdate | type = object · e="externalLockUpdate" |
| listStatus | type = object · e="listStatus" |
| outboundAccountPosition | type = object · e="outboundAccountPosition" |

**Properties for balanceUpdate:**

`e`

​string · enum

Event Type

Enum values:

balanceUpdate

Example: balanceUpdate

`E`

​integer · int64

Event Time

Example: 1573200697110

`a`

​string

Asset

Example: BTC

`d`

​string

Balance Delta

Example: 100.00000000

`T`

​integer · int64

Clear Time

Example: 1573200697068

On this page

* [myFiltersResponse](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#myfiltersresponse)
* [exchangeFilters](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#exchangefilters)
* [symbolFilters](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#symbolfilters)
* [assetFilters](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#assetfilters)
* [ExchangeMaxNumOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#exchangemaxnumordersfilter)
* [ExchangeMaxNumAlgoOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#exchangemaxnumalgoordersfilter)
* [ExchangeMaxNumIcebergOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#exchangemaxnumicebergordersfilter)
* [ExchangeMaxNumOrderListsFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#exchangemaxnumorderlistsfilter)
* [PriceFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#pricefilter)
* [PercentPriceFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#percentpricefilter)
* [PercentPriceBySideFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#percentpricebysidefilter)
* [LotSizeFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#lotsizefilter)
* [MinNotionalFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#minnotionalfilter)
* [NotionalFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#notionalfilter)
* [IcebergPartsFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#icebergpartsfilter)
* [MarketLotSizeFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#marketlotsizefilter)
* [MaxNumOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#maxnumordersfilter)
* [MaxNumAlgoOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#maxnumalgoordersfilter)
* [MaxNumIcebergOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#maxnumicebergordersfilter)
* [MaxPositionFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#maxpositionfilter)
* [TrailingDeltaFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#trailingdeltafilter)
* [TPlusSellFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#tplussellfilter)
* [MaxNumOrderListsFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#maxnumorderlistsfilter)
* [MaxNumOrderAmendsFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#maxnumorderamendsfilter)
* [MaxAssetFilter](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#maxassetfilter)
* [rateLimits](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#ratelimits)
* [exchangeInfoResponse](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#exchangeinforesponse)
* [balanceUpdate](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#balanceupdate)
* [eventStreamTerminated](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#eventstreamterminated)
* [executionReport](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#executionreport)
* [externalLockUpdate](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#externallockupdate)
* [listStatus](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#liststatus)
* [outboundAccountPosition](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#outboundaccountposition)
* [User Data Stream Events](/en/docs/catalog/core-trading-spot-trading/api/ws-api/~schemas#user-data-stream-events)

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-api/general -->

# General - Spot WebSocket API | Binance Developer Docs

Spot WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [WebSocket API](/en/docs/catalog/core-trading-spot-trading/api/ws-api)

# General

Endpoint

wss://ws-api.binance.com:443/ws-api/v3wss://demo-ws-api.binance.com:443/ws-api/v3wss://ws-api.testnet.binance.vision:443/ws-api/v3

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/ws-api/1.0.0/schema.yaml)

---

## Exchange information

Query current exchange trading rules, rate limits, and symbol
information.

WSS

exchangeInfo

wss://ws-api.binance.com:443/ws-api/v3

### Exchange information › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight20

### Exchange information › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

exchangeInfo

Example: exchangeInfo

`params`

​object

`symbol`

​string

Describe a single symbol

Example: BNBUSDT

`symbols`

​string[]

Describe multiple symbols

`permissions`

​string[]

Filter symbols by permissions

`showPermissionSets`

​boolean

Controls whether the content of the `permissionSets` field is populated or not. Defaults to `true`.

Example: true

Default: true

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`. Valid values: `TRADING`, `HALT`, `BREAK`. Cannot be used in combination with `symbol` or `symbols`.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

**Notes:**

* If the value provided to `symbol` or `symbols` do not exist, the endpoint will throw an error saying the symbol is invalid.
* All parameters are optional.
* Only one of `symbol`, `symbols`, `permissions` parameters can be specified.
* Without parameters, `exchangeInfo` displays all symbols with `["SPOT", "MARGIN", "LEVERAGED"]` permissions.
  + In order to list *all* active symbols on the exchange, you need to explicitly request all permissions.
* `permissions` accepts either a list of permissions, or a single permission name. E.g. `"SPOT"`.

**Examples of Symbol Permissions Interpretation from the Response:**

* `[["A","B"]]` means you may place an order if your account has either permission "A" **or** permission "B".
* `[["A"],["B"]]` means you can place an order if your account has permission "A" **and** permission "B".
* `[["A"],["B","C"]]` means you can place an order if your account has permission "A" **and** permission "B" or permission "C". (Inclusive or is applied here, not exclusive or, so your account may have both permission "B" and permission "C".)

### Exchange information › Responses

Successful Response

Exchange information

`id`

​string

Example: 5494febb-d167-46a2-996d-70533eb4d976

`status`

​integer · int64

Example: 200

`result`

​object

`timezone`

​string

Example: UTC

`serverTime`

​integer · int64

Example: 1655969291181

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

`exchangeFilters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| EXCHANGE\_MAX\_NUM\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ORDER\_LISTS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDER\_LISTS" |

**Properties for EXCHANGE\_MAX\_NUM\_ORDERS:**

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 1000

`symbols`

​object[]

`symbol`

​string

Example: BNBBTC

`status`

​string

Example: TRADING

`baseAsset`

​string

Example: BNB

`baseAssetPrecision`

​integer · int64

Example: 8

`quoteAsset`

​string

Example: BTC

`quotePrecision`

​integer · int64

Example: 8

`quoteAssetPrecision`

​integer · int64

Example: 8

`baseCommissionPrecision`

​integer · int64

Example: 8

`quoteCommissionPrecision`

​integer · int64

Example: 8

`orderTypes`

​string[]

`icebergAllowed`

​boolean

Example: true

`ocoAllowed`

​boolean

Example: true

`otoAllowed`

​boolean

Example: true

`opoAllowed`

​boolean

Example: true

`quoteOrderQtyMarketAllowed`

​boolean

Example: true

`allowTrailingStop`

​boolean

Example: true

`cancelReplaceAllowed`

​boolean

Example: true

`amendAllowed`

​boolean

Example: false

`pegInstructionsAllowed`

​boolean

Example: true

`isSpotTradingAllowed`

​boolean

Example: true

`isMarginTradingAllowed`

​boolean

Example: true

`filters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| PRICE\_FILTER | type = object · filterType="PRICE\_FILTER" |
| PERCENT\_PRICE | type = object · filterType="PERCENT\_PRICE" |
| PERCENT\_PRICE\_BY\_SIDE | type = object · filterType="PERCENT\_PRICE\_BY\_SIDE" |
| LOT\_SIZE | type = object · filterType="LOT\_SIZE" |
| MIN\_NOTIONAL | type = object · filterType="MIN\_NOTIONAL" |
| NOTIONAL | type = object · filterType="NOTIONAL" |
| ICEBERG\_PARTS | type = object · filterType="ICEBERG\_PARTS" |
| MARKET\_LOT\_SIZE | type = object · filterType="MARKET\_LOT\_SIZE" |
| MAX\_NUM\_ORDERS | type = object · filterType="MAX\_NUM\_ORDERS" |
| MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="MAX\_NUM\_ALGO\_ORDERS" |
| MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="MAX\_NUM\_ICEBERG\_ORDERS" |
| MAX\_POSITION | type = object · filterType="MAX\_POSITION" |
| TRAILING\_DELTA | type = object · filterType="TRAILING\_DELTA" |
| T\_PLUS\_SELL | type = object · filterType="T\_PLUS\_SELL" |
| MAX\_NUM\_ORDER\_LISTS | type = object · filterType="MAX\_NUM\_ORDER\_LISTS" |
| MAX\_NUM\_ORDER\_AMENDS | type = object · filterType="MAX\_NUM\_ORDER\_AMENDS" |

**Properties for PRICE\_FILTER:**

`filterType`

​string

Example: PRICE\_FILTER

`priceExponent`

​integer

Example: 8

`minPrice`

​string

Example: 0.00000100

`maxPrice`

​string

Example: 100000.00000000

`tickSize`

​string

Example: 0.00000100

`permissions`

​string[]

`permissionSets`

​array[]

`defaultSelfTradePreventionMode`

​string

Example: NONE

`allowedSelfTradePreventionModes`

​string[]

`sors`

​object[]

`baseAsset`

​string

Example: BTC

`symbols`

​string[]

WSSexchangeInfo

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "exchangeInfo"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "exchangeInfo"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "5494febb-d167-46a2-996d-70533eb4d976",
 "status": 200,
 "result": {
 "timezone": "UTC",
 "serverTime": 1655969291181,
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ],
 "exchangeFilters": [
 {
 "filterType": "EXCHANGE_MAX_NUM_ORDERS",
 "maxNumOrders": 1000
 }
 ],
 "symbols": [
 {
 "symbol": "BNBBTC",
 "status": "TRADING",
 "baseAsset": "BNB",
 "baseAssetPrecision": 8,
 "quoteAsset": "BTC",
 "quotePrecision": 8,
 "quoteAssetPrecision": 8,
 "baseCommissionPrecision": 8,
 "quoteCommissionPrecision": 8,
 "orderTypes": [
 "LIMIT"
 ],
 "icebergAllowed": true,
 "ocoAllowed": true,
 "otoAllowed": true,
 "opoAllowed": true,
 "quoteOrderQtyMarketAllowed": true,
 "allowTrailingStop": true,
 "cancelReplaceAllowed": true,
 "amendAllowed": false,
 "pegInstructionsAllowed": true,
 "isSpotTradingAllowed": true,
 "isMarginTradingAllowed": true,
 "filters": [
 {
 "filterType": "PRICE_FILTER",
 "priceExponent": 8,
 "minPrice": "0.00000100",
 "maxPrice": "100000.00000000",
 "tickSize": "0.00000100"
 }
 ],
 "permissions": [
 "SPOT"
 ],
 "permissionSets": [
 [
 "SPOT"
 ]
 ],
 "defaultSelfTradePreventionMode": "NONE",
 "allowedSelfTradePreventionModes": [
 "NONE"
 ]
 }
 ],
 "sors": [
 {
 "baseAsset": "BTC",
 "symbols": [
 "BTCUSDT"
 ]
 }
 ]
 }
}`

json

application/json

---

## Query Execution Rules

Query execution rules for symbols.

WSS

executionRules

wss://ws-api.binance.com:443/ws-api/v3

### Query Execution Rules › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

| Parameter | Weight |
| --- | --- |
| `symbol` | 2 |
| `symbols` | 2 for each `symbol`, capped at a max of 40 |
| `symbolStatus` | 40 |
| None | 40 |

### Query Execution Rules › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

executionRules

Example: executionRules

`params`

​object

`symbol`

​string

Query for specified symbol.

Example: BAZUSD

`symbols`

​string[]

Query for multiple symbols.

`symbolStatus`

​string · enum

Query for all symbols with the specified status. Supported values: `TRADING`, `HALT`, `BREAK`

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

**Note:** No combination of multiple parameters is allowed.

### Query Execution Rules › Responses

Successful Response

Query Execution Rules

`id`

​string

Example: 5162affb-0aba-4821-b475-f2625006eb43

`status`

​integer · int64

Example: 200

`result`

​object

`symbolRules`

​object[]

`symbol`

​string

Example: BAZUSD

`rules`

​object[]

`ruleType`

​string

Example: PRICE\_RANGE

`bidLimitMultUp`

​string

Example: 1.0001

`bidLimitMultDown`

​string

Example: 0.9999

`askLimitMultUp`

​string

Example: 1.0001

`askLimitMultDown`

​string

Example: 0.9999

WSSexecutionRules

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "executionRules"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "executionRules"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "5162affb-0aba-4821-b475-f2625006eb43",
 "status": 200,
 "result": {
 "symbolRules": [
 {
 "symbol": "BAZUSD",
 "rules": [
 {
 "ruleType": "PRICE_RANGE",
 "bidLimitMultUp": "1.0001",
 "bidLimitMultDown": "0.9999",
 "askLimitMultUp": "1.0001",
 "askLimitMultDown": "0.9999"
 }
 ]
 }
 ]
 }
}`

json

application/json

---

## Test connectivity

Test connectivity to the WebSocket API.

Note: You can use regular WebSocket ping frames to test connectivity as well, WebSocket API will respond with pong frames as soon as possible. ping request along with time is a safe way to test request-response handling in your application.

WSS

ping

wss://ws-api.binance.com:443/ws-api/v3

### Test connectivity › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Test connectivity › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

ping

Example: ping

`params`

​object

**Data Source:** Memory

### Test connectivity › Responses

Successful Response

Test connectivity

`id`

​string

Example: 922bcc6e-9de8-440d-9e84-7c80933a8d0d

`status`

​integer · int64

Example: 200

`result`

​object

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSping

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ping"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ping"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "922bcc6e-9de8-440d-9e84-7c80933a8d0d",
 "status": 200,
 "result": {},
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Check server time

Test connectivity to the WebSocket API and get the current server time.

WSS

time

wss://ws-api.binance.com:443/ws-api/v3

### Check server time › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Check server time › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

time

Example: time

`params`

​object

**Data Source:** Memory

### Check server time › Responses

Successful Response

Check server time

`id`

​string

Example: 187d3cb2-942d-484c-8271-4e2141bbadb1

`status`

​integer · int64

Example: 200

`result`

​object

`serverTime`

​integer · int64

Example: 1656400526260

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSStime

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "time"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "time"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "187d3cb2-942d-484c-8271-4e2141bbadb1",
 "status": 200,
 "result": {
 "serverTime": 1656400526260
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-api/trade -->

# Trade - Spot WebSocket API | Binance Developer Docs

Spot WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [WebSocket API](/en/docs/catalog/core-trading-spot-trading/api/ws-api)

# Trade

Endpoint

wss://ws-api.binance.com:443/ws-api/v3wss://demo-ws-api.binance.com:443/ws-api/v3wss://ws-api.testnet.binance.vision:443/ws-api/v3

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/ws-api/1.0.0/schema.yaml)

---

## Cancel open orders (TRADE)

Cancel all open orders on a symbol.
This includes orders that are part of an order list.

WSS

openOrders.cancelAll

wss://ws-api.binance.com:443/ws-api/v3

### Cancel open orders (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Cancel open orders (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Cancel open orders (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

openOrders.cancelAll

Example: openOrders.cancelAll

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

### Cancel open orders (TRADE) › Responses

Successful Response

Cancel open orders

`id`

​string

Example: 778f938f-9041-4b88-9914-efbf64eeacc8

`status`

​integer · int64

Example: 200

`result`

​object[]

`orderListId`

​integer · int64

Example: -1

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: ALL\_DONE

`listOrderStatus`

​string

Example: ALL\_DONE

`listClientOrderId`

​string

Example: iuVNVJYYrByz6C4yGOPPK0

`transactionTime`

​integer · int64

Example: 1660803702431

`symbol`

​string

Example: BTCUSDT

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569099453

`clientOrderId`

​string

Example: bX5wROblo6YeDwa9iTLeyY

`orderReports`

​object[]

`symbol`

​string

Example: BTCUSDT

`origClientOrderId`

​string

Example: bX5wROblo6YeDwa9iTLeyY

`orderId`

​integer · int64

Example: 12569099453

`orderListId`

​integer · int64

Example: 19431

`clientOrderId`

​string

Example: OFFXQtxVFZ6Nbcg4PgE2DA

`transactTime`

​integer · int64

Example: 1684804350068

`price`

​string

Example: 23450.5

`origQty`

​string

Example: 0.0085

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: CANCELED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: STOP\_LOSS\_LIMIT

`side`

​string

Example: BUY

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`origClientOrderId`

​string

Example: 4d96324ff9d44481926157

`orderId`

​integer · int64

Example: 12569099453

`clientOrderId`

​string

Example: 91fe37ce9e69c90d6358c0

`transactTime`

​integer · int64

Example: 1684804350068

`price`

​string

Example: 23416.1

`origQty`

​string

Example: 0.00847

`executedQty`

​string

Example: 0.00001

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0.234161

`status`

​string

Example: CANCELED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: SELL

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`selfTradePreventionMode`

​string

Example: NONE

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSopenOrders.cancelAll

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "openOrders.cancelAll",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "openOrders.cancelAll",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "778f938f-9041-4b88-9914-efbf64eeacc8",
 "status": 200,
 "result": [
 {
 "orderListId": -1,
 "contingencyType": "OCO",
 "listStatusType": "ALL_DONE",
 "listOrderStatus": "ALL_DONE",
 "listClientOrderId": "iuVNVJYYrByz6C4yGOPPK0",
 "transactionTime": 1660803702431,
 "symbol": "BTCUSDT",
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569099453,
 "clientOrderId": "bX5wROblo6YeDwa9iTLeyY"
 }
 ],
 "orderReports": [
 {
 "symbol": "BTCUSDT",
 "origClientOrderId": "bX5wROblo6YeDwa9iTLeyY",
 "orderId": 12569099453,
 "orderListId": 19431,
 "clientOrderId": "OFFXQtxVFZ6Nbcg4PgE2DA",
 "transactTime": 1684804350068,
 "price": 23450.5,
 "origQty": 0.0085,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "CANCELED",
 "timeInForce": "GTC",
 "type": "STOP_LOSS_LIMIT",
 "side": "BUY",
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ],
 "origClientOrderId": "4d96324ff9d44481926157",
 "orderId": 12569099453,
 "clientOrderId": "91fe37ce9e69c90d6358c0",
 "transactTime": 1684804350068,
 "price": 23416.1,
 "origQty": 0.00847,
 "executedQty": 0.00001,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0.234161,
 "status": "CANCELED",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "SELL",
 "stopPrice": "0.00000000",
 "trailingDelta": 10,
 "trailingTime": -1,
 "icebergQty": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "selfTradePreventionMode": "NONE",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Order Amend Keep Priority (TRADE)

Reduce the quantity of an existing open order.

This adds 0 orders to the `EXCHANGE_MAX_ORDERS` filter and the `MAX_NUM_ORDERS` filter.

Read [Order Amend Keep Priority FAQ](/en/docs/products/spot/faqs/order_amend_keep_priority) to learn more.

WSS

order.amend.keepPriority

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count0

### Order Amend Keep Priority (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Order Amend Keep Priority (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight4

### Order Amend Keep Priority (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

order.amend.keepPriority

Example: order.amend.keepPriority

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`newQty`

​number · float · required

`newQty` must be greater than 0 and less than the order's quantity.

Example: 1

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`orderId`

​integer · int64

`orderId` or `origClientOrderId` must be sent

Example: 1

`origClientOrderId`

​string

`orderId` or `origClientOrderId` must be sent

Example: myOrder1

`newClientOrderId`

​string

The new client order ID for the order after being amended.   
 If not sent, one will be randomly generated.   
 It is possible to reuse the current clientOrderId by sending it as the `newClientOrderId`.

Example: myOrder2

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

### Order Amend Keep Priority (TRADE) › Responses

Successful Response

Order Amend Keep Priority

`id`

​string

Example: 56374b46-3061-486b-a311-89ee972eb648

`status`

​integer · int64

Example: 200

`result`

​object

`transactTime`

​integer · int64

Example: 1741924229819

`executionId`

​integer · int64

Example: 60

`amendedOrder`

​object

`symbol`

​string

Example: BTUCSDT

`orderId`

​integer · int64

Example: 23

`orderListId`

​integer · int64

Example: 4

`origClientOrderId`

​string

Example: my\_pending\_order

`clientOrderId`

​string

Example: xbxXh5SSwaHS7oUEOCI88B

`price`

​string

Example: 1

`qty`

​string

Example: 5

`executedQty`

​string

Example: 0

`preventedQty`

​string

Example: 0

`quoteOrderQty`

​string

Example: 0

`cumulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: BUY

`workingTime`

​integer · int64

Example: 1741924204920

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`listStatus`

​object

`orderListId`

​integer · int64

Example: 4

`contingencyType`

​string

Example: OTO

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: 8nOGLLawudj1QoOiwbroRH

`symbol`

​string

Example: BTCUSDT

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 22

`clientOrderId`

​string

Example: g04EWsjaackzedjC9wRkWD

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorder.amend.keepPriority

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.amend.keepPriority",
 "params": {
 "symbol": "BNBUSDT",
 "newQty": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.amend.keepPriority",
 "params": {
 "symbol": "BNBUSDT",
 "newQty": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "56374b46-3061-486b-a311-89ee972eb648",
 "status": 200,
 "result": {
 "transactTime": 1741924229819,
 "executionId": 60,
 "amendedOrder": {
 "symbol": "BTUCSDT",
 "orderId": 23,
 "orderListId": 4,
 "origClientOrderId": "my_pending_order",
 "clientOrderId": "xbxXh5SSwaHS7oUEOCI88B",
 "price": 1,
 "qty": 5,
 "executedQty": 0,
 "preventedQty": 0,
 "quoteOrderQty": 0,
 "cumulativeQuoteQty": 0,
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "BUY",
 "workingTime": 1741924204920,
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 },
 "listStatus": {
 "orderListId": 4,
 "contingencyType": "OTO",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "8nOGLLawudj1QoOiwbroRH",
 "symbol": "BTCUSDT",
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 22,
 "clientOrderId": "g04EWsjaackzedjC9wRkWD"
 }
 ]
 }
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Cancel order (TRADE)

Cancel an active order.

WSS

order.cancel

wss://ws-api.binance.com:443/ws-api/v3

### Cancel order (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Cancel order (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Cancel order (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

order.cancel

Example: order.cancel

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`orderId`

​integer · int64

Example: 1

`origClientOrderId`

​string

Example: myOrder1

`newClientOrderId`

​string

Used to uniquely identify this cancel. Automatically generated by default.

Example: cancelMyOrder1

`cancelRestrictions`

​string · enum

Supported values:   
`ONLY_NEW` - Cancel will succeed if the order status is `NEW`.  
 `ONLY_PARTIALLY_FILLED` - Cancel will succeed if order status is `PARTIALLY_FILLED`.

Enum values:

ONLY\_NEW

ONLY\_PARTIALLY\_FILLED

Example: ONLY\_NEW

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

Notes:

* If both `orderId` and `origClientOrderId` parameters are provided, the `orderId` is searched first, then the `origClientOrderId` from that result is checked against that order. If both conditions are not met the request will be rejected.
* `newClientOrderId` will replace `clientOrderId` of the canceled order, freeing it up for new orders.
* If you cancel an order that is a part of an order list, the entire order list is canceled.
* The performance for canceling an order (single cancel or as part of a cancel-replace) is always better when only `orderId` is sent. Sending `origClientOrderId` or both `orderId` + `origClientOrderId` will be slower.

### Cancel order (TRADE) › Responses

Successful Response

Cancel order

`id`

​string

Example: 16eaf097-bbec-44b9-96ff-e97e6e875870

`status`

​integer · int64

Example: 200

`result`

​object

`symbol`

​string

Example: BTCUSDT

`origClientOrderId`

​string

Example: 4d96324ff9d44481926157

`orderId`

​integer · int64

Example: 12569099453

`orderListId`

​integer · int64

Example: 19431

`clientOrderId`

​string

Example: 91fe37ce9e69c90d6358c0

`transactTime`

​integer · int64

Example: 1684804350068

`price`

​string

Example: 23416.1

`origQty`

​string

Example: 0.00847

`executedQty`

​string

Example: 0.00001

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0.234161

`status`

​string

Example: CANCELED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: SELL

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`selfTradePreventionMode`

​string

Example: NONE

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: ALL\_DONE

`listOrderStatus`

​string

Example: ALL\_DONE

`listClientOrderId`

​string

Example: iuVNVJYYrByz6C4yGOPPK0

`transactionTime`

​integer · int64

Example: 1660803702431

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569099453

`clientOrderId`

​string

Example: bX5wROblo6YeDwa9iTLeyY

`orderReports`

​object[]

`symbol`

​string

Example: BTCUSDT

`origClientOrderId`

​string

Example: bX5wROblo6YeDwa9iTLeyY

`orderId`

​integer · int64

Example: 12569099453

`orderListId`

​integer · int64

Example: 19431

`clientOrderId`

​string

Example: OFFXQtxVFZ6Nbcg4PgE2DA

`transactTime`

​integer · int64

Example: 1684804350068

`price`

​string

Example: 23450.5

`origQty`

​string

Example: 0.0085

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: CANCELED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: STOP\_LOSS\_LIMIT

`side`

​string

Example: BUY

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorder.cancel

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.cancel",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.cancel",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "16eaf097-bbec-44b9-96ff-e97e6e875870",
 "status": 200,
 "result": {
 "symbol": "BTCUSDT",
 "origClientOrderId": "4d96324ff9d44481926157",
 "orderId": 12569099453,
 "orderListId": 19431,
 "clientOrderId": "91fe37ce9e69c90d6358c0",
 "transactTime": 1684804350068,
 "price": 23416.1,
 "origQty": 0.00847,
 "executedQty": 0.00001,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0.234161,
 "status": "CANCELED",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "SELL",
 "stopPrice": "0.00000000",
 "trailingDelta": 10,
 "icebergQty": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "selfTradePreventionMode": "NONE",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY",
 "contingencyType": "OCO",
 "listStatusType": "ALL_DONE",
 "listOrderStatus": "ALL_DONE",
 "listClientOrderId": "iuVNVJYYrByz6C4yGOPPK0",
 "transactionTime": 1660803702431,
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569099453,
 "clientOrderId": "bX5wROblo6YeDwa9iTLeyY"
 }
 ],
 "orderReports": [
 {
 "symbol": "BTCUSDT",
 "origClientOrderId": "bX5wROblo6YeDwa9iTLeyY",
 "orderId": 12569099453,
 "orderListId": 19431,
 "clientOrderId": "OFFXQtxVFZ6Nbcg4PgE2DA",
 "transactTime": 1684804350068,
 "price": 23450.5,
 "origQty": 0.0085,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "CANCELED",
 "timeInForce": "GTC",
 "type": "STOP_LOSS_LIMIT",
 "side": "BUY",
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Cancel and replace order (TRADE)

* Cancel an existing order and immediately place a new order instead of the canceled one.
* A new order that was not attempted (i.e. when `newOrderResult: NOT_ATTEMPTED`), will still increase the unfilled order count by 1.
* You can only cancel an individual order from an orderList using this method, but the result is the same as canceling the entire orderList.not attempted (i.e. when `newOrderResult: NOT_ATTEMPTED`), will still increase the unfilled order count by 1.

WSS

order.cancelReplace

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count1

### Cancel and replace order (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Cancel and replace order (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Cancel and replace order (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

order.cancelReplace

Example: order.cancelReplace

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`cancelReplaceMode`

​string · enum · required

The allowed values are:   
 `STOP_ON_FAILURE` - If the cancel request fails, the new order placement will not be attempted.   
 `ALLOW_FAILURE` - new order placement will be attempted even if cancel request fails.

Enum values:

STOP\_ON\_FAILURE

ALLOW\_FAILURE

Example: STOP\_ON\_FAILURE

`side`

​string · enum · required

Please see [Enums](/en/docs/products/spot/enums#side) for supported values.

Enum values:

BUY

SELL

Example: BUY

`type`

​string · enum · required

Please see [Enums](/en/docs/products/spot/enums#ordertypes) for supported values.

Enum values:

MARKET

LIMIT

STOP\_LOSS

STOP\_LOSS\_LIMIT

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

LIMIT\_MAKER

Example: MARKET

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`cancelOrderId`

​integer · int64

Either `cancelOrderId` or `cancelOrigClientOrderId` must be sent.   
  
If both `cancelOrderId` and `cancelOrigClientOrderId` parameters are provided, the `cancelOrderId` is searched first, then the `cancelOrigClientOrderId` from that result is checked against that order.   
  
If both conditions are not met the request will be rejected.

Example: 1

`cancelOrigClientOrderId`

​string

Either `cancelOrderId` or `cancelOrigClientOrderId` must be sent.   
  
 If both `cancelOrderId` and `cancelOrigClientOrderId` parameters are provided, the `cancelOrderId` is searched first, then the `cancelOrigClientOrderId` from that result is checked against that order.   
  
 If both conditions are not met the request will be rejected.

Example: myOrder1

`cancelNewClientOrderId`

​string

Used to uniquely identify this cancel. Automatically generated by default.

Example: cancelMyOrder1

`timeInForce`

​string · enum

Please see [Enums](/en/docs/products/spot/enums#timeinforce) for supported values.

Enum values:

GTC

IOC

FOK

Example: GTC

`price`

​number · float

Example: 1

`quantity`

​number · float

Example: 1

`quoteOrderQty`

​number · float

Example: 1

`newClientOrderId`

​string

Used to identify the new order.

Example: myOrder2

`newOrderRespType`

​string · enum

Allowed values:   
 `ACK`, `RESULT`, `FULL`   
 `MARKET` and `LIMIT` orders types default to `FULL`; all other orders default to `ACK`

Enum values:

ACK

RESULT

FULL

Example: ACK

`stopPrice`

​number · float

Used with `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, and `TAKE_PROFIT_LIMIT` orders.

Example: 1

`trailingDelta`

​number · float

See [Trailing Stop order FAQ](/en/docs/products/spot/faqs/trailing-stop-faq)

Example: 1

`icebergQty`

​number · float

Used with `LIMIT`, `STOP_LOSS_LIMIT`, and `TAKE_PROFIT_LIMIT` to create an iceberg order.

Example: 1

`strategyId`

​integer · int64

Example: 1

`strategyType`

​integer

The value cannot be less than `1000000`.

Example: 1

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol. The possible supported values are: [STP Modes](/en/docs/products/spot/enums#stpmodes).

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`cancelRestrictions`

​string · enum

Supported values:   
`ONLY_NEW` - Cancel will succeed if the order status is `NEW`.  
 `ONLY_PARTIALLY_FILLED` - Cancel will succeed if order status is `PARTIALLY_FILLED`.

Enum values:

ONLY\_NEW

ONLY\_PARTIALLY\_FILLED

Example: ONLY\_NEW

`orderRateLimitExceededMode`

​string · enum

Supported values:   
 `DO_NOTHING` (default)- will only attempt to cancel the order if account has not exceeded the unfilled order rate limit  
 `CANCEL_ONLY` - will always cancel the order

Enum values:

DO\_NOTHING

CANCEL\_ONLY

Example: DO\_NOTHING

`pegPriceType`

​string · enum

`PRIMARY_PEG` or `MARKET_PEG`   
 See Pegged Orders

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`pegOffsetValue`

​integer · max: 100

Price level to peg the price to (max: 100)   
 See Pegged Orders

Example: 1

`pegOffsetType`

​string · enum

Only `PRICE_LEVEL` is supported   
 See Pegged Orders

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

Similar to the [`order.place`](/en/docs/catalog/core-trading-spot-trading/api/ws-api/trade#order-place) request,
additional mandatory parameters (\*) are determined by the new order `type`.

Available `cancelReplaceMode` options:

* `STOP_ON_FAILURE` – if cancellation request fails, new order placement will not be attempted.
* `ALLOW_FAILURE` – new order placement will be attempted even if the cancel request fails.

| Request | | | Response | | |
| --- | --- | --- | --- | --- | --- |
| `cancelReplaceMode` | `orderRateLimitExceededMode` | Unfilled Order Count | `cancelResult` | `newOrderResult` | `status` |
| `STOP_ON_FAILURE` | `DO_NOTHING` | Within Limits | ✅ `SUCCESS` | ✅ `SUCCESS` | `200` |
| ❌ `FAILURE` | ➖ `NOT_ATTEMPTED` | `400` |
| ✅ `SUCCESS` | ❌ `FAILURE` | `409` |
| Exceeds Limits | ✅ `SUCCESS` | ✅ `SUCCESS` | N/A |
| ❌ `FAILURE` | ➖ `NOT_ATTEMPTED` | N/A |
| ✅ `SUCCESS` | ❌ `FAILURE` | N/A |
| `CANCEL_ONLY` | Within Limits | ✅ `SUCCESS` | ✅ `SUCCESS` | `200` |
| ❌ `FAILURE` | ➖ `NOT_ATTEMPTED` | `400` |
| ✅ `SUCCESS` | ❌ `FAILURE` | `409` |
| Exceeds Limits | ❌ `FAILURE` | ➖ `NOT_ATTEMPTED` | `429` |
| ✅ `SUCCESS` | ❌ `FAILURE` | `429` |
| `ALLOW_FAILURE` | `DO_NOTHING` | Within Limits | ✅ `SUCCESS` | ✅ `SUCCESS` | `200` |
| ❌ `FAILURE` | ❌ `FAILURE` | `400` |
| ❌ `FAILURE` | ✅ `SUCCESS` | `409` |
| ✅ `SUCCESS` | ❌ `FAILURE` | `409` |
| Exceeds Limits | ✅ `SUCCESS` | ✅ `SUCCESS` | N/A |
| ❌ `FAILURE` | ❌ `FAILURE` | N/A |
| ❌ `FAILURE` | ✅ `SUCCESS` | N/A |
| ✅ `SUCCESS` | ❌ `FAILURE` | N/A |
| `CANCEL_ONLY` | Within Limits | ✅ `SUCCESS` | ✅ `SUCCESS` | `200` |
| ❌ `FAILURE` | ❌ `FAILURE` | `400` |
| ❌ `FAILURE` | ✅ `SUCCESS` | `409` |
| ✅ `SUCCESS` | ❌ `FAILURE` | `409` |
| Exceeds Limits | ✅ `SUCCESS` | ✅ `SUCCESS` | `200` |
| ❌ `FAILURE` | ❌ `FAILURE` | `400` |
| ❌ `FAILURE` | ✅ `SUCCESS` | N/A |
| ✅ `SUCCESS` | ❌ `FAILURE` | `409` |

Notes:

* If both `cancelOrderId` and `cancelOrigClientOrderId` parameters are provided, the `cancelOrderId` is searched first, then the `cancelOrigClientOrderId` from that result is checked against that order. If both conditions are not met the request will be rejected.
* `cancelNewClientOrderId` will replace `clientOrderId` of the canceled order, freeing it up for new orders.
* `newClientOrderId` specifies `clientOrderId` value for the placed order.

  A new order with the same `clientOrderId` is accepted only when the previous one is filled or expired.

  The new order can reuse old `clientOrderId` of the canceled order.
* This cancel-replace operation is **not transactional**.

  If one operation succeeds but the other one fails, the successful operation is still executed.

  For example, in `STOP_ON_FAILURE` mode, if the new order placement fails, the old order is still canceled.
* Filters and order count limits are evaluated before cancellation and order placement occurs.
* If new order placement is not attempted, your order count is still incremented.
* Like [`order.cancel`](/en/docs/catalog/core-trading-spot-trading/api/ws-api/trade#order-cancel), if you cancel an individual order from an order list, the entire order list is canceled.
* The performance for canceling an order (single cancel or as part of a cancel-replace) is always better when only `orderId` is sent. Sending `origClientOrderId` or both `orderId` + `origClientOrderId` will be slower.

### Cancel and replace order (TRADE) › Responses

Successful Response

Cancel and replace order

`id`

​string

Example: 99de1036-b5e2-4e0f-9b5c-13d751c93a1a

`status`

​integer · int64

Example: 200

`result`

​object

`cancelResult`

​string

Example: SUCCESS

`newOrderResult`

​string

Example: SUCCESS

`cancelResponse`

​object

`symbol`

​string

Example: BTCUSDT

`origClientOrderId`

​string

Example: 4d96324ff9d44481926157

`orderId`

​integer · int64

Example: 125690984230

`orderListId`

​integer · int64

Example: -1

`clientOrderId`

​string

Example: 91fe37ce9e69c90d6358c0

`transactTime`

​integer · int64

Example: 1684804350068

`price`

​string

Example: 23450

`origQty`

​string

Example: 0.00847

`executedQty`

​string

Example: 0.00001

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0.2345

`status`

​string

Example: CANCELED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: SELL

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`newOrderResponse`

​object

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569099453

`orderListId`

​integer · int64

Example: -1

`clientOrderId`

​string

Example: bX5wROblo6YeDwa9iTLeyY

`transactTime`

​integer · int64

Example: 1660813156959

`price`

​string

Example: 23416.1

`origQty`

​string

Example: 0.00847

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: SELL

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorder.cancelReplace

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.cancelReplace",
 "params": {
 "symbol": "BNBUSDT",
 "cancelReplaceMode": "STOP_ON_FAILURE",
 "side": "BUY",
 "type": "MARKET",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.cancelReplace",
 "params": {
 "symbol": "BNBUSDT",
 "cancelReplaceMode": "STOP_ON_FAILURE",
 "side": "BUY",
 "type": "MARKET",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "99de1036-b5e2-4e0f-9b5c-13d751c93a1a",
 "status": 200,
 "result": {
 "cancelResult": "SUCCESS",
 "newOrderResult": "SUCCESS",
 "cancelResponse": {
 "symbol": "BTCUSDT",
 "origClientOrderId": "4d96324ff9d44481926157",
 "orderId": 125690984230,
 "orderListId": -1,
 "clientOrderId": "91fe37ce9e69c90d6358c0",
 "transactTime": 1684804350068,
 "price": 23450,
 "origQty": 0.00847,
 "executedQty": 0.00001,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0.2345,
 "status": "CANCELED",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "SELL",
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 },
 "newOrderResponse": {
 "symbol": "BTCUSDT",
 "orderId": 12569099453,
 "orderListId": -1,
 "clientOrderId": "bX5wROblo6YeDwa9iTLeyY",
 "transactTime": 1660813156959,
 "price": 23416.1,
 "origQty": 0.00847,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "SELL",
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Cancel Order list (TRADE)

Cancel an active order list.

WSS

orderList.cancel

wss://ws-api.binance.com:443/ws-api/v3

### Cancel Order list (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Cancel Order list (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Cancel Order list (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

orderList.cancel

Example: orderList.cancel

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`orderListId`

​integer

Either `orderListId` or `listClientOrderId` must be provided

Example: 1

`listClientOrderId`

​string

Either `orderListId` or `listClientOrderId` must be provided

Example: C3wyj4WVEktd7u9aVBRXcN

`newClientOrderId`

​string

Used to uniquely identify this cancel. Automatically generated by default.

Example: cancelMyOrder1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

Notes:

* If both `orderListId` and `listClientOrderId` parameters are provided, the `orderListId` is searched first, then the `listClientOrderId` from that result is checked against that order. If both conditions are not met the request will be rejected.
* Canceling an individual order with [`order.cancel`](/en/docs/catalog/core-trading-spot-trading/api/ws-api/trade#order-cancel) will cancel the entire order list as well.

### Cancel Order list (TRADE) › Responses

Successful Response

Cancel Order list

`id`

​string

Example: c5899911-d3f4-47ae-8835-97da553d27d0

`status`

​integer · int64

Example: 200

`result`

​object

`orderListId`

​integer · int64

Example: 1274512

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: ALL\_DONE

`listOrderStatus`

​string

Example: ALL\_DONE

`listClientOrderId`

​string

Example: 6023531d7edaad348f5aff

`transactionTime`

​integer · int64

Example: 1660801720215

`symbol`

​string

Example: BTCUSDT

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569138901

`clientOrderId`

​string

Example: BqtFCj5odMoWtSqGk2X9tU

`orderReports`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569138901

`orderListId`

​integer · int64

Example: 1274512

`clientOrderId`

​string

Example: BqtFCj5odMoWtSqGk2X9tU

`transactTime`

​integer · int64

Example: 1660801720215

`price`

​string

Example: 23410

`origQty`

​string

Example: 0.0065

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: CANCELED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: STOP\_LOSS\_LIMIT

`side`

​string

Example: SELL

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 23405

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorderList.cancel

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.cancel",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.cancel",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "c5899911-d3f4-47ae-8835-97da553d27d0",
 "status": 200,
 "result": {
 "orderListId": 1274512,
 "contingencyType": "OCO",
 "listStatusType": "ALL_DONE",
 "listOrderStatus": "ALL_DONE",
 "listClientOrderId": "6023531d7edaad348f5aff",
 "transactionTime": 1660801720215,
 "symbol": "BTCUSDT",
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569138901,
 "clientOrderId": "BqtFCj5odMoWtSqGk2X9tU"
 }
 ],
 "orderReports": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569138901,
 "orderListId": 1274512,
 "clientOrderId": "BqtFCj5odMoWtSqGk2X9tU",
 "transactTime": 1660801720215,
 "price": 23410,
 "origQty": 0.0065,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "CANCELED",
 "timeInForce": "GTC",
 "type": "STOP_LOSS_LIMIT",
 "side": "SELL",
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": 23405,
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

deprecated

## Place new OCO - Deprecated (TRADE)

Send in a new one-cancels-the-other (OCO) pair:
`LIMIT_MAKER` + `STOP_LOSS`/`STOP_LOSS_LIMIT` orders (called *legs*),
where activation of one order immediately cancels the other.

This adds 1 order to `EXCHANGE_MAX_ORDERS` filter and the `MAX_NUM_ORDERS` filter

WSS

orderList.place

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count1

### Place new OCO - Deprecated (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Place new OCO - Deprecated (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Place new OCO - Deprecated (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

orderList.place

Example: orderList.place

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`side`

​string · enum · required

Please see [Enums](/en/docs/products/spot/enums#side) for supported values.

Enum values:

BUY

SELL

Example: BUY

`price`

​number · float · required

Example: 1

`quantity`

​number · float · required

Example: 1

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`listClientOrderId`

​string

A unique Id for the entire orderList

Example: 08985fedd9ea2cf6b28996

`limitClientOrderId`

​string

A unique Id for the limit order

Example: limitOrder1

`limitIcebergQty`

​number · float

Used to make the `LIMIT_MAKER` leg an iceberg order.

Example: 1

`limitStrategyId`

​integer · int64

Example: 1

`limitStrategyType`

​integer

The value cannot be less than `1000000`.

Example: 1

`stopPrice`

​number · float

Example: 1

`trailingDelta`

​integer

Example: 1

`stopClientOrderId`

​string

A unique Id for the stop loss/stop loss limit leg

Example: stopOrder1

`stopLimitPrice`

​number · float

If provided, `stopLimitTimeInForce` is required.

Example: 1

`stopLimitTimeInForce`

​string · enum

Valid values are `GTC`/`FOK`/`IOC`

Enum values:

GTC

IOC

FOK

Example: GTC

`stopIcebergQty`

​number · float

Used with `STOP_LOSS_LIMIT` leg to make an iceberg order.

Example: 1

`stopStrategyId`

​integer · int64

Example: 1

`stopStrategyType`

​integer

The value cannot be less than `1000000`.

Example: 1

`newOrderRespType`

​string · enum

Format of the JSON response. Supported values: [Order Response Type](/en/docs/products/spot/enums#orderresponsetype)

Enum values:

ACK

RESULT

FULL

Example: ACK

`selfTradePreventionMode`

​string · enum

The allowed values are dependent on what is configured on the symbol. Supported values: [STP Modes](/en/docs/products/spot/enums#stpmodes)

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

Notes:

* `listClientOrderId` parameter specifies `listClientOrderId` for the OCO pair.

  A new OCO with the same `listClientOrderId` is accepted only when the previous one is filled or completely expired.

  `listClientOrderId` is distinct from `clientOrderId` of individual orders.
* `limitClientOrderId` and `stopClientOrderId` specify `clientOrderId` values for both legs of the OCO.

  A new order with the same `clientOrderId` is accepted only when the previous one is filled or expired.
* Price restrictions on the legs:

  | `side` | Price relation |
  | --- | --- |
  | `BUY` | `price` < market price < `stopPrice` |
  | `SELL` | `price` > market price > `stopPrice` |
* Both legs have the same `quantity`.

  However, you can set different iceberg quantity for individual legs.

  If `stopIcebergQty` is used, `stopLimitTimeInForce` must be `GTC`.
* `trailingDelta` applies only to the `STOP_LOSS`/`STOP_LOSS_LIMIT` leg of the OCO.

### Place new OCO - Deprecated (TRADE) › Responses

Successful Response

Place new OCO - Deprecated

`id`

​string

Example: 57833dc0-e3f2-43fb-ba20-46480973b0aa

`status`

​integer · int64

Example: 200

`result`

​object

`orderListId`

​integer · int64

Example: 1274512

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: 08985fedd9ea2cf6b28996

`transactionTime`

​integer · int64

Example: 1660801713793

`symbol`

​string

Example: BTCUSDT

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569138901

`clientOrderId`

​string

Example: BqtFCj5odMoWtSqGk2X9tU

`orderReports`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569138901

`orderListId`

​integer · int64

Example: 1274512

`clientOrderId`

​string

Example: BqtFCj5odMoWtSqGk2X9tU

`transactTime`

​integer · int64

Example: 1660801713793

`price`

​string

Example: 23410

`origQty`

​string

Example: 0.0065

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: STOP\_LOSS\_LIMIT

`side`

​string

Example: SELL

`workingTime`

​integer · int64

Example: -1

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 23405

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorderList.place

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "price": 1,
 "quantity": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "price": 1,
 "quantity": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "57833dc0-e3f2-43fb-ba20-46480973b0aa",
 "status": 200,
 "result": {
 "orderListId": 1274512,
 "contingencyType": "OCO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "08985fedd9ea2cf6b28996",
 "transactionTime": 1660801713793,
 "symbol": "BTCUSDT",
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569138901,
 "clientOrderId": "BqtFCj5odMoWtSqGk2X9tU"
 }
 ],
 "orderReports": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569138901,
 "orderListId": 1274512,
 "clientOrderId": "BqtFCj5odMoWtSqGk2X9tU",
 "transactTime": 1660801713793,
 "price": 23410,
 "origQty": 0.0065,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "STOP_LOSS_LIMIT",
 "side": "SELL",
 "workingTime": -1,
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": 23405,
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Place new Order list - OCO (TRADE)

Send in an one-cancels-the-other (OCO) pair, where activation of one order immediately cancels the other.

* An OCO has 2 orders called the **above order** and **below order**.
* One of the orders must be a `LIMIT_MAKER/TAKE_PROFIT/TAKE_PROFIT_LIMIT` order and the other must be
  `STOP_LOSS` or `STOP_LOSS_LIMIT` order.
* Price restrictions:

  + If the OCO is on the `SELL` side:
    - `LIMIT_MAKER/TAKE_PROFIT_LIMIT` `price` > Last Traded Price > `STOP_LOSS/STOP_LOSS_LIMIT`
      `stopPrice`
    - `TAKE_PROFIT stopPrice` > Last Traded Price > `STOP_LOSS/STOP_LOSS_LIMIT stopPrice`
  + If the OCO is on the `BUY` side:
    - `LIMIT_MAKER` `price` < Last Traded Price < `STOP_LOSS/STOP_LOSS_LIMIT` `stopPrice`
    - `TAKE_PROFIT stopPrice` > Last Traded Price > `STOP_LOSS/STOP_LOSS_LIMIT stopPrice`
* OCOs add **2 orders** to the `EXCHANGE_MAX_ORDERS` filter and `MAX_NUM_ORDERS` filter.

WSS

orderList.place.oco

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count2

### Place new Order list - OCO (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Place new Order list - OCO (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Place new Order list - OCO (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

orderList.place.oco

Example: orderList.place.oco

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`side`

​string · enum · required

`BUY` or `SELL`

Enum values:

BUY

SELL

Example: BUY

`quantity`

​number · float · required

Quantity for both orders of the order list.

Example: 1

`aboveType`

​string · enum · required

Enum values:

STOP\_LOSS\_LIMIT

STOP\_LOSS

LIMIT\_MAKER

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

Example: STOP\_LOSS\_LIMIT

`belowType`

​string · enum · required

Supported values: `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`

Enum values:

STOP\_LOSS

STOP\_LOSS\_LIMIT

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

Example: STOP\_LOSS

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`listClientOrderId`

​string

Arbitrary unique ID among open order lists. Automatically generated if not sent. A new order list with the same `listClientOrderId` is accepted only when the previous one is filled or completely expired. `listClientOrderId` is distinct from the `aboveClientOrderId` and the `belowClientOrderId`.

Example: cKPMnDCbcLQILtDYM4f4fX

`aboveClientOrderId`

​string

Arbitrary unique ID among open orders for the above order. Automatically generated if not sent.

Example: aboveOrder1

`aboveIcebergQty`

​integer · int64

Note that this can only be used if `aboveTimeInForce` is `GTC`.

Example: 1

`abovePrice`

​number · float

Can be used if `aboveType` is `STOP_LOSS_LIMIT`, `LIMIT_MAKER`, or `TAKE_PROFIT_LIMIT` to specify the limit price.

Example: 1

`aboveStopPrice`

​number · float

Can be used if `aboveType` is `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`. Either `aboveStopPrice` or `aboveTrailingDelta` or both, must be specified.

Example: 1

`aboveTrailingDelta`

​integer · int64

See [Trailing Stop order FAQ](/en/docs/products/spot/faqs/trailing-stop-faq)

Example: 1

`aboveTimeInForce`

​string · enum

Required if `aboveType` is `STOP_LOSS_LIMIT` or `TAKE_PROFIT_LIMIT`.

Enum values:

GTC

IOC

FOK

Example: GTC

`aboveStrategyId`

​integer · int64

Arbitrary numeric value identifying the above order within an order strategy.

Example: 1

`aboveStrategyType`

​integer

Arbitrary numeric value identifying the above order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`abovePegPriceType`

​string · enum

`PRIMARY_PEG` or `MARKET_PEG`. See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`abovePegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`abovePegOffsetValue`

​integer · max: 100

Example: 1

`belowClientOrderId`

​string

Arbitrary unique ID among open orders for the below order. Automatically generated if not sent.

Example: belowOrder1

`belowIcebergQty`

​integer · int64

Note that this can only be used if `belowTimeInForce` is `GTC`.

Example: 1

`belowPrice`

​number · float

Can be used if `belowType` is `STOP_LOSS_LIMIT`, `LIMIT_MAKER`, or `TAKE_PROFIT_LIMIT` to specify the limit price.

Example: 1

`belowStopPrice`

​number · float

Can be used if `belowType` is `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`. Either `belowStopPrice` or `belowTrailingDelta` or both, must be specified.

Example: 1

`belowTrailingDelta`

​integer · int64

See [Trailing Stop order FAQ](/en/docs/products/spot/faqs/trailing-stop-faq)

Example: 1

`belowTimeInForce`

​string · enum

Required if `belowType` is `STOP_LOSS_LIMIT` or `TAKE_PROFIT_LIMIT`.

Enum values:

GTC

IOC

FOK

Example: GTC

`belowStrategyId`

​integer · int64

Arbitrary numeric value identifying the below order within an order strategy.

Example: 1

`belowStrategyType`

​integer

Arbitrary numeric value identifying the below order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`belowPegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`belowPegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`belowPegOffsetValue`

​integer · max: 100

Example: 1

`newOrderRespType`

​string · enum

Select response format: `ACK`, `RESULT`, `FULL`.

Enum values:

ACK

RESULT

FULL

Example: ACK

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol. Supported values: [STP Modes](/en/docs/products/spot/enums#stpmodes)

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

### Place new Order list - OCO (TRADE) › Responses

Successful Response

Place new Order list - OCO

`id`

​string

Example: 56374a46-3261-486b-a211-99ed972eb648

`status`

​integer · int64

Example: 200

`result`

​object

`orderListId`

​integer · int64

Example: 2

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: cKPMnDCbcLQILtDYM4f4fX

`transactionTime`

​integer · int64

Example: 1711062760648

`symbol`

​string

Example: LTCBNB

`orders`

​object[]

`symbol`

​string

Example: LTCBNB

`orderId`

​integer · int64

Example: 2

`clientOrderId`

​string

Example: 0m6I4wfxvTUrOBSMUl0OPU

`orderReports`

​object[]

`symbol`

​string

Example: LTCBNB

`orderId`

​integer · int64

Example: 2

`orderListId`

​integer · int64

Example: 2

`clientOrderId`

​string

Example: 0m6I4wfxvTUrOBSMUl0OPU

`transactTime`

​integer · int64

Example: 1711062760648

`price`

​string

Example: 1.5

`origQty`

​string

Example: 1

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: STOP\_LOSS\_LIMIT

`side`

​string

Example: BUY

`workingTime`

​integer · int64

Example: -1

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 1.50000001

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorderList.place.oco

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.oco",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "quantity": 1,
 "aboveType": "STOP_LOSS_LIMIT",
 "belowType": "STOP_LOSS",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.oco",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "quantity": 1,
 "aboveType": "STOP_LOSS_LIMIT",
 "belowType": "STOP_LOSS",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "56374a46-3261-486b-a211-99ed972eb648",
 "status": 200,
 "result": {
 "orderListId": 2,
 "contingencyType": "OCO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "cKPMnDCbcLQILtDYM4f4fX",
 "transactionTime": 1711062760648,
 "symbol": "LTCBNB",
 "orders": [
 {
 "symbol": "LTCBNB",
 "orderId": 2,
 "clientOrderId": "0m6I4wfxvTUrOBSMUl0OPU"
 }
 ],
 "orderReports": [
 {
 "symbol": "LTCBNB",
 "orderId": 2,
 "orderListId": 2,
 "clientOrderId": "0m6I4wfxvTUrOBSMUl0OPU",
 "transactTime": 1711062760648,
 "price": 1.5,
 "origQty": 1,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "STOP_LOSS_LIMIT",
 "side": "BUY",
 "workingTime": -1,
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": 1.50000001,
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## OPO (TRADE)

Place an [OPO](/en/docs/products/spot/faqs/opo).

* OPOs add 2 orders to the EXCHANGE\_MAX\_NUM\_ORDERS filter and MAX\_NUM\_ORDERS filter.

WSS

orderList.place.opo

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count2

### OPO (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### OPO (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### OPO (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

orderList.place.opo

Example: orderList.place.opo

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`workingType`

​string · enum · required

Supported values: `LIMIT`, `LIMIT_MAKER`

Enum values:

LIMIT

LIMIT\_MAKER

Example: LIMIT

`workingSide`

​string · enum · required

Supported values: [Order Side](/en/docs/products/spot/enums#side)

Enum values:

BUY

SELL

Example: BUY

`workingPrice`

​number · float · required

Price for the working order.

Example: 1

`workingQuantity`

​number · float · required

Sets the quantity for the working order.

Example: 1

`pendingType`

​string · enum · required

Supported values: [Order Types](/en/docs/products/spot/enums#ordertypes). Note that `MARKET` orders using `quoteOrderQty` are not supported.

Enum values:

LIMIT

MARKET

STOP\_LOSS

STOP\_LOSS\_LIMIT

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

LIMIT\_MAKER

Example: LIMIT

`pendingSide`

​string · enum · required

Supported values: [Order Side](/en/docs/products/spot/enums#side)

Enum values:

BUY

SELL

Example: BUY

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`listClientOrderId`

​string

Arbitrary unique ID among open order lists. Automatically generated if not sent. A new order list with the same `listClientOrderId` is accepted only when the previous one is filled or completely expired. `listClientOrderId` is distinct from the `workingClientOrderId` and the `pendingClientOrderId`.

Example: OiOgqvRagBefpzdM5gjYX3

`newOrderRespType`

​string · enum

Format of the JSON response. Supported values: [Order Response Type](/en/docs/products/spot/enums#orderresponsetype)

Enum values:

ACK

RESULT

FULL

Example: ACK

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol. Supported values: [STP Modes](/en/docs/products/spot/enums#stpmodes)

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`workingClientOrderId`

​string

Arbitrary unique ID among open orders for the working order. Automatically generated if not sent.

Example: workingOrder1

`workingIcebergQty`

​number · float

This can only be used if `workingTimeInForce` is `GTC`, or if `workingType` is `LIMIT_MAKER`.

Example: 1

`workingTimeInForce`

​string · enum

Supported values: [Time In Force](/en/docs/products/spot/enums#timeinforce)

Enum values:

GTC

IOC

FOK

Example: GTC

`workingStrategyId`

​integer · int64

Arbitrary numeric value identifying the working order within an order strategy.

Example: 1

`workingStrategyType`

​integer

Arbitrary numeric value identifying the working order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`workingPegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`workingPegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`workingPegOffsetValue`

​integer · max: 100

Example: 1

`pendingClientOrderId`

​string

Arbitrary unique ID among open orders for the pending order. Automatically generated if not sent.

Example: pendingOrder1

`pendingPrice`

​number · float

Price for the pending order.

Example: 1

`pendingStopPrice`

​number · float

Stop price for the pending order.

Example: 1

`pendingTrailingDelta`

​number · float

Trailing delta for the pending order.

Example: 1

`pendingIcebergQty`

​number · float

This can only be used if `pendingTimeInForce` is `GTC` or if `pendingType` is `LIMIT_MAKER`.

Example: 1

`pendingTimeInForce`

​string · enum

Supported values: [Time In Force](/en/docs/products/spot/enums#timeinforce)

Enum values:

GTC

IOC

FOK

Example: GTC

`pendingStrategyId`

​integer · int64

Arbitrary numeric value identifying the pending order within an order strategy.

Example: 1

`pendingStrategyType`

​integer

Arbitrary numeric value identifying the pending order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`pendingPegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`pendingPegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`pendingPegOffsetValue`

​integer · max: 100

Example: 1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

### OPO (TRADE) › Responses

Successful Response

OPO

`id`

​string

Example: 1762941318128

`status`

​integer · int64

Example: 200

`result`

​object

`orderListId`

​integer · int64

Example: 2

`contingencyType`

​string

Example: OTO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: OiOgqvRagBefpzdM5gjYX3

`transactionTime`

​integer · int64

Example: 1762941318142

`symbol`

​string

Example: BTCUSDT

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 2

`clientOrderId`

​string

Example: pUzhKBbc0ZVdMScIRAqitH

`orderReports`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 2

`orderListId`

​integer · int64

Example: 2

`clientOrderId`

​string

Example: pUzhKBbc0ZVdMScIRAqitH

`transactTime`

​integer · int64

Example: 1762941318142

`price`

​string

Example: 101496

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: BUY

`workingTime`

​integer · int64

Example: 1762941318142

`selfTradePreventionMode`

​string

Example: NONE

`origQty`

​string

Example: 0.0007

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

WSSorderList.place.opo

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.opo",
 "params": {
 "symbol": "BNBUSDT",
 "workingType": "LIMIT",
 "workingSide": "BUY",
 "workingPrice": 1,
 "workingQuantity": 1,
 "pendingType": "LIMIT",
 "pendingSide": "BUY",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.opo",
 "params": {
 "symbol": "BNBUSDT",
 "workingType": "LIMIT",
 "workingSide": "BUY",
 "workingPrice": 1,
 "workingQuantity": 1,
 "pendingType": "LIMIT",
 "pendingSide": "BUY",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": 1762941318128,
 "status": 200,
 "result": {
 "orderListId": 2,
 "contingencyType": "OTO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "OiOgqvRagBefpzdM5gjYX3",
 "transactionTime": 1762941318142,
 "symbol": "BTCUSDT",
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 2,
 "clientOrderId": "pUzhKBbc0ZVdMScIRAqitH"
 }
 ],
 "orderReports": [
 {
 "symbol": "BTCUSDT",
 "orderId": 2,
 "orderListId": 2,
 "clientOrderId": "pUzhKBbc0ZVdMScIRAqitH",
 "transactTime": 1762941318142,
 "price": 101496,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "BUY",
 "workingTime": 1762941318142,
 "selfTradePreventionMode": "NONE",
 "origQty": 0.0007,
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ]
 }
}`

json

application/json

---

## OPOCO (TRADE)

Place an [OPOCO](/en/docs/products/spot/faqs/opo).

WSS

orderList.place.opoco

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count3

### OPOCO (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### OPOCO (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### OPOCO (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

orderList.place.opoco

Example: orderList.place.opoco

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`workingType`

​string · enum · required

Enum values:

LIMIT

LIMIT\_MAKER

Example: LIMIT

`workingSide`

​string · enum · required

Supported values: [Order Side](/en/docs/products/spot/enums#side)

Enum values:

BUY

SELL

Example: BUY

`workingPrice`

​number · float · required

Price for the working order.

Example: 1

`workingQuantity`

​number · float · required

Sets the quantity for the working order.

Example: 1

`pendingSide`

​string · enum · required

Supported values: [Order Side](/en/docs/products/spot/enums#side)

Enum values:

BUY

SELL

Example: BUY

`pendingAboveType`

​string · enum · required

Supported values: `STOP_LOSS_LIMIT`, `STOP_LOSS`, `LIMIT_MAKER`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`

Enum values:

STOP\_LOSS\_LIMIT

STOP\_LOSS

LIMIT\_MAKER

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

Example: STOP\_LOSS\_LIMIT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`listClientOrderId`

​string

Arbitrary unique ID among open order lists. Automatically generated if not sent. A new order list with the same `listClientOrderId` is accepted only when the previous one is filled or completely expired. `listClientOrderId` is distinct from the `workingClientOrderId` and the `pendingClientOrderId`.

Example: TVbG6ymkYMXTj7tczbOsBf

`newOrderRespType`

​string · enum

Format of the JSON response. Supported values: [Order Response Type](/en/docs/products/spot/enums#orderresponsetype)

Enum values:

ACK

RESULT

FULL

Example: ACK

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol. Supported values: [STP Modes](/en/docs/products/spot/enums#stpmodes)

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`workingClientOrderId`

​string

Arbitrary unique ID among open orders for the working order. Automatically generated if not sent.

Example: workingOrder1

`workingIcebergQty`

​number · float

This can only be used if `workingTimeInForce` is `GTC`, or if `workingType` is `LIMIT_MAKER`.

Example: 1

`workingTimeInForce`

​string · enum

Supported values: [Time In Force](/en/docs/products/spot/enums#timeinforce)

Enum values:

GTC

IOC

FOK

Example: GTC

`workingStrategyId`

​integer · int64

Arbitrary numeric value identifying the working order within an order strategy.

Example: 1

`workingStrategyType`

​integer

Arbitrary numeric value identifying the working order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`workingPegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`workingPegOffsetType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`workingPegOffsetValue`

​integer · max: 100

Price level for pegging (max: 100). See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Example: 1

`pendingAboveClientOrderId`

​string

Arbitrary unique ID among open orders for the pending above order. Automatically generated if not sent.

Example: pendingAboveOrder1

`pendingAbovePrice`

​number · float

Can be used if `pendingAboveType` is `STOP_LOSS_LIMIT`, `LIMIT_MAKER`, or `TAKE_PROFIT_LIMIT` to specify the limit price.

Example: 1

`pendingAboveStopPrice`

​number · float

Can be used if `pendingAboveType` is `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`.

Example: 1

`pendingAboveTrailingDelta`

​number · float

See [Trailing Stop order FAQ](/en/docs/products/spot/faqs/trailing-stop-faq)

Example: 1

`pendingAboveIcebergQty`

​number · float

This can only be used if `pendingAboveTimeInForce` is `GTC` or `pendingAboveType` is `LIMIT_MAKER`.

Example: 1

`pendingAboveTimeInForce`

​string · enum

Required if `pendingAboveType` is `STOP_LOSS_LIMIT` or `TAKE_PROFIT_LIMIT`.

Enum values:

GTC

IOC

FOK

Example: GTC

`pendingAboveStrategyId`

​integer · int64

Arbitrary numeric value identifying the pending above order within an order strategy.

Example: 1

`pendingAboveStrategyType`

​integer

Arbitrary numeric value identifying the pending above order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`pendingAbovePegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`pendingAbovePegOffsetType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`pendingAbovePegOffsetValue`

​integer · max: 100

Price level for pegging (max: 100). See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Example: 1

`pendingBelowType`

​string · enum

Supported values: `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`

Enum values:

STOP\_LOSS

STOP\_LOSS\_LIMIT

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

Example: STOP\_LOSS

`pendingBelowClientOrderId`

​string

Arbitrary unique ID among open orders for the pending below order. Automatically generated if not sent.

Example: pendingBelowOrder1

`pendingBelowPrice`

​number · float

Can be used if `pendingBelowType` is `STOP_LOSS_LIMIT` or `TAKE_PROFIT_LIMIT` to specify the limit price.

Example: 1

`pendingBelowStopPrice`

​number · float

Can be used if `pendingBelowType` is `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`. Either `pendingBelowStopPrice` or `pendingBelowTrailingDelta` or both, must be specified.

Example: 1

`pendingBelowTrailingDelta`

​number · float

See [Trailing Stop order FAQ](/en/docs/products/spot/faqs/trailing-stop-faq)

Example: 1

`pendingBelowIcebergQty`

​number · float

This can only be used if `pendingBelowTimeInForce` is `GTC` or `pendingBelowType` is `LIMIT_MAKER`.

Example: 1

`pendingBelowTimeInForce`

​string · enum

Supported values: [Time In Force](/en/docs/products/spot/enums#timeinforce)

Enum values:

GTC

IOC

FOK

Example: GTC

`pendingBelowStrategyId`

​integer · int64

Arbitrary numeric value identifying the pending below order within an order strategy.

Example: 1

`pendingBelowStrategyType`

​integer

Arbitrary numeric value identifying the pending below order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`pendingBelowPegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`pendingBelowPegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`pendingBelowPegOffsetValue`

​integer · max: 100

Example: 1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

### OPOCO (TRADE) › Responses

Successful Response

OPOCO

`id`

​string

Example: 1763000139090

`status`

​integer · int64

Example: 200

`result`

​object

`orderListId`

​integer · int64

Example: 1

`contingencyType`

​string

Example: OTO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: TVbG6ymkYMXTj7tczbOsBf

`transactionTime`

​integer · int64

Example: 1763000139104

`symbol`

​string

Example: BTCUSDT

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 6

`clientOrderId`

​string

Example: 3czuJSeyjPwV9Xo28j1Dv3

`orderReports`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 6

`orderListId`

​integer · int64

Example: 1

`clientOrderId`

​string

Example: 3czuJSeyjPwV9Xo28j1Dv3

`transactTime`

​integer · int64

Example: 1763000139104

`price`

​string

Example: 102496

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: BUY

`workingTime`

​integer · int64

Example: 1763000139104

`selfTradePreventionMode`

​string

Example: NONE

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 10100

`origQty`

​string

Example: 0.0017

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

WSSorderList.place.opoco

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.opoco",
 "params": {
 "symbol": "BNBUSDT",
 "workingType": "LIMIT",
 "workingSide": "BUY",
 "workingPrice": 1,
 "workingQuantity": 1,
 "pendingSide": "BUY",
 "pendingAboveType": "STOP_LOSS_LIMIT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.opoco",
 "params": {
 "symbol": "BNBUSDT",
 "workingType": "LIMIT",
 "workingSide": "BUY",
 "workingPrice": 1,
 "workingQuantity": 1,
 "pendingSide": "BUY",
 "pendingAboveType": "STOP_LOSS_LIMIT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": 1763000139090,
 "status": 200,
 "result": {
 "orderListId": 1,
 "contingencyType": "OTO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "TVbG6ymkYMXTj7tczbOsBf",
 "transactionTime": 1763000139104,
 "symbol": "BTCUSDT",
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 6,
 "clientOrderId": "3czuJSeyjPwV9Xo28j1Dv3"
 }
 ],
 "orderReports": [
 {
 "symbol": "BTCUSDT",
 "orderId": 6,
 "orderListId": 1,
 "clientOrderId": "3czuJSeyjPwV9Xo28j1Dv3",
 "transactTime": 1763000139104,
 "price": 102496,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "BUY",
 "workingTime": 1763000139104,
 "selfTradePreventionMode": "NONE",
 "stopPrice": 10100,
 "origQty": 0.0017,
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ]
 }
}`

json

application/json

---

## Place new Order list - OTO (TRADE)

Places an OTO.

* An OTO (One-Triggers-the-Other) is an order list comprised of 2 orders.
* The first order is called the **working order** and must be `LIMIT` or `LIMIT_MAKER`. Initially, only the
  working order goes on the order book.
* The second order is called the **pending order**. It can be any order type except for `MARKET` orders using
  parameter `quoteOrderQty`. The pending order is only placed on the order book when the working order gets
  **fully filled**.
* If either the working order or the pending order is cancelled individually, the other order in the order list
  will also be canceled or expired.
* When the order list is placed, if the working order gets **immediately fully filled**, the placement response
  will show the working order as `FILLED` but the pending order will still appear as `PENDING_NEW`. You need to
  query the status of the pending order again to see its updated status.
* OTOs add **2 orders** to the `EXCHANGE_MAX_NUM_ORDERS` filter and `MAX_NUM_ORDERS` filter.

WSS

orderList.place.oto

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count2

### Place new Order list - OTO (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Place new Order list - OTO (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Place new Order list - OTO (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

orderList.place.oto

Example: orderList.place.oto

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`workingType`

​string · enum · required

Supported values: `LIMIT`, `LIMIT_MAKER`

Enum values:

LIMIT

LIMIT\_MAKER

Example: LIMIT

`workingSide`

​string · enum · required

Supported values: [Order Side](/en/docs/products/spot/enums#side)

Enum values:

BUY

SELL

Example: BUY

`workingPrice`

​number · float · required

Example: 1

`workingQuantity`

​number · float · required

Sets the quantity for the working order.

Example: 1

`pendingType`

​string · enum · required

Supported values: [Order Types](/en/docs/products/spot/enums#ordertypes). Note that `MARKET` orders using `quoteOrderQty` are not supported.

Enum values:

LIMIT

MARKET

STOP\_LOSS

STOP\_LOSS\_LIMIT

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

LIMIT\_MAKER

Example: LIMIT

`pendingSide`

​string · enum · required

Supported values: [Order Side](/en/docs/products/spot/enums#side)

Enum values:

BUY

SELL

Example: BUY

`pendingQuantity`

​number · float · required

Sets the quantity for the pending order.

Example: 1

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`listClientOrderId`

​string

Arbitrary unique ID among open order lists. Automatically generated if not sent. A new order list with the same `listClientOrderId` is accepted only when the previous one is filled or completely expired. `listClientOrderId` is distinct from the `workingClientOrderId` and the `pendingClientOrderId`.

Example: KA4EBjGnzvSwSCQsDdTrlf

`newOrderRespType`

​string · enum

Format of the JSON response. Supported values: [Order Response Type](/en/docs/products/spot/enums#orderresponsetype)

Enum values:

ACK

RESULT

FULL

Example: ACK

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol. Supported values: [STP Modes](/en/docs/products/spot/enums#stpmodes)

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`workingClientOrderId`

​string

Arbitrary unique ID among open orders for the working order. Automatically generated if not sent.

Example: workingOrder1

`workingIcebergQty`

​number · float

This can only be used if `workingTimeInForce` is `GTC`, or if `workingType` is `LIMIT_MAKER`.

Example: 1

`workingTimeInForce`

​string · enum

Supported values: [Time In Force](/en/docs/products/spot/enums#timeinforce)

Enum values:

GTC

IOC

FOK

Example: GTC

`workingStrategyId`

​integer · int64

Arbitrary numeric value identifying the working order within an order strategy.

Example: 1

`workingStrategyType`

​integer

Arbitrary numeric value identifying the working order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`workingPegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`workingPegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`workingPegOffsetValue`

​integer · max: 100

Example: 1

`pendingClientOrderId`

​string

Arbitrary unique ID among open orders for the pending order. Automatically generated if not sent.

Example: pendingOrder1

`pendingPrice`

​number · float

Example: 1

`pendingStopPrice`

​number · float

Example: 1

`pendingTrailingDelta`

​number · float

Example: 1

`pendingIcebergQty`

​number · float

This can only be used if `pendingTimeInForce` is `GTC` or if `pendingType` is `LIMIT_MAKER`.

Example: 1

`pendingTimeInForce`

​string · enum

Supported values: [Time In Force](/en/docs/products/spot/enums#timeinforce)

Enum values:

GTC

IOC

FOK

Example: GTC

`pendingStrategyId`

​integer · int64

Arbitrary numeric value identifying the pending order within an order strategy.

Example: 1

`pendingStrategyType`

​integer

Arbitrary numeric value identifying the pending order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`pendingPegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`pendingPegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`pendingPegOffsetValue`

​integer · max: 100

Example: 1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

**Mandatory parameters based on `pendingType` or `workingType`**

Depending on the `pendingType` or `workingType`, some optional parameters will become mandatory.

| Type | Additional mandatory parameters | Additional information |
| --- | --- | --- |
| `workingType` = `LIMIT` | `workingTimeInForce` |  |
| `pendingType` = `LIMIT` | `pendingPrice`, `pendingTimeInForce` |  |
| `pendingType` = `STOP_LOSS` or `TAKE_PROFIT` | `pendingStopPrice` and/or `pendingTrailingDelta` |  |
| `pendingType` =`STOP_LOSS_LIMIT` or `TAKE_PROFIT_LIMIT` | `pendingPrice`, `pendingStopPrice` and/or `pendingTrailingDelta`, `pendingTimeInForce` |  |

### Place new Order list - OTO (TRADE) › Responses

Successful Response

Place new Order list - OTO

`id`

​string

Example: 1712544395950

`status`

​integer · int64

Example: 200

`result`

​object

`orderListId`

​integer · int64

Example: 626

`contingencyType`

​string

Example: OTO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: KA4EBjGnzvSwSCQsDdTrlf

`transactionTime`

​integer · int64

Example: 1712544395981

`symbol`

​string

Example: 1712544378871

`orders`

​object[]

`symbol`

​string

Example: LTCBNB

`orderId`

​integer · int64

Example: 13

`clientOrderId`

​string

Example: YiAUtM9yJjl1a2jXHSp9Ny

`orderReports`

​object[]

`symbol`

​string

Example: LTCBNB

`orderId`

​integer · int64

Example: 13

`orderListId`

​integer · int64

Example: 626

`clientOrderId`

​string

Example: YiAUtM9yJjl1a2jXHSp9Ny

`transactTime`

​integer · int64

Example: 1712544395981

`price`

​string

Example: 1

`origQty`

​string

Example: 1

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: SELL

`workingTime`

​integer · int64

Example: 1712544395981

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorderList.place.oto

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.oto",
 "params": {
 "symbol": "BNBUSDT",
 "workingType": "LIMIT",
 "workingSide": "BUY",
 "workingPrice": 1,
 "workingQuantity": 1,
 "pendingType": "LIMIT",
 "pendingSide": "BUY",
 "pendingQuantity": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.oto",
 "params": {
 "symbol": "BNBUSDT",
 "workingType": "LIMIT",
 "workingSide": "BUY",
 "workingPrice": 1,
 "workingQuantity": 1,
 "pendingType": "LIMIT",
 "pendingSide": "BUY",
 "pendingQuantity": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": 1712544395950,
 "status": 200,
 "result": {
 "orderListId": 626,
 "contingencyType": "OTO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "KA4EBjGnzvSwSCQsDdTrlf",
 "transactionTime": 1712544395981,
 "symbol": 1712544378871,
 "orders": [
 {
 "symbol": "LTCBNB",
 "orderId": 13,
 "clientOrderId": "YiAUtM9yJjl1a2jXHSp9Ny"
 }
 ],
 "orderReports": [
 {
 "symbol": "LTCBNB",
 "orderId": 13,
 "orderListId": 626,
 "clientOrderId": "YiAUtM9yJjl1a2jXHSp9Ny",
 "transactTime": 1712544395981,
 "price": 1,
 "origQty": 1,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "SELL",
 "workingTime": 1712544395981,
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Place new Order list - OTOCO (TRADE)

Place an OTOCO.

* An OTOCO (One-Triggers-One-Cancels-the-Other) is an order list comprised of 3 orders.
* The first order is called the **working order** and must be `LIMIT` or `LIMIT_MAKER`. Initially, only the working order goes on the order book.
  + The behavior of the working order is the same as the [OTO](/en/docs/catalog/core-trading-spot-trading/api/ws-api/trade#order-list-place-oto).
* OTOCO has 2 pending orders (pending above and pending below), forming an OCO pair. The pending orders are only placed on the order book when the working order gets **fully filled**.
  + The rules of the pending above and pending below follow the same rules as the [Order list OCO](/en/docs/catalog/core-trading-spot-trading/api/ws-api/trade#order-list-place-oco).
* OTOCOs add **3 orders** to the `EXCHANGE_MAX_NUM_ORDERS` filter and `MAX_NUM_ORDERS` filter.

WSS

orderList.place.otoco

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count3

### Place new Order list - OTOCO (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Place new Order list - OTOCO (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Place new Order list - OTOCO (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

orderList.place.otoco

Example: orderList.place.otoco

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`workingType`

​string · enum · required

Supported values: `LIMIT`, `LIMIT_MAKER`

Enum values:

LIMIT

LIMIT\_MAKER

Example: LIMIT

`workingSide`

​string · enum · required

Supported values: [Order Side](/en/docs/products/spot/enums#side)

Enum values:

BUY

SELL

Example: BUY

`workingPrice`

​number · float · required

Example: 1

`workingQuantity`

​number · float · required

Sets the quantity for the working order.

Example: 1

`pendingSide`

​string · enum · required

Supported values: [Order Side](/en/docs/products/spot/enums#side)

Enum values:

BUY

SELL

Example: BUY

`pendingQuantity`

​number · float · required

Sets the quantity for the pending orders.

Example: 1

`pendingAboveType`

​string · enum · required

Supported values: `STOP_LOSS_LIMIT`, `STOP_LOSS`, `LIMIT_MAKER`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`

Enum values:

STOP\_LOSS\_LIMIT

STOP\_LOSS

LIMIT\_MAKER

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

Example: STOP\_LOSS\_LIMIT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`listClientOrderId`

​string

Arbitrary unique ID among open order lists. Automatically generated if not sent. A new order list with the same `listClientOrderId` is accepted only when the previous one is filled or completely expired. `listClientOrderId` is distinct from the `workingClientOrderId` and the `pendingClientOrderId`.

Example: GaeJHjZPasPItFj4x7Mqm6

`newOrderRespType`

​string · enum

Format of the JSON response. Supported values: [Order Response Type](/en/docs/products/spot/enums#orderresponsetype)

Enum values:

ACK

RESULT

FULL

Example: ACK

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol. Supported values: [STP Modes](/en/docs/products/spot/enums#stpmodes)

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`workingClientOrderId`

​string

Arbitrary unique ID among open orders for the working order. Automatically generated if not sent.

Example: workingOrder1

`workingIcebergQty`

​number · float

This can only be used if `workingTimeInForce` is `GTC`, or if `workingType` is `LIMIT_MAKER`.

Example: 1

`workingTimeInForce`

​string · enum

Supported values: [Time In Force](/en/docs/products/spot/enums#timeinforce)

Enum values:

GTC

IOC

FOK

Example: GTC

`workingStrategyId`

​integer · int64

Arbitrary numeric value identifying the working order within an order strategy.

Example: 1

`workingStrategyType`

​integer

Arbitrary numeric value identifying the working order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`workingPegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`workingPegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`workingPegOffsetValue`

​integer · max: 100

Example: 1

`pendingAboveClientOrderId`

​string

Arbitrary unique ID among open orders for the pending above order. Automatically generated if not sent.

Example: pendingAboveOrder1

`pendingAbovePrice`

​number · float

Can be used if `pendingAboveType` is `STOP_LOSS_LIMIT`, `LIMIT_MAKER`, or `TAKE_PROFIT_LIMIT` to specify the limit price.

Example: 1

`pendingAboveStopPrice`

​number · float

Can be used if `pendingAboveType` is `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`.

Example: 1

`pendingAboveTrailingDelta`

​number · float

See [Trailing Stop order FAQ](/en/docs/products/spot/faqs/trailing-stop-faq)

Example: 1

`pendingAboveIcebergQty`

​number · float

This can only be used if `pendingAboveTimeInForce` is `GTC` or if `pendingAboveType` is `LIMIT_MAKER`.

Example: 1

`pendingAboveTimeInForce`

​string · enum

Required if `pendingAboveType` is `STOP_LOSS_LIMIT` or `TAKE_PROFIT_LIMIT`.

Enum values:

GTC

IOC

FOK

Example: GTC

`pendingAboveStrategyId`

​integer · int64

Arbitrary numeric value identifying the pending above order within an order strategy.

Example: 1

`pendingAboveStrategyType`

​integer

Arbitrary numeric value identifying the pending above order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`pendingAbovePegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`pendingAbovePegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`pendingAbovePegOffsetValue`

​integer · max: 100

Example: 1

`pendingBelowType`

​string · enum

Supported values: `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`

Enum values:

STOP\_LOSS

STOP\_LOSS\_LIMIT

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

Example: STOP\_LOSS

`pendingBelowClientOrderId`

​string

Arbitrary unique ID among open orders for the pending below order. Automatically generated if not sent.

Example: pendingBelowOrder1

`pendingBelowPrice`

​number · float

Can be used if `pendingBelowType` is `STOP_LOSS_LIMIT` or `TAKE_PROFIT_LIMIT` to specify the limit price.

Example: 1

`pendingBelowStopPrice`

​number · float

Can be used if `pendingBelowType` is `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT`. Either `pendingBelowStopPrice` or `pendingBelowTrailingDelta` or both, must be specified.

Example: 1

`pendingBelowTrailingDelta`

​number · float

See [Trailing Stop order FAQ](/en/docs/products/spot/faqs/trailing-stop-faq)

Example: 1

`pendingBelowIcebergQty`

​number · float

This can only be used if `pendingBelowTimeInForce` is `GTC`, or if `pendingBelowType` is `LIMIT_MAKER`.

Example: 1

`pendingBelowTimeInForce`

​string · enum

Required if `pendingBelowType` is `STOP_LOSS_LIMIT` or `TAKE_PROFIT_LIMIT`.

Enum values:

GTC

IOC

FOK

Example: GTC

`pendingBelowStrategyId`

​integer · int64

Arbitrary numeric value identifying the pending below order within an order strategy.

Example: 1

`pendingBelowStrategyType`

​integer

Arbitrary numeric value identifying the pending below order strategy. Values smaller than `1000000` are reserved and cannot be used.

Example: 1

`pendingBelowPegPriceType`

​string · enum

See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`pendingBelowPegOffsetType`

​string · enum

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`pendingBelowPegOffsetValue`

​integer · max: 100

Example: 1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

**Mandatory parameters based on `pendingAboveType`, `pendingBelowType` or `workingType`**

Depending on the `pendingAboveType`/`pendingBelowType` or `workingType`, some optional parameters will become mandatory.

| Type | Additional mandatory parameters | Additional information |
| --- | --- | --- |
| `workingType` = `LIMIT` | `workingTimeInForce` |  |
| `pendingAboveType`= `LIMIT_MAKER` | `pendingAbovePrice` |  |
| `pendingAboveType` = `STOP_LOSS/TAKE_PROFIT` | `pendingAboveStopPrice` and/or `pendingAboveTrailingDelta` |  |
| `pendingAboveType=STOP_LOSS_LIMIT/TAKE_PROFIT_LIMIT` | `pendingAbovePrice`, `pendingAboveStopPrice` and/or `pendingAboveTrailingDelta`, `pendingAboveTimeInForce` |  |
| `pendingBelowType`= `LIMIT_MAKER` | `pendingBelowPrice` |  |
| `pendingBelowType= STOP_LOSS/TAKE_PROFIT` | `pendingBelowStopPrice` and/or `pendingBelowTrailingDelta` |  |
| `pendingBelowType=STOP_LOSS_LIMIT/TAKE_PROFIT_LIMIT` | `pendingBelowPrice`, `pendingBelowStopPrice` and/or `pendingBelowTrailingDelta`, `pendingBelowTimeInForce` |  |

### Place new Order list - OTOCO (TRADE) › Responses

Successful Response

Place new Order list - OTOCO

`id`

​string

Example: 1712544408508

`status`

​integer · int64

Example: 200

`result`

​object

`orderListId`

​integer · int64

Example: 629

`contingencyType`

​string

Example: OTO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: GaeJHjZPasPItFj4x7Mqm6

`transactionTime`

​integer · int64

Example: 1712544408537

`symbol`

​string

Example: 1712544378871

`orders`

​object[]

`symbol`

​string

Example: LTCBNB

`orderId`

​integer · int64

Example: 23

`clientOrderId`

​string

Example: OVQOpKwfmPCfaBTD0n7e7H

`orderReports`

​object[]

`symbol`

​string

Example: LTCBNB

`orderId`

​integer · int64

Example: 23

`orderListId`

​integer · int64

Example: 629

`clientOrderId`

​string

Example: OVQOpKwfmPCfaBTD0n7e7H

`transactTime`

​integer · int64

Example: 1712544408537

`price`

​string

Example: 1.5

`origQty`

​string

Example: 1

`executedQty`

​string

Example: 0

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: BUY

`workingTime`

​integer · int64

Example: 1712544408537

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.5

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorderList.place.otoco

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.otoco",
 "params": {
 "symbol": "BNBUSDT",
 "workingType": "LIMIT",
 "workingSide": "BUY",
 "workingPrice": 1,
 "workingQuantity": 1,
 "pendingSide": "BUY",
 "pendingQuantity": 1,
 "pendingAboveType": "STOP_LOSS_LIMIT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.place.otoco",
 "params": {
 "symbol": "BNBUSDT",
 "workingType": "LIMIT",
 "workingSide": "BUY",
 "workingPrice": 1,
 "workingQuantity": 1,
 "pendingSide": "BUY",
 "pendingQuantity": 1,
 "pendingAboveType": "STOP_LOSS_LIMIT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": 1712544408508,
 "status": 200,
 "result": {
 "orderListId": 629,
 "contingencyType": "OTO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "GaeJHjZPasPItFj4x7Mqm6",
 "transactionTime": 1712544408537,
 "symbol": 1712544378871,
 "orders": [
 {
 "symbol": "LTCBNB",
 "orderId": 23,
 "clientOrderId": "OVQOpKwfmPCfaBTD0n7e7H"
 }
 ],
 "orderReports": [
 {
 "symbol": "LTCBNB",
 "orderId": 23,
 "orderListId": 629,
 "clientOrderId": "OVQOpKwfmPCfaBTD0n7e7H",
 "transactTime": 1712544408537,
 "price": 1.5,
 "origQty": 1,
 "executedQty": 0,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 0,
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "BUY",
 "workingTime": 1712544408537,
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": 0.5,
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Place new order (TRADE)

Send in a new order.

This adds 1 order to the `EXCHANGE_MAX_ORDERS` filter and the `MAX_NUM_ORDERS` filter.

WSS

order.place

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count1

### Place new order (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Place new order (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Place new order (TRADE) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

order.place

Example: order.place

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`side`

​string · enum · required

Please see [Enums](/en/docs/products/spot/enums#side) for supported values.

Enum values:

BUY

SELL

Example: BUY

`type`

​string · enum · required

Please see [Enums](/en/docs/products/spot/enums#ordertypes) for supported values.

Enum values:

MARKET

LIMIT

STOP\_LOSS

STOP\_LOSS\_LIMIT

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

LIMIT\_MAKER

Example: MARKET

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`timeInForce`

​string · enum

Please see [Enums](/en/docs/products/spot/enums#timeinforce) for supported values.

Enum values:

GTC

IOC

FOK

Example: GTC

`price`

​number · float

Example: 1

`quantity`

​number · float

Example: 1

`quoteOrderQty`

​number · float

Example: 1

`newClientOrderId`

​string

A unique id among open orders. Automatically generated if not sent.  
 Orders with the same `newClientOrderID` can be accepted only when the previous one is filled, otherwise the order will be rejected.

Example: myOrder1

`newOrderRespType`

​string · enum

`MARKET` and `LIMIT` order types default to `FULL`, all other orders default to `ACK`.

Enum values:

ACK

RESULT

FULL

Example: ACK

`stopPrice`

​number · float

Used with `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, and `TAKE_PROFIT_LIMIT` orders.

Example: 1

`trailingDelta`

​integer

See Trailing Stop order FAQ

Example: 1

`icebergQty`

​number · float

Used with `LIMIT`, `STOP_LOSS_LIMIT`, and `TAKE_PROFIT_LIMIT` to create an iceberg order.

Example: 1

`strategyId`

​integer · int64

Example: 1

`strategyType`

​integer · min: 1000000

The value cannot be less than `1000000`.

Example: 1

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol.

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`pegPriceType`

​string · enum

See Pegged Orders Info

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`pegOffsetValue`

​integer · max: 100

Price level to peg the price to (max: 100). See Pegged Orders Info

Example: 1

`pegOffsetType`

​string · enum

Only `PRICE_LEVEL` is supported. See Pegged Orders Info

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

Certain parameters (\*) become mandatory based on the order `type`:

| Order `type` | Mandatory parameters |
| --- | --- |
| `LIMIT` | * `timeInForce` * `price` * `quantity` |
| `LIMIT_MAKER` | * `price` * `quantity` |
| `MARKET` | * `quantity` or `quoteOrderQty` |
| `STOP_LOSS` | * `quantity` * `stopPrice` or `trailingDelta` |
| `STOP_LOSS_LIMIT` | * `timeInForce` * `price` * `quantity` * `stopPrice` or `trailingDelta` |
| `TAKE_PROFIT` | * `quantity` * `stopPrice` or `trailingDelta` |
| `TAKE_PROFIT_LIMIT` | * `timeInForce` * `price` * `quantity` * `stopPrice` or `trailingDelta` |

Supported order types:

| Order `type` | Description |
| --- | --- |
| `LIMIT` | Buy or sell `quantity` at the specified `price` or better. |
| `LIMIT_MAKER` | `LIMIT` order that will be rejected if it immediately matches and trades as a taker.  This order type is also known as a POST-ONLY order. |
| `MARKET` | Buy or sell at the best available market price.   * `MARKET` order with `quantity` parameter   specifies the amount of the *base asset* you want to buy or sell.   Actually executed quantity of the quote asset will be determined by available market liquidity.  E.g., a MARKET BUY order on BTCUSDT for `"quantity": "0.1000"`   specifies that you want to buy 0.1 BTC at the best available price.   If there is not enough BTC at the best price, keep buying at the next best price,   until either your order is filled, or you run out of USDT, or market runs out of BTC. * `MARKET` order with `quoteOrderQty` parameter   specifies the amount of the *quote asset* you want to spend (when buying) or receive (when selling).   Actually executed quantity of the base asset will be determined by available market liquidity.  E.g., a MARKET BUY on BTCUSDT for `"quoteOrderQty": "100.00"`   specifies that you want to buy as much BTC as you can for 100 USDT at the best available price.   Similarly, a SELL order will sell as much available BTC as needed for you to receive 100 USDT   (before commission). |
| `STOP_LOSS` | Execute a `MARKET` order for given `quantity` when specified conditions are met.  I.e., when `stopPrice` is reached, or when `trailingDelta` is activated. |
| `STOP_LOSS_LIMIT` | Place a `LIMIT` order with given parameters when specified conditions are met. |
| `TAKE_PROFIT` | Like `STOP_LOSS` but activates when market price moves in the favorable direction. |
| `TAKE_PROFIT_LIMIT` | Like `STOP_LOSS_LIMIT` but activates when market price moves in the favorable direction. |

Notes on using parameters for Pegged Orders:

* These parameters are allowed for `LIMIT`, `LIMIT_MAKER`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT_LIMIT` orders.
* If `pegPriceType` is specified, `price` becomes optional. Otherwise, it is still mandatory.
* `pegPriceType=PRIMARY_PEG` means the primary peg, that is the best price on the same side of the order book as your order.
* `pegPriceType=MARKET_PEG` means the market peg, that is the best price on the opposite side of the order book from your order.
* Use `pegOffsetType` and `pegOffsetValue` to request a price level other than the best one. These parameters must be specified together.

Available `timeInForce` options,
setting how long the order should be active before expiration:

| TIF | Description |
| --- | --- |
| `GTC` | **Good 'til Canceled** – the order will remain on the book until you cancel it, or the order is completely filled. |
| `IOC` | **Immediate or Cancel** – the order will be filled for as much as possible, the unfilled quantity immediately expires. |
| `FOK` | **Fill or Kill** – the order will expire unless it cannot be immediately filled for the entire quantity. |

Notes:

* `newClientOrderId` specifies `clientOrderId` value for the order.

  A new order with the same `clientOrderId` is accepted only when the previous one is filled or expired.
* Any `LIMIT` or `LIMIT_MAKER` order can be made into an iceberg order by specifying the `icebergQty`.

  An order with an `icebergQty` must have `timeInForce` set to `GTC`.
* Trigger order price rules for `STOP_LOSS`/`TAKE_PROFIT` orders:

  + `stopPrice` must be above market price: `STOP_LOSS BUY`, `TAKE_PROFIT SELL`
  + `stopPrice` must be below market price: `STOP_LOSS SELL`, `TAKE_PROFIT BUY`
* `MARKET` orders using `quoteOrderQty` follow [`LOT_SIZE`](/en/docs/products/spot/filters#lot_size) filter rules.

  The order will execute a quantity that has notional value as close as possible to requested `quoteOrderQty`.

### Place new order (TRADE) › Responses

Successful Response

Place new order

`id`

​string

Example: 56374a46-3061-486b-a311-99ee972eb648

`status`

​integer · int64

Example: 200

`result`

​object

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569099453

`orderListId`

​integer · int64

Example: -1

`clientOrderId`

​string

Example: 4d96324ff9d44481926157ec08158a40

`transactTime`

​integer · int64

Example: 1660801715793

`price`

​string

Example: 23416.1

`origQty`

​string

Example: 0.00847

`executedQty`

​string

Example: 0.00847

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 198.335215

`status`

​string

Example: FILLED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: SELL

`workingTime`

​integer · int64

Example: 1660801715639

`selfTradePreventionMode`

​string

Example: NONE

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`fills`

​object[]

`price`

​string

Example: 23416.1

`qty`

​string

Example: 0.00635

`commission`

​string

Example: 0

`commissionAsset`

​string

Example: BNB

`tradeId`

​integer · int64

Example: 1650422481

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorder.place

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.place",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "type": "MARKET",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.place",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "type": "MARKET",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "56374a46-3061-486b-a311-99ee972eb648",
 "status": 200,
 "result": {
 "symbol": "BTCUSDT",
 "orderId": 12569099453,
 "orderListId": -1,
 "clientOrderId": "4d96324ff9d44481926157ec08158a40",
 "transactTime": 1660801715793,
 "price": 23416.1,
 "origQty": 0.00847,
 "executedQty": 0.00847,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 198.335215,
 "status": "FILLED",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "SELL",
 "workingTime": 1660801715639,
 "selfTradePreventionMode": "NONE",
 "stopPrice": "0.00000000",
 "trailingDelta": 10,
 "icebergQty": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY",
 "fills": [
 {
 "price": 23416.1,
 "qty": 0.00635,
 "commission": 0,
 "commissionAsset": "BNB",
 "tradeId": 1650422481
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Test new order (TRADE)

Test order placement.

Validates new order parameters and verifies your signature
but does not send the order into the matching engine.

WSS

order.test

wss://ws-api.binance.com:443/ws-api/v3

### Test new order (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Test new order (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

| Condition | Request Weight |
| --- | --- |
| Without `computeCommissionRates` | 1 |
| With `computeCommissionRates` | 20 |

### Test new order (TRADE) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

order.test

Example: order.test

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`side`

​string · enum · required

Please see [Enums](/en/docs/products/spot/enums#side) for supported values.

Enum values:

BUY

SELL

Example: BUY

`type`

​string · enum · required

Please see [Enums](/en/docs/products/spot/enums#ordertypes) for supported values.

Enum values:

MARKET

LIMIT

STOP\_LOSS

STOP\_LOSS\_LIMIT

TAKE\_PROFIT

TAKE\_PROFIT\_LIMIT

LIMIT\_MAKER

Example: MARKET

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`computeCommissionRates`

​boolean

Default: `false`   
 See [Commissions FAQ](/en/docs/products/spot/faqs/commission_faq#test-order-diferences) to learn more.

Example: false

Default: false

`timeInForce`

​string · enum

Please see [Enums](/en/docs/products/spot/enums#timeinforce) for supported values.

Enum values:

GTC

IOC

FOK

Example: GTC

`price`

​number · float

Example: 1

`quantity`

​number · float

Example: 1

`quoteOrderQty`

​number · float

Example: 1

`newClientOrderId`

​string

A unique id among open orders. Automatically generated if not sent. Orders with the same `newClientOrderID` can be accepted only when the previous one is filled, otherwise the order will be rejected.

Example: myOrder1

`newOrderRespType`

​string · enum

Set the response JSON. `ACK`, `RESULT`, or `FULL`; `MARKET` and `LIMIT` order types default to `FULL`, all other orders default to `ACK`.

Enum values:

ACK

RESULT

FULL

Example: ACK

`stopPrice`

​number · float

Used with `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, and `TAKE_PROFIT_LIMIT` orders.

Example: 1

`trailingDelta`

​integer

See [Trailing Stop order FAQ](/en/docs/products/spot/faqs/trailing-stop-faq)

Example: 1

`icebergQty`

​number · float

Used with `LIMIT`, `STOP_LOSS_LIMIT`, and `TAKE_PROFIT_LIMIT` to create an iceberg order.

Example: 1

`strategyId`

​integer · int64

Example: 1

`strategyType`

​integer · min: 1000000

The value cannot be less than `1000000`.

Example: 1

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol. Supported values: [STP Modes](/en/docs/products/spot/enums#stpmodes)

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`pegPriceType`

​string · enum

`PRIMARY_PEG` or `MARKET_PEG`. See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRIMARY\_PEG

MARKET\_PEG

Example: PRIMARY\_PEG

`pegOffsetValue`

​integer · max: 100

Price level for pegging (max: 100). See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Example: 1

`pegOffsetType`

​string · enum

Only `PRICE_LEVEL` is supported. See [Pegged Orders](/en/docs/products/spot/faqs/pegged_orders)

Enum values:

PRICE\_LEVEL

Example: PRICE\_LEVEL

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory

### Test new order (TRADE) › Responses

Successful Response

Test new order

`id`

​string

Example: 6ffebe91-01d9-43ac-be99-57cf062e0e30

`status`

​integer · int64

Example: 200

`result`

​object

`standardCommissionForOrder`

​object

`maker`

​string

Example: 0.00000112

`taker`

​string

Example: 0.00000114

`specialCommissionForOrder`

​object

`maker`

​string

Example: 0.05

`taker`

​string

Example: 0.06

`taxCommissionForOrder`

​object

`maker`

​string

Example: 0.00000112

`taker`

​string

Example: 0.00000114

`discount`

​object

`enabledForAccount`

​boolean

Example: true

`enabledForSymbol`

​boolean

Example: true

`discountAsset`

​string

Example: BNB

`discount`

​string

Example: 0.25

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorder.test

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.test",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "type": "MARKET",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.test",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "type": "MARKET",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "6ffebe91-01d9-43ac-be99-57cf062e0e30",
 "status": 200,
 "result": {
 "standardCommissionForOrder": {
 "maker": 0.00000112,
 "taker": 0.00000114
 },
 "specialCommissionForOrder": {
 "maker": 0.05,
 "taker": 0.06
 },
 "taxCommissionForOrder": {
 "maker": 0.00000112,
 "taker": 0.00000114
 },
 "discount": {
 "enabledForAccount": true,
 "enabledForSymbol": true,
 "discountAsset": "BNB",
 "discount": 0.25
 }
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Place new order using SOR (TRADE)

Places an order using smart order routing (SOR).

This adds 1 order to the `EXCHANGE_MAX_ORDERS` filter and the `MAX_NUM_ORDERS` filter.

Read [SOR FAQ](/en/docs/products/spot/faqs/sor_faq) to learn more.

WSS

sor.order.place

wss://ws-api.binance.com:443/ws-api/v3

Unfilled Order Count1

### Place new order using SOR (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Place new order using SOR (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight1

### Place new order using SOR (TRADE) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

sor.order.place

Example: sor.order.place

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`side`

​string · enum · required

`BUY` or `SELL`

Enum values:

BUY

SELL

Example: BUY

`type`

​string · enum · required

Only `LIMIT` and `MARKET` orders are supported.

Enum values:

MARKET

LIMIT

Example: MARKET

`quantity`

​number · float · required

Example: 1

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`timeInForce`

​string · enum

Applicable only to `LIMIT` order type.

Enum values:

GTC

IOC

FOK

Example: GTC

`price`

​number · float

Example: 1

`newClientOrderId`

​string

A unique id among open orders. Automatically generated if not sent.  
 Orders with the same `newClientOrderID` can be accepted only when the previous one is filled, otherwise the order will be rejected.

Example: myOrder1

`newOrderRespType`

​string · enum

Set the response JSON. `ACK`, `RESULT`, or `FULL`. Default to `FULL`

Enum values:

ACK

RESULT

FULL

Example: ACK

`icebergQty`

​number · float

Used with `LIMIT` to create an iceberg order.

Example: 1

`strategyId`

​integer · int64

Example: 1

`strategyType`

​integer

The value cannot be less than `1000000`.

Example: 1

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol. The possible supported values are: [STP Modes](/en/docs/products/spot/enums#stpmodes).

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Matching Engine

**Note:** `sor.order.place` only supports `LIMIT` and `MARKET` orders. `quoteOrderQty` is not supported.

### Place new order using SOR (TRADE) › Responses

Successful Response

Place new order using SOR

`id`

​string

Example: 3a4437e2-41a3-4c19-897c-9cadc5dce8b6

`status`

​integer · int64

Example: 200

`result`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 2

`orderListId`

​integer · int64

Example: -1

`clientOrderId`

​string

Example: sBI1KM6nNtOfj5tccZSKly

`transactTime`

​integer · int64

Example: 1689149087774

`price`

​string

Example: 31000

`origQty`

​string

Example: 0.5

`executedQty`

​string

Example: 0.5

`origQuoteOrderQty`

​string

Example: 0

`cummulativeQuoteQty`

​string

Example: 14000

`status`

​string

Example: FILLED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: BUY

`workingTime`

​integer · int64

Example: 1689149087774

`fills`

​object[]

`matchType`

​string

Example: ONE\_PARTY\_TRADE\_REPORT

`price`

​string

Example: 28000

`qty`

​string

Example: 0.5

`commission`

​string

Example: 0

`commissionAsset`

​string

Example: BTC

`tradeId`

​integer · int64

Example: -1

`allocId`

​integer · int64

Example: 0

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`selfTradePreventionMode`

​string

Example: NONE

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSsor.order.place

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "sor.order.place",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "type": "MARKET",
 "quantity": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "sor.order.place",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "type": "MARKET",
 "quantity": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "3a4437e2-41a3-4c19-897c-9cadc5dce8b6",
 "status": 200,
 "result": [
 {
 "symbol": "BTCUSDT",
 "orderId": 2,
 "orderListId": -1,
 "clientOrderId": "sBI1KM6nNtOfj5tccZSKly",
 "transactTime": 1689149087774,
 "price": 31000,
 "origQty": 0.5,
 "executedQty": 0.5,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 14000,
 "status": "FILLED",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "BUY",
 "workingTime": 1689149087774,
 "fills": [
 {
 "matchType": "ONE_PARTY_TRADE_REPORT",
 "price": 28000,
 "qty": 0.5,
 "commission": 0,
 "commissionAsset": "BTC",
 "tradeId": -1,
 "allocId": 0
 }
 ],
 "workingFloor": "SOR",
 "selfTradePreventionMode": "NONE",
 "usedSor": true,
 "stopPrice": "0.00000000",
 "trailingDelta": 10,
 "icebergQty": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "trailingTime": -1,
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Test new order using SOR (TRADE)

Test new order creation and signature/recvWindow using smart order routing (SOR).
Creates and validates a new order but does not send it into the matching engine.

WSS

sor.order.test

wss://ws-api.binance.com:443/ws-api/v3

### Test new order using SOR (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Test new order using SOR (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

| Condition | Request Weight |
| --- | --- |
| Without `computeCommissionRates` | 1 |
| With `computeCommissionRates` | 20 |

### Test new order using SOR (TRADE) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

sor.order.test

Example: sor.order.test

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`side`

​string · enum · required

Please see [Enums](/en/docs/products/spot/enums#side) for supported values.

Enum values:

BUY

SELL

Example: BUY

`type`

​string · enum · required

Please see [Enums](/en/docs/products/spot/enums#ordertypes) for supported values.

Enum values:

MARKET

LIMIT

Example: MARKET

`quantity`

​number · float · required

Example: 1

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`computeCommissionRates`

​boolean

Default: `false`

Example: false

Default: false

`timeInForce`

​string · enum

Please see [Enums](/en/docs/products/spot/enums#timeinforce) for supported values.

Enum values:

GTC

IOC

FOK

Example: GTC

`price`

​number · float

Example: 1

`newClientOrderId`

​string

A unique id among open orders. Automatically generated if not sent. Orders with the same `newClientOrderID` can be accepted only when the previous one is filled, otherwise the order will be rejected.

Example: myOrder1

`newOrderRespType`

​string · enum

Set the response JSON. `ACK`, `RESULT`, or `FULL`. Default to `FULL`.

Enum values:

ACK

RESULT

FULL

Example: ACK

`icebergQty`

​number · float

Used with `LIMIT` to create an iceberg order.

Example: 1

`strategyId`

​integer · int64

Example: 1

`strategyType`

​integer

The value cannot be less than `1000000`.

Example: 1

`selfTradePreventionMode`

​string · enum

The allowed enums is dependent on what is configured on the symbol. Supported values: [STP Modes](/en/docs/products/spot/enums#stpmodes)

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_MAKER

EXPIRE\_BOTH

DECREMENT

TRANSFER

Example: NONE

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory

### Test new order using SOR (TRADE) › Responses

Successful Response

Test new order using SOR

`id`

​string

Example: 3a4437e2-41a3-4c19-897c-9cadc5dce8b6

`status`

​integer · int64

Example: 200

`result`

​object

`standardCommissionForOrder`

​object

`maker`

​string

Example: 0.00000112

`taker`

​string

Example: 0.00000114

`taxCommissionForOrder`

​object

`maker`

​string

Example: 0.00000112

`taker`

​string

Example: 0.00000114

`discount`

​object

`enabledForAccount`

​boolean

Example: true

`enabledForSymbol`

​boolean

Example: true

`discountAsset`

​string

Example: BNB

`discount`

​string

Example: 0.25

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSsor.order.test

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "sor.order.test",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "type": "MARKET",
 "quantity": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "sor.order.test",
 "params": {
 "symbol": "BNBUSDT",
 "side": "BUY",
 "type": "MARKET",
 "quantity": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "3a4437e2-41a3-4c19-897c-9cadc5dce8b6",
 "status": 200,
 "result": {
 "standardCommissionForOrder": {
 "maker": 0.00000112,
 "taker": 0.00000114
 },
 "taxCommissionForOrder": {
 "maker": 0.00000112,
 "taker": 0.00000114
 },
 "discount": {
 "enabledForAccount": true,
 "enabledForSymbol": true,
 "discountAsset": "BNB",
 "discount": 0.25
 }
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-streams -->

# Spot WebSocket Market Streams | Binance Developer Docs

Spot WebSocket Market Streams

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [WebSocket Market Streams](/en/docs/catalog/core-trading-spot-trading/api/ws-streams)

Endpoint

wss://stream.binance.com:9443wss://stream.binance.com:443wss://demo-stream.binance.com:9443wss://demo-stream.binance.com:443wss://stream.testnet.binance.vision

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/ws-streams/1.0.0/schema.yaml)

---

## Aggregate Trade Streams

The Aggregate Trade Streams push trade information that is aggregated
for a single taker order.

WSS

{symbol}@aggTrade

wss://stream.binance.com:9443

Update SpeedReal-time

### Aggregate Trade Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Aggregate Trade Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@aggTrade`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@aggTrade`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@aggTrade"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Aggregate Trade Streams › Responses

Raw StreamCombined Stream

Aggregate Trade Streams

`e`

​string

Event type

Example: aggTrade

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`a`

​integer · int64

Aggregate trade ID

Example: 12345

`p`

​string

Price

Example: 0.001

`q`

​string

Quantity

Example: 100

`f`

​integer · int64

First trade ID

Example: 100

`l`

​integer · int64

Last trade ID

Example: 105

`T`

​integer · int64

Trade time

Example: 1672515782136

`m`

​boolean

Is the buyer the market maker?

Example: true

`M`

​boolean

Ignore

Example: true

WSS{symbol}@aggTrade

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@aggTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@aggTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "aggTrade",
 "E": 1672515782136,
 "s": "BNBBTC",
 "a": 12345,
 "p": 0.001,
 "q": 100,
 "f": 100,
 "l": 105,
 "T": 1672515782136,
 "m": true,
 "M": true
}`

json

application/json

---

## All Market Rolling Window Statistics Streams

Rolling window ticker statistics for all market symbols, computed over
multiple windows.

Note that only tickers that have changed will be present in the array.

WSS

!ticker\_{windowSize}@arr

wss://stream.binance.com:9443

Update Speed1000ms

### All Market Rolling Window Statistics Streams › Stream parameters

`windowSize`

​string · enum · required

Enum values:

1h

4h

1d

Example: 1h

### All Market Rolling Window Statistics Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/!ticker_{windowSize}@arr`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams=!ticker_{windowSize}@arr`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!ticker\_1h@arr"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### All Market Rolling Window Statistics Streams › Responses

Raw StreamCombined Stream

All Market Rolling Window Statistics Streams

​object

`e`

​string

Event type

Example: 1hTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`p`

​string

Price change

Example: 0.0015

`P`

​string

Price change percent

Example: 250

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`c`

​string

Last price

Example: 0.0025

`w`

​string

Weighted average price

Example: 0.0018

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

`O`

​integer · int64

Statistics open time

Example: 0

`C`

​integer · int64

Statistics close time

Example: 1675216573749

`F`

​integer · int64

First trade ID

Example: 0

`L`

​integer · int64

Last trade Id

Example: 18150

`n`

​integer · int64

Total number of trades

Example: 18151

WSS!ticker\_{windowSize}@arr

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!ticker_1h@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!ticker_1h@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`[
 {
 "e": "1hTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "p": 0.0015,
 "P": 250,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "c": 0.0025,
 "w": 0.0018,
 "v": 10000,
 "q": 18,
 "O": 0,
 "C": 1675216573749,
 "F": 0,
 "L": 18150,
 "n": 18151
 }
]`

json

application/json

---

## All Market Mini Tickers Stream

24hr rolling window mini-ticker statistics for all symbols that changed
in an array. These are NOT the statistics of the UTC day, but a 24hr
rolling window for the previous 24hrs. Note that only tickers that have
changed will be present in the array.

WSS

!miniTicker@arr

wss://stream.binance.com:9443

Update Speed1000ms

### All Market Mini Tickers Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/!miniTicker@arr`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams=!miniTicker@arr`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!miniTicker@arr"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### All Market Mini Tickers Stream › Responses

Raw StreamCombined Stream

All Market Mini Tickers Stream

​object

`e`

​string

Event type

Example: 24hrMiniTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`c`

​string

Close price

Example: 0.0025

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

WSS!miniTicker@arr

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!miniTicker@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!miniTicker@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`[
 {
 "e": "24hrMiniTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "c": 0.0025,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "v": 10000,
 "q": 18
 }
]`

json

application/json

---

## Average Price

Average price streams push changes in the average price over a fixed time interval.

WSS

{symbol}@avgPrice

wss://stream.binance.com:9443

Update Speed1000ms

### Average Price › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Average Price › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@avgPrice`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@avgPrice`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@avgPrice"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Average Price › Responses

Raw StreamCombined Stream

Average Price

`e`

​string

Event type

Example: avgPrice

`E`

​integer · int64

Event time

Example: 1693907033000

`s`

​string

Symbol

Example: BTCUSDT

`i`

​string

Average price interval

Example: 5m

`w`

​string

Average price

Example: 25776.86

`T`

​integer · int64

Last trade time

Example: 1693907032213

WSS{symbol}@avgPrice

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@avgPrice"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@avgPrice"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "avgPrice",
 "E": 1693907033000,
 "s": "BTCUSDT",
 "i": "5m",
 "w": 25776.86,
 "T": 1693907032213
}`

json

application/json

---

## Individual Symbol Book Ticker Streams

Pushes any update to the best bid or ask's price or quantity in
real-time for a specified symbol.

Multiple `<symbol>@bookTicker` streams can be subscribed to over one
connection.

WSS

{symbol}@bookTicker

wss://stream.binance.com:9443

Update SpeedReal-time

### Individual Symbol Book Ticker Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Individual Symbol Book Ticker Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@bookTicker`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@bookTicker`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@bookTicker"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Individual Symbol Book Ticker Streams › Responses

Raw StreamCombined Stream

Individual Symbol Book Ticker Streams

`u`

​integer · int64

Order book updateId

Example: 400900217

`s`

​string

Symbol

Example: BNBUSDT

`b`

​string

Best bid price

Example: 25.3519

`B`

​string

Best bid qty

Example: 31.21

`a`

​string

Best ask price

Example: 25.3652

`A`

​string

Best ask qty

Example: 40.66

WSS{symbol}@bookTicker

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@bookTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@bookTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "u": 400900217,
 "s": "BNBUSDT",
 "b": 25.3519,
 "B": 31.21,
 "a": 25.3652,
 "A": 40.66
}`

json

application/json

---

## Diff. Depth Stream

Order book price and quantity depth updates used to locally manage an order book.

WSS

{symbol}@depth@{updateSpeed}

wss://stream.binance.com:9443

Update Speed1000ms or 100ms

### Diff. Depth Stream › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`updateSpeed`

​string · enum

Optional stream update speed suffix

Enum values:

100ms

Example: 100ms

### Diff. Depth Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@depth@{updateSpeed}`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@depth@{updateSpeed}`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@depth@100ms"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Diff. Depth Stream › Responses

Raw StreamCombined Stream

Diff. Depth Stream

`e`

​string

Event type

Example: depthUpdate

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`U`

​integer · int64

First update ID in event

Example: 157

`u`

​integer · int64

Final update ID in event

Example: 160

`b`

​array[]

Bids to be updated

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price level to be updated

Example: 0.0024

`[1]`

​string · required

Quantity

Example: 10

`a`

​array[]

Asks to be updated

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price level to be updated

Example: 0.0026

`[1]`

​string · required

Quantity

Example: 100

WSS{symbol}@depth@{updateSpeed}

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@depth@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@depth@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "depthUpdate",
 "E": 1672515782136,
 "s": "BNBBTC",
 "U": 157,
 "u": 160
}`

json

application/json

---

## Kline/Candlestick Streams for UTC

The Kline/Candlestick Stream push updates to the current
klines/candlestick every second in `UTC+0` timezone

WSS

{symbol}@kline\_{interval}

wss://stream.binance.com:9443

Update Speed1000ms for `1s`, 2000ms for the other intervals

### Kline/Candlestick Streams for UTC › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`interval`

​string · enum · required

Enum values:

1s

1m

3m

5m

15m

30m

1h

2h

show 8 more

Example: 1s

### Kline/Candlestick Streams for UTC › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@kline_{interval}`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@kline\_1s"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Kline/Candlestick Streams for UTC › Responses

Raw StreamCombined Stream

Kline/Candlestick Streams for UTC

`e`

​string

Event type

Example: kline

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`k`

​object

Kline payload

Kline payload

`t`

​integer · int64

Kline start time

Example: 1672515780000

`T`

​integer · int64

Kline close time

Example: 1672515839999

`s`

​string

Symbol

Example: BNBBTC

`i`

​string

Interval

Example: 1m

`f`

​integer · int64

First trade ID

Example: 100

`L`

​integer · int64

Last trade ID

Example: 200

`o`

​string

Open price

Example: 0.001

`c`

​string

Close price

Example: 0.002

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.0015

`v`

​string

Base asset volume

Example: 1000

`n`

​integer · int64

Number of trades

Example: 100

`x`

​boolean

Is this kline closed?

Example: false

`q`

​string

Quote asset volume

Example: 1

`V`

​string

Taker buy base asset volume

Example: 500

`Q`

​string

Taker buy quote asset volume

Example: 0.5

`B`

​string

Ignore

Example: 123456

WSS{symbol}@kline\_{interval}

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@kline_1s"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@kline_1s"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "kline",
 "E": 1672515782136,
 "s": "BNBBTC",
 "k": {
 "t": 1672515780000,
 "T": 1672515839999,
 "s": "BNBBTC",
 "i": "1m",
 "f": 100,
 "L": 200,
 "o": 0.001,
 "c": 0.002,
 "h": 0.0025,
 "l": 0.0015,
 "v": 1000,
 "n": 100,
 "x": false,
 "q": 1,
 "V": 500,
 "Q": 0.5,
 "B": 123456
 }
}`

json

application/json

---

## Kline/Candlestick Streams with timezone offset

The Kline/Candlestick Stream push updates to the current
klines/candlestick every second in `UTC+8` timezone

**Kline/Candlestick chart intervals:**

Supported intervals: See Kline/Candlestick chart intervals

**UTC+8 timezone offset:**

* Kline intervals open and close in the UTC+8 timezone. For example the 1d klines will open at the beginning of the UTC+8 day, and close at the end of the UTC+8 day.
* Note that E (event time), t (start time) and T (close time) in the payload are Unix timestamps, which are always interpreted in UTC.

WSS

{symbol}@kline\_{interval}@+08:00

wss://stream.binance.com:9443

Update Speed1000ms for `1s`, 2000ms for the other intervals

### Kline/Candlestick Streams with timezone offset › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`interval`

​string · enum · required

Enum values:

1s

1m

3m

5m

15m

30m

1h

2h

show 8 more

Example: 1s

### Kline/Candlestick Streams with timezone offset › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}@+08:00`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@kline_{interval}@+08:00`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@kline\_1s@+08:00"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Kline/Candlestick Streams with timezone offset › Responses

Raw StreamCombined Stream

Kline/Candlestick Streams with timezone offset

`e`

​string

Event type

Example: kline

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`k`

​object

Kline payload

Kline payload

`t`

​integer · int64

Kline start time

Example: 1672515780000

`T`

​integer · int64

Kline close time

Example: 1672515839999

`s`

​string

Symbol

Example: BNBBTC

`i`

​string

Interval

Example: 1m

`f`

​integer · int64

First trade ID

Example: 100

`L`

​integer · int64

Last trade ID

Example: 200

`o`

​string

Open price

Example: 0.001

`c`

​string

Close price

Example: 0.002

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.0015

`v`

​string

Base asset volume

Example: 1000

`n`

​integer · int64

Number of trades

Example: 100

`x`

​boolean

Is this kline closed?

Example: false

`q`

​string

Quote asset volume

Example: 1

`V`

​string

Taker buy base asset volume

Example: 500

`Q`

​string

Taker buy quote asset volume

Example: 0.5

`B`

​string

Ignore

Example: 123456

WSS{symbol}@kline\_{interval}@+08:00

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@kline_1s@+08:00"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@kline_1s@+08:00"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "kline",
 "E": 1672515782136,
 "s": "BNBBTC",
 "k": {
 "t": 1672515780000,
 "T": 1672515839999,
 "s": "BNBBTC",
 "i": "1m",
 "f": 100,
 "L": 200,
 "o": 0.001,
 "c": 0.002,
 "h": 0.0025,
 "l": 0.0015,
 "v": 1000,
 "n": 100,
 "x": false,
 "q": 1,
 "V": 500,
 "Q": 0.5,
 "B": 123456
 }
}`

json

application/json

---

## Individual Symbol Mini Ticker Stream

24hr rolling window mini-ticker statistics. These are NOT the statistics
of the UTC day, but a 24hr rolling window for the previous 24hrs.

WSS

{symbol}@miniTicker

wss://stream.binance.com:9443

Update Speed1000ms

### Individual Symbol Mini Ticker Stream › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Individual Symbol Mini Ticker Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@miniTicker`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@miniTicker`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@miniTicker"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Individual Symbol Mini Ticker Stream › Responses

Raw StreamCombined Stream

Individual Symbol Mini Ticker Stream

`e`

​string

Event type

Example: 24hrMiniTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`c`

​string

Close price

Example: 0.0025

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

WSS{symbol}@miniTicker

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@miniTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@miniTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "24hrMiniTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "c": 0.0025,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "v": 10000,
 "q": 18
}`

json

application/json

---

## WebSocket Partial Book Depth Streams

Top **<levels>** bids and asks, pushed every second.

WSS

{symbol}@depth{levels}@{updateSpeed}

wss://stream.binance.com:9443

Update Speed1000ms or 100ms

### WebSocket Partial Book Depth Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`levels`

​string · enum · required

Enum values:

5

10

20

Example: 5

`updateSpeed`

​string · enum

Optional stream update speed suffix

Enum values:

100ms

Example: 100ms

### WebSocket Partial Book Depth Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@depth{levels}@{updateSpeed}`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@depth{levels}@{updateSpeed}`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@depth5@100ms"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### WebSocket Partial Book Depth Streams › Responses

Raw StreamCombined Stream

Partial Book Depth Streams

`lastUpdateId`

​integer · int64

Last update ID

Example: 160

`bids`

​array[]

Bids to be updated

Example: [["0.0024","10"]]

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price level to be updated

Example: 0.0024

`[1]`

​string · required

Quantity

Example: 10

`asks`

​array[]

Asks to be updated

Example: [["0.0026","100"]]

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price level to be updated

Example: 0.0026

`[1]`

​string · required

Quantity

Example: 100

WSS{symbol}@depth{levels}@{updateSpeed}

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@depth5@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@depth5@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "lastUpdateId": 160,
 "bids": [
 [
 "0.0024",
 "10"
 ]
 ],
 "asks": [
 [
 "0.0026",
 "100"
 ]
 ]
}`

json

application/json

---

## Reference Price Streams

Reference price stream for a symbol.

WSS

{symbol}@referencePrice

wss://stream.binance.com:9443

Update Speed1000ms

### Reference Price Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bazusd

### Reference Price Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@referencePrice`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@referencePrice`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bazusd@referencePrice"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Reference Price Streams › Responses

Raw StreamCombined Stream

Reference Price Streams

`e`

​string

Event type

Example: referencePrice

`s`

​string

Symbol

Example: BAZUSD

`r`

​string

Reference price (null if no reference price)

Example: 1.00

`t`

​integer · int64

Engine timestamp when reference price was valid

Example: 1770313263917

WSS{symbol}@referencePrice

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bazusd@referencePrice"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bazusd@referencePrice"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "referencePrice",
 "s": "BAZUSD",
 "r": "1.00",
 "t": 1770313263917
}`

json

application/json

---

## Individual Symbol Rolling Window Statistics Streams

Rolling window ticker statistics for a single symbol, computed over
multiple windows.

**Note:** This stream is different from the `<symbol>@ticker` stream. The open time `"O"` always starts on a minute, while the closing time `"C"` is the current time
of the update. As such, the effective window might be up to 59999ms wider than `<window_size>`.

WSS

{symbol}@ticker\_{windowSize}

wss://stream.binance.com:9443

Update Speed1000ms

### Individual Symbol Rolling Window Statistics Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`windowSize`

​string · enum · required

Enum values:

1h

4h

1d

Example: 1h

### Individual Symbol Rolling Window Statistics Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@ticker_{windowSize}`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@ticker_{windowSize}`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@ticker\_1h"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Individual Symbol Rolling Window Statistics Streams › Responses

Raw StreamCombined Stream

Individual Symbol Rolling Window Statistics Streams

`e`

​string

Event type

Example: 1hTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`p`

​string

Price change

Example: 0.0015

`P`

​string

Price change percent

Example: 250

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`c`

​string

Last price

Example: 0.0025

`w`

​string

Weighted average price

Example: 0.0018

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

`O`

​integer · int64

Statistics open time

Example: 0

`C`

​integer · int64

Statistics close time

Example: 1675216573749

`F`

​integer · int64

First trade ID

Example: 0

`L`

​integer · int64

Last trade Id

Example: 18150

`n`

​integer · int64

Total number of trades

Example: 18151

WSS{symbol}@ticker\_{windowSize}

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@ticker_1h"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@ticker_1h"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "1hTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "p": 0.0015,
 "P": 250,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "c": 0.0025,
 "w": 0.0018,
 "v": 10000,
 "q": 18,
 "O": 0,
 "C": 1675216573749,
 "F": 0,
 "L": 18150,
 "n": 18151
}`

json

application/json

---

## Individual Symbol Ticker Streams

24hr rolling window ticker statistics for a single symbol. These are NOT
the statistics of the UTC day, but a 24hr rolling window for the
previous 24hrs.

WSS

{symbol}@ticker

wss://stream.binance.com:9443

Update Speed1000ms

### Individual Symbol Ticker Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Individual Symbol Ticker Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@ticker`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@ticker`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@ticker"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Individual Symbol Ticker Streams › Responses

Raw StreamCombined Stream

Individual Symbol Ticker Streams

`e`

​string

Event type

Example: 24hrTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`p`

​string

Price change

Example: 0.0015

`P`

​string

Price change percent

Example: 250

`w`

​string

Weighted average price

Example: 0.0018

`x`

​string

First trade(F)-1 price (first trade before the 24hr rolling window)

Example: 0.0009

`c`

​string

Last price

Example: 0.0025

`Q`

​string

Last quantity

Example: 10

`b`

​string

Best bid price

Example: 0.0024

`B`

​string

Best bid quantity

Example: 10

`a`

​string

Best ask price

Example: 0.0026

`A`

​string

Best ask quantity

Example: 100

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

`O`

​integer · int64

Statistics open time

Example: 0

`C`

​integer · int64

Statistics close time

Example: 1675216573749

`F`

​integer · int64

First trade ID

Example: 0

`L`

​integer · int64

Last trade Id

Example: 18150

`n`

​integer · int64

Total number of trades

Example: 18151

WSS{symbol}@ticker

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@ticker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@ticker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "24hrTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "p": 0.0015,
 "P": 250,
 "w": 0.0018,
 "x": 0.0009,
 "c": 0.0025,
 "Q": 10,
 "b": 0.0024,
 "B": 10,
 "a": 0.0026,
 "A": 100,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "v": 10000,
 "q": 18,
 "O": 0,
 "C": 1675216573749,
 "F": 0,
 "L": 18150,
 "n": 18151
}`

json

application/json

---

## Trade Streams

The Trade Streams push raw trade information; each trade has a unique
buyer and seller.

WSS

{symbol}@trade

wss://stream.binance.com:9443

Update SpeedReal-time

### Trade Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Trade Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@trade`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@trade`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@trade"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Trade Streams › Responses

Raw StreamCombined Stream

Trade Streams

`e`

​string

Event type

Example: trade

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`t`

​integer · int64

Trade ID

Example: 12345

`p`

​string

Price

Example: 0.001

`q`

​string

Quantity

Example: 100

`T`

​integer · int64

Trade time

Example: 1672515782136

`m`

​boolean

Is the buyer the market maker?

Example: true

`M`

​boolean

Ignore

Example: true

WSS{symbol}@trade

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@trade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@trade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "trade",
 "E": 1672515782136,
 "s": "BNBBTC",
 "t": 12345,
 "p": 0.001,
 "q": 100,
 "T": 1672515782136,
 "m": true,
 "M": true
}`

json

application/json

---

## Block Trade Streams

Block Trade Streams push block trade information in real-time.

WSS

{symbol}@blockTrade

wss://stream.binance.com:9443

Update SpeedReal-time

### Block Trade Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Block Trade Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@blockTrade`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@blockTrade`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@blockTrade"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Block Trade Streams › Responses

Raw StreamCombined Stream

Block Trade Streams

`e`

​string

Event type

Example: blockTrade

`E`

​integer · int64

Event time

Example: 1772506983582

`s`

​string

Symbol

Example: BNBBTC

`t`

​integer · int64

Block Trade ID

Example: 582

`p`

​string

Price

Example: 0.052

`q`

​string

Quantity

Example: 5838

`T`

​integer · int64

Trade time

Example: 1772506983321

`m`

​boolean

Is the buyer the maker?

Example: true

WSS{symbol}@blockTrade

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@blockTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@blockTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "blockTrade",
 "E": 1772506983582,
 "s": "BNBBTC",
 "t": 582,
 "p": "0.052",
 "q": "5838",
 "T": 1772506983321,
 "m": true
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/products/spot/README -->

# Binance Developer Docs

We value your privacy

We use cookies to analyze site usage and improve the documentation experience. Analytics are aggregated and do not include sensitive personal data.

[Privacy & cookies](https://www.binance.com/en/about-legal/privacy-portal)

RejectAccept

404

# Page not found

It seems that the page you are looking for does not exist or may have been moved.
Please check the URL for any typos or use the navigation menu to find the correct page.

[Go back home](/en/docs)

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api -->

# General - Spot REST API | Binance Developer Docs

Spot REST API

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [REST API](/en/docs/catalog/core-trading-spot-trading/api/rest-api)

# General

Endpoint

https://api.binance.comhttps://api-gcp.binance.comhttps://api1.binance.comhttps://api2.binance.comhttps://api3.binance.comhttps://api4.binance.comhttps://demo-api.binance.comhttps://data-api.binance.visionhttps://testnet.binance.visionhttps://api1.testnet.binance.vision

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/rest-api/1.0.0/schema.yaml)

---

## Exchange information

Current exchange trading rules and symbol information

GET

/api/v3/exchangeInfo

https://api.binance.com

### Exchange information › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight20

### Exchange information › Query Parameters

`symbol`

​string

Example: curl -X GET "<https://api.binance.com/api/v3/exchangeInfo?symbol=BNBBTC>"

Example: ETHBTC

`symbols`

​string[]

Examples: curl -X GET "<https://api.binance.com/api/v3/exchangeInfo?symbols=%5B%22BNBBTC%22,%22BTCUSDT%22%5D>" or curl -g -X GET '[https://api.binance.com/api/v3/exchangeInfo?symbols=["BTCUSDT","BNBBTC](https://api.binance.com/api/v3/exchangeInfo?symbols=%5B%22BTCUSDT%22,%22BNBBTC)"]'

Example: ["BTCUSDT","BNBBTC"]

`permissions`

​string[]

Examples: curl -X GET "<https://api.binance.com/api/v3/exchangeInfo?permissions=SPOT>"

curl -X GET "<https://api.binance.com/api/v3/exchangeInfo?permissions=%5B%22MARGIN%22%2C%22LEVERAGED%22%5D>"
or
curl -g -X GET '[https://api.binance.com/api/v3/exchangeInfo?permissions=["MARGIN","LEVERAGED](https://api.binance.com/api/v3/exchangeInfo?permissions=%5B%22MARGIN%22,%22LEVERAGED)"]'

Enum values:

SPOT

MARGIN

LEVERAGED

TRD\_GRP\_002

TRD\_GRP\_003

TRD\_GRP\_004

TRD\_GRP\_005

TRD\_GRP\_006

show 19 more

Example: ["SPOT"]

`showPermissionSets`

​boolean

Controls whether the content of the `permissionSets` field is populated or not.

Example: false

Default: true

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`. Cannot be used in combination with `symbols` or `symbol`.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

**Notes:**

* If the value provided to `symbol` or `symbols` do not exist, the endpoint will throw an error saying the symbol is invalid.
* All parameters are optional.
* `permissions` can support single or multiple values (e.g. `SPOT`, `["MARGIN","LEVERAGED"]`). This cannot be used in combination with `symbol` or `symbols`.
* If `permissions` parameter not provided, all symbols that have either `SPOT`, `MARGIN`, or `LEVERAGED` permission will be exposed.
  + To display symbols with any permission you need to specify them explicitly in `permissions`: (e.g. `["SPOT","MARGIN",...]`.). See Account and Symbol Permissions for the full list.

**Examples of Symbol Permissions Interpretation from the Response:**

* `[["A","B"]]` means you may place an order if your account has either permission "A" **or** permission "B".
* `[["A"],["B"]]` means you can place an order if your account has permission "A" **and** permission "B".
* `[["A"],["B","C"]]` means you can place an order if your account has permission "A" **and** permission "B" or permission "C". (Inclusive or is applied here, not exclusive or, so your account may have both permission "B" and permission "C".)

### Exchange information › Responses

200

Exchange information

`timezone`

​string

Example: UTC

`serverTime`

​integer · int64

Example: 1565246363776

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

`exchangeFilters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| EXCHANGE\_MAX\_NUM\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ORDER\_LISTS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDER\_LISTS" |

**Properties for EXCHANGE\_MAX\_NUM\_ORDERS:**

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 1000

`symbols`

​object[]

`symbol`

​string

Example: ETHBTC

`status`

​string

Example: TRADING

`baseAsset`

​string

Example: ETH

`baseAssetPrecision`

​integer · int64

Example: 8

`quoteAsset`

​string

Example: BTC

`quotePrecision`

​integer · int64

Example: 8

`quoteAssetPrecision`

​integer · int64

Example: 8

`baseCommissionPrecision`

​integer · int64

Example: 8

`quoteCommissionPrecision`

​integer · int64

Example: 8

`orderTypes`

​string[]

`icebergAllowed`

​boolean

Example: true

`ocoAllowed`

​boolean

Example: true

`otoAllowed`

​boolean

Example: true

`opoAllowed`

​boolean

Example: true

`quoteOrderQtyMarketAllowed`

​boolean

Example: true

`allowTrailingStop`

​boolean

Example: false

`cancelReplaceAllowed`

​boolean

Example: false

`amendAllowed`

​boolean

Example: false

`pegInstructionsAllowed`

​boolean

Example: true

`isSpotTradingAllowed`

​boolean

Example: true

`isMarginTradingAllowed`

​boolean

Example: true

`filters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| PRICE\_FILTER | type = object · filterType="PRICE\_FILTER" |
| PERCENT\_PRICE | type = object · filterType="PERCENT\_PRICE" |
| PERCENT\_PRICE\_BY\_SIDE | type = object · filterType="PERCENT\_PRICE\_BY\_SIDE" |
| LOT\_SIZE | type = object · filterType="LOT\_SIZE" |
| MIN\_NOTIONAL | type = object · filterType="MIN\_NOTIONAL" |
| NOTIONAL | type = object · filterType="NOTIONAL" |
| ICEBERG\_PARTS | type = object · filterType="ICEBERG\_PARTS" |
| MARKET\_LOT\_SIZE | type = object · filterType="MARKET\_LOT\_SIZE" |
| MAX\_NUM\_ORDERS | type = object · filterType="MAX\_NUM\_ORDERS" |
| MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="MAX\_NUM\_ALGO\_ORDERS" |
| MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="MAX\_NUM\_ICEBERG\_ORDERS" |
| MAX\_POSITION | type = object · filterType="MAX\_POSITION" |
| TRAILING\_DELTA | type = object · filterType="TRAILING\_DELTA" |
| T\_PLUS\_SELL | type = object · filterType="T\_PLUS\_SELL" |
| MAX\_NUM\_ORDER\_LISTS | type = object · filterType="MAX\_NUM\_ORDER\_LISTS" |
| MAX\_NUM\_ORDER\_AMENDS | type = object · filterType="MAX\_NUM\_ORDER\_AMENDS" |

**Properties for PRICE\_FILTER:**

`filterType`

​string

Example: PRICE\_FILTER

`priceExponent`

​integer

Example: 8

`minPrice`

​string

Example: 0.00000100

`maxPrice`

​string

Example: 100000.00000000

`tickSize`

​string

Example: 0.00000100

`permissions`

​string[]

`permissionSets`

​array[]

`defaultSelfTradePreventionMode`

​string

Example: NONE

`allowedSelfTradePreventionModes`

​string[]

`sors`

​object[]

Optional. Present only when SOR is available.

`baseAsset`

​string

Example: BTC

`symbols`

​string[]

GET/api/v3/exchangeInfo

Loading…

`curl --request GET \
 --url https://api.binance.com/api/v3/exchangeInfo`

Example Responses

200

`{
 "timezone": "UTC",
 "serverTime": 1565246363776,
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000
 },
 {
 "rateLimitType": "ORDERS",
 "interval": "DAY",
 "intervalNum": 1,
 "limit": 160000
 },
 {
 "rateLimitType": "RAW_REQUESTS",
 "interval": "MINUTE",
 "intervalNum": 5,
 "limit": 61000
 }
 ],
 "exchangeFilters": [],
 "symbols": [
 {
 "symbol": "ETHBTC",
 "status": "TRADING",
 "baseAsset": "ETH",
 "baseAssetPrecision": 8,
 "quoteAsset": "BTC",
 "quotePrecision": 8,
 "quoteAssetPrecision": 8,
 "baseCommissionPrecision": 8,
 "quoteCommissionPrecision": 8,
 "orderTypes": [
 "LIMIT LIMIT_MAKER MARKET STOP_LOSS STOP_LOSS_LIMIT TAKE_PROFIT TAKE_PROFIT_LIMIT"
 ],
 "icebergAllowed": true,
 "ocoAllowed": true,
 "otoAllowed": true,
 "opoAllowed": true,
 "quoteOrderQtyMarketAllowed": true,
 "allowTrailingStop": false,
 "cancelReplaceAllowed": false,
 "amendAllowed": false,
 "pegInstructionsAllowed": true,
 "isSpotTradingAllowed": true,
 "isMarginTradingAllowed": true,
 "filters": [],
 "permissions": [],
 "permissionSets": [
 [
 "SPOT",
 "MARGIN"
 ]
 ],
 "defaultSelfTradePreventionMode": "NONE",
 "allowedSelfTradePreventionModes": [
 "NONE"
 ]
 }
 ]
}`

json

application/json

---

## Query Execution Rules

Query execution rules for symbols.

GET

/api/v3/executionRules

https://api.binance.com

### Query Execution Rules › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

| Parameter | Weight |
| --- | --- |
| `symbol` | 2 |
| `symbols` | 2 for each `symbol`, capped at a max of 40 |
| `symbolStatus` | 40 |
| None | 40 |

### Query Execution Rules › Query Parameters

`symbol`

​string

Query for specified symbol.

Example: BAZUSD

`symbols`

​string[]

Query for multiple symbols.

Example: ["BAZUSD","BNBUSDT"]

`symbolStatus`

​string · enum

Query for all symbols with the specified status.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

**Note:**: No combination of multiple parameters is allowed.

### Query Execution Rules › Responses

200

Query execution rules

`symbolRules`

​object[]

`symbol`

​string

Example: BAZUSD

`rules`

​object[]

`ruleType`

​string

Example: PRICE\_RANGE

`bidLimitMultUp`

​string

Example: 1.0001

`bidLimitMultDown`

​string

Example: 0.9999

`askLimitMultUp`

​string

Example: 1.0001

`askLimitMultDown`

​string

Example: 0.9999

GET/api/v3/executionRules

Loading…

`curl --request GET \
 --url https://api.binance.com/api/v3/executionRules`

Example Responses

200

`{
 "symbolRules": [
 {
 "symbol": "BAZUSD",
 "rules": [
 {
 "ruleType": "PRICE_RANGE",
 "bidLimitMultUp": "1.0001",
 "bidLimitMultDown": "0.9999",
 "askLimitMultUp": "1.0001",
 "askLimitMultDown": "0.9999"
 }
 ]
 }
 ]
}`

json

application/json

---

## Test connectivity

Test connectivity to the Rest API.

GET

/api/v3/ping

https://api.binance.com

### Test connectivity › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight1

### Test connectivity › Responses

200

OK

No data returned

GET/api/v3/ping

Loading…

`curl --request GET \
 --url https://api.binance.com/api/v3/ping`

Example Responses

200

No example specified for this content type

---

## Check server time

Test connectivity to the Rest API and get the current server time.

GET

/api/v3/time

https://api.binance.com

### Check server time › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight1

### Check server time › Responses

200

Check server time

`serverTime`

​integer · int64

Example: 1499827319559

GET/api/v3/time

Loading…

`curl --request GET \
 --url https://api.binance.com/api/v3/time`

Example Responses

200

`{
 "serverTime": 1499827319559
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-streams/~ -->

# Spot WebSocket Market Streams | Binance Developer Docs

Spot WebSocket Market Streams

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [WebSocket Market Streams](/en/docs/catalog/core-trading-spot-trading/api/ws-streams)

Endpoint

wss://stream.binance.com:9443wss://stream.binance.com:443wss://demo-stream.binance.com:9443wss://demo-stream.binance.com:443wss://stream.testnet.binance.vision

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/ws-streams/1.0.0/schema.yaml)

---

## Aggregate Trade Streams

The Aggregate Trade Streams push trade information that is aggregated
for a single taker order.

WSS

{symbol}@aggTrade

wss://stream.binance.com:9443

Update SpeedReal-time

### Aggregate Trade Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Aggregate Trade Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@aggTrade`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@aggTrade`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@aggTrade"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Aggregate Trade Streams › Responses

Raw StreamCombined Stream

Aggregate Trade Streams

`e`

​string

Event type

Example: aggTrade

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`a`

​integer · int64

Aggregate trade ID

Example: 12345

`p`

​string

Price

Example: 0.001

`q`

​string

Quantity

Example: 100

`f`

​integer · int64

First trade ID

Example: 100

`l`

​integer · int64

Last trade ID

Example: 105

`T`

​integer · int64

Trade time

Example: 1672515782136

`m`

​boolean

Is the buyer the market maker?

Example: true

`M`

​boolean

Ignore

Example: true

WSS{symbol}@aggTrade

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@aggTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@aggTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "aggTrade",
 "E": 1672515782136,
 "s": "BNBBTC",
 "a": 12345,
 "p": 0.001,
 "q": 100,
 "f": 100,
 "l": 105,
 "T": 1672515782136,
 "m": true,
 "M": true
}`

json

application/json

---

## All Market Rolling Window Statistics Streams

Rolling window ticker statistics for all market symbols, computed over
multiple windows.

Note that only tickers that have changed will be present in the array.

WSS

!ticker\_{windowSize}@arr

wss://stream.binance.com:9443

Update Speed1000ms

### All Market Rolling Window Statistics Streams › Stream parameters

`windowSize`

​string · enum · required

Enum values:

1h

4h

1d

Example: 1h

### All Market Rolling Window Statistics Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/!ticker_{windowSize}@arr`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams=!ticker_{windowSize}@arr`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!ticker\_1h@arr"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### All Market Rolling Window Statistics Streams › Responses

Raw StreamCombined Stream

All Market Rolling Window Statistics Streams

​object

`e`

​string

Event type

Example: 1hTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`p`

​string

Price change

Example: 0.0015

`P`

​string

Price change percent

Example: 250

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`c`

​string

Last price

Example: 0.0025

`w`

​string

Weighted average price

Example: 0.0018

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

`O`

​integer · int64

Statistics open time

Example: 0

`C`

​integer · int64

Statistics close time

Example: 1675216573749

`F`

​integer · int64

First trade ID

Example: 0

`L`

​integer · int64

Last trade Id

Example: 18150

`n`

​integer · int64

Total number of trades

Example: 18151

WSS!ticker\_{windowSize}@arr

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!ticker_1h@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!ticker_1h@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`[
 {
 "e": "1hTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "p": 0.0015,
 "P": 250,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "c": 0.0025,
 "w": 0.0018,
 "v": 10000,
 "q": 18,
 "O": 0,
 "C": 1675216573749,
 "F": 0,
 "L": 18150,
 "n": 18151
 }
]`

json

application/json

---

## All Market Mini Tickers Stream

24hr rolling window mini-ticker statistics for all symbols that changed
in an array. These are NOT the statistics of the UTC day, but a 24hr
rolling window for the previous 24hrs. Note that only tickers that have
changed will be present in the array.

WSS

!miniTicker@arr

wss://stream.binance.com:9443

Update Speed1000ms

### All Market Mini Tickers Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/!miniTicker@arr`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams=!miniTicker@arr`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!miniTicker@arr"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### All Market Mini Tickers Stream › Responses

Raw StreamCombined Stream

All Market Mini Tickers Stream

​object

`e`

​string

Event type

Example: 24hrMiniTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`c`

​string

Close price

Example: 0.0025

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

WSS!miniTicker@arr

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!miniTicker@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!miniTicker@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`[
 {
 "e": "24hrMiniTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "c": 0.0025,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "v": 10000,
 "q": 18
 }
]`

json

application/json

---

## Average Price

Average price streams push changes in the average price over a fixed time interval.

WSS

{symbol}@avgPrice

wss://stream.binance.com:9443

Update Speed1000ms

### Average Price › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Average Price › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@avgPrice`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@avgPrice`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@avgPrice"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Average Price › Responses

Raw StreamCombined Stream

Average Price

`e`

​string

Event type

Example: avgPrice

`E`

​integer · int64

Event time

Example: 1693907033000

`s`

​string

Symbol

Example: BTCUSDT

`i`

​string

Average price interval

Example: 5m

`w`

​string

Average price

Example: 25776.86

`T`

​integer · int64

Last trade time

Example: 1693907032213

WSS{symbol}@avgPrice

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@avgPrice"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@avgPrice"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "avgPrice",
 "E": 1693907033000,
 "s": "BTCUSDT",
 "i": "5m",
 "w": 25776.86,
 "T": 1693907032213
}`

json

application/json

---

## Individual Symbol Book Ticker Streams

Pushes any update to the best bid or ask's price or quantity in
real-time for a specified symbol.

Multiple `<symbol>@bookTicker` streams can be subscribed to over one
connection.

WSS

{symbol}@bookTicker

wss://stream.binance.com:9443

Update SpeedReal-time

### Individual Symbol Book Ticker Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Individual Symbol Book Ticker Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@bookTicker`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@bookTicker`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@bookTicker"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Individual Symbol Book Ticker Streams › Responses

Raw StreamCombined Stream

Individual Symbol Book Ticker Streams

`u`

​integer · int64

Order book updateId

Example: 400900217

`s`

​string

Symbol

Example: BNBUSDT

`b`

​string

Best bid price

Example: 25.3519

`B`

​string

Best bid qty

Example: 31.21

`a`

​string

Best ask price

Example: 25.3652

`A`

​string

Best ask qty

Example: 40.66

WSS{symbol}@bookTicker

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@bookTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@bookTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "u": 400900217,
 "s": "BNBUSDT",
 "b": 25.3519,
 "B": 31.21,
 "a": 25.3652,
 "A": 40.66
}`

json

application/json

---

## Diff. Depth Stream

Order book price and quantity depth updates used to locally manage an order book.

WSS

{symbol}@depth@{updateSpeed}

wss://stream.binance.com:9443

Update Speed1000ms or 100ms

### Diff. Depth Stream › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`updateSpeed`

​string · enum

Optional stream update speed suffix

Enum values:

100ms

Example: 100ms

### Diff. Depth Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@depth@{updateSpeed}`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@depth@{updateSpeed}`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@depth@100ms"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Diff. Depth Stream › Responses

Raw StreamCombined Stream

Diff. Depth Stream

`e`

​string

Event type

Example: depthUpdate

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`U`

​integer · int64

First update ID in event

Example: 157

`u`

​integer · int64

Final update ID in event

Example: 160

`b`

​array[]

Bids to be updated

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price level to be updated

Example: 0.0024

`[1]`

​string · required

Quantity

Example: 10

`a`

​array[]

Asks to be updated

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price level to be updated

Example: 0.0026

`[1]`

​string · required

Quantity

Example: 100

WSS{symbol}@depth@{updateSpeed}

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@depth@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@depth@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "depthUpdate",
 "E": 1672515782136,
 "s": "BNBBTC",
 "U": 157,
 "u": 160
}`

json

application/json

---

## Kline/Candlestick Streams for UTC

The Kline/Candlestick Stream push updates to the current
klines/candlestick every second in `UTC+0` timezone

WSS

{symbol}@kline\_{interval}

wss://stream.binance.com:9443

Update Speed1000ms for `1s`, 2000ms for the other intervals

### Kline/Candlestick Streams for UTC › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`interval`

​string · enum · required

Enum values:

1s

1m

3m

5m

15m

30m

1h

2h

show 8 more

Example: 1s

### Kline/Candlestick Streams for UTC › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@kline_{interval}`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@kline\_1s"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Kline/Candlestick Streams for UTC › Responses

Raw StreamCombined Stream

Kline/Candlestick Streams for UTC

`e`

​string

Event type

Example: kline

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`k`

​object

Kline payload

Kline payload

`t`

​integer · int64

Kline start time

Example: 1672515780000

`T`

​integer · int64

Kline close time

Example: 1672515839999

`s`

​string

Symbol

Example: BNBBTC

`i`

​string

Interval

Example: 1m

`f`

​integer · int64

First trade ID

Example: 100

`L`

​integer · int64

Last trade ID

Example: 200

`o`

​string

Open price

Example: 0.001

`c`

​string

Close price

Example: 0.002

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.0015

`v`

​string

Base asset volume

Example: 1000

`n`

​integer · int64

Number of trades

Example: 100

`x`

​boolean

Is this kline closed?

Example: false

`q`

​string

Quote asset volume

Example: 1

`V`

​string

Taker buy base asset volume

Example: 500

`Q`

​string

Taker buy quote asset volume

Example: 0.5

`B`

​string

Ignore

Example: 123456

WSS{symbol}@kline\_{interval}

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@kline_1s"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@kline_1s"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "kline",
 "E": 1672515782136,
 "s": "BNBBTC",
 "k": {
 "t": 1672515780000,
 "T": 1672515839999,
 "s": "BNBBTC",
 "i": "1m",
 "f": 100,
 "L": 200,
 "o": 0.001,
 "c": 0.002,
 "h": 0.0025,
 "l": 0.0015,
 "v": 1000,
 "n": 100,
 "x": false,
 "q": 1,
 "V": 500,
 "Q": 0.5,
 "B": 123456
 }
}`

json

application/json

---

## Kline/Candlestick Streams with timezone offset

The Kline/Candlestick Stream push updates to the current
klines/candlestick every second in `UTC+8` timezone

**Kline/Candlestick chart intervals:**

Supported intervals: See Kline/Candlestick chart intervals

**UTC+8 timezone offset:**

* Kline intervals open and close in the UTC+8 timezone. For example the 1d klines will open at the beginning of the UTC+8 day, and close at the end of the UTC+8 day.
* Note that E (event time), t (start time) and T (close time) in the payload are Unix timestamps, which are always interpreted in UTC.

WSS

{symbol}@kline\_{interval}@+08:00

wss://stream.binance.com:9443

Update Speed1000ms for `1s`, 2000ms for the other intervals

### Kline/Candlestick Streams with timezone offset › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`interval`

​string · enum · required

Enum values:

1s

1m

3m

5m

15m

30m

1h

2h

show 8 more

Example: 1s

### Kline/Candlestick Streams with timezone offset › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}@+08:00`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@kline_{interval}@+08:00`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@kline\_1s@+08:00"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Kline/Candlestick Streams with timezone offset › Responses

Raw StreamCombined Stream

Kline/Candlestick Streams with timezone offset

`e`

​string

Event type

Example: kline

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`k`

​object

Kline payload

Kline payload

`t`

​integer · int64

Kline start time

Example: 1672515780000

`T`

​integer · int64

Kline close time

Example: 1672515839999

`s`

​string

Symbol

Example: BNBBTC

`i`

​string

Interval

Example: 1m

`f`

​integer · int64

First trade ID

Example: 100

`L`

​integer · int64

Last trade ID

Example: 200

`o`

​string

Open price

Example: 0.001

`c`

​string

Close price

Example: 0.002

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.0015

`v`

​string

Base asset volume

Example: 1000

`n`

​integer · int64

Number of trades

Example: 100

`x`

​boolean

Is this kline closed?

Example: false

`q`

​string

Quote asset volume

Example: 1

`V`

​string

Taker buy base asset volume

Example: 500

`Q`

​string

Taker buy quote asset volume

Example: 0.5

`B`

​string

Ignore

Example: 123456

WSS{symbol}@kline\_{interval}@+08:00

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@kline_1s@+08:00"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@kline_1s@+08:00"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "kline",
 "E": 1672515782136,
 "s": "BNBBTC",
 "k": {
 "t": 1672515780000,
 "T": 1672515839999,
 "s": "BNBBTC",
 "i": "1m",
 "f": 100,
 "L": 200,
 "o": 0.001,
 "c": 0.002,
 "h": 0.0025,
 "l": 0.0015,
 "v": 1000,
 "n": 100,
 "x": false,
 "q": 1,
 "V": 500,
 "Q": 0.5,
 "B": 123456
 }
}`

json

application/json

---

## Individual Symbol Mini Ticker Stream

24hr rolling window mini-ticker statistics. These are NOT the statistics
of the UTC day, but a 24hr rolling window for the previous 24hrs.

WSS

{symbol}@miniTicker

wss://stream.binance.com:9443

Update Speed1000ms

### Individual Symbol Mini Ticker Stream › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Individual Symbol Mini Ticker Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@miniTicker`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@miniTicker`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@miniTicker"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Individual Symbol Mini Ticker Stream › Responses

Raw StreamCombined Stream

Individual Symbol Mini Ticker Stream

`e`

​string

Event type

Example: 24hrMiniTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`c`

​string

Close price

Example: 0.0025

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

WSS{symbol}@miniTicker

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@miniTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@miniTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "24hrMiniTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "c": 0.0025,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "v": 10000,
 "q": 18
}`

json

application/json

---

## WebSocket Partial Book Depth Streams

Top **<levels>** bids and asks, pushed every second.

WSS

{symbol}@depth{levels}@{updateSpeed}

wss://stream.binance.com:9443

Update Speed1000ms or 100ms

### WebSocket Partial Book Depth Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`levels`

​string · enum · required

Enum values:

5

10

20

Example: 5

`updateSpeed`

​string · enum

Optional stream update speed suffix

Enum values:

100ms

Example: 100ms

### WebSocket Partial Book Depth Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@depth{levels}@{updateSpeed}`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@depth{levels}@{updateSpeed}`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@depth5@100ms"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### WebSocket Partial Book Depth Streams › Responses

Raw StreamCombined Stream

Partial Book Depth Streams

`lastUpdateId`

​integer · int64

Last update ID

Example: 160

`bids`

​array[]

Bids to be updated

Example: [["0.0024","10"]]

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price level to be updated

Example: 0.0024

`[1]`

​string · required

Quantity

Example: 10

`asks`

​array[]

Asks to be updated

Example: [["0.0026","100"]]

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price level to be updated

Example: 0.0026

`[1]`

​string · required

Quantity

Example: 100

WSS{symbol}@depth{levels}@{updateSpeed}

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@depth5@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@depth5@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "lastUpdateId": 160,
 "bids": [
 [
 "0.0024",
 "10"
 ]
 ],
 "asks": [
 [
 "0.0026",
 "100"
 ]
 ]
}`

json

application/json

---

## Reference Price Streams

Reference price stream for a symbol.

WSS

{symbol}@referencePrice

wss://stream.binance.com:9443

Update Speed1000ms

### Reference Price Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bazusd

### Reference Price Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@referencePrice`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@referencePrice`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bazusd@referencePrice"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Reference Price Streams › Responses

Raw StreamCombined Stream

Reference Price Streams

`e`

​string

Event type

Example: referencePrice

`s`

​string

Symbol

Example: BAZUSD

`r`

​string

Reference price (null if no reference price)

Example: 1.00

`t`

​integer · int64

Engine timestamp when reference price was valid

Example: 1770313263917

WSS{symbol}@referencePrice

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bazusd@referencePrice"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bazusd@referencePrice"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "referencePrice",
 "s": "BAZUSD",
 "r": "1.00",
 "t": 1770313263917
}`

json

application/json

---

## Individual Symbol Rolling Window Statistics Streams

Rolling window ticker statistics for a single symbol, computed over
multiple windows.

**Note:** This stream is different from the `<symbol>@ticker` stream. The open time `"O"` always starts on a minute, while the closing time `"C"` is the current time
of the update. As such, the effective window might be up to 59999ms wider than `<window_size>`.

WSS

{symbol}@ticker\_{windowSize}

wss://stream.binance.com:9443

Update Speed1000ms

### Individual Symbol Rolling Window Statistics Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

`windowSize`

​string · enum · required

Enum values:

1h

4h

1d

Example: 1h

### Individual Symbol Rolling Window Statistics Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@ticker_{windowSize}`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@ticker_{windowSize}`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@ticker\_1h"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Individual Symbol Rolling Window Statistics Streams › Responses

Raw StreamCombined Stream

Individual Symbol Rolling Window Statistics Streams

`e`

​string

Event type

Example: 1hTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`p`

​string

Price change

Example: 0.0015

`P`

​string

Price change percent

Example: 250

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`c`

​string

Last price

Example: 0.0025

`w`

​string

Weighted average price

Example: 0.0018

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

`O`

​integer · int64

Statistics open time

Example: 0

`C`

​integer · int64

Statistics close time

Example: 1675216573749

`F`

​integer · int64

First trade ID

Example: 0

`L`

​integer · int64

Last trade Id

Example: 18150

`n`

​integer · int64

Total number of trades

Example: 18151

WSS{symbol}@ticker\_{windowSize}

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@ticker_1h"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@ticker_1h"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "1hTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "p": 0.0015,
 "P": 250,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "c": 0.0025,
 "w": 0.0018,
 "v": 10000,
 "q": 18,
 "O": 0,
 "C": 1675216573749,
 "F": 0,
 "L": 18150,
 "n": 18151
}`

json

application/json

---

## Individual Symbol Ticker Streams

24hr rolling window ticker statistics for a single symbol. These are NOT
the statistics of the UTC day, but a 24hr rolling window for the
previous 24hrs.

WSS

{symbol}@ticker

wss://stream.binance.com:9443

Update Speed1000ms

### Individual Symbol Ticker Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Individual Symbol Ticker Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@ticker`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@ticker`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@ticker"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Individual Symbol Ticker Streams › Responses

Raw StreamCombined Stream

Individual Symbol Ticker Streams

`e`

​string

Event type

Example: 24hrTicker

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`p`

​string

Price change

Example: 0.0015

`P`

​string

Price change percent

Example: 250

`w`

​string

Weighted average price

Example: 0.0018

`x`

​string

First trade(F)-1 price (first trade before the 24hr rolling window)

Example: 0.0009

`c`

​string

Last price

Example: 0.0025

`Q`

​string

Last quantity

Example: 10

`b`

​string

Best bid price

Example: 0.0024

`B`

​string

Best bid quantity

Example: 10

`a`

​string

Best ask price

Example: 0.0026

`A`

​string

Best ask quantity

Example: 100

`o`

​string

Open price

Example: 0.001

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.001

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

`O`

​integer · int64

Statistics open time

Example: 0

`C`

​integer · int64

Statistics close time

Example: 1675216573749

`F`

​integer · int64

First trade ID

Example: 0

`L`

​integer · int64

Last trade Id

Example: 18150

`n`

​integer · int64

Total number of trades

Example: 18151

WSS{symbol}@ticker

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@ticker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@ticker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "24hrTicker",
 "E": 1672515782136,
 "s": "BNBBTC",
 "p": 0.0015,
 "P": 250,
 "w": 0.0018,
 "x": 0.0009,
 "c": 0.0025,
 "Q": 10,
 "b": 0.0024,
 "B": 10,
 "a": 0.0026,
 "A": 100,
 "o": 0.001,
 "h": 0.0025,
 "l": 0.001,
 "v": 10000,
 "q": 18,
 "O": 0,
 "C": 1675216573749,
 "F": 0,
 "L": 18150,
 "n": 18151
}`

json

application/json

---

## Trade Streams

The Trade Streams push raw trade information; each trade has a unique
buyer and seller.

WSS

{symbol}@trade

wss://stream.binance.com:9443

Update SpeedReal-time

### Trade Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Trade Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@trade`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@trade`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@trade"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Trade Streams › Responses

Raw StreamCombined Stream

Trade Streams

`e`

​string

Event type

Example: trade

`E`

​integer · int64

Event time

Example: 1672515782136

`s`

​string

Symbol

Example: BNBBTC

`t`

​integer · int64

Trade ID

Example: 12345

`p`

​string

Price

Example: 0.001

`q`

​string

Quantity

Example: 100

`T`

​integer · int64

Trade time

Example: 1672515782136

`m`

​boolean

Is the buyer the market maker?

Example: true

`M`

​boolean

Ignore

Example: true

WSS{symbol}@trade

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@trade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@trade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "trade",
 "E": 1672515782136,
 "s": "BNBBTC",
 "t": 12345,
 "p": 0.001,
 "q": 100,
 "T": 1672515782136,
 "m": true,
 "M": true
}`

json

application/json

---

## Block Trade Streams

Block Trade Streams push block trade information in real-time.

WSS

{symbol}@blockTrade

wss://stream.binance.com:9443

Update SpeedReal-time

### Block Trade Streams › Stream parameters

`symbol`

​string · required

Symbol to query

Example: bnbusdt

### Block Trade Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://stream.binance.com:9443/ws/{symbol}@blockTrade`
* **Combined stream via URL:** `wss://stream.binance.com:9443/stream?streams={symbol}@blockTrade`
* **Combined stream via request:** Connect to `wss://stream.binance.com:9443/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["bnbusdt@blockTrade"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Block Trade Streams › Responses

Raw StreamCombined Stream

Block Trade Streams

`e`

​string

Event type

Example: blockTrade

`E`

​integer · int64

Event time

Example: 1772506983582

`s`

​string

Symbol

Example: BNBBTC

`t`

​integer · int64

Block Trade ID

Example: 582

`p`

​string

Price

Example: 0.052

`q`

​string

Quantity

Example: 5838

`T`

​integer · int64

Trade time

Example: 1772506983321

`m`

​boolean

Is the buyer the maker?

Example: true

WSS{symbol}@blockTrade

Loading…

`wscat -c wss://stream.binance.com:9443//stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@blockTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "bnbusdt@blockTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "blockTrade",
 "E": 1772506983582,
 "s": "BNBBTC",
 "t": 582,
 "p": "0.052",
 "q": "5838",
 "T": 1772506983321,
 "m": true
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas -->

# Schemas | Binance Developer Docs

Spot REST API

Spot REST API

# Schemas

API Information

---

## myFiltersResponse

`exchangeFilters`

​array

`symbolFilters`

​array

`assetFilters`

​array

`rateLimits`

​object[]

## exchangeFilters

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| EXCHANGE\_MAX\_NUM\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ORDER\_LISTS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDER\_LISTS" |

**Properties for EXCHANGE\_MAX\_NUM\_ORDERS:**

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 1000

## symbolFilters

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| PRICE\_FILTER | type = object · filterType="PRICE\_FILTER" |
| PERCENT\_PRICE | type = object · filterType="PERCENT\_PRICE" |
| PERCENT\_PRICE\_BY\_SIDE | type = object · filterType="PERCENT\_PRICE\_BY\_SIDE" |
| LOT\_SIZE | type = object · filterType="LOT\_SIZE" |
| MIN\_NOTIONAL | type = object · filterType="MIN\_NOTIONAL" |
| NOTIONAL | type = object · filterType="NOTIONAL" |
| ICEBERG\_PARTS | type = object · filterType="ICEBERG\_PARTS" |
| MARKET\_LOT\_SIZE | type = object · filterType="MARKET\_LOT\_SIZE" |
| MAX\_NUM\_ORDERS | type = object · filterType="MAX\_NUM\_ORDERS" |
| MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="MAX\_NUM\_ALGO\_ORDERS" |
| MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="MAX\_NUM\_ICEBERG\_ORDERS" |
| MAX\_POSITION | type = object · filterType="MAX\_POSITION" |
| TRAILING\_DELTA | type = object · filterType="TRAILING\_DELTA" |
| T\_PLUS\_SELL | type = object · filterType="T\_PLUS\_SELL" |
| MAX\_NUM\_ORDER\_LISTS | type = object · filterType="MAX\_NUM\_ORDER\_LISTS" |
| MAX\_NUM\_ORDER\_AMENDS | type = object · filterType="MAX\_NUM\_ORDER\_AMENDS" |

**Properties for PRICE\_FILTER:**

`filterType`

​string

Example: PRICE\_FILTER

`priceExponent`

​integer

Example: 8

`minPrice`

​string

Example: 0.00000100

`maxPrice`

​string

Example: 100000.00000000

`tickSize`

​string

Example: 0.00000100

## assetFilters

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| MAX\_ASSET | type = object · filterType="MAX\_ASSET" |

**Properties for MAX\_ASSET:**

`filterType`

​string

Example: MAX\_ASSET

`qtyExponent`

​integer

Example: 8

`limit`

​string

Example: 100.00000000

`asset`

​string

Example: BNB

## ExchangeMaxNumOrdersFilter

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 1000

## ExchangeMaxNumAlgoOrdersFilter

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS

`maxNumAlgoOrders`

​integer · int64

Example: 200

## ExchangeMaxNumIcebergOrdersFilter

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS

`maxNumIcebergOrders`

​integer · int64

Example: 10

## ExchangeMaxNumOrderListsFilter

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDER\_LISTS

`maxNumOrderLists`

​integer · int64

Example: 20

## PriceFilter

`filterType`

​string

Example: PRICE\_FILTER

`priceExponent`

​integer

Example: 8

`minPrice`

​string

Example: 0.00000100

`maxPrice`

​string

Example: 100000.00000000

`tickSize`

​string

Example: 0.00000100

## PercentPriceFilter

`filterType`

​string

Example: PERCENT\_PRICE

`multiplierExponent`

​integer

Example: 4

`multiplierUp`

​string

Example: 1.3000

`multiplierDown`

​string

Example: 0.7000

`avgPriceMins`

​integer

Example: 5

## PercentPriceBySideFilter

`filterType`

​string

Example: PERCENT\_PRICE\_BY\_SIDE

`multiplierExponent`

​integer

Example: 4

`bidMultiplierUp`

​string

Example: 1.2000

`bidMultiplierDown`

​string

Example: 0.8000

`askMultiplierUp`

​string

Example: 1.2000

`askMultiplierDown`

​string

Example: 0.8000

`avgPriceMins`

​integer

Example: 5

## LotSizeFilter

`filterType`

​string

Example: LOT\_SIZE

`qtyExponent`

​integer

Example: 8

`minQty`

​string

Example: 0.00010000

`maxQty`

​string

Example: 100000.00000000

`stepSize`

​string

Example: 0.00010000

## MinNotionalFilter

`filterType`

​string

Example: MIN\_NOTIONAL

`priceExponent`

​integer

Example: 8

`minNotional`

​string

Example: 10.00000000

`applyToMarket`

​boolean

Example: true

`avgPriceMins`

​integer

Example: 5

## NotionalFilter

`filterType`

​string

Example: NOTIONAL

`priceExponent`

​integer

Example: 8

`minNotional`

​string

Example: 10.00000000

`applyMinToMarket`

​boolean

Example: true

`maxNotional`

​string

Example: 100000.00000000

`applyMaxToMarket`

​boolean

Example: false

`avgPriceMins`

​integer

Example: 5

## IcebergPartsFilter

`filterType`

​string

Example: ICEBERG\_PARTS

`limit`

​integer · int64

Example: 10

## MarketLotSizeFilter

`filterType`

​string

Example: MARKET\_LOT\_SIZE

`qtyExponent`

​integer

Example: 8

`minQty`

​string

Example: 0.00000000

`maxQty`

​string

Example: 1000.00000000

`stepSize`

​string

Example: 0.00000000

## MaxNumOrdersFilter

`filterType`

​string

Example: MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 200

## MaxNumAlgoOrdersFilter

`filterType`

​string

Example: MAX\_NUM\_ALGO\_ORDERS

`maxNumAlgoOrders`

​integer · int64

Example: 10

## MaxNumIcebergOrdersFilter

`filterType`

​string

Example: MAX\_NUM\_ICEBERG\_ORDERS

`maxNumIcebergOrders`

​integer · int64

Example: 5

## MaxPositionFilter

`filterType`

​string

Example: MAX\_POSITION

`qtyExponent`

​integer

Example: 8

`maxPosition`

​string

Example: 100.00000000

## TrailingDeltaFilter

`filterType`

​string

Example: TRAILING\_DELTA

`minTrailingAboveDelta`

​integer · int64

Example: 10

`maxTrailingAboveDelta`

​integer · int64

Example: 2000

`minTrailingBelowDelta`

​integer · int64

Example: 10

`maxTrailingBelowDelta`

​integer · int64

Example: 2000

## TPlusSellFilter

`filterType`

​string

Example: T\_PLUS\_SELL

`endTime`

​integer · int64

Example: 1741672924895

## MaxNumOrderListsFilter

`filterType`

​string

Example: MAX\_NUM\_ORDER\_LISTS

`maxNumOrderLists`

​integer · int64

Example: 20

## MaxNumOrderAmendsFilter

`filterType`

​string

Example: MAX\_NUM\_ORDER\_AMENDS

`maxNumOrderAmends`

​integer · int64

Example: 10

## MaxAssetFilter

`filterType`

​string

Example: MAX\_ASSET

`qtyExponent`

​integer

Example: 8

`limit`

​string

Example: 100.00000000

`asset`

​string

Example: BNB

## rateLimits

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

## exchangeInfoResponse

`timezone`

​string

Example: UTC

`serverTime`

​integer · int64

Example: 1565246363776

`rateLimits`

​object[]

`exchangeFilters`

​array

`symbols`

​object[]

`sors`

​object[]

Optional. Present only when SOR is available.

On this page

* [myFiltersResponse](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#myfiltersresponse)
* [exchangeFilters](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#exchangefilters)
* [symbolFilters](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#symbolfilters)
* [assetFilters](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#assetfilters)
* [ExchangeMaxNumOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#exchangemaxnumordersfilter)
* [ExchangeMaxNumAlgoOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#exchangemaxnumalgoordersfilter)
* [ExchangeMaxNumIcebergOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#exchangemaxnumicebergordersfilter)
* [ExchangeMaxNumOrderListsFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#exchangemaxnumorderlistsfilter)
* [PriceFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#pricefilter)
* [PercentPriceFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#percentpricefilter)
* [PercentPriceBySideFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#percentpricebysidefilter)
* [LotSizeFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#lotsizefilter)
* [MinNotionalFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#minnotionalfilter)
* [NotionalFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#notionalfilter)
* [IcebergPartsFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#icebergpartsfilter)
* [MarketLotSizeFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#marketlotsizefilter)
* [MaxNumOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#maxnumordersfilter)
* [MaxNumAlgoOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#maxnumalgoordersfilter)
* [MaxNumIcebergOrdersFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#maxnumicebergordersfilter)
* [MaxPositionFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#maxpositionfilter)
* [TrailingDeltaFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#trailingdeltafilter)
* [TPlusSellFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#tplussellfilter)
* [MaxNumOrderListsFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#maxnumorderlistsfilter)
* [MaxNumOrderAmendsFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#maxnumorderamendsfilter)
* [MaxAssetFilter](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#maxassetfilter)
* [rateLimits](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#ratelimits)
* [exchangeInfoResponse](/en/docs/catalog/core-trading-spot-trading/api/rest-api/~schemas#exchangeinforesponse)

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market -->

# Market - Spot REST API | Binance Developer Docs

Spot REST API

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [REST API](/en/docs/catalog/core-trading-spot-trading/api/rest-api)

# Market

Endpoint

https://api.binance.comhttps://api-gcp.binance.comhttps://api1.binance.comhttps://api2.binance.comhttps://api3.binance.comhttps://api4.binance.comhttps://demo-api.binance.comhttps://data-api.binance.visionhttps://testnet.binance.visionhttps://api1.testnet.binance.vision

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/rest-api/1.0.0/schema.yaml)

---

## Compressed/Aggregate trades list

Get compressed, aggregate trades. Trades that fill at the time, from the same taker order, with the same price will have the quantity aggregated.

GET

/api/v3/aggTrades

https://api.binance.com

### Compressed/Aggregate trades list › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight4

### Compressed/Aggregate trades list › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

`fromId`

​integer · int64

ID to get aggregate trades from INCLUSIVE.

Example: 1

`startTime`

​integer · int64

Timestamp in ms to get aggregate trades from INCLUSIVE.

Example: 1735693200000

`endTime`

​integer · int64

Timestamp in ms to get aggregate trades until INCLUSIVE.

Example: 1735693200000

`limit`

​integer · max: 1000

Example: 1

Default: 500

**Data Source:** Database

* If fromId, startTime, and endTime are not sent, the most recent aggregate trades will be returned.

### Compressed/Aggregate trades list › Responses

200

Compressed/Aggregate trades list

​object

`a`

​integer · int64

Aggregate tradeId

Example: 26129

`p`

​string

Price

Example: 0.01633102

`q`

​string

Quantity

Example: 4.70443515

`f`

​integer · int64

First tradeId

Example: 27781

`l`

​integer · int64

Last tradeId

Example: 27781

`T`

​integer · int64

Timestamp

Example: 1498793709153

`m`

​boolean

Was the buyer the maker?

Example: true

`M`

​boolean

Was the trade the best price match?

Example: true

GET/api/v3/aggTrades

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/aggTrades?symbol=%3Cstring%3E'`

Example Responses

200

`[
 {
 "a": 26129,
 "p": "0.01633102",
 "q": "4.70443515",
 "f": 27781,
 "l": 27781,
 "T": 1498793709153,
 "m": true,
 "M": true
 }
]`

json

application/json

---

## Current average price

Current average price for a symbol.

GET

/api/v3/avgPrice

https://api.binance.com

### Current average price › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight2

### Current average price › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

**Data Source:** Memory

### Current average price › Responses

200

Current average price

`mins`

​integer · int64

Average price interval (in minutes)

Example: 5

`price`

​string

Average price

Example: 9.35751834

`closeTime`

​integer · int64

Last trade time

Example: 1694061154503

GET/api/v3/avgPrice

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/avgPrice?symbol=%3Cstring%3E'`

Example Responses

200

`{
 "mins": 5,
 "price": "9.35751834",
 "closeTime": 1694061154503
}`

json

application/json

---

## Order book

Order book

GET

/api/v3/depth

https://api.binance.com

### Order book › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

Adjusted based on the limit:

| Limit | Request Weight |
| --- | --- |
| 1-100 | 5 |
| 101-500 | 25 |
| 501-1000 | 50 |
| 1001-5000 | 250 |

### Order book › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

`limit`

​integer · max: 5000

If limit > 5000, only 5000 entries will be returned.

Example: 1

Default: 100

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`.
A status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

### Order book › Responses

200

Order book

`lastUpdateId`

​integer · int64

Example: 1027024

`bids`

​array[]

Bid orders. Each entry is [price, quantity].

Example: [["4.00000000","431.00000000"]]

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price

Example: 4.00000000

`[1]`

​string · required

Quantity

Example: 431.00000000

`asks`

​array[]

Ask orders. Each entry is [price, quantity].

Example: [["4.00000200","12.00000000"]]

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price

Example: 4.00000200

`[1]`

​string · required

Quantity

Example: 12.00000000

GET/api/v3/depth

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/depth?symbol=%3Cstring%3E'`

Example Responses

200

`{
 "lastUpdateId": 1027024,
 "bids": [
 [
 "4.00000000",
 "431.00000000"
 ]
 ],
 "asks": [
 [
 "4.00000200",
 "12.00000000"
 ]
 ]
}`

json

application/json

---

## Recent trades list

Get recent trades.

GET

/api/v3/trades

https://api.binance.com

### Recent trades list › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight25

### Recent trades list › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

`limit`

​integer · max: 1000

Example: 1

Default: 500

**Data Source:** Memory

### Recent trades list › Responses

200

Recent trades list

​object

`id`

​integer · int64

Example: 28457

`price`

​string

Example: 4.00000100

`qty`

​string

Example: 12.00000000

`quoteQty`

​string

Example: 48.000012

`time`

​integer · int64

Example: 1499865549590

`isBuyerMaker`

​boolean

Example: true

`isBestMatch`

​boolean

Example: true

GET/api/v3/trades

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/trades?symbol=%3Cstring%3E'`

Example Responses

200

`[
 {
 "id": 28457,
 "price": "4.00000100",
 "qty": "12.00000000",
 "quoteQty": "48.000012",
 "time": 1499865549590,
 "isBuyerMaker": true,
 "isBestMatch": true
 }
]`

json

application/json

---

## Old trade lookup

Get older trades.

GET

/api/v3/historicalTrades

https://api.binance.com

### Old trade lookup › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight25

### Old trade lookup › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

`limit`

​integer · max: 1000

Example: 1

Default: 500

`fromId`

​integer · int64

TradeId to fetch from. Default gets most recent trades.

Example: 1

**Data Source:** Database

### Old trade lookup › Responses

200

Old trade lookup

​object

`id`

​integer · int64

Example: 28457

`price`

​string

Example: 4.00000100

`qty`

​string

Example: 12.00000000

`quoteQty`

​string

Example: 48.000012

`time`

​integer · int64

Example: 1499865549590

`isBuyerMaker`

​boolean

Example: true

`isBestMatch`

​boolean

Example: true

GET/api/v3/historicalTrades

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/historicalTrades?symbol=%3Cstring%3E'`

Example Responses

200

`[
 {
 "id": 28457,
 "price": "4.00000100",
 "qty": "12.00000000",
 "quoteQty": "48.000012",
 "time": 1499865549590,
 "isBuyerMaker": true,
 "isBestMatch": true
 }
]`

json

application/json

---

## Historical Block Trades (MARKET\_DATA)

Get block trades.

GET

/api/v3/historicalBlockTrades

https://api.binance.com

### Historical Block Trades (MARKET\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight25

### Historical Block Trades (MARKET\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Historical Block Trades (MARKET\_DATA) › Query Parameters

`symbol`

​string · required

Example: BNBBTC

`fromId`

​integer · int64 · required

Block trade ID to fetch from

Example: 582

`limit`

​integer · int64 · max: 1000

Default: 500; Maximum: 1000

Example: 500

Default: 500

* Data Source: Database

### Historical Block Trades (MARKET\_DATA) › Responses

200

Historical Block Trades

​object

`id`

​integer · int64

Example: 582

`price`

​string

Example: 0.052

`qty`

​string

Example: 5838

`quoteQty`

​string

Example: 303.576

`time`

​integer · int64

Example: 1772506983321

`isBuyerMaker`

​boolean

Example: true

GET/api/v3/historicalBlockTrades

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/historicalBlockTrades?symbol=%3Cstring%3E&fromId=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "id": 582,
 "price": "0.052",
 "qty": "5838",
 "quoteQty": "303.576",
 "time": 1772506983321,
 "isBuyerMaker": true
 }
]`

json

application/json

---

## Kline/Candlestick data

Kline/candlestick bars for a symbol.
Klines are uniquely identified by their open time.

GET

/api/v3/klines

https://api.binance.com

### Kline/Candlestick data › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight2

### Kline/Candlestick data › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

`interval`

​string · enum · required

Enum values:

1s

1m

3m

5m

15m

30m

1h

2h

show 8 more

Example: 1s

`startTime`

​integer · int64

Example: 1735693200000

`endTime`

​integer · int64

Example: 1735693200000

`timeZone`

​string

Default: 0 (UTC)

Example: 0

`limit`

​integer · max: 1000

Example: 1

Default: 500

**Data Source:** Database

Supported kline intervals (case-sensitive):

| Interval | `interval` value |
| --- | --- |
| seconds | `1s` |
| minutes | `1m`, `3m`, `5m`, `15m`, `30m` |
| hours | `1h`, `2h`, `4h`, `6h`, `8h`, `12h` |
| days | `1d`, `3d` |
| weeks | `1w` |
| months | `1M` |

**Notes:**

* If `startTime` and `endTime` are not sent, the most recent klines are returned.
* Supported values for `timeZone`:
  + Hours and minutes (e.g. `-1:00`, `05:45`)
  + Only hours (e.g. `0`, `8`, `4`)
  + Accepted range is strictly [-12:00 to +14:00] inclusive
* If `timeZone` provided, kline intervals are interpreted in that timezone instead of UTC.
* Note that `startTime` and `endTime` are always interpreted in UTC, regardless of `timeZone`.

### Kline/Candlestick data › Responses

200

Kline/Candlestick data

​array[]

​tuple[12] · minItems: 12 · maxItems: 12

`[0]`

​integer · int64 · required

Open time

Example: 1499040000000

`[1]`

​string · required

Open

Example: 0.01634790

`[2]`

​string · required

High

Example: 0.80000000

`[3]`

​string · required

Low

Example: 0.01575800

`[4]`

​string · required

Close

Example: 0.01577100

`[5]`

​string · required

Volume

Example: 148976.11427815

`[6]`

​integer · int64 · required

Close time

Example: 1499644799999

`[7]`

​string · required

Quote asset volume

Example: 2434.19055334

`[8]`

​integer · required

Number of trades

Example: 308

`[9]`

​string · required

Taker buy base asset volume

Example: 1756.87402397

`[10]`

​string · required

Taker buy quote asset volume

Example: 28.46694368

`[11]`

​string · required

Ignore

Example: 0

GET/api/v3/klines

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/klines?symbol=%3Cstring%3E&interval=%3Cstring%3E'`

Example Responses

200

`[
 [
 1499040000000,
 "0.01634790",
 "0.80000000",
 "0.01575800",
 "0.01577100",
 "148976.11427815",
 1499644799999,
 "2434.19055334",
 308,
 "1756.87402397",
 "28.46694368",
 "0"
 ]
]`

json

application/json

---

## Rolling window price change statistics

**Note:** This endpoint differs from `GET /api/v3/ticker/24hr`.

The statistical time range of this endpoint can be up to 59999ms longer
than the requested `windowSize`.

`openTime` starts at the beginning of a minute, while the end time is
the current time. Therefore, the actual interval can be up to 59999ms
longer than the requested window.

For example, if `closeTime` is 1641287867099 (January 04, 2022
09:17:47:099 UTC) and `windowSize` is `1d`, then `openTime` is
1641201420000 (January 3, 2022, 09:17:00 UTC).

GET

/api/v3/ticker

https://api.binance.com

### Rolling window price change statistics › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

4 for each requested symbol regardless of windowSize.

The weight for this request will cap at 200 once the number of `symbols` in the request is more than 50.

### Rolling window price change statistics › Query Parameters

`symbol`

​string

Either `symbol` or `symbols` must be provided

Example: BNBUSDT

`symbols`

​string[]

Either `symbol` or `symbols` must be provided

Examples of accepted format for the `symbols` parameter: ["BTCUSDT","BNBUSDT"] or %5B%22BTCUSDT%22,%22BNBUSDT%22%5D

The maximum number of symbols allowed in a request is 100.

Example: ["BTCUSDT","BNBUSDT"]

`windowSize`

​string · enum

Units cannot be combined (e.g. `1d2h` is not allowed).

Enum values:

1m

2m

3m

4m

5m

6m

7m

8m

show 81 more

Example: 1m

Default: 1d

`type`

​string · enum

Enum values:

FULL

MINI

Example: FULL

Default: FULL

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`.
For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`.
For multiple symbols, non-matching ones are simply excluded from the response.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Database

### Rolling window price change statistics › Responses

200

Rolling window price change statistics

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| Variant 1 | type = object |
| Variant 2 | type = array |

**Properties for Variant 1:**

`symbol`

​string

Example: LTCBTC

`priceChange`

​string

Absolute price change

Example: -8

`priceChangePercent`

​string

Relative price change in percent

Example: -88.889

`weightedAvgPrice`

​string

QuoteVolume / Volume

Example: 2.60427807

`openPrice`

​string

Example: 0.1

`highPrice`

​string

Example: 2

`lowPrice`

​string

Example: 0.1

`lastPrice`

​string

Example: 2

`volume`

​string

Example: 39

`quoteVolume`

​string

Sum of (price \* volume) for all trades

Example: 13.4

`openTime`

​integer · int64

Open time for ticker window

Example: 1656986580000

`closeTime`

​integer · int64

Close time for ticker window

Example: 1657001016795

`firstId`

​integer · int64

Trade IDs

Example: 0

`lastId`

​integer · int64

Example: 34

`count`

​integer · int64

Number of trades in the interval

Example: 35

GET/api/v3/ticker

Loading…

`curl --request GET \
 --url https://api.binance.com/api/v3/ticker`

Example Responses

200

`{
 "symbol": "LTCBTC",
 "priceChange": -8,
 "priceChangePercent": -88.889,
 "weightedAvgPrice": 2.60427807,
 "openPrice": 0.1,
 "highPrice": 2,
 "lowPrice": 0.1,
 "lastPrice": 2,
 "volume": 39,
 "quoteVolume": 13.4,
 "openTime": 1656986580000,
 "closeTime": 1657001016795,
 "firstId": 0,
 "lastId": 34,
 "count": 35
}`

json

application/json

---

## 24hr ticker price change statistics

24 hour rolling window price change statistics. **Careful** when accessing this with no symbol.

GET

/api/v3/ticker/24hr

https://api.binance.com

### 24hr ticker price change statistics › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

| Parameter | Symbols Provided | Weight |
| --- | --- | --- |
| symbol | 1 | 2 |
| symbol parameter is omitted | 80 |
| symbols | 1-20 | 2 |
| 21-100 | 40 |
| 101 or more | 80 |
| symbols parameter is omitted | 80 |

### 24hr ticker price change statistics › Query Parameters

`symbol`

​string

Either `symbol` or `symbols` must be provided

Example: BNBUSDT

`symbols`

​string[]

Either `symbol` or `symbols` must be provided

Examples of accepted format for the `symbols` parameter: ["BTCUSDT","BNBUSDT"] or %5B%22BTCUSDT%22,%22BNBUSDT%22%5D

The maximum number of symbols allowed in a request is 100.

Example: ["BTCUSDT","BNBUSDT"]

`type`

​string · enum

Enum values:

FULL

MINI

Example: FULL

Default: FULL

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`.
For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`.
For multiple symbols, non-matching ones are simply excluded from the response.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

### 24hr ticker price change statistics › Responses

200

24hr ticker price change statistics

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| Variant 1 | type = object |
| Variant 2 | type = array |

**Properties for Variant 1:**

`symbol`

​string

Symbol Name

Example: BNBBTC

`priceChange`

​string

Example: -94.999998

`priceChangePercent`

​string

Example: -95.96

`weightedAvgPrice`

​string

Example: 0.29628482

`prevClosePrice`

​string

Example: 0.10002

`lastPrice`

​string

Closing price of the interval

Example: 4.000002

`lastQty`

​string

Example: 200

`bidPrice`

​string

Example: 4

`bidQty`

​string

Example: 100

`askPrice`

​string

Example: 4.000002

`askQty`

​string

Example: 100

`openPrice`

​string

Opening price of the Interval

Example: 99

`highPrice`

​string

Highest price in the interval

Example: 100

`lowPrice`

​string

Lowest price in the interval

Example: 0.1

`volume`

​string

Total trade volume (in base asset)

Example: 8913.3

`quoteVolume`

​string

Total trade volume (in quote asset)

Example: 15.3

`openTime`

​integer · int64

Start of the ticker interval

Example: 1499783499040

`closeTime`

​integer · int64

End of the ticker interval

Example: 1499869899040

`firstId`

​integer · int64

First tradeId

Example: 28385

`lastId`

​integer · int64

Last tradeId

Example: 28460

`count`

​integer · int64

Trade count

Example: 76

GET/api/v3/ticker/24hr

Loading…

`curl --request GET \
 --url https://api.binance.com/api/v3/ticker/24hr`

Example Responses

200

`{
 "symbol": "BNBBTC",
 "priceChange": -94.999998,
 "priceChangePercent": -95.96,
 "weightedAvgPrice": 0.29628482,
 "prevClosePrice": 0.10002,
 "lastPrice": 4.000002,
 "lastQty": 200,
 "bidPrice": 4,
 "bidQty": 100,
 "askPrice": 4.000002,
 "askQty": 100,
 "openPrice": 99,
 "highPrice": 100,
 "lowPrice": 0.1,
 "volume": 8913.3,
 "quoteVolume": 15.3,
 "openTime": 1499783499040,
 "closeTime": 1499869899040,
 "firstId": 28385,
 "lastId": 28460,
 "count": 76
}`

json

application/json

---

## Symbol order book ticker

Best price/qty on the order book for a symbol or symbols.

GET

/api/v3/ticker/bookTicker

https://api.binance.com

### Symbol order book ticker › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

| Parameter | Symbols Provided | Weight |
| --- | --- | --- |
| symbol | 1 | 2 |
|  | omitted | 4 |
| symbols | Any | 4 |

### Symbol order book ticker › Query Parameters

`symbol`

​string

Parameter symbol and symbols cannot be used in combination.
If neither parameter is sent, `bookTickers` for all symbols will be returned in an array.

Example: BNBUSDT

`symbols`

​string[]

Parameter symbol and symbols cannot be used in combination.
If neither parameter is sent, `bookTickers` for all symbols will be returned in an array.
Examples of accepted format for the symbols parameter: ["BTCUSDT","BNBUSDT"] or %5B%22BTCUSDT%22,%22BNBUSDT%22%5D

Example: ["BTCUSDT","BNBUSDT"]

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`.
For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`.
For multiple or all symbols, non-matching ones are simply excluded from the response.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

### Symbol order book ticker › Responses

200

Symbol order book ticker

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| Variant 1 | type = object |
| Variant 2 | type = array |

**Properties for Variant 1:**

`symbol`

​string

Example: LTCBTC

`bidPrice`

​string

best bid price.

Example: 4

`bidQty`

​string

bid/ask qty.

Example: 431

`askPrice`

​string

best ask price.

Example: 4.000002

`askQty`

​string

bid/ask qty.

Example: 9

GET/api/v3/ticker/bookTicker

Loading…

`curl --request GET \
 --url https://api.binance.com/api/v3/ticker/bookTicker`

Example Responses

200

`{
 "symbol": "LTCBTC",
 "bidPrice": 4,
 "bidQty": 431,
 "askPrice": 4.000002,
 "askQty": 9
}`

json

application/json

---

## Symbol price ticker

Latest price for a symbol or symbols.

GET

/api/v3/ticker/price

https://api.binance.com

### Symbol price ticker › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

| Parameter | Symbols Provided | Weight |
| --- | --- | --- |
| symbol | 1 | 2 |
|  | omitted | 4 |
| symbols | Any | 4 |

### Symbol price ticker › Query Parameters

`symbol`

​string

Parameter symbol and symbols cannot be used in combination.
If neither parameter is sent, prices for all symbols will be returned in an array.

Example: BNBUSDT

`symbols`

​string[]

Parameter symbol and symbols cannot be used in combination.
If neither parameter is sent, prices for all symbols will be returned in an array.
Examples of accepted format for the symbols parameter: ["BTCUSDT","BNBUSDT"] or %5B%22BTCUSDT%22,%22BNBUSDT%22%5D

Example: ["BTCUSDT","BNBUSDT"]

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`.
For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`.
For multiple or all symbols, non-matching ones are simply excluded from the response.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

### Symbol price ticker › Responses

200

Symbol price ticker

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| Variant 1 | type = object |
| Variant 2 | type = array |

**Properties for Variant 1:**

`symbol`

​string

Example: LTCBTC

`price`

​string

Example: 4.000002

GET/api/v3/ticker/price

Loading…

`curl --request GET \
 --url https://api.binance.com/api/v3/ticker/price`

Example Responses

200

`{
 "symbol": "LTCBTC",
 "price": 4.000002
}`

json

application/json

---

## Trading Day Ticker

Price change statistics for a trading day.

GET

/api/v3/ticker/tradingDay

https://api.binance.com

### Trading Day Ticker › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

4 for each requested symbol. The weight for this request will cap at 200 once the number of symbols in the request is more than 50.

### Trading Day Ticker › Query Parameters

`symbol`

​string

Either `symbol` or `symbols` must be provided.

Example: BNBUSDT

`symbols`

​string[]

Either `symbol` or `symbols` must be provided.
Examples of accepted format for the `symbols` parameter: ["BTCUSDT","BNBUSDT"] or %5B%22BTCUSDT%22,%22BNBUSDT%22%5D.
The maximum number of `symbols` allowed in a request is 100.

Example: ["BTCUSDT","BNBUSDT"]

`timeZone`

​string

Default: 0 (UTC)

Example: 0

Default: 0

`type`

​string · enum

Enum values:

FULL

MINI

Example: FULL

Default: FULL

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`.
For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`.
For multiple symbols, non-matching ones are simply excluded from the response.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Database

**Notes:**:

* Supported values for `timeZone`:
  + Hours and minutes (e.g. `-1:00`, `05:45`)
  + Only hours (e.g. `0`, `8`, `4`)

### Trading Day Ticker › Responses

200

Trading Day Ticker

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| Variant 1 | type = object |
| Variant 2 | type = array |

**Properties for Variant 1:**

`symbol`

​string

Example: BTCUSDT

`priceChange`

​string

Absolute price change

Example: -83.13

`priceChangePercent`

​string

Relative price change in percent

Example: -0.317

`weightedAvgPrice`

​string

quoteVolume / volume

Example: 26234.58803036

`openPrice`

​string

Example: 26304.8

`highPrice`

​string

Example: 26397.46

`lowPrice`

​string

Example: 26088.34

`lastPrice`

​string

Example: 26221.67

`volume`

​string

Volume in base asset

Example: 18495.35066

`quoteVolume`

​string

Volume in quote asset

Example: 485217905.0421048

`openTime`

​integer · int64

Example: 1695686400000

`closeTime`

​integer · int64

Example: 1695772799999

`firstId`

​integer · int64

Trade ID of the first trade in the interval

Example: 3220151555

`lastId`

​integer · int64

Trade ID of the last trade in the interval

Example: 3220849281

`count`

​integer · int64

Number of trades in the interval

Example: 697727

GET/api/v3/ticker/tradingDay

Loading…

`curl --request GET \
 --url https://api.binance.com/api/v3/ticker/tradingDay`

Example Responses

200

`{
 "symbol": "BTCUSDT",
 "priceChange": -83.13,
 "priceChangePercent": -0.317,
 "weightedAvgPrice": 26234.58803036,
 "openPrice": 26304.8,
 "highPrice": 26397.46,
 "lowPrice": 26088.34,
 "lastPrice": 26221.67,
 "volume": 18495.35066,
 "quoteVolume": 485217905.0421048,
 "openTime": 1695686400000,
 "closeTime": 1695772799999,
 "firstId": 3220151555,
 "lastId": 3220849281,
 "count": 697727
}`

json

application/json

---

## UIKlines

The request is similar to klines having the same parameters and
response.

`uiKlines` return modified kline data, optimized for presentation of
candlestick charts.

GET

/api/v3/uiKlines

https://api.binance.com

### UIKlines › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight2

### UIKlines › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

`interval`

​string · enum · required

Enum values:

1s

1m

3m

5m

15m

30m

1h

2h

show 8 more

Example: 1s

`startTime`

​integer · int64

Example: 1735693200000

`endTime`

​integer · int64

Example: 1735693200000

`timeZone`

​string

Default: 0 (UTC)

Example: 0

Default: 0

`limit`

​integer · max: 1000

Example: 1

Default: 500

**Data Source:** Database

* If `startTime` and `endTime` are not sent, the most recent klines are returned.
* Supported values for `timeZone`:
  + Hours and minutes (e.g. `-1:00`, `05:45`)
  + Only hours (e.g. `0`, `8`, `4`)
  + Accepted range is strictly [-12:00 to +14:00] inclusive
* If `timeZone` provided, kline intervals are interpreted in that timezone instead of UTC.
* Note that `startTime` and `endTime` are always interpreted in UTC, regardless of `timeZone`.

### UIKlines › Responses

200

UIKlines

​array[]

​tuple[12] · minItems: 12 · maxItems: 12

`[0]`

​integer · int64 · required

Open time

Example: 1499040000000

`[1]`

​string · required

Open

Example: 0.01634790

`[2]`

​string · required

High

Example: 0.80000000

`[3]`

​string · required

Low

Example: 0.01575800

`[4]`

​string · required

Close

Example: 0.01577100

`[5]`

​string · required

Volume

Example: 148976.11427815

`[6]`

​integer · int64 · required

Close time

Example: 1499644799999

`[7]`

​string · required

Quote asset volume

Example: 2434.19055334

`[8]`

​integer · required

Number of trades

Example: 308

`[9]`

​string · required

Taker buy base asset volume

Example: 1756.87402397

`[10]`

​string · required

Taker buy quote asset volume

Example: 28.46694368

`[11]`

​string · required

Ignore

Example: 0

GET/api/v3/uiKlines

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/uiKlines?symbol=%3Cstring%3E&interval=%3Cstring%3E'`

Example Responses

200

`[
 [
 1499040000000,
 "0.01634790",
 "0.80000000",
 "0.01575800",
 "0.01577100",
 "148976.11427815",
 1499644799999,
 "2434.19055334",
 308,
 "1756.87402397",
 "28.46694368",
 "0"
 ]
]`

json

application/json

---

## Query Reference Price

Query the reference price for a symbol.

GET

/api/v3/referencePrice

https://api.binance.com

### Query Reference Price › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight2

### Query Reference Price › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

**Data Source:** Memory

### Query Reference Price › Responses

200

Reference price

`symbol`

​string

Example: BAZUSD

`referencePrice`

​string

Reference price. Can be `null` if no reference price is set.

Example: 10.00

`timestamp`

​integer · int64

Timestamp when reference price was valid.

Example: 1770736694138

GET/api/v3/referencePrice

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/referencePrice?symbol=%3Cstring%3E'`

Example Responses

200

`{
 "symbol": "BAZUSD",
 "referencePrice": "10.00",
 "timestamp": 1770736694138
}`

json

application/json

---

## Query Reference Price Calculation

Describes how reference price is calculated for a given symbol.

GET

/api/v3/referencePrice/calculation

https://api.binance.com

### Query Reference Price Calculation › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight2

### Query Reference Price Calculation › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

`symbolStatus`

​string · enum

Supported values: `TRADING`, `HALT`, `BREAK`

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

### Query Reference Price Calculation › Responses

200

Reference price calculation

`symbol`

​string

Example: BAZUSD

`calculationType`

​string

Either `ARITHMETIC_MEAN` or `EXTERNAL`.

Example: ARITHMETIC\_MEAN

`bucketCount`

​integer · int64

Present when calculationType is ARITHMETIC\_MEAN.

Example: 10

`bucketWidthMs`

​integer · int64

Present when calculationType is ARITHMETIC\_MEAN.

Example: 1000

`externalCalculationId`

​integer · int64

Present when calculationType is EXTERNAL.

Example: 42

GET/api/v3/referencePrice/calculation

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/referencePrice/calculation?symbol=%3Cstring%3E'`

Example Responses

200

`{
 "symbol": "BAZUSD",
 "calculationType": "ARITHMETIC_MEAN",
 "bucketCount": 10,
 "bucketWidthMs": 1000,
 "externalCalculationId": 42
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-api/market -->

# Market - Spot WebSocket API | Binance Developer Docs

Spot WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [WebSocket API](/en/docs/catalog/core-trading-spot-trading/api/ws-api)

# Market

Endpoint

wss://ws-api.binance.com:443/ws-api/v3wss://demo-ws-api.binance.com:443/ws-api/v3wss://ws-api.testnet.binance.vision:443/ws-api/v3

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/ws-api/1.0.0/schema.yaml)

---

## Current average price

Get current average price for a symbol.

WSS

avgPrice

wss://ws-api.binance.com:443/ws-api/v3

### Current average price › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight2

### Current average price › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

avgPrice

Example: avgPrice

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

**Data Source:** Memory

### Current average price › Responses

Successful Response

Current average price

`id`

​string

Example: ddbfb65f-9ebf-42ec-8240-8f0f91de0867

`status`

​integer · int64

Example: 200

`result`

​object

`mins`

​integer · int64

Average price interval (in minutes)

Example: 5

`price`

​string

Average price

Example: 0.01378135

`closeTime`

​integer · int64

Last trade time

Example: 1694061154503

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSavgPrice

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "avgPrice",
 "params": {
 "symbol": "BNBUSDT"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "avgPrice",
 "params": {
 "symbol": "BNBUSDT"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "ddbfb65f-9ebf-42ec-8240-8f0f91de0867",
 "status": 200,
 "result": {
 "mins": 5,
 "price": 0.01378135,
 "closeTime": 1694061154503
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Order book

Get current order book.

Note that this request returns limited market depth.

If you need to continuously monitor order book updates, please consider using WebSocket Streams:

* `<symbol>@depth<levels>`
* `<symbol>@depth`

You can use `depth` request together with `<symbol>@depth` streams to [maintain a local order book](/en/docs/products/spot/web-socket-streams#how-to-manage-a-local-order-book-correctly).

WSS

depth

wss://ws-api.binance.com:443/ws-api/v3

### Order book › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

Adjusted based on the limit:

| Limit | Request Weight |
| --- | --- |
| 1-100 | 5 |
| 101-500 | 25 |
| 501-1000 | 50 |
| 1001-5000 | 250 |

### Order book › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

depth

Example: depth

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`limit`

​integer · max: 5000

Example: 1

Default: 100

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`.
A status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`.

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

### Order book › Responses

Successful Response

Order book

`id`

​string

Example: 51e2affb-0aba-4821-ba75-f2625006eb43

`status`

​integer · int64

Example: 200

`result`

​object

`lastUpdateId`

​integer · int64

Example: 2731179239

`bids`

​array[]

Bid orders. Each entry is [price, quantity].

Example: [["0.01379900","3.43200000"]]

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price

Example: 0.01379900

`[1]`

​string · required

Quantity

Example: 3.43200000

`asks`

​array[]

Ask orders. Each entry is [price, quantity].

Example: [["0.01380000","5.91700000"]]

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price

Example: 0.01380000

`[1]`

​string · required

Quantity

Example: 5.91700000

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSdepth

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "depth",
 "params": {
 "symbol": "BNBUSDT"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "depth",
 "params": {
 "symbol": "BNBUSDT"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "51e2affb-0aba-4821-ba75-f2625006eb43",
 "status": 200,
 "result": {
 "lastUpdateId": 2731179239,
 "bids": [
 [
 "0.01379900",
 "3.43200000"
 ]
 ],
 "asks": [
 [
 "0.01380000",
 "5.91700000"
 ]
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Klines

Get klines (candlestick bars).

Klines are uniquely identified by their open & close time.

If you need access to real-time kline updates, please consider using WebSocket Streams:

* `<symbol>@kline_<interval>`

If you need historical kline data, please consider using [data.binance.vision](https://github.com/binance/binance-public-data/#klines).

WSS

klines

wss://ws-api.binance.com:443/ws-api/v3

### Klines › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight2

### Klines › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

klines

Example: klines

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`interval`

​string · enum · required

Enum values:

1s

1m

3m

5m

15m

30m

1h

2h

show 8 more

Example: 1s

`startTime`

​integer · int64

Example: 1735693200000

`endTime`

​integer · int64

Example: 1735693200000

`timeZone`

​string

Default: 0 (UTC)

Example: 0

`limit`

​integer · max: 1000

Example: 1

Default: 500

**Data Source:** Database

Supported kline intervals (case-sensitive):

| Interval | `interval` value |
| --- | --- |
| seconds | `1s` |
| minutes | `1m`, `3m`, `5m`, `15m`, `30m` |
| hours | `1h`, `2h`, `4h`, `6h`, `8h`, `12h` |
| days | `1d`, `3d` |
| weeks | `1w` |
| months | `1M` |

**Notes:**

* If `startTime` and `endTime` are not sent, the most recent klines are returned.
* Supported values for `timeZone`:
  + Hours and minutes (e.g. `-1:00`, `05:45`)
  + Only hours (e.g. `0`, `8`, `4`)
  + Accepted range is strictly [-12:00 to +14:00] inclusive
* If `timeZone` provided, kline intervals are interpreted in that timezone instead of UTC.
* Note that `startTime` and `endTime` are always interpreted in UTC, regardless of `timeZone`.

### Klines › Responses

Successful Response

Klines

`id`

​string

Example: 1dbbeb56-8eea-466a-8f6e-86bdcfa2fc0b

`status`

​integer · int64

Example: 200

`result`

​array[]

​tuple[12] · minItems: 12 · maxItems: 12

`[0]`

​integer · int64 · required

Open time

Example: 1499040000000

`[1]`

​string · required

Open

Example: 0.01634790

`[2]`

​string · required

High

Example: 0.80000000

`[3]`

​string · required

Low

Example: 0.01575800

`[4]`

​string · required

Close

Example: 0.01577100

`[5]`

​string · required

Volume

Example: 148976.11427815

`[6]`

​integer · int64 · required

Close time

Example: 1499644799999

`[7]`

​string · required

Quote asset volume

Example: 2434.19055334

`[8]`

​integer · required

Number of trades

Example: 308

`[9]`

​string · required

Taker buy base asset volume

Example: 1756.87402397

`[10]`

​string · required

Taker buy quote asset volume

Example: 28.46694368

`[11]`

​string · required

Ignore

Example: 0

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSklines

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "klines",
 "params": {
 "symbol": "BNBUSDT",
 "interval": "1s"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "klines",
 "params": {
 "symbol": "BNBUSDT",
 "interval": "1s"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "1dbbeb56-8eea-466a-8f6e-86bdcfa2fc0b",
 "status": 200,
 "result": [
 [
 1499040000000,
 "0.01634790",
 "0.80000000",
 "0.01575800",
 "0.01577100",
 "148976.11427815",
 1499644799999,
 "2434.19055334",
 308,
 "1756.87402397",
 "28.46694368",
 "0"
 ]
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Rolling window price change statistics

Get rolling window price change statistics with a custom window.

This request is similar to `ticker.24hr` but statistics are computed on demand using the arbitrary window you specify.

**Note:** Window size precision is limited to 1 minute.
While the `closeTime` is the current time of the request, `openTime` always start on a minute boundary.
As such, the effective window might be up to 59999 ms wider than the requested `windowSize`.

Window computation example

For example, a request for `"windowSize": "7d"` might result in the following window:

```
JavascriptCode



{
    "openTime": 1659580020000,
    "closeTime": 1660184865291
}
```

Time of the request – `closeTime` – is 1660184865291 (August 11, 2022 02:27:45.291).
Requested window size should put the `openTime` 7 days before that – August 4, 02:27:45.291 –
but due to limited precision it ends up a bit earlier: 1659580020000 (August 4, 2022 02:27:00),
exactly at the start of a minute.

If you need to continuously monitor trading statistics, please consider using WebSocket Streams:

* `<symbol>@ticker_<window_size>` or `!ticker_<window-size>@arr`

WSS

ticker

wss://ws-api.binance.com:443/ws-api/v3

### Rolling window price change statistics › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

Adjusted based on the number of requested symbols:

| Symbols | Weight |
| --- | --- |
| 1–50 | 4 per symbol |
| 51–100 | 200 |

### Rolling window price change statistics › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

ticker

Example: ticker

`params`

​object

`symbol`

​string

Query ticker of a single symbol

Example: BNBUSDT

`symbols`

​string[]

Query ticker for multiple symbols

`type`

​string · enum

Ticker type. Supported values: FULL (default) or MINI

Enum values:

FULL

MINI

Example: FULL

`windowSize`

​string · enum

Defaults to 1d if no parameter provided.

Enum values:

1m

2m

3m

4m

5m

6m

7m

8m

show 81 more

Example: 1d

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`. For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`. For multiple or all symbols, non-matching ones are simply excluded from the response. Valid values: `TRADING`, `HALT`, `BREAK`

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Database

Supported window sizes:

| Unit | `windowSize` value |
| --- | --- |
| minutes | `1m`, `2m` ... `59m` |
| hours | `1h`, `2h` ... `23h` |
| days | `1d`, `2d` ... `7d` |

Notes:

* Either `symbol` or `symbols` must be specified.
* Maximum number of symbols in one request: 200.
* Window size units cannot be combined.
  E.g., `1d 2h` is not supported.

### Rolling window price change statistics › Responses

Successful Response

Rolling window price change statistics

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| Variant 1 | type = object |
| Variant 2 | type = object |

**Properties for Variant 1:**

`id`

​string

Example: bdb7c503-542c-495c-b797-4d2ee2e91173

`status`

​integer · int64

Example: 200

`result`

​object

`rateLimits`

​object[]

WSSticker

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "bdb7c503-542c-495c-b797-4d2ee2e91173",
 "status": 200,
 "result": {
 "symbol": "BNBBTC",
 "priceChange": 0.000615,
 "priceChangePercent": 4.735,
 "weightedAvgPrice": 0.01368242,
 "openPrice": 0.012989,
 "highPrice": 0.014188,
 "lowPrice": 0.01296,
 "lastPrice": 0.013604,
 "volume": 587179.239,
 "quoteVolume": 8034.03382165,
 "openTime": 1659580020000,
 "closeTime": 1660184865291,
 "firstId": 192977765,
 "lastId": 195365758,
 "count": 2387994
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## 24hr ticker price change statistics

Get 24-hour rolling window price change statistics.

If you need to continuously monitor trading statistics, please consider using WebSocket Streams:

* `<symbol>@ticker` or `!ticker@arr`
* `<symbol>@miniTicker` or `!miniTicker@arr`

If you need different window sizes,

use the `ticker` request.

WSS

ticker.24hr

wss://ws-api.binance.com:443/ws-api/v3

### 24hr ticker price change statistics › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

Adjusted based on the number of requested symbols:

| Parameter | Symbols Provided | Weight |
| --- | --- | --- |
| symbol | 1 | 2 |
|  | omitted | 80 |
| symbols | 1-20 | 2 |
|  | 21-100 | 40 |
|  | 101+ | 80 |
|  | omitted | 80 |

### 24hr ticker price change statistics › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

ticker.24hr

Example: ticker.24hr

`params`

​object

`symbol`

​string

Example: BNBUSDT

`symbols`

​string[]

`type`

​string · enum

Ticker type. Supported values: FULL (default) or MINI

Enum values:

FULL

MINI

Example: FULL

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`. For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`. For multiple or all symbols, non-matching ones are simply excluded from the response. Valid values: `TRADING`, `HALT`, `BREAK`

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

Notes:

* `symbol` and `symbols` cannot be used together.
* If no symbol is specified, returns information about all symbols currently trading on the exchange.

### 24hr ticker price change statistics › Responses

Successful Response

24hr ticker price change statistics

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| Variant 1 | type = object |
| Variant 2 | type = object |

**Properties for Variant 1:**

`id`

​string

Example: 9fa2a91b-3fca-4ed7-a9ad-58e3b67483de

`status`

​integer · int64

Example: 200

`result`

​object

`rateLimits`

​object[]

WSSticker.24hr

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker.24hr"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker.24hr"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "9fa2a91b-3fca-4ed7-a9ad-58e3b67483de",
 "status": 200,
 "result": {
 "symbol": "BNBBTC",
 "priceChange": 0.000139,
 "priceChangePercent": 1.02,
 "weightedAvgPrice": 0.01382453,
 "prevClosePrice": 0.013628,
 "lastPrice": 0.013767,
 "lastQty": 1.788,
 "bidPrice": 0.013767,
 "bidQty": 4.646,
 "askPrice": 0.013768,
 "askQty": 14.314,
 "openPrice": 0.013628,
 "highPrice": 0.014149,
 "lowPrice": 0.013466,
 "volume": 69412.405,
 "quoteVolume": 959.59411487,
 "openTime": 1660014164909,
 "closeTime": 1660100564909,
 "firstId": 194696115,
 "lastId": 194968287,
 "count": 272173
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Symbol order book ticker

Get the current best price and quantity on the order book.

If you need access to real-time order book ticker updates, please
consider using WebSocket Streams:

* `<symbol>@bookTicker`

WSS

ticker.book

wss://ws-api.binance.com:443/ws-api/v3

### Symbol order book ticker › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

Adjusted based on the number of requested symbols:

| Parameter | Symbols Provided | Weight |
| --- | --- | --- |
| symbol | 1 | 2 |
|  | omitted | 4 |
| symbols | Any | 4 |

### Symbol order book ticker › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

ticker.book

Example: ticker.book

`params`

​object

`symbol`

​string

Query ticker for a single symbol

Example: BNBUSDT

`symbols`

​string[]

Query ticker for multiple symbols

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`. For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`. For multiple or all symbols, non-matching ones are simply excluded from the response. Valid values: `TRADING`, `HALT`, `BREAK`

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

Notes:

* `symbol` and `symbols` cannot be used together.
* If no symbol is specified, returns information about all symbols currently trading on the exchange.

### Symbol order book ticker › Responses

Successful Response

Symbol order book ticker

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| Variant 1 | type = object |
| Variant 2 | type = object |

**Properties for Variant 1:**

`id`

​string

Example: 9d32157c-a556-4d27-9866-66760a174b57

`status`

​integer · int64

Example: 200

`result`

​object

`rateLimits`

​object[]

WSSticker.book

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker.book"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker.book"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "9d32157c-a556-4d27-9866-66760a174b57",
 "status": 200,
 "result": {
 "symbol": "BNBBTC",
 "bidPrice": 0.01358,
 "bidQty": 12.534,
 "askPrice": 0.013581,
 "askQty": 17.837
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Symbol price ticker

Get the latest market price for a symbol.

If you need access to real-time price updates, please consider using
WebSocket Streams:

* `<symbol>@aggTrade`
* `<symbol>@trade`

WSS

ticker.price

wss://ws-api.binance.com:443/ws-api/v3

### Symbol price ticker › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

Adjusted based on the number of requested symbols:

| Parameter | Symbols Provided | Weight |
| --- | --- | --- |
| symbol | 1 | 2 |
|  | omitted | 4 |
| symbols | Any | 4 |

### Symbol price ticker › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

ticker.price

Example: ticker.price

`params`

​object

`symbol`

​string

Query price for a single symbol

Example: BNBUSDT

`symbols`

​string[]

Query price for multiple symbols

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`. For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`. For multiple or all symbols, non-matching ones are simply excluded from the response. Valid values: `TRADING`, `HALT`, `BREAK`

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Memory

Notes:

* `symbol` and `symbols` cannot be used together.
* If no symbol is specified, returns information about all symbols currently trading on the exchange.

### Symbol price ticker › Responses

Successful Response

Symbol price ticker

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| Variant 1 | type = object |
| Variant 2 | type = object |

**Properties for Variant 1:**

`id`

​string

Example: 043a7cf2-bde3-4888-9604-c8ac41fcba4d

`status`

​integer · int64

Example: 200

`result`

​object

`rateLimits`

​object[]

WSSticker.price

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker.price"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker.price"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "043a7cf2-bde3-4888-9604-c8ac41fcba4d",
 "status": 200,
 "result": {
 "symbol": "BNBBTC",
 "price": 0.013619
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Trading Day Ticker

Price change statistics for a trading day.

WSS

ticker.tradingDay

wss://ws-api.binance.com:443/ws-api/v3

### Trading Day Ticker › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

4 for each requested symbol regardless of windowSize. The weight for this request will cap at 200 once the number of symbols in the request is more than 50.

### Trading Day Ticker › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

ticker.tradingDay

Example: ticker.tradingDay

`params`

​object

`symbol`

​string

Example: BNBUSDT

`symbols`

​string[]

`timeZone`

​string

Default: 0 (UTC)

Example: 0

`type`

​string · enum

Ticker type. Supported values: FULL (default) or MINI

Enum values:

FULL

MINI

Example: FULL

`symbolStatus`

​string · enum

Filters for symbols that have this `tradingStatus`. For a single symbol, a status mismatch returns error `-1220 SYMBOL_DOES_NOT_MATCH_STATUS`. For multiple or all symbols, non-matching ones are simply excluded from the response. Valid values: `TRADING`, `HALT`, `BREAK`

Enum values:

TRADING

HALT

BREAK

Example: TRADING

**Data Source:** Database

**Notes:**

* Supported values for `timeZone`:
  + Hours and minutes (e.g. `-1:00`, `05:45`)
  + Only hours (e.g. `0`, `8`, `4`)

### Trading Day Ticker › Responses

Successful Response

Trading Day Ticker

`id`

​string

Example: f4b3b507-c8f2-442a-81a6-b2f12daa030f

`status`

​integer · int64

Example: 200

`result`

​object[]

`symbol`

​string

Example: BTCUSDT

`priceChange`

​string

Absolute price change

Example: -83.13

`priceChangePercent`

​string

Relative price change in percent

Example: -0.317

`weightedAvgPrice`

​string

quoteVolume / volume

Example: 26234.58803036

`openPrice`

​string

Example: 26304.8

`highPrice`

​string

Example: 26397.46

`lowPrice`

​string

Example: 26088.34

`lastPrice`

​string

Example: 26221.67

`volume`

​string

Volume in base asset

Example: 18495.35066

`quoteVolume`

​string

Volume in quote asset

Example: 485217905.0421048

`openTime`

​integer · int64

Example: 1695686400000

`closeTime`

​integer · int64

Example: 1695772799999

`firstId`

​integer · int64

Trade ID of the first trade in the interval

Example: 3220151555

`lastId`

​integer · int64

Trade ID of the last trade in the interval

Example: 3220849281

`count`

​integer · int64

Number of trades in the interval

Example: 697727

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSticker.tradingDay

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker.tradingDay"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "ticker.tradingDay"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "f4b3b507-c8f2-442a-81a6-b2f12daa030f",
 "status": 200,
 "result": [
 {
 "symbol": "BTCUSDT",
 "priceChange": -83.13,
 "priceChangePercent": -0.317,
 "weightedAvgPrice": 26234.58803036,
 "openPrice": 26304.8,
 "highPrice": 26397.46,
 "lowPrice": 26088.34,
 "lastPrice": 26221.67,
 "volume": 18495.35066,
 "quoteVolume": 485217905.0421048,
 "openTime": 1695686400000,
 "closeTime": 1695772799999,
 "firstId": 3220151555,
 "lastId": 3220849281,
 "count": 697727
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Aggregate trades

Get aggregate trades.

An *aggregate trade* (aggtrade) represents one or more individual
trades.

Trades that fill at the same time, from the same taker order, with the
same price –

those trades are collected into an aggregate trade with total quantity
of the individual trades.

If you need access to real-time trading activity, please consider using
WebSocket Streams:

* `<symbol>@aggTrade`

If you need historical aggregate trade data, please consider using [data.binance.vision](https://github.com/binance/binance-public-data/#aggtrades).

WSS

trades.aggregate

wss://ws-api.binance.com:443/ws-api/v3

### Aggregate trades › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight4

### Aggregate trades › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

trades.aggregate

Example: trades.aggregate

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`fromId`

​integer · int64

Aggregate trade ID to begin at

Example: 1

`startTime`

​integer · int64

Timestamp in ms to get aggregate trades from INCLUSIVE.

Example: 1735693200000

`endTime`

​integer · int64

Timestamp in ms to get aggregate trades until INCLUSIVE.

Example: 1735693200000

`limit`

​integer · max: 1000

Example: 1

Default: 500

**Data Source:** Database

* If `fromId` is specified, return aggtrades with aggregate trade ID >= `fromId`. Use `fromId` and `limit` to page through all aggtrades.
* If `startTime` and/or `endTime` are specified, aggtrades are filtered by execution time (`T`). `fromId` cannot be used together with `startTime` and `endTime`.
* If no condition is specified, the most recent aggregate trades are returned.

### Aggregate trades › Responses

Successful Response

Aggregate trades

`id`

​string

Example: 189da436-d4bd-48ca-9f95-9f613d621717

`status`

​integer · int64

Example: 200

`result`

​object[]

`a`

​integer · int64

Aggregate tradeId

Example: 50000000

`p`

​string

Price

Example: 0.002741

`q`

​string

Quantity

Example: 57.19

`f`

​integer · int64

First tradeId

Example: 59120167

`l`

​integer · int64

Last tradeId

Example: 59120170

`T`

​integer · int64

Timestamp

Example: 1565877971222

`m`

​boolean

Was the buyer the maker?

Example: true

`M`

​boolean

Was the trade the best price match?

Example: true

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSStrades.aggregate

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "trades.aggregate",
 "params": {
 "symbol": "BNBUSDT"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "trades.aggregate",
 "params": {
 "symbol": "BNBUSDT"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "189da436-d4bd-48ca-9f95-9f613d621717",
 "status": 200,
 "result": [
 {
 "a": 50000000,
 "p": 0.002741,
 "q": 57.19,
 "f": 59120167,
 "l": 59120170,
 "T": 1565877971222,
 "m": true,
 "M": true
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Historical trades

Get historical trades.

WSS

trades.historical

wss://ws-api.binance.com:443/ws-api/v3

### Historical trades › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight25

### Historical trades › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

trades.historical

Example: trades.historical

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`fromId`

​integer · int64

Trade ID to begin at

Example: 1

`limit`

​integer · max: 1000

Example: 1

Default: 500

**Data Source:** Database

Notes:

* If `fromId` is not specified, the most recent trades are returned.

### Historical trades › Responses

Successful Response

Historical trades

`id`

​string

Example: cffc9c7d-4efc-4ce0-b587-6b87448f052a

`status`

​integer · int64

Example: 200

`result`

​object[]

`id`

​integer · int64

Example: 0

`price`

​string

Example: 0.00005

`qty`

​string

Example: 40

`quoteQty`

​string

Example: 0.002

`time`

​integer · int64

Example: 1500004800376

`isBuyerMaker`

​boolean

Example: true

`isBestMatch`

​boolean

Example: true

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSStrades.historical

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "trades.historical",
 "params": {
 "symbol": "BNBUSDT"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "trades.historical",
 "params": {
 "symbol": "BNBUSDT"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "cffc9c7d-4efc-4ce0-b587-6b87448f052a",
 "status": 200,
 "result": [
 {
 "id": 0,
 "price": 0.00005,
 "qty": 40,
 "quoteQty": 0.002,
 "time": 1500004800376,
 "isBuyerMaker": true,
 "isBestMatch": true
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Historical Block Trades

Get block trades.

WSS

blockTrades.historical

wss://ws-api.binance.com:443/ws-api/v3

### Historical Block Trades › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight25

### Historical Block Trades › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

blockTrades.historical

Example: blockTrades.historical

`params`

​object · required

`symbol`

​string · required

Example: BNBBTC

`fromId`

​integer · int64 · required

Block trade ID to fetch from

Example: 582

`limit`

​integer · int64 · max: 1000

Default: 500; Maximum: 1000

Example: 500

Default: 500

* Data Source: Database

### Historical Block Trades › Responses

Successful Response

Historical Block Trades

`id`

​string

Example: cffc9c7d-4efc-4ce0-b587-6b87448f052a

`status`

​integer

Example: 200

`result`

​object[]

`id`

​integer · int64

Example: 582

`price`

​string

Example: 0.052

`qty`

​string

Example: 5838

`quoteQty`

​string

Example: 303.576

`time`

​integer · int64

Example: 1772506983321

`isBuyerMaker`

​boolean

Example: true

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer

Example: 1

`limit`

​integer

Example: 6000

`count`

​integer

Example: 10

WSSblockTrades.historical

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "blockTrades.historical",
 "params": {
 "symbol": "BNBBTC",
 "fromId": 582
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "blockTrades.historical",
 "params": {
 "symbol": "BNBBTC",
 "fromId": 582
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "cffc9c7d-4efc-4ce0-b587-6b87448f052a",
 "status": 200,
 "result": [
 {
 "id": 582,
 "price": "0.052",
 "qty": "5838",
 "quoteQty": "303.576",
 "time": 1772506983321,
 "isBuyerMaker": true
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 10
 }
 ]
}`

json

application/json

---

## Recent trades

Get recent trades.

If you need access to real-time trading activity, please consider using
WebSocket Streams:

* `<symbol>@trade`

WSS

trades.recent

wss://ws-api.binance.com:443/ws-api/v3

### Recent trades › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight25

### Recent trades › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

trades.recent

Example: trades.recent

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`limit`

​integer · max: 1000

Example: 1

Default: 500

**Data Source:** Memory

### Recent trades › Responses

Successful Response

Recent trades

`id`

​string

Example: 409a20bd-253d-41db-a6dd-687862a5882f

`status`

​integer · int64

Example: 200

`result`

​object[]

`id`

​integer · int64

Example: 194686783

`price`

​string

Example: 0.01361

`qty`

​string

Example: 0.014

`quoteQty`

​string

Example: 0.00019054

`time`

​integer · int64

Example: 1660009530807

`isBuyerMaker`

​boolean

Example: true

`isBestMatch`

​boolean

Example: true

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSStrades.recent

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "trades.recent",
 "params": {
 "symbol": "BNBUSDT"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "trades.recent",
 "params": {
 "symbol": "BNBUSDT"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "409a20bd-253d-41db-a6dd-687862a5882f",
 "status": 200,
 "result": [
 {
 "id": 194686783,
 "price": 0.01361,
 "qty": 0.014,
 "quoteQty": 0.00019054,
 "time": 1660009530807,
 "isBuyerMaker": true,
 "isBestMatch": true
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## UI Klines

Get klines (candlestick bars) optimized for presentation.

This request is similar to `klines`, having the same parameters and response. `uiKlines` return modified kline data, optimized for presentation of candlestick charts.

WSS

uiKlines

wss://ws-api.binance.com:443/ws-api/v3

### UI Klines › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight2

### UI Klines › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

uiKlines

Example: uiKlines

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`interval`

​string · enum · required

Enum values:

1s

1m

3m

5m

15m

30m

1h

2h

show 8 more

Example: 1s

`startTime`

​integer · int64

Example: 1735693200000

`endTime`

​integer · int64

Example: 1735693200000

`timeZone`

​string

Default: 0 (UTC)

Example: 0

`limit`

​integer · max: 1000

Example: 1

Default: 500

**Data Source:** Database

* If `startTime` and `endTime` are not sent, the most recent klines are returned.
* Supported values for `timeZone`:
  + Hours and minutes (e.g. `-1:00`, `05:45`)
  + Only hours (e.g. `0`, `8`, `4`)
  + Accepted range is strictly [-12:00 to +14:00] inclusive
* If `timeZone` provided, kline intervals are interpreted in that timezone instead of UTC.
* Note that `startTime` and `endTime` are always interpreted in UTC, regardless of `timeZone`.

### UI Klines › Responses

Successful Response

UI Klines

`id`

​string

Example: b137468a-fb20-4c06-bd6b-625148eec958

`status`

​integer · int64

Example: 200

`result`

​array[]

​tuple[12] · minItems: 12 · maxItems: 12

`[0]`

​integer · int64 · required

Open time

Example: 1499040000000

`[1]`

​string · required

Open

Example: 0.01634790

`[2]`

​string · required

High

Example: 0.80000000

`[3]`

​string · required

Low

Example: 0.01575800

`[4]`

​string · required

Close

Example: 0.01577100

`[5]`

​string · required

Volume

Example: 148976.11427815

`[6]`

​integer · int64 · required

Close time

Example: 1499644799999

`[7]`

​string · required

Quote asset volume

Example: 2434.19055334

`[8]`

​integer · required

Number of trades

Example: 308

`[9]`

​string · required

Taker buy base asset volume

Example: 1756.87402397

`[10]`

​string · required

Taker buy quote asset volume

Example: 28.46694368

`[11]`

​string · required

Ignore

Example: 0

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSuiKlines

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "uiKlines",
 "params": {
 "symbol": "BNBUSDT",
 "interval": "1s"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "uiKlines",
 "params": {
 "symbol": "BNBUSDT",
 "interval": "1s"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "b137468a-fb20-4c06-bd6b-625148eec958",
 "status": 200,
 "result": [
 [
 1499040000000,
 "0.01634790",
 "0.80000000",
 "0.01575800",
 "0.01577100",
 "148976.11427815",
 1499644799999,
 "2434.19055334",
 308,
 "1756.87402397",
 "28.46694368",
 "0"
 ]
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Query Reference Price

Query Reference Price

WSS

referencePrice

wss://ws-api.binance.com:443/ws-api/v3

### Query Reference Price › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight2

### Query Reference Price › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

referencePrice

Example: referencePrice

`params`

​object · required

`symbol`

​string · required

Example: BAZUSD

**Data Source:** Memory

### Query Reference Price › Responses

Successful Response

Query Reference Price

`id`

​string

Example: ddbfb65f-9ebf-42ec-8240-8f0f91de0867

`status`

​integer · int64

Example: 200

`result`

​object

`symbol`

​string

Example: BAZUSD

`referencePrice`

​string

Example: 0.00501900

`timestamp`

​integer · int64

Timestamp when the reference price was valid

Example: 1770946889251

`code`

​integer · int64

Example: -2043

`msg`

​string

Example: This symbol doesn't have a reference price.

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSreferencePrice

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "referencePrice",
 "params": {
 "symbol": "BAZUSD"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "referencePrice",
 "params": {
 "symbol": "BAZUSD"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "ddbfb65f-9ebf-42ec-8240-8f0f91de0867",
 "status": 200,
 "result": {
 "symbol": "BAZUSD",
 "referencePrice": "0.00501900",
 "timestamp": 1770946889251,
 "code": -2043,
 "msg": "This symbol doesn't have a reference price."
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Query Reference Price Calculation

Query Reference Price Calculation

WSS

referencePrice.calculation

wss://ws-api.binance.com:443/ws-api/v3

### Query Reference Price Calculation › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight2

### Query Reference Price Calculation › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

referencePrice.calculation

Example: referencePrice.calculation

`params`

​object · required

`symbol`

​string · required

Example: BAZUSD

`symbolStatus`

​string · enum

Enum values:

TRADING

HALT

BREAK

Example: BAZUSD

**Data Source:** Memory

### Query Reference Price Calculation › Responses

Successful Response

Query Reference Price Calculation

`id`

​string

Example: ddbfb65f-9ebf-42ec-8240-8f0f91de0867

`status`

​integer · int64

Example: 200

`result`

​object

`symbol`

​string

Example: BAZUSD

`calculationType`

​string

Example: ARITHMETIC\_MEAN

`bucketCount`

​integer · int64

If the reference price is being calculated by the matching engine as an arithmetic mean

Example: 10

`bucketWidthMs`

​integer · int64

If the reference price is being calculated by the matching engine as an arithmetic mean

Example: 1000

`externalCalculationId`

​integer · int64

If the reference price is being calculated outside the matching engine

Example: 42

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSreferencePrice.calculation

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "referencePrice.calculation",
 "params": {
 "symbol": "BAZUSD"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "referencePrice.calculation",
 "params": {
 "symbol": "BAZUSD"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "ddbfb65f-9ebf-42ec-8240-8f0f91de0867",
 "status": 200,
 "result": {
 "symbol": "BAZUSD",
 "calculationType": "ARITHMETIC_MEAN",
 "bucketCount": 10,
 "bucketWidthMs": 1000,
 "externalCalculationId": 42
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account -->

# Account - Spot REST API | Binance Developer Docs

Spot REST API

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [REST API](/en/docs/catalog/core-trading-spot-trading/api/rest-api)

# Account

Endpoint

https://api.binance.comhttps://api-gcp.binance.comhttps://api1.binance.comhttps://api2.binance.comhttps://api3.binance.comhttps://api4.binance.comhttps://demo-api.binance.comhttps://data-api.binance.visionhttps://testnet.binance.visionhttps://api1.testnet.binance.vision

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/rest-api/1.0.0/schema.yaml)

---

## Query Commission Rates (USER\_DATA)

Get current account commission rates.

GET

/api/v3/account/commission

https://api.binance.com

### Query Commission Rates (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query Commission Rates (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight20

### Query Commission Rates (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Commission Rates (USER\_DATA) › Query Parameters

`symbol`

​string · required

Example: BTCUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

**Data Source:** Database

### Query Commission Rates (USER\_DATA) › Responses

200

Query Commission Rates

`symbol`

​string

Example: BTCUSDT

`standardCommission`

​object

Commission rates on trades from the order.

Commission rates on trades from the order.

`maker`

​string

Example: 0.00000010

`taker`

​string

Example: 0.00000020

`buyer`

​string

Example: 0.00000030

`seller`

​string

Example: 0.00000040

`specialCommission`

​object

Special commission rates from the order.

Special commission rates from the order.

`maker`

​string

Example: 0.01000000

`taker`

​string

Example: 0.02000000

`buyer`

​string

Example: 0.03000000

`seller`

​string

Example: 0.04000000

`taxCommission`

​object

Tax commission rates for trades from the order.

Tax commission rates for trades from the order.

`maker`

​string

Example: 0.00000112

`taker`

​string

Example: 0.00000114

`buyer`

​string

Example: 0.00000118

`seller`

​string

Example: 0.00000116

`discount`

​object

Discount commission when paying in BNB

Discount commission when paying in BNB

`enabledForAccount`

​boolean

Example: true

`enabledForSymbol`

​boolean

Example: true

`discountAsset`

​string

Example: BNB

`discount`

​string

Standard commission is reduced by this rate when paying commission in BNB.

Example: 0.75000000

GET/api/v3/account/commission

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/account/commission?symbol=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "symbol": "BTCUSDT",
 "standardCommission": {
 "maker": "0.00000010",
 "taker": "0.00000020",
 "buyer": "0.00000030",
 "seller": "0.00000040"
 },
 "specialCommission": {
 "maker": "0.01000000",
 "taker": "0.02000000",
 "buyer": "0.03000000",
 "seller": "0.04000000"
 },
 "taxCommission": {
 "maker": "0.00000112",
 "taker": "0.00000114",
 "buyer": "0.00000118",
 "seller": "0.00000116"
 },
 "discount": {
 "enabledForAccount": true,
 "enabledForSymbol": true,
 "discountAsset": "BNB",
 "discount": "0.75000000"
 }
}`

json

application/json

---

## Query all Order lists (USER\_DATA)

Retrieves all order lists based on provided optional parameters.

Note that the time between `startTime` and `endTime` can't be longer
than 24 hours.

GET

/api/v3/allOrderList

https://api.binance.com

### Query all Order lists (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query all Order lists (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight20

### Query all Order lists (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query all Order lists (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`fromId`

​integer · int64

If supplied, neither startTime or endTime can be provided

Example: 1

`startTime`

​integer · int64

Example: 1735693200000

`endTime`

​integer · int64

Example: 1735693200000

`limit`

​integer · max: 1000

Example: 1

Default: 500

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

### Query all Order lists (USER\_DATA) › Responses

200

Query all Order lists

​object

`orderListId`

​integer · int64

Example: 29

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: amEEAXryFzFwYF1FeRpUoZ

`transactionTime`

​integer · int64

Example: 1565245913483

`symbol`

​string

Example: LTCBTC

`orders`

​object[]

`symbol`

​string

Example: LTCBTC

`orderId`

​integer · int64

Example: 4

`clientOrderId`

​string

Example: oD7aesZqjEGlZrbtRpy5zB

GET/api/v3/allOrderList

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/allOrderList?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "orderListId": 29,
 "contingencyType": "OCO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "amEEAXryFzFwYF1FeRpUoZ",
 "transactionTime": 1565245913483,
 "symbol": "LTCBTC",
 "orders": [
 {
 "symbol": "LTCBTC",
 "orderId": 4,
 "clientOrderId": "oD7aesZqjEGlZrbtRpy5zB"
 }
 ]
 }
]`

json

application/json

---

## All orders (USER\_DATA)

Get all account orders; active, canceled, or filled.

GET

/api/v3/allOrders

https://api.binance.com

### All orders (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### All orders (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight20

### All orders (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### All orders (USER\_DATA) › Query Parameters

`symbol`

​string · required

Example: LTCBTC

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`orderId`

​integer · int64

Example: 1

`startTime`

​integer · int64

Example: 1735693200000

`endTime`

​integer · int64

Example: 1735693200000

`limit`

​integer · max: 1000

Example: 1

Default: 500

`recvWindow`

​number · float

The value cannot be greater than `60000`.   
 Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

* If `orderId` is set, it will get orders >= that `orderId`. Otherwise most recent orders are returned.
* For some historical orders `cummulativeQuoteQty` will be < 0, meaning the data is not available at this time.
* If `startTime` and/or `endTime` provided, `orderId` is not required.
* The time between `startTime` and `endTime` can't be longer than 24 hours.

### All orders (USER\_DATA) › Responses

200

All orders

​object

`symbol`

​string

Example: LTCBTC

`orderId`

​integer · int64

Example: 1

`orderListId`

​integer · int64

Unless it's part of an order list, value will be -1

Example: -1

`clientOrderId`

​string

Example: myOrder1

`price`

​string

Example: 0.1

`origQty`

​string

Example: 1.0

`executedQty`

​string

Example: 0.0

`cummulativeQuoteQty`

​string

Example: 0.0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: BUY

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`time`

​integer · int64

Example: 1499827319559

`updateTime`

​integer · int64

Example: 1499827319559

`isWorking`

​boolean

Example: true

`origQuoteOrderQty`

​string

Example: 0.000000

`workingTime`

​integer · int64

Example: 1499827319559

`selfTradePreventionMode`

​string

Example: NONE

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

GET/api/v3/allOrders

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/allOrders?symbol=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "symbol": "LTCBTC",
 "orderId": 1,
 "orderListId": -1,
 "clientOrderId": "myOrder1",
 "price": "0.1",
 "origQty": "1.0",
 "executedQty": "0.0",
 "cummulativeQuoteQty": "0.0",
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "BUY",
 "stopPrice": "0.00000000",
 "icebergQty": "0.00000000",
 "time": 1499827319559,
 "updateTime": 1499827319559,
 "isWorking": true,
 "origQuoteOrderQty": "0.000000",
 "workingTime": 1499827319559,
 "selfTradePreventionMode": "NONE",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
]`

json

application/json

---

## Account information (USER\_DATA)

Get current account information.

GET

/api/v3/account

https://api.binance.com

### Account information (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Account information (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight20

### Account information (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Account information (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`omitZeroBalances`

​boolean

When set to `true`, emits only the non-zero balances of an account.

Example: false

Default: false

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory => Database

### Account information (USER\_DATA) › Responses

200

Account information

`makerCommission`

​integer · int64

Example: 15

`takerCommission`

​integer · int64

Example: 15

`buyerCommission`

​integer · int64

Example: 0

`sellerCommission`

​integer · int64

Example: 0

`commissionRates`

​object

`maker`

​string

Example: 0.00150000

`taker`

​string

Example: 0.00150000

`buyer`

​string

Example: 0.00000000

`seller`

​string

Example: 0.00000000

`canTrade`

​boolean

Example: true

`canWithdraw`

​boolean

Example: true

`canDeposit`

​boolean

Example: true

`brokered`

​boolean

Example: false

`requireSelfTradePrevention`

​boolean

Example: false

`preventSor`

​boolean

Example: false

`updateTime`

​integer · int64

Example: 123456789

`accountType`

​string

Example: SPOT

`balances`

​object[]

`asset`

​string

Example: BTC

`free`

​string

Example: 4723846.89208129

`locked`

​string

Example: 0.00000000

`permissions`

​string[]

`uid`

​integer · int64

Example: 354937868

GET/api/v3/account

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/account?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "makerCommission": 15,
 "takerCommission": 15,
 "buyerCommission": 0,
 "sellerCommission": 0,
 "commissionRates": {
 "maker": "0.00150000",
 "taker": "0.00150000",
 "buyer": "0.00000000",
 "seller": "0.00000000"
 },
 "canTrade": true,
 "canWithdraw": true,
 "canDeposit": true,
 "brokered": false,
 "requireSelfTradePrevention": false,
 "preventSor": false,
 "updateTime": 123456789,
 "accountType": "SPOT",
 "balances": [
 {
 "asset": "BTC",
 "free": "4723846.89208129",
 "locked": "0.00000000"
 }
 ],
 "permissions": [
 "SPOT"
 ],
 "uid": 354937868
}`

json

application/json

---

## Current open orders (USER\_DATA)

Get all open orders on a symbol. **Careful** when accessing this with no symbol.

GET

/api/v3/openOrders

https://api.binance.com

### Current open orders (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Current open orders (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

6 for a single symbol; 80 when the symbol parameter is omitted

### Current open orders (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Current open orders (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`symbol`

​string

Example: LTCBTC

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory => Database

* If the symbol is not sent, orders for all symbols will be returned in an array.

### Current open orders (USER\_DATA) › Responses

200

Current open orders

​object

`symbol`

​string

Example: LTCBTC

`orderId`

​integer · int64

Example: 1

`orderListId`

​integer · int64

Unless it's part of an order list, value will be -1

Example: -1

`clientOrderId`

​string

Example: myOrder1

`price`

​string

Example: 0.1

`origQty`

​string

Example: 1.0

`executedQty`

​string

Example: 0.0

`origQuoteOrderQty`

​string

Example: 0.000000

`cummulativeQuoteQty`

​string

Example: 0.0

`status`

​string

Example: NEW

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: BUY

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`time`

​integer · int64

Example: 1499827319559

`updateTime`

​integer · int64

Example: 1499827319559

`isWorking`

​boolean

Example: true

`workingTime`

​integer · int64

Example: 1499827319559

`selfTradePreventionMode`

​string

Example: NONE

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

GET/api/v3/openOrders

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/openOrders?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "symbol": "LTCBTC",
 "orderId": 1,
 "orderListId": -1,
 "clientOrderId": "myOrder1",
 "price": "0.1",
 "origQty": "1.0",
 "executedQty": "0.0",
 "origQuoteOrderQty": "0.000000",
 "cummulativeQuoteQty": "0.0",
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "BUY",
 "stopPrice": "0.00000000",
 "icebergQty": "0.00000000",
 "time": 1499827319559,
 "updateTime": 1499827319559,
 "isWorking": true,
 "workingTime": 1499827319559,
 "selfTradePreventionMode": "NONE",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
]`

json

application/json

---

## Query order (USER\_DATA)

Check an order's status.

GET

/api/v3/order

https://api.binance.com

### Query order (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query order (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight4

### Query order (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query order (USER\_DATA) › Query Parameters

`symbol`

​string · required

Example: LTCBTC

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`orderId`

​integer · int64

Example: 1

`origClientOrderId`

​string

Example: myOrder1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory => Database

* Either `orderId` or `origClientOrderId` must be sent.
* If both `orderId` and `origClientOrderId` are provided, the `orderId` is searched first, then the `origClientOrderId` from that result is checked against that order. If both conditions are not met the request will be rejected.
* For some historical orders `cummulativeQuoteQty` will be < 0, meaning the data is not available at this time.

### Query order (USER\_DATA) › Responses

200

Query order

`symbol`

​string

symbol.

Example: LTCBTC

`orderId`

​integer · int64

order Id.

Example: 1

`orderListId`

​integer · int64

This field will always have a value of -1 if not an order list.

Example: -1

`clientOrderId`

​string

client Order Id.

Example: myOrder1

`price`

​string

price.

Example: 0.1

`origQty`

​string

orig Qty.

Example: 1.0

`executedQty`

​string

executed Qty.

Example: 0.0

`origQuoteOrderQty`

​string

orig Quote Order Qty.

Example: 0.000000

`cummulativeQuoteQty`

​string

cummulative Quote Qty.

Example: 0.0

`status`

​string

status.

Example: NEW

`timeInForce`

​string

time In Force.

Example: GTC

`type`

​string

type.

Example: LIMIT

`side`

​string

side.

Example: BUY

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`time`

​integer · int64

time.

Example: 1499827319559

`updateTime`

​integer · int64

update Time.

Example: 1499827319559

`isWorking`

​boolean

is Working.

Example: true

`workingTime`

​integer · int64

working Time.

Example: 1499827319559

`selfTradePreventionMode`

​string

self Trade Prevention Mode.

Example: NONE

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

GET/api/v3/order

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/order?symbol=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "symbol": "LTCBTC",
 "orderId": 1,
 "orderListId": -1,
 "clientOrderId": "myOrder1",
 "price": "0.1",
 "origQty": "1.0",
 "executedQty": "0.0",
 "origQuoteOrderQty": "0.000000",
 "cummulativeQuoteQty": "0.0",
 "status": "NEW",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "BUY",
 "stopPrice": "0.00000000",
 "icebergQty": "0.00000000",
 "time": 1499827319559,
 "updateTime": 1499827319559,
 "isWorking": true,
 "workingTime": 1499827319559,
 "selfTradePreventionMode": "NONE",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
}`

json

application/json

---

## Query Order list (USER\_DATA)

Retrieves a specific order list based on provided optional parameters.

GET

/api/v3/orderList

https://api.binance.com

### Query Order list (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query Order list (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight4

### Query Order list (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Order list (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`orderListId`

​integer · int64

Query order list by `orderListId`. `orderListId` or `origClientOrderId` must be provided.

Example: 27

`origClientOrderId`

​string

Query order list by `listClientOrderId`. `orderListId` or `origClientOrderId` must be provided.

Example: 1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

### Query Order list (USER\_DATA) › Responses

200

Query Order list

`orderListId`

​integer · int64

Example: 27

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: h2USkA5YQpaXHPIrkd96xE

`transactionTime`

​integer · int64

Example: 1565245656253

`symbol`

​string

Example: LTCBTC

`orders`

​object[]

`symbol`

​string

Example: LTCBTC

`orderId`

​integer · int64

Example: 4

`clientOrderId`

​string

Example: qD1gy3kc3Gx0rihm9Y3xwS

GET/api/v3/orderList

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/orderList?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "orderListId": 27,
 "contingencyType": "OCO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "h2USkA5YQpaXHPIrkd96xE",
 "transactionTime": 1565245656253,
 "symbol": "LTCBTC",
 "orders": [
 {
 "symbol": "LTCBTC",
 "orderId": 4,
 "clientOrderId": "qD1gy3kc3Gx0rihm9Y3xwS"
 }
 ]
}`

json

application/json

---

## Query Allocations (USER\_DATA)

Retrieves allocations resulting from SOR order placement.

GET

/api/v3/myAllocations

https://api.binance.com

### Query Allocations (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query Allocations (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight20

### Query Allocations (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Allocations (USER\_DATA) › Query Parameters

`symbol`

​string · required

Example: BTCUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`startTime`

​integer · int64

Example: 1735693200000

`endTime`

​integer · int64

Example: 1735693200000

`fromAllocationId`

​integer

Example: 0

`limit`

​integer · max: 1000

Example: 1

Default: 500

`orderId`

​integer · int64

Example: 1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database"

Supported parameter combinations:

| Parameters | Response |
| --- | --- |
| `symbol` | allocations from oldest to newest |
| `symbol` + `startTime` | oldest allocations since `startTime` |
| `symbol` + `endTime` | newest allocations until `endTime` |
| `symbol` + `startTime` + `endTime` | allocations within the time range |
| `symbol` + `fromAllocationId` | allocations by allocation ID |
| `symbol` + `orderId` | allocations related to an order starting with oldest |
| `symbol` + `orderId` + `fromAllocationId` | allocations related to an order by allocation ID |

**Note:** The time between `startTime` and `endTime` can't be longer than 24 hours.

### Query Allocations (USER\_DATA) › Responses

200

Query Allocations

​object

`symbol`

​string

Example: BTCUSDT

`allocationId`

​integer · int64

Example: 0

`allocationType`

​string

Example: SOR

`orderId`

​integer · int64

Example: 1

`orderListId`

​integer · int64

Example: -1

`price`

​string

Example: 1.00000000

`qty`

​string

Example: 5.00000000

`quoteQty`

​string

Example: 5.00000000

`commission`

​string

Example: 0.00000000

`commissionAsset`

​string

Example: BTC

`time`

​integer · int64

Example: 1687506878118

`isBuyer`

​boolean

Example: true

`isMaker`

​boolean

Example: false

`isAllocator`

​boolean

Example: false

GET/api/v3/myAllocations

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/myAllocations?symbol=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "symbol": "BTCUSDT",
 "allocationId": 0,
 "allocationType": "SOR",
 "orderId": 1,
 "orderListId": -1,
 "price": "1.00000000",
 "qty": "5.00000000",
 "quoteQty": "5.00000000",
 "commission": "0.00000000",
 "commissionAsset": "BTC",
 "time": 1687506878118,
 "isBuyer": true,
 "isMaker": false,
 "isAllocator": false
 }
]`

json

application/json

---

## Query relevant filters (USER\_DATA)

Retrieves the list of filters relevant to an account on a given symbol. This is the only endpoint that shows if an account has `MAX_ASSET` filters applied to it.

GET

/api/v3/myFilters

https://api.binance.com

### Query relevant filters (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query relevant filters (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight40

### Query relevant filters (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query relevant filters (USER\_DATA) › Query Parameters

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory

### Query relevant filters (USER\_DATA) › Responses

200

Query relevant filters

`exchangeFilters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| EXCHANGE\_MAX\_NUM\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ORDER\_LISTS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDER\_LISTS" |

**Properties for EXCHANGE\_MAX\_NUM\_ORDERS:**

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 1000

`symbolFilters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| PRICE\_FILTER | type = object · filterType="PRICE\_FILTER" |
| PERCENT\_PRICE | type = object · filterType="PERCENT\_PRICE" |
| PERCENT\_PRICE\_BY\_SIDE | type = object · filterType="PERCENT\_PRICE\_BY\_SIDE" |
| LOT\_SIZE | type = object · filterType="LOT\_SIZE" |
| MIN\_NOTIONAL | type = object · filterType="MIN\_NOTIONAL" |
| NOTIONAL | type = object · filterType="NOTIONAL" |
| ICEBERG\_PARTS | type = object · filterType="ICEBERG\_PARTS" |
| MARKET\_LOT\_SIZE | type = object · filterType="MARKET\_LOT\_SIZE" |
| MAX\_NUM\_ORDERS | type = object · filterType="MAX\_NUM\_ORDERS" |
| MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="MAX\_NUM\_ALGO\_ORDERS" |
| MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="MAX\_NUM\_ICEBERG\_ORDERS" |
| MAX\_POSITION | type = object · filterType="MAX\_POSITION" |
| TRAILING\_DELTA | type = object · filterType="TRAILING\_DELTA" |
| T\_PLUS\_SELL | type = object · filterType="T\_PLUS\_SELL" |
| MAX\_NUM\_ORDER\_LISTS | type = object · filterType="MAX\_NUM\_ORDER\_LISTS" |
| MAX\_NUM\_ORDER\_AMENDS | type = object · filterType="MAX\_NUM\_ORDER\_AMENDS" |

**Properties for PRICE\_FILTER:**

`filterType`

​string

Example: PRICE\_FILTER

`priceExponent`

​integer

Example: 8

`minPrice`

​string

Example: 0.00000100

`maxPrice`

​string

Example: 100000.00000000

`tickSize`

​string

Example: 0.00000100

`assetFilters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| MAX\_ASSET | type = object · filterType="MAX\_ASSET" |

**Properties for MAX\_ASSET:**

`filterType`

​string

Example: MAX\_ASSET

`qtyExponent`

​integer

Example: 8

`limit`

​string

Example: 100.00000000

`asset`

​string

Example: BNB

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

GET/api/v3/myFilters

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/myFilters?symbol=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "exchangeFilters": [
 {
 "filterType": "EXCHANGE_MAX_NUM_ORDERS",
 "maxNumOrders": 1000
 }
 ],
 "symbolFilters": [
 {
 "filterType": "PRICE_FILTER",
 "priceExponent": 8,
 "minPrice": "0.00000100",
 "maxPrice": "100000.00000000",
 "tickSize": "0.00000100"
 }
 ],
 "assetFilters": [
 {
 "filterType": "MAX_ASSET",
 "qtyExponent": 8,
 "limit": "100.00000000",
 "asset": "BNB"
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Query Prevented Matches (USER\_DATA)

Displays the list of orders that were expired due to STP.

These are the combinations supported:

* `symbol` + `preventedMatchId`
* `symbol` + `orderId`
* `symbol` + `orderId` + `fromPreventedMatchId` (`limit` will default to 500)
* `symbol` + `orderId` + `fromPreventedMatchId` + `limit`

GET

/api/v3/myPreventedMatches

https://api.binance.com

### Query Prevented Matches (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query Prevented Matches (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

| Case | Weight |
| --- | --- |
| If `symbol` is invalid | 2 |
| Querying by `preventedMatchId` | 2 |
| Querying by `orderId` | 20 |

### Query Prevented Matches (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Prevented Matches (USER\_DATA) › Query Parameters

`symbol`

​string · required

Example: BTCUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`preventedMatchId`

​integer · int64

Example: 1

`orderId`

​integer · int64

Example: 1

`fromPreventedMatchId`

​integer · int64

Example: 1

`limit`

​integer · max: 1000

Example: 1

Default: 500

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

### Query Prevented Matches (USER\_DATA) › Responses

200

Query Prevented Matches

​object

`symbol`

​string

Example: BTCUSDT

`preventedMatchId`

​integer · int64

Example: 1

`takerOrderId`

​integer · int64

Example: 5

`makerSymbol`

​string

Example: BTCUSDT

`makerOrderId`

​integer · int64

Example: 3

`tradeGroupId`

​integer · int64

Example: 1

`selfTradePreventionMode`

​string

Example: EXPIRE\_MAKER

`price`

​string

Example: 1.100000

`makerPreventedQuantity`

​string

Example: 1.300000

`transactTime`

​integer · int64

Example: 1669101687094

GET/api/v3/myPreventedMatches

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/myPreventedMatches?symbol=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "symbol": "BTCUSDT",
 "preventedMatchId": 1,
 "takerOrderId": 5,
 "makerSymbol": "BTCUSDT",
 "makerOrderId": 3,
 "tradeGroupId": 1,
 "selfTradePreventionMode": "EXPIRE_MAKER",
 "price": "1.100000",
 "makerPreventedQuantity": "1.300000",
 "transactTime": 1669101687094
 }
]`

json

application/json

---

## Account trade list (USER\_DATA)

Get trades for a specific account and symbol.

GET

/api/v3/myTrades

https://api.binance.com

### Account trade list (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Account trade list (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight

| Condition | Weight |
| --- | --- |
| Without orderId | 20 |
| With orderId | 5 |

### Account trade list (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Account trade list (USER\_DATA) › Query Parameters

`symbol`

​string · required

Example: BNBBTC

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`orderId`

​integer · int64

This can only be used in combination with `symbol`.

Example: 100234

`startTime`

​integer · int64

Example: 1735693200000

`endTime`

​integer · int64

Example: 1735693200000

`fromId`

​integer · int64

TradeId to fetch from. Default gets most recent trades.

Example: 1

`limit`

​integer · max: 1000

Example: 1

Default: 500

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory => Database

**Notes:**:

* If `fromId` is set, it will get trades >= that `fromId`. Otherwise most recent trades are returned.
* The time between `startTime` and `endTime` can't be longer than 24 hours.
* These are the supported combinations of all parameters:
  + `symbol`
  + `symbol` + `orderId`
  + `symbol` + `startTime`
  + `symbol` + `endTime`
  + `symbol` + `fromId`
  + `symbol` + `startTime` + `endTime`
  + `symbol`+ `orderId` + `fromId`

### Account trade list (USER\_DATA) › Responses

200

Account trade list

​object

`symbol`

​string

Example: BNBBTC

`id`

​integer · int64

Example: 28457

`orderId`

​integer · int64

Example: 100234

`orderListId`

​integer · int64

Example: -1

`price`

​string

Example: 4.00000100

`qty`

​string

Example: 12.00000000

`quoteQty`

​string

Example: 48.000012

`commission`

​string

Example: 10.10000000

`commissionAsset`

​string

Example: BNB

`time`

​integer · int64

Example: 1499865549590

`isBuyer`

​boolean

Example: true

`isMaker`

​boolean

Example: false

`isBestMatch`

​boolean

Example: true

GET/api/v3/myTrades

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/myTrades?symbol=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "symbol": "BNBBTC",
 "id": 28457,
 "orderId": 100234,
 "orderListId": -1,
 "price": "4.00000100",
 "qty": "12.00000000",
 "quoteQty": "48.000012",
 "commission": "10.10000000",
 "commissionAsset": "BNB",
 "time": 1499865549590,
 "isBuyer": true,
 "isMaker": false,
 "isBestMatch": true
 }
]`

json

application/json

---

## Query Open Order lists (USER\_DATA)

Query Open Order lists

GET

/api/v3/openOrderList

https://api.binance.com

### Query Open Order lists (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query Open Order lists (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight6

### Query Open Order lists (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Open Order lists (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory -> Database

### Query Open Order lists (USER\_DATA) › Responses

200

Query Open Order lists

​object

`orderListId`

​integer · int64

Example: 31

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: wuB13fmulKj3YjdqWEcsnp

`transactionTime`

​integer · int64

Example: 1565246080644

`symbol`

​string

Example: LTCBTC

`orders`

​object[]

`symbol`

​string

Example: LTCBTC

`orderId`

​integer · int64

Example: 4

`clientOrderId`

​string

Example: r3EH2N76dHfLoSZWIUw1bT

GET/api/v3/openOrderList

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/openOrderList?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "orderListId": 31,
 "contingencyType": "OCO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "wuB13fmulKj3YjdqWEcsnp",
 "transactionTime": 1565246080644,
 "symbol": "LTCBTC",
 "orders": [
 {
 "symbol": "LTCBTC",
 "orderId": 4,
 "clientOrderId": "r3EH2N76dHfLoSZWIUw1bT"
 }
 ]
 }
]`

json

application/json

---

## Query Order Amendments (USER\_DATA)

Queries all amendments of a single order.

GET

/api/v3/order/amendments

https://api.binance.com

### Query Order Amendments (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query Order Amendments (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight4

### Query Order Amendments (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Order Amendments (USER\_DATA) › Query Parameters

`symbol`

​string · required

Example: BTCUSDT

`orderId`

​integer · int64 · required

Example: 9

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`fromExecutionId`

​integer · int64

Example: 22

`limit`

​integer · int64 · max: 1000

Example: 1

Default: 500

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

### Query Order Amendments (USER\_DATA) › Responses

200

Query Order Amendments

​object

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 9

`executionId`

​integer · int64

Example: 22

`origClientOrderId`

​string

Example: W0fJ9fiLKHOJutovPK3oJp

`newClientOrderId`

​string

Example: UQ1Np3bmQ71jJzsSDW9Vpi

`origQty`

​string

Example: 5.00000000

`newQty`

​string

Example: 4.00000000

`time`

​integer · int64

Example: 1741669661670

GET/api/v3/order/amendments

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/order/amendments?symbol=%3Cstring%3E&orderId=%3Cnumber%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "symbol": "BTCUSDT",
 "orderId": 9,
 "executionId": 22,
 "origClientOrderId": "W0fJ9fiLKHOJutovPK3oJp",
 "newClientOrderId": "UQ1Np3bmQ71jJzsSDW9Vpi",
 "origQty": "5.00000000",
 "newQty": "4.00000000",
 "time": 1741669661670
 }
]`

json

application/json

---

## Query Unfilled Order Count (USER\_DATA)

Displays the user's unfilled order count for all intervals.

GET

/api/v3/rateLimit/order

https://api.binance.com

### Query Unfilled Order Count (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/rest-api#request-security)

### Query Unfilled Order Count (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/rest-api#limits) section.

IP Weight40

### Query Unfilled Order Count (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Unfilled Order Count (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory

### Query Unfilled Order Count (USER\_DATA) › Responses

200

Query Unfilled Order Count

​object

`rateLimitType`

​string

Example: ORDERS

`interval`

​string

Example: SECOND

`intervalNum`

​integer · int64

Example: 10

`limit`

​integer · int64

Example: 50

`count`

​integer · int64

Example: 0

GET/api/v3/rateLimit/order

Loading…

`curl --request GET \
 --url 'https://api.binance.com/api/v3/rateLimit/order?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "rateLimitType": "ORDERS",
 "interval": "SECOND",
 "intervalNum": 10,
 "limit": 50,
 "count": 0
 }
]`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-api/user-data-stream -->

# User Data Stream - Spot WebSocket API | Binance Developer Docs

Spot WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [WebSocket API](/en/docs/catalog/core-trading-spot-trading/api/ws-api)

# User Data Stream

Endpoint

wss://ws-api.binance.com:443/ws-api/v3wss://demo-ws-api.binance.com:443/ws-api/v3wss://ws-api.testnet.binance.vision:443/ws-api/v3

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/ws-api/1.0.0/schema.yaml)

---

## Listing all subscriptions

**Note:**

* Users should track the corresponding subscription status of related accounts as needed.

WSS

session.subscriptions

wss://ws-api.binance.com:443/ws-api/v3

### Listing all subscriptions › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight2

### Listing all subscriptions › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

session.subscriptions

Example: session.subscriptions

`params`

​object

**Data Source:** Memory

### Listing all subscriptions › Responses

Successful Response

Listing all subscriptions

`id`

​string

Example: d3df5a22-88ea-4fe0-9f4e-0fcea5d418b7

`status`

​integer · int64

Example: 200

`result`

​object[]

`subscriptionId`

​integer · int64

Example: 0

WSSsession.subscriptions

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "session.subscriptions"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "session.subscriptions"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "d3df5a22-88ea-4fe0-9f4e-0fcea5d418b7",
 "status": 200,
 "result": [
 {
 "subscriptionId": 0
 }
 ]
}`

json

application/json

---

## Subscribe to User Data Stream

Subscribe to the User Data Stream in the current WebSocket connection.

**Notes:**

* This method requires an authenticated WebSocket connection using Ed25519 keys. Please refer to [`session.logon`](/en/docs/catalog/core-trading-spot-trading/api/ws-api/auth#session-logon).
* To check the subscription status, use [`session.status`](/en/docs/catalog/core-trading-spot-trading/api/ws-api/auth#session-status), see the `userDataStream` flag indicating you have have an active subscription.
* User Data Stream events are available in both JSON and [SBE](/en/docs/products/spot/faqs/sbe_faq) sessions.
  + Please refer to [User Data Streams](/en/docs/products/spot/user-data-stream) for the event format details.
  + For SBE, only SBE schema 2:1 or later is supported.

WSS

userDataStream.subscribe

wss://ws-api.binance.com:443/ws-api/v3

### Subscribe to User Data Stream › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight2

### Subscribe to User Data Stream › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

userDataStream.subscribe

Example: userDataStream.subscribe

`params`

​object

### Subscribe to User Data Stream › Responses

Successful Response

Subscribe to User Data Stream

`id`

​string

Example: d3df8a21-98ea-4fe0-8f4e-0fcea5d418b7

`status`

​integer · int64

Example: 200

`result`

​object

`subscriptionId`

​integer · int64

Example: 0

WSSuserDataStream.subscribe

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "userDataStream.subscribe"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "userDataStream.subscribe"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "d3df8a21-98ea-4fe0-8f4e-0fcea5d418b7",
 "status": 200,
 "result": {
 "subscriptionId": 0
 }
}`

json

application/json

---

## Subscribe to User Data Stream through signature subscription (USER\_STREAM)

WSS

userDataStream.subscribe.signature

wss://ws-api.binance.com:443/ws-api/v3

### Subscribe to User Data Stream through signature subscription (USER\_STREAM) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Subscribe to User Data Stream through signature subscription (USER\_STREAM) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight2

### Subscribe to User Data Stream through signature subscription (USER\_STREAM) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

userDataStream.subscribe.signature

Example: userDataStream.subscribe.signature

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory

### Subscribe to User Data Stream through signature subscription (USER\_STREAM) › Responses

Successful Response

Subscribe to User Data Stream through signature subscription

`id`

​string

Example: d3df8a22-98ea-4fe0-9f4e-0fcea5d418b7

`status`

​integer · int64

Example: 200

`result`

​object

`subscriptionId`

​integer · int64

Example: 0

WSSuserDataStream.subscribe.signature

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "userDataStream.subscribe.signature",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "userDataStream.subscribe.signature",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "d3df8a22-98ea-4fe0-9f4e-0fcea5d418b7",
 "status": 200,
 "result": {
 "subscriptionId": 0
 }
}`

json

application/json

---

## WebSocket Unsubscribe from User Data Stream

Stop listening to the User Data Stream in the current WebSocket
connection.

Note that `session.logout` will only close the subscription created with `userDataStream.subscribe` but not subscriptions opened with `userDataStream.subscribe.signature`.

WSS

userDataStream.unsubscribe

wss://ws-api.binance.com:443/ws-api/v3

### WebSocket Unsubscribe from User Data Stream › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight2

### WebSocket Unsubscribe from User Data Stream › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

userDataStream.unsubscribe

Example: userDataStream.unsubscribe

`params`

​object

`subscriptionId`

​integer

When called with no parameter, this will close all subscriptions. When called with the subscriptionId parameter, this will attempt to close the subscription with that subscription id, if it exists.

Example: 1

### WebSocket Unsubscribe from User Data Stream › Responses

Successful Response

Unsubscribe from User Data Stream

`id`

​string

Example: d3df8a21-98ea-4fe0-8f4e-0fcea5d418b7

`status`

​integer · int64

Example: 200

`result`

​object

WSSuserDataStream.unsubscribe

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "userDataStream.unsubscribe"
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "userDataStream.unsubscribe"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "d3df8a21-98ea-4fe0-8f4e-0fcea5d418b7",
 "status": 200,
 "result": {}
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-api/account -->

# Account - Spot WebSocket API | Binance Developer Docs

Spot WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Spot](/en/docs/catalog#core-trading-spot-trading)
3. [WebSocket API](/en/docs/catalog/core-trading-spot-trading/api/ws-api)

# Account

Endpoint

wss://ws-api.binance.com:443/ws-api/v3wss://demo-ws-api.binance.com:443/ws-api/v3wss://ws-api.testnet.binance.vision:443/ws-api/v3

[Download schema](/en/docs/catalog/core-trading-spot-trading/api/ws-api/1.0.0/schema.yaml)

---

## Account Commission Rates (USER\_DATA)

Get current account commission rates.

WSS

account.commission

wss://ws-api.binance.com:443/ws-api/v3

### Account Commission Rates (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Account Commission Rates (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight20

### Account Commission Rates (USER\_DATA) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

account.commission

Example: account.commission

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

**Data Source:** Database

### Account Commission Rates (USER\_DATA) › Responses

Successful Response

Account Commission Rates

`id`

​string

Example: d3df8a61-98ea-4fe0-8f4e-0fcea5d418b0

`status`

​integer · int64

Example: 200

`result`

​object

`symbol`

​string

Example: BTCUSDT

`standardCommission`

​object

Standard commission rates on trades from the order.

Standard commission rates on trades from the order.

`maker`

​string

Example: 0.00000010

`taker`

​string

Example: 0.00000020

`buyer`

​string

Example: 0.00000030

`seller`

​string

Example: 0.00000040

`specialCommission`

​object

Special commission rates from the order.

Special commission rates from the order.

`maker`

​string

Example: 0.01000000

`taker`

​string

Example: 0.02000000

`buyer`

​string

Example: 0.03000000

`seller`

​string

Example: 0.04000000

`taxCommission`

​object

Tax commission rates on trades from the order.

Tax commission rates on trades from the order.

`maker`

​string

Example: 0.00000112

`taker`

​string

Example: 0.00000114

`buyer`

​string

Example: 0.00000118

`seller`

​string

Example: 0.00000116

`discount`

​object

Discount on standard commissions when paying in BNB.

Discount on standard commissions when paying in BNB.

`enabledForAccount`

​boolean

Example: true

`enabledForSymbol`

​boolean

Example: true

`discountAsset`

​string

Example: BNB

`discount`

​string

Standard commission is reduced by this rate when paying commission in BNB.

Example: 0.75000000

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSaccount.commission

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "account.commission",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "account.commission",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "d3df8a61-98ea-4fe0-8f4e-0fcea5d418b0",
 "status": 200,
 "result": {
 "symbol": "BTCUSDT",
 "standardCommission": {
 "maker": "0.00000010",
 "taker": "0.00000020",
 "buyer": "0.00000030",
 "seller": "0.00000040"
 },
 "specialCommission": {
 "maker": "0.01000000",
 "taker": "0.02000000",
 "buyer": "0.03000000",
 "seller": "0.04000000"
 },
 "taxCommission": {
 "maker": 0.00000112,
 "taker": 0.00000114,
 "buyer": 0.00000118,
 "seller": 0.00000116
 },
 "discount": {
 "enabledForAccount": true,
 "enabledForSymbol": true,
 "discountAsset": "BNB",
 "discount": "0.75000000"
 }
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Unfilled Order Count (USER\_DATA)

Query your current unfilled order count for all intervals.

WSS

account.rateLimits.orders

wss://ws-api.binance.com:443/ws-api/v3

### Unfilled Order Count (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Unfilled Order Count (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight40

### Unfilled Order Count (USER\_DATA) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

account.rateLimits.orders

Example: account.rateLimits.orders

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory

### Unfilled Order Count (USER\_DATA) › Responses

Successful Response

Unfilled Order Count

`id`

​string

Example: d3783d8d-f8d1-4d2c-b8a0-b7596af5a664

`status`

​integer · int64

Example: 200

`result`

​object[]

`rateLimitType`

​string

Example: ORDERS

`interval`

​string

Example: SECOND

`intervalNum`

​integer · int64

Example: 10

`limit`

​integer · int64

Example: 50

`count`

​integer · int64

Example: 0

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSaccount.rateLimits.orders

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "account.rateLimits.orders",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "account.rateLimits.orders",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "d3783d8d-f8d1-4d2c-b8a0-b7596af5a664",
 "status": 200,
 "result": [
 {
 "rateLimitType": "ORDERS",
 "interval": "SECOND",
 "intervalNum": 10,
 "limit": 50,
 "count": 0
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Account information (USER\_DATA)

Query information about your account.

WSS

account.status

wss://ws-api.binance.com:443/ws-api/v3

### Account information (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Account information (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight20

### Account information (USER\_DATA) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

account.status

Example: account.status

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`omitZeroBalances`

​boolean

When set to `true`, emits only the non-zero balances of an account. Default value: `false`.

Example: false

Default: false

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory => Database

### Account information (USER\_DATA) › Responses

Successful Response

Account information

`id`

​string

Example: 605a6d20-6588-4cb9-afa0-b0ab087507ba

`status`

​integer · int64

Example: 200

`result`

​object

`makerCommission`

​integer · int64

Example: 15

`takerCommission`

​integer · int64

Example: 15

`buyerCommission`

​integer · int64

Example: 0

`sellerCommission`

​integer · int64

Example: 0

`canTrade`

​boolean

Example: true

`canWithdraw`

​boolean

Example: true

`canDeposit`

​boolean

Example: true

`commissionRates`

​object

`maker`

​string

Example: 0.0015

`taker`

​string

Example: 0.0015

`buyer`

​string

Example: 0

`seller`

​string

Example: 0

`brokered`

​boolean

Example: false

`requireSelfTradePrevention`

​boolean

Example: false

`preventSor`

​boolean

Example: false

`updateTime`

​integer · int64

Example: 1660801833000

`accountType`

​string

Example: SPOT

`balances`

​object[]

`asset`

​string

Example: BNB

`free`

​string

Example: 0

`locked`

​string

Example: 0

`permissions`

​string[]

`uid`

​integer · int64

Example: 354937868

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSaccount.status

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "account.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "account.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "605a6d20-6588-4cb9-afa0-b0ab087507ba",
 "status": 200,
 "result": {
 "makerCommission": 15,
 "takerCommission": 15,
 "buyerCommission": 0,
 "sellerCommission": 0,
 "canTrade": true,
 "canWithdraw": true,
 "canDeposit": true,
 "commissionRates": {
 "maker": 0.0015,
 "taker": 0.0015,
 "buyer": 0,
 "seller": 0
 },
 "brokered": false,
 "requireSelfTradePrevention": false,
 "preventSor": false,
 "updateTime": 1660801833000,
 "accountType": "SPOT",
 "balances": [
 {
 "asset": "BNB",
 "free": 0,
 "locked": 0
 }
 ],
 "permissions": [
 "SPOT"
 ],
 "uid": 354937868
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Account order list history (USER\_DATA)

Query information about all your order lists, filtered by time range.

WSS

allOrderLists

wss://ws-api.binance.com:443/ws-api/v3

### Account order list history (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Account order list history (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight20

### Account order list history (USER\_DATA) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

allOrderLists

Example: allOrderLists

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`fromId`

​integer

Order list ID to begin at

Example: 1

`startTime`

​integer · int64

Timestamp in ms

Example: 1735693200000

`endTime`

​integer · int64

Timestamp in ms

Example: 1735693200000

`limit`

​integer · max: 1000

Default: 500; Maximum: 1000

Example: 1

Default: 500

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

Notes:

* If `startTime` and/or `endTime` are specified, `fromId` is ignored.
  Order lists are filtered by `transactionTime` of the last order list execution status update.
* If `fromId` is specified, return order lists with order list ID >= `fromId`.
* If no condition is specified, the most recent order lists are returned.
* The time between `startTime` and `endTime` can't be longer than 24 hours.

### Account order list history (USER\_DATA) › Responses

Successful Response

Account order list history

`id`

​string

Example: 8617b7b3-1b3d-4dec-94cd-eefd929b8ceb

`status`

​integer · int64

Example: 200

`result`

​object[]

`orderListId`

​integer · int64

Example: 1274512

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: 08985fedd9ea2cf6b28996

`transactionTime`

​integer · int64

Example: 1660801713793

`symbol`

​string

Example: BTCUSDT

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569138901

`clientOrderId`

​string

Example: BqtFCj5odMoWtSqGk2X9tU

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSallOrderLists

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "allOrderLists",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "allOrderLists",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "8617b7b3-1b3d-4dec-94cd-eefd929b8ceb",
 "status": 200,
 "result": [
 {
 "orderListId": 1274512,
 "contingencyType": "OCO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "08985fedd9ea2cf6b28996",
 "transactionTime": 1660801713793,
 "symbol": "BTCUSDT",
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569138901,
 "clientOrderId": "BqtFCj5odMoWtSqGk2X9tU"
 }
 ]
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Account order history (USER\_DATA)

Query information about all your orders – active, canceled, filled – filtered by time range.

WSS

allOrders

wss://ws-api.binance.com:443/ws-api/v3

### Account order history (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Account order history (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight20

### Account order history (USER\_DATA) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

allOrders

Example: allOrders

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`orderId`

​integer · int64

Order ID to begin at

Example: 1

`startTime`

​integer · int64

Timestamp in ms

Example: 1735693200000

`endTime`

​integer · int64

Timestamp in ms

Example: 1735693200000

`limit`

​integer · max: 1000

Default: 500; Maximum: 1000

Example: 1

Default: 500

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

Notes:

* If `startTime` and/or `endTime` are specified, `orderId` is ignored.

  Orders are filtered by `time` of the last execution status update.
* If `orderId` is specified, return orders with order ID >= `orderId`.
* If no condition is specified, the most recent orders are returned.
* For some historical orders the `cummulativeQuoteQty` response field may be negative,
  meaning the data is not available at this time.
* The time between `startTime` and `endTime` can't be longer than 24 hours.

### Account order history (USER\_DATA) › Responses

Successful Response

Account order history

`id`

​string

Example: 734235c2-13d2-4574-be68-723e818c08f3

`status`

​integer · int64

Example: 200

`result`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569099453

`orderListId`

​integer · int64

Present only for orders that belong to an order list.

Example: -1

`clientOrderId`

​string

Example: 4d96324ff9d44481926157

`price`

​string

Example: 23416.1

`origQty`

​string

Example: 0.00847

`executedQty`

​string

Example: 0.00847

`cummulativeQuoteQty`

​string

Example: 198.335215

`status`

​string

Example: FILLED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: SELL

`time`

​integer · int64

Order placement time.

Example: 1660801715639

`updateTime`

​integer · int64

Time of the last update to the order.

Example: 1660801717945

`isWorking`

​boolean

Example: true

`workingTime`

​integer · int64

Example: 1660801715639

`origQuoteOrderQty`

​string

Always present. Zero if the order type does not use `quoteOrderQty`.

Example: 0

`selfTradePreventionMode`

​string

Example: NONE

`preventedMatchId`

​integer · int64

Present only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Present only if the order expired due to STP.

Example: 1.2

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSallOrders

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "allOrders",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "allOrders",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "734235c2-13d2-4574-be68-723e818c08f3",
 "status": 200,
 "result": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569099453,
 "orderListId": -1,
 "clientOrderId": "4d96324ff9d44481926157",
 "price": 23416.1,
 "origQty": 0.00847,
 "executedQty": 0.00847,
 "cummulativeQuoteQty": 198.335215,
 "status": "FILLED",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "SELL",
 "time": 1660801715639,
 "updateTime": 1660801717945,
 "isWorking": true,
 "workingTime": 1660801715639,
 "origQuoteOrderQty": 0,
 "selfTradePreventionMode": "NONE",
 "preventedMatchId": 0,
 "preventedQuantity": 1.2,
 "icebergQty": "0.00000000",
 "stopPrice": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Account allocations (USER\_DATA)

Retrieves allocations resulting from SOR order placement.

WSS

myAllocations

wss://ws-api.binance.com:443/ws-api/v3

### Account allocations (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Account allocations (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight20

### Account allocations (USER\_DATA) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

myAllocations

Example: myAllocations

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`startTime`

​integer · int64

Timestamp in ms

Example: 1735693200000

`endTime`

​integer · int64

Timestamp in ms

Example: 1735693200000

`fromAllocationId`

​integer

Allocation ID to begin at

Example: 1

`limit`

​integer · max: 1000

Default: 500; Maximum: 1000

Example: 1

Default: 500

`orderId`

​integer · int64

Order ID

Example: 1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

Supported parameter combinations:

| Parameters | Response |
| --- | --- |
| `symbol` | allocations from oldest to newest |
| `symbol` + `startTime` | oldest allocations since `startTime` |
| `symbol` + `endTime` | newest allocations until `endTime` |
| `symbol` + `startTime` + `endTime` | allocations within the time range |
| `symbol` + `fromAllocationId` | allocations by allocation ID |
| `symbol` + `orderId` | allocations related to an order starting with oldest |
| `symbol` + `orderId` + `fromAllocationId` | allocations related to an order by allocation ID |

**Note:** The time between `startTime` and `endTime` can't be longer than 24 hours.

### Account allocations (USER\_DATA) › Responses

Successful Response

Account allocations

`id`

​string

Example: g4ce6a53-a39d-4f71-823b-4ab5r391d6y8

`status`

​integer · int64

Example: 200

`result`

​object[]

`symbol`

​string

Example: BTCUSDT

`allocationId`

​integer · int64

Example: 0

`allocationType`

​string

Example: SOR

`orderId`

​integer · int64

Example: 500

`orderListId`

​integer · int64

Example: -1

`price`

​string

Example: 1

`qty`

​string

Example: 0.1

`quoteQty`

​string

Example: 0.1

`commission`

​string

Example: 0

`commissionAsset`

​string

Example: BTC

`time`

​integer · int64

Example: 1687319487614

`isBuyer`

​boolean

Example: false

`isMaker`

​boolean

Example: false

`isAllocator`

​boolean

Example: false

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSmyAllocations

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "myAllocations",
 "params": {
 "symbol": "BNBUSDT",
 "apiKey": "API_KEY",
 "timestamp": 1770736694138
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "myAllocations",
 "params": {
 "symbol": "BNBUSDT",
 "apiKey": "API_KEY",
 "timestamp": 1770736694138
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "g4ce6a53-a39d-4f71-823b-4ab5r391d6y8",
 "status": 200,
 "result": [
 {
 "symbol": "BTCUSDT",
 "allocationId": 0,
 "allocationType": "SOR",
 "orderId": 500,
 "orderListId": -1,
 "price": 1,
 "qty": 0.1,
 "quoteQty": 0.1,
 "commission": 0,
 "commissionAsset": "BTC",
 "time": 1687319487614,
 "isBuyer": false,
 "isMaker": false,
 "isAllocator": false
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Query Relevant Filters (USER\_DATA)

Retrieves the list of [filters](/en/docs/products/spot/filters) relevant to an account on a given symbol. This is the only method
that shows if an account has [`MAX_ASSET`](/en/docs/products/spot/filters#max_asset) filters applied to it.

WSS

myFilters

wss://ws-api.binance.com:443/ws-api/v3

### Query Relevant Filters (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Query Relevant Filters (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight40

### Query Relevant Filters (USER\_DATA) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

myFilters

Example: myFilters

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory

### Query Relevant Filters (USER\_DATA) › Responses

Successful Response

Query Relevant Filters

`id`

​string

Example: 1758009606869

`status`

​integer · int64

Example: 200

`result`

​object

`exchangeFilters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| EXCHANGE\_MAX\_NUM\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ICEBERG\_ORDERS" |
| EXCHANGE\_MAX\_NUM\_ORDER\_LISTS | type = object · filterType="EXCHANGE\_MAX\_NUM\_ORDER\_LISTS" |

**Properties for EXCHANGE\_MAX\_NUM\_ORDERS:**

`filterType`

​string

Example: EXCHANGE\_MAX\_NUM\_ORDERS

`maxNumOrders`

​integer · int64

Example: 1000

`symbolFilters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| PRICE\_FILTER | type = object · filterType="PRICE\_FILTER" |
| PERCENT\_PRICE | type = object · filterType="PERCENT\_PRICE" |
| PERCENT\_PRICE\_BY\_SIDE | type = object · filterType="PERCENT\_PRICE\_BY\_SIDE" |
| LOT\_SIZE | type = object · filterType="LOT\_SIZE" |
| MIN\_NOTIONAL | type = object · filterType="MIN\_NOTIONAL" |
| NOTIONAL | type = object · filterType="NOTIONAL" |
| ICEBERG\_PARTS | type = object · filterType="ICEBERG\_PARTS" |
| MARKET\_LOT\_SIZE | type = object · filterType="MARKET\_LOT\_SIZE" |
| MAX\_NUM\_ORDERS | type = object · filterType="MAX\_NUM\_ORDERS" |
| MAX\_NUM\_ALGO\_ORDERS | type = object · filterType="MAX\_NUM\_ALGO\_ORDERS" |
| MAX\_NUM\_ICEBERG\_ORDERS | type = object · filterType="MAX\_NUM\_ICEBERG\_ORDERS" |
| MAX\_POSITION | type = object · filterType="MAX\_POSITION" |
| TRAILING\_DELTA | type = object · filterType="TRAILING\_DELTA" |
| T\_PLUS\_SELL | type = object · filterType="T\_PLUS\_SELL" |
| MAX\_NUM\_ORDER\_LISTS | type = object · filterType="MAX\_NUM\_ORDER\_LISTS" |
| MAX\_NUM\_ORDER\_AMENDS | type = object · filterType="MAX\_NUM\_ORDER\_AMENDS" |

**Properties for PRICE\_FILTER:**

`filterType`

​string

Example: PRICE\_FILTER

`priceExponent`

​integer

Example: 8

`minPrice`

​string

Example: 0.00000100

`maxPrice`

​string

Example: 100000.00000000

`tickSize`

​string

Example: 0.00000100

`assetFilters`

​array

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| MAX\_ASSET | type = object · filterType="MAX\_ASSET" |

**Properties for MAX\_ASSET:**

`filterType`

​string

Example: MAX\_ASSET

`qtyExponent`

​integer

Example: 8

`limit`

​string

Example: 1000000.00000000

`asset`

​string

Example: JPY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSmyFilters

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "myFilters",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "myFilters",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": 1758009606869,
 "status": 200,
 "result": {
 "exchangeFilters": [
 {
 "filterType": "EXCHANGE_MAX_NUM_ORDERS",
 "maxNumOrders": 1000
 }
 ],
 "symbolFilters": [
 {
 "filterType": "PRICE_FILTER",
 "priceExponent": 8,
 "minPrice": "0.00000100",
 "maxPrice": "100000.00000000",
 "tickSize": "0.00000100"
 }
 ],
 "assetFilters": [
 {
 "filterType": "MAX_ASSET",
 "qtyExponent": 8,
 "limit": "1000000.00000000",
 "asset": "JPY"
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
 }
}`

json

application/json

---

## Account prevented matches (USER\_DATA)

Displays the list of orders that were expired due to STP.

These are the combinations supported:

* `symbol` + `preventedMatchId`
* `symbol` + `orderId`
* `symbol` + `orderId` + `fromPreventedMatchId` (`limit` will default to 500)
* `symbol` + `orderId` + `fromPreventedMatchId` + `limit`

WSS

myPreventedMatches

wss://ws-api.binance.com:443/ws-api/v3

### Account prevented matches (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Account prevented matches (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

| Case | Weight |
| --- | --- |
| If `symbol` is invalid | 2 |
| Querying by `preventedMatchId` | 2 |
| Querying by `orderId` | 20 |

### Account prevented matches (USER\_DATA) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

myPreventedMatches

Example: myPreventedMatches

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`preventedMatchId`

​integer · int64

Prevented match ID

Example: 1

`orderId`

​integer · int64

Order ID

Example: 1

`fromPreventedMatchId`

​integer · int64

Prevented match ID to begin at

Example: 1

`limit`

​integer · max: 1000

Default: 500; Maximum: 1000

Example: 1

Default: 500

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

### Account prevented matches (USER\_DATA) › Responses

Successful Response

Account prevented matches

`id`

​string

Example: g4ce6a53-a39d-4f71-823b-4ab5r391d6y8

`status`

​integer · int64

Example: 200

`result`

​object[]

`symbol`

​string

Example: BTCUSDT

`preventedMatchId`

​integer · int64

Example: 1

`takerOrderId`

​integer · int64

Example: 5

`makerSymbol`

​string

Example: BTCUSDT

`makerOrderId`

​integer · int64

Example: 3

`tradeGroupId`

​integer · int64

Example: 1

`selfTradePreventionMode`

​string

Example: EXPIRE\_MAKER

`price`

​string

Example: 1.1

`makerPreventedQuantity`

​string

Example: 1.3

`transactTime`

​integer · int64

Example: 1669101687094

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSmyPreventedMatches

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "myPreventedMatches",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "myPreventedMatches",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "g4ce6a53-a39d-4f71-823b-4ab5r391d6y8",
 "status": 200,
 "result": [
 {
 "symbol": "BTCUSDT",
 "preventedMatchId": 1,
 "takerOrderId": 5,
 "makerSymbol": "BTCUSDT",
 "makerOrderId": 3,
 "tradeGroupId": 1,
 "selfTradePreventionMode": "EXPIRE_MAKER",
 "price": 1.1,
 "makerPreventedQuantity": 1.3,
 "transactTime": 1669101687094
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Account trade history (USER\_DATA)

Query information about all your trades, filtered by time range.

WSS

myTrades

wss://ws-api.binance.com:443/ws-api/v3

### Account trade history (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Account trade history (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

| Condition | Weight |
| --- | --- |
| Without orderId | 20 |
| With orderId | 5 |

### Account trade history (USER\_DATA) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

myTrades

Example: myTrades

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`orderId`

​integer · int64

This can only be used in combination with `symbol`.

Example: 1

`startTime`

​integer · int64

Timestamp in ms

Example: 1735693200000

`endTime`

​integer · int64

Timestamp in ms

Example: 1735693200000

`fromId`

​integer

First trade ID to query

Example: 1

`limit`

​integer · max: 1000

Default: 500; Maximum: 1000

Example: 1

Default: 500

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

Data Source: Memory => Database

Notes:

* If `fromId` is specified, return trades with trade ID >= `fromId`.
* If `startTime` and/or `endTime` are specified, trades are filtered by execution time (`time`).
* `fromId` cannot be used together with `startTime` and `endTime`.
* If `orderId` is specified, only trades related to that order are returned.
* `startTime` and `endTime` cannot be used together with `orderId`.
* If no condition is specified, the most recent trades are returned.
* The time between `startTime` and `endTime` can't be longer than 24 hours.

### Account trade history (USER\_DATA) › Responses

Successful Response

Account trade history

`id`

​string

Example: f4ce6a53-a29d-4f70-823b-4ab59391d6e8

`status`

​integer · int64

Example: 200

`result`

​object[]

`symbol`

​string

Example: BTCUSDT

`id`

​integer · int64

Example: 1650422481

`orderId`

​integer · int64

Example: 12569099453

`orderListId`

​integer · int64

Example: -1

`price`

​string

Example: 23416.1

`qty`

​string

Example: 0.00635

`quoteQty`

​string

Example: 148.692235

`commission`

​string

Example: 0

`commissionAsset`

​string

Example: BNB

`time`

​integer · int64

Example: 1660801715793

`isBuyer`

​boolean

Example: false

`isMaker`

​boolean

Example: true

`isBestMatch`

​boolean

Example: true

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSmyTrades

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "myTrades",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "myTrades",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "f4ce6a53-a29d-4f70-823b-4ab59391d6e8",
 "status": 200,
 "result": [
 {
 "symbol": "BTCUSDT",
 "id": 1650422481,
 "orderId": 12569099453,
 "orderListId": -1,
 "price": 23416.1,
 "qty": 0.00635,
 "quoteQty": 148.692235,
 "commission": 0,
 "commissionAsset": "BNB",
 "time": 1660801715793,
 "isBuyer": false,
 "isMaker": true,
 "isBestMatch": true
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Current open Order lists (USER\_DATA)

Query execution status of all open order lists.

If you need to continuously monitor order status updates, please consider using WebSocket Streams:

* `userDataStream.subscribe` if on an authenticated session
* `userDataStream.subscribe.signature` if subscribing through signature subscription

WSS

openOrderLists.status

wss://ws-api.binance.com:443/ws-api/v3

### Current open Order lists (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Current open Order lists (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight6

### Current open Order lists (USER\_DATA) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

openOrderLists.status

Example: openOrderLists.status

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory -> Database

### Current open Order lists (USER\_DATA) › Responses

Successful Response

Current open Order lists

`id`

​string

Example: 3a4437e2-41a3-4c19-897c-9cadc5dce8b6

`status`

​integer · int64

Example: 200

`result`

​object[]

`orderListId`

​integer · int64

Example: 0

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: 08985fedd9ea2cf6b28996

`transactionTime`

​integer · int64

Example: 1660801713793

`symbol`

​string

Example: BTCUSDT

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 4

`clientOrderId`

​string

Example: CUhLgTXnX5n2c0gWiLpV4d

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSopenOrderLists.status

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "openOrderLists.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "openOrderLists.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "3a4437e2-41a3-4c19-897c-9cadc5dce8b6",
 "status": 200,
 "result": [
 {
 "orderListId": 0,
 "contingencyType": "OCO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "08985fedd9ea2cf6b28996",
 "transactionTime": 1660801713793,
 "symbol": "BTCUSDT",
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 4,
 "clientOrderId": "CUhLgTXnX5n2c0gWiLpV4d"
 }
 ]
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Current open orders (USER\_DATA)

Query execution status of all open orders.

If you need to continuously monitor order status updates, please consider using WebSocket Streams:

* `userDataStream.subscribe` if on an authenticated session
* `userDataStream.subscribe.signature` if subscribing through signature subscription

WSS

openOrders.status

wss://ws-api.binance.com:443/ws-api/v3

### Current open orders (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Current open orders (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight

| Parameter | Weight |
| --- | --- |
| `symbol` | 6 |
| none | 80 |

### Current open orders (USER\_DATA) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

openOrders.status

Example: openOrders.status

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`symbol`

​string

If omitted, open orders for all symbols are returned

Example: BNBUSDT

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

Data Source: Memory => Database

### Current open orders (USER\_DATA) › Responses

Successful Response

Current open orders

`id`

​string

Example: 55f07876-4f6f-4c47-87dc-43e5fff3f2e7

`status`

​integer · int64

Example: 200

`result`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569099453

`orderListId`

​integer · int64

Present only for orders that belong to an order list.

Example: -1

`clientOrderId`

​string

Example: 4d96324ff9d44481926157

`price`

​string

Example: 23416.1

`origQty`

​string

Example: 0.00847

`executedQty`

​string

Example: 0.0072

`origQuoteOrderQty`

​string

Always present. Zero if the order type does not use `quoteOrderQty`.

Example: 0

`cummulativeQuoteQty`

​string

Example: 172.43931

`status`

​string

Example: PARTIALLY\_FILLED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: SELL

`time`

​integer · int64

Order placement time.

Example: 1660801715639

`updateTime`

​integer · int64

Time of the last update to the order.

Example: 1660801717945

`isWorking`

​boolean

Example: true

`workingTime`

​integer · int64

Example: 1660801715639

`selfTradePreventionMode`

​string

Example: NONE

`icebergQty`

​string

Appears only if the parameter icebergQty was sent in the request.

Example: 0.00000000

`preventedMatchId`

​integer · int64

Appears only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Order quantity that expired due to STP.

Example: 1.200000

`stopPrice`

​string

Appears for STOP\_LOSS, TAKE\_PROFIT, STOP\_LOSS\_LIMIT, and TAKE\_PROFIT\_LIMIT orders.

Example: 0.00000000

`strategyId`

​integer · int64

Appears only if the strategyId parameter was provided upon order placement.

Example: 1

`strategyType`

​integer · int64

Appears only if the strategyType parameter was provided upon order placement.

Example: 1000000

`trailingDelta`

​integer · int64

Delta price change required before order activation.

Example: 10

`trailingTime`

​integer · int64

Time when the trailing order is now active and tracking price changes.

Example: -1

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSopenOrders.status

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "openOrders.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "openOrders.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "55f07876-4f6f-4c47-87dc-43e5fff3f2e7",
 "status": 200,
 "result": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569099453,
 "orderListId": -1,
 "clientOrderId": "4d96324ff9d44481926157",
 "price": 23416.1,
 "origQty": 0.00847,
 "executedQty": 0.0072,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 172.43931,
 "status": "PARTIALLY_FILLED",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "SELL",
 "time": 1660801715639,
 "updateTime": 1660801717945,
 "isWorking": true,
 "workingTime": 1660801715639,
 "selfTradePreventionMode": "NONE",
 "icebergQty": "0.00000000",
 "preventedMatchId": 0,
 "preventedQuantity": "1.200000",
 "stopPrice": "0.00000000",
 "strategyId": 1,
 "strategyType": 1000000,
 "trailingDelta": 10,
 "trailingTime": -1,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Query Order Amendments (USER\_DATA)

Queries all amendments of a single order.

WSS

order.amendments

wss://ws-api.binance.com:443/ws-api/v3

### Query Order Amendments (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Query Order Amendments (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight4

### Query Order Amendments (USER\_DATA) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

order.amendments

Example: order.amendments

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`orderId`

​integer · int64 · required

Order ID

Example: 1

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`fromExecutionId`

​integer · int64

Execution ID to begin at

Example: 1

`limit`

​integer · int64 · max: 1000

Default: 500; Maximum: 1000

Example: 1

Default: 500

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

### Query Order Amendments (USER\_DATA) › Responses

Successful Response

Query Order Amendments

`id`

​string

Example: 6f5ebe91-01d9-43ac-be99-57cf062e0e30

`status`

​integer · int64

Example: 200

`result`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 23

`executionId`

​integer · int64

Example: 60

`origClientOrderId`

​string

Example: my\_pending\_order

`newClientOrderId`

​string

Example: xbxXh5SSwaHS7oUEOCI88B

`origQty`

​string

Example: 7

`newQty`

​string

Example: 5

`time`

​integer · int64

Example: 1741924229819

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorder.amendments

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.amendments",
 "params": {
 "symbol": "BNBUSDT",
 "orderId": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.amendments",
 "params": {
 "symbol": "BNBUSDT",
 "orderId": 1,
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "6f5ebe91-01d9-43ac-be99-57cf062e0e30",
 "status": 200,
 "result": [
 {
 "symbol": "BTCUSDT",
 "orderId": 23,
 "executionId": 60,
 "origClientOrderId": "my_pending_order",
 "newClientOrderId": "xbxXh5SSwaHS7oUEOCI88B",
 "origQty": 7,
 "newQty": 5,
 "time": 1741924229819
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Query Order list (USER\_DATA)

Check execution status of an Order list.

For execution status of individual orders, use `order.status`.

WSS

orderList.status

wss://ws-api.binance.com:443/ws-api/v3

### Query Order list (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Query Order list (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight4

### Query Order list (USER\_DATA) › Request Parameters optional

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

orderList.status

Example: orderList.status

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`origClientOrderId`

​string

Query order list by `listClientOrderId`. `orderListId` or `origClientOrderId` must be provided.

Example: 08985fedd9ea2cf6b28996

`orderListId`

​integer

Query order list by `orderListId`. `orderListId` or `origClientOrderId` must be provided.

Example: 1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Database

Notes:

* `origClientOrderId` refers to `listClientOrderId` of the order list itself.
* If both `origClientOrderId` and `orderListId` parameters are specified,
  only `origClientOrderId` is used and `orderListId` is ignored.

### Query Order list (USER\_DATA) › Responses

Successful Response

Query Order list

`id`

​string

Example: b53fd5ff-82c7-4a04-bd64-5f9dc42c2100

`status`

​integer · int64

Example: 200

`result`

​object

`orderListId`

​integer · int64

Example: 1274512

`contingencyType`

​string

Example: OCO

`listStatusType`

​string

Example: EXEC\_STARTED

`listOrderStatus`

​string

Example: EXECUTING

`listClientOrderId`

​string

Example: 08985fedd9ea2cf6b28996

`transactionTime`

​integer · int64

Example: 1660801713793

`symbol`

​string

Example: BTCUSDT

`orders`

​object[]

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569138901

`clientOrderId`

​string

Example: BqtFCj5odMoWtSqGk2X9tU

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorderList.status

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "orderList.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "b53fd5ff-82c7-4a04-bd64-5f9dc42c2100",
 "status": 200,
 "result": {
 "orderListId": 1274512,
 "contingencyType": "OCO",
 "listStatusType": "EXEC_STARTED",
 "listOrderStatus": "EXECUTING",
 "listClientOrderId": "08985fedd9ea2cf6b28996",
 "transactionTime": 1660801713793,
 "symbol": "BTCUSDT",
 "orders": [
 {
 "symbol": "BTCUSDT",
 "orderId": 12569138901,
 "clientOrderId": "BqtFCj5odMoWtSqGk2X9tU"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

## Query order (USER\_DATA)

Check execution status of an order.

WSS

order.status

wss://ws-api.binance.com:443/ws-api/v3

### Query order (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/spot/websocket-api#request-security)

### Query order (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/spot/websocket-api#rate-limits) section.

IP Weight4

### Query order (USER\_DATA) › Request Parameters

`id`

​string · required

Client-generated request identifier.

Example: 7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b

`method`

​string · enum · required

WebSocket API method name.

Enum values:

order.status

Example: order.status

`params`

​object · required

`symbol`

​string · required

Example: BNBUSDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client
time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`orderId`

​integer · int64

Lookup order by `orderId`

Example: 1

`origClientOrderId`

​string

Lookup order by `clientOrderId`

Example: myOrder1

`recvWindow`

​number · float · max: 60000

Supports up to three decimal places of precision (e.g., 6000.346) so that microseconds may be specified.

Example: 5000

**Data Source:** Memory => Database

Notes:

* If both `orderId` and `origClientOrderId` are provided, the `orderId` is searched first, then the `origClientOrderId` from that result is checked against that order. If both conditions are not met the request will be rejected.
* For some historical orders the `cummulativeQuoteQty` response field may be negative,
  meaning the data is not available at this time.

### Query order (USER\_DATA) › Responses

Successful Response

Query order

`id`

​string

Example: aa62318a-5a97-4f3b-bdc7-640bbe33b291

`status`

​integer · int64

Example: 200

`result`

​object

`symbol`

​string

Example: BTCUSDT

`orderId`

​integer · int64

Example: 12569099453

`orderListId`

​integer · int64

Present only for orders that belong to an order list.

Example: -1

`clientOrderId`

​string

Example: 4d96324ff9d44481926157

`price`

​string

Example: 23416.1

`origQty`

​string

Example: 0.00847

`executedQty`

​string

Example: 0.00847

`origQuoteOrderQty`

​string

Always present. Zero if the order type does not use `quoteOrderQty`.

Example: 0

`cummulativeQuoteQty`

​string

Example: 198.335215

`status`

​string

Example: FILLED

`timeInForce`

​string

Example: GTC

`type`

​string

Example: LIMIT

`side`

​string

Example: SELL

`stopPrice`

​string

Always present. Zero if the order type does not use `stopPrice`.

Example: 0

`trailingDelta`

​integer · int64

Present only if `trailingDelta` was set on the order.

Example: 10

`trailingTime`

​integer · int64

Present only if `trailingDelta` was set on the order.

Example: -1

`icebergQty`

​string

Always present. Zero for non-iceberg orders.

Example: 0

`time`

​integer · int64

Order placement time.

Example: 1660801715639

`updateTime`

​integer · int64

Time of the last update to the order.

Example: 1660801717945

`isWorking`

​boolean

Example: true

`workingTime`

​integer · int64

Example: 1660801715639

`strategyId`

​integer · int64

Present only if `strategyId` was set on the order.

Example: 37463720

`strategyType`

​integer · int64

Present only if `strategyType` was set on the order.

Example: 1000000

`selfTradePreventionMode`

​string

Example: NONE

`preventedMatchId`

​integer · int64

Present only if the order expired due to STP.

Example: 0

`preventedQuantity`

​string

Present only if the order expired due to STP.

Example: 1.2

`usedSor`

​boolean

Field that determines whether order used SOR.

Example: true

`workingFloor`

​string

Determines whether the order is being filled by the SOR or by the order book.

Example: SOR

`pegPriceType`

​string

Price peg type. Only for pegged orders.

Example: PRIMARY\_PEG

`pegOffsetType`

​string

Price peg offset type. Only for pegged orders, if requested.

Example: PRICE\_LEVEL

`pegOffsetValue`

​integer · int64

Price peg offset value. Only for pegged orders, if requested.

Example: 5

`peggedPrice`

​string

Current price order is pegged at. Only for pegged orders, once determined.

Example: 87523.83710000

`expiryReason`

​string

Cause of the order's expiration. Appears when an order has expired.

Example: INSUFFICIENT\_LIQUIDITY

`rateLimits`

​object[]

`rateLimitType`

​string

Example: REQUEST\_WEIGHT

`interval`

​string

Example: MINUTE

`intervalNum`

​integer · int64

Example: 1

`limit`

​integer · int64

Example: 6000

`count`

​integer · int64

Example: 321

WSSorder.status

Loading…

`wscat -c wss://ws-api.binance.com:443/ws-api/v3 -x '{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.status",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "7d3b9b46-5f4f-4c8b-9a2d-0a8f9a4a0f5b",
 "method": "order.status",
 "params": {
 "symbol": "BNBUSDT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "aa62318a-5a97-4f3b-bdc7-640bbe33b291",
 "status": 200,
 "result": {
 "symbol": "BTCUSDT",
 "orderId": 12569099453,
 "orderListId": -1,
 "clientOrderId": "4d96324ff9d44481926157",
 "price": 23416.1,
 "origQty": 0.00847,
 "executedQty": 0.00847,
 "origQuoteOrderQty": 0,
 "cummulativeQuoteQty": 198.335215,
 "status": "FILLED",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "side": "SELL",
 "stopPrice": 0,
 "trailingDelta": 10,
 "trailingTime": -1,
 "icebergQty": 0,
 "time": 1660801715639,
 "updateTime": 1660801717945,
 "isWorking": true,
 "workingTime": 1660801715639,
 "strategyId": 37463720,
 "strategyType": 1000000,
 "selfTradePreventionMode": "NONE",
 "preventedMatchId": 0,
 "preventedQuantity": 1.2,
 "usedSor": true,
 "workingFloor": "SOR",
 "pegPriceType": "PRIMARY_PEG",
 "pegOffsetType": "PRICE_LEVEL",
 "pegOffsetValue": 5,
 "peggedPrice": "87523.83710000",
 "expiryReason": "INSUFFICIENT_LIQUIDITY"
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 6000,
 "count": 321
 }
 ]
}`

json

application/json

---

---

