<!-- Gerado a partir de: https://developers.binance.com/docs/derivatives/quick-start -->

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api -->

# Account - Futures (USDⓈ-M) WebSocket API | Binance Developer Docs

Futures (USDⓈ-M) WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Futures (USDⓈ-M)](/en/docs/catalog#core-trading-derivatives-trading-usd-s-m-futures)
3. [WebSocket API](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api)

# Account

Endpoint

wss://ws-fapi.binance.com/ws-fapi/v1wss://testnet.binancefuture.com/ws-fapi/v1

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api/1.0.0/schema.yaml)

---

## Account Information (USER\_DATA)

Get current account information. User in single-asset/ multi-assets mode will see different value, see comments in response section for detail.

WSS

account.status

wss://ws-fapi.binance.com/ws-fapi/v1

### Account Information (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-usds-futures/general-info#endpoint-security-type)

### Account Information (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight5

### Account Information (USER\_DATA) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

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

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64

Recv Window.

Example: 5000

### Account Information (USER\_DATA) › Responses

Successful Response

Account Information

`id`

​string

Example: 605a6d20-6588-4cb9-afa0-b0ab087507ba

`status`

​integer · int64

Example: 200

`result`

​object

`feeTier`

​integer · int64

account commission tier

Example: 0

`canTrade`

​boolean

if can trade

Example: true

`canDeposit`

​boolean

if can transfer in asset

Example: true

`canWithdraw`

​boolean

if can transfer out asset

Example: true

`updateTime`

​integer · int64

reserved property, please ignore

Example: 0

`multiAssetsMargin`

​boolean

Example: true

`tradeGroupId`

​integer · int64

Example: -1

`totalInitialMargin`

​string

total initial margin required with current mark price (useless with isolated positions), only for USDT asset

Example: 0.00000000

`totalMaintMargin`

​string

the sum of USD value of all cross positions maintenance margin

Example: 0.00000000

`totalWalletBalance`

​string

total wallet balance, only for USDT asset

Example: 126.72469206

`totalUnrealizedProfit`

​string

total unrealized profit, only for USDT asset

Example: 0.00000000

`totalMarginBalance`

​string

total margin balance, only for USDT asset

Example: 126.72469206

`totalPositionInitialMargin`

​string

initial margin required for positions with current mark price, only for USDT asset

Example: 0.00000000

`totalOpenOrderInitialMargin`

​string

initial margin required for open orders with current mark price, only for USDT asset

Example: 0.00000000

`totalCrossWalletBalance`

​string

crossed wallet balance, only for USDT asset

Example: 126.72469206

`totalCrossUnPnl`

​string

unrealized profit of crossed positions, only for USDT asset

Example: 0.00000000

`availableBalance`

​string

available balance, only for USDT asset

Example: 126.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out, only for USDT asset

Example: 126.72469206

`assets`

​object[]

`asset`

​string

asset name

Example: USDT

`walletBalance`

​string

wallet balance

Example: 23.72469206

`unrealizedProfit`

​string

unrealized profit

Example: 0.00000000

`marginBalance`

​string

margin balance

Example: 23.72469206

`maintMargin`

​string

maintenance margin required

Example: 0.00000000

`initialMargin`

​string

total initial margin required with current mark price

Example: 0.00000000

`positionInitialMargin`

​string

initial margin required for positions with current mark price

Example: 0.00000000

`openOrderInitialMargin`

​string

initial margin required for open orders with current mark price

Example: 0.00000000

`crossWalletBalance`

​string

crossed wallet balance

Example: 23.72469206

`crossUnPnl`

​string

unrealized profit of crossed positions

Example: 0.00000000

`availableBalance`

​string

available balance, only for USDT asset

Example: 126.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out, only for USDT asset

Example: 23.72469206

`marginAvailable`

​boolean

whether the asset can be used as margin in Multi-Assets mode

Example: true

`updateTime`

​integer · int64

reserved property, please ignore

Example: 1625474304765

`positions`

​object[]

positions of all symbols in the market are returned

`symbol`

​string

symbol name

Example: BTCUSDT

`initialMargin`

​string

total initial margin required with current mark price

Example: 0

`maintMargin`

​string

maintenance margin required

Example: 0

`unrealizedProfit`

​string

unrealized profit

Example: 0.00000000

`positionInitialMargin`

​string

initial margin required for positions with current mark price

Example: 0

`openOrderInitialMargin`

​string

initial margin required for open orders with current mark price

Example: 0

`leverage`

​string

current initial leverage

Example: 100

`isolated`

​boolean

if the position is isolated

Example: true

`entryPrice`

​string

average entry price

Example: 0.00000

`maxNotional`

​string

maximum available notional with current leverage

Example: 250000

`bidNotional`

​string

bids notional, ignore

Example: 0

`askNotional`

​string

ask notional, ignore

Example: 0

`positionSide`

​string

position side

Example: BOTH

`positionAmt`

​string

position amount

Example: 0

`updateTime`

​integer · int64

reserved property, please ignore

Example: 0

`breakEvenPrice`

​string

average entry price

Example: 0.0

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

Example: 2400

`count`

​integer · int64

Example: 20

WSSaccount.status

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
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
 "feeTier": 0,
 "canTrade": true,
 "canDeposit": true,
 "canWithdraw": true,
 "updateTime": 0,
 "multiAssetsMargin": true,
 "tradeGroupId": -1,
 "totalInitialMargin": "0.00000000",
 "totalMaintMargin": "0.00000000",
 "totalWalletBalance": "126.72469206",
 "totalUnrealizedProfit": "0.00000000",
 "totalMarginBalance": "126.72469206",
 "totalPositionInitialMargin": "0.00000000",
 "totalOpenOrderInitialMargin": "0.00000000",
 "totalCrossWalletBalance": "126.72469206",
 "totalCrossUnPnl": "0.00000000",
 "availableBalance": "126.72469206",
 "maxWithdrawAmount": "126.72469206",
 "assets": [
 {
 "asset": "USDT",
 "walletBalance": "23.72469206",
 "unrealizedProfit": "0.00000000",
 "marginBalance": "23.72469206",
 "maintMargin": "0.00000000",
 "initialMargin": "0.00000000",
 "positionInitialMargin": "0.00000000",
 "openOrderInitialMargin": "0.00000000",
 "crossWalletBalance": "23.72469206",
 "crossUnPnl": "0.00000000",
 "availableBalance": "126.72469206",
 "maxWithdrawAmount": "23.72469206",
 "marginAvailable": true,
 "updateTime": 1625474304765
 }
 ],
 "positions": [
 {
 "symbol": "BTCUSDT",
 "initialMargin": "0",
 "maintMargin": "0",
 "unrealizedProfit": "0.00000000",
 "positionInitialMargin": "0",
 "openOrderInitialMargin": "0",
 "leverage": "100",
 "isolated": true,
 "entryPrice": "0.00000",
 "maxNotional": "250000",
 "bidNotional": "0",
 "askNotional": "0",
 "positionSide": "BOTH",
 "positionAmt": "0",
 "updateTime": 0,
 "breakEvenPrice": "0.0"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 20
 }
 ]
}`

json

application/json

---

## Account Information V2 (USER\_DATA)

Get current account information. User in single-asset/ multi-assets mode will see different value, see comments in response section for detail.

WSS

v2/account.status

wss://ws-fapi.binance.com/ws-fapi/v1

### Account Information V2 (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-usds-futures/general-info#endpoint-security-type)

### Account Information V2 (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight5

### Account Information V2 (USER\_DATA) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

v2/account.status

Example: v2/account.status

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64

Recv Window.

Example: 5000

### Account Information V2 (USER\_DATA) › Responses

Successful Response

Account Information V2

`id`

​string

Example: 605a6d20-6588-4cb9-afa0-b0ab087507ba

`status`

​integer · int64

Example: 200

`result`

​object

`totalInitialMargin`

​string

total initial margin required with current mark price (useless with isolated positions), only for USDT asset

Example: 0.00000000

`totalMaintMargin`

​string

the sum of USD value of all cross positions maintenance margin

Example: 0.00000000

`totalWalletBalance`

​string

total wallet balance, only for USDT asset

Example: 126.72469206

`totalUnrealizedProfit`

​string

total unrealized profit, only for USDT asset

Example: 0.00000000

`totalMarginBalance`

​string

total margin balance, only for USDT asset

Example: 126.72469206

`totalPositionInitialMargin`

​string

initial margin required for positions with current mark price, only for USDT asset

Example: 0.00000000

`totalOpenOrderInitialMargin`

​string

initial margin required for open orders with current mark price, only for USDT asset

Example: 0.00000000

`totalCrossWalletBalance`

​string

crossed wallet balance, only for USDT asset

Example: 126.72469206

`totalCrossUnPnl`

​string

unrealized profit of crossed positions, only for USDT asset

Example: 0.00000000

`availableBalance`

​string

available balance, only for USDT asset

Example: 126.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out, only for USDT asset

Example: 126.72469206

`assets`

​object[]

For assets that are quote assets, USDT/USDC/BTC

`asset`

​string

asset name

Example: USDT

`walletBalance`

​string

wallet balance

Example: 23.72469206

`unrealizedProfit`

​string

unrealized profit

Example: 0.00000000

`marginBalance`

​string

margin balance

Example: 23.72469206

`maintMargin`

​string

maintenance margin required

Example: 0.00000000

`initialMargin`

​string

total initial margin required with current mark price

Example: 0.00000000

`positionInitialMargin`

​string

initial margin required for positions with current mark price

Example: 0.00000000

`openOrderInitialMargin`

​string

initial margin required for open orders with current mark price

Example: 0.00000000

`crossWalletBalance`

​string

crossed wallet balance

Example: 23.72469206

`crossUnPnl`

​string

unrealized profit of crossed positions

Example: 0.00000000

`availableBalance`

​string

available balance, only for USDT asset

Example: 23.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out, only for USDT asset

Example: 23.72469206

`marginAvailable`

​boolean

whether the asset can be used as margin in Multi-Assets mode

Example: true

`updateTime`

​integer · int64

last update time

Example: 1625474304765

`positions`

​object[]

positions of all symbols user had position/ open orders are returned

`symbol`

​string

Example: BTCUSDT

`positionSide`

​string

position side

Example: BOTH

`positionAmt`

​string

Example: 1.000

`unrealizedProfit`

​string

unrealized profit

Example: 0.00000000

`isolatedMargin`

​string

Example: 0.00000000

`notional`

​string

Example: 0

`isolatedWallet`

​string

Example: 0

`initialMargin`

​string

total initial margin required with current mark price

Example: 0

`maintMargin`

​string

maintenance margin required

Example: 0

`updateTime`

​integer · int64

last update time

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

Example: 2400

`count`

​integer · int64

Example: 20

WSSv2/account.status

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "v2/account.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "v2/account.status",
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
 "totalInitialMargin": "0.00000000",
 "totalMaintMargin": "0.00000000",
 "totalWalletBalance": "126.72469206",
 "totalUnrealizedProfit": "0.00000000",
 "totalMarginBalance": "126.72469206",
 "totalPositionInitialMargin": "0.00000000",
 "totalOpenOrderInitialMargin": "0.00000000",
 "totalCrossWalletBalance": "126.72469206",
 "totalCrossUnPnl": "0.00000000",
 "availableBalance": "126.72469206",
 "maxWithdrawAmount": "126.72469206",
 "assets": [
 {
 "asset": "USDT",
 "walletBalance": "23.72469206",
 "unrealizedProfit": "0.00000000",
 "marginBalance": "23.72469206",
 "maintMargin": "0.00000000",
 "initialMargin": "0.00000000",
 "positionInitialMargin": "0.00000000",
 "openOrderInitialMargin": "0.00000000",
 "crossWalletBalance": "23.72469206",
 "crossUnPnl": "0.00000000",
 "availableBalance": "23.72469206",
 "maxWithdrawAmount": "23.72469206",
 "marginAvailable": true,
 "updateTime": 1625474304765
 }
 ],
 "positions": [
 {
 "symbol": "BTCUSDT",
 "positionSide": "BOTH",
 "positionAmt": "1.000",
 "unrealizedProfit": "0.00000000",
 "isolatedMargin": "0.00000000",
 "notional": "0",
 "isolatedWallet": "0",
 "initialMargin": "0",
 "maintMargin": "0",
 "updateTime": 0
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 20
 }
 ]
}`

json

application/json

---

## Futures Account Balance (USER\_DATA)

Futures Account Balance

WSS

account.balance

wss://ws-fapi.binance.com/ws-fapi/v1

### Futures Account Balance (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-usds-futures/general-info#endpoint-security-type)

### Futures Account Balance (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight5

### Futures Account Balance (USER\_DATA) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

account.balance

Example: account.balance

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64

Recv Window.

Example: 5000

### Futures Account Balance (USER\_DATA) › Responses

Successful Response

Futures Account Balance

`id`

​string

Example: 605a6d20-6588-4cb9-afa0-b0ab087507ba

`status`

​integer · int64

Example: 200

`result`

​object[]

`accountAlias`

​string

unique account code

Example: SgsR

`asset`

​string

asset name

Example: USDT

`balance`

​string

wallet balance

Example: 122607.35137903

`crossWalletBalance`

​string

crossed wallet balance

Example: 23.72469206

`crossUnPnl`

​string

unrealized profit of crossed positions

Example: 0.00000000

`availableBalance`

​string

available balance

Example: 23.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out

Example: 23.72469206

`marginAvailable`

​boolean

whether the asset can be used as margin in Multi-Assets mode

Example: true

`updateTime`

​integer · int64

Example: 1617939110373

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

Example: 2400

`count`

​integer · int64

Example: 20

WSSaccount.balance

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.balance",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.balance",
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
 "result": [
 {
 "accountAlias": "SgsR",
 "asset": "USDT",
 "balance": "122607.35137903",
 "crossWalletBalance": "23.72469206",
 "crossUnPnl": "0.00000000",
 "availableBalance": "23.72469206",
 "maxWithdrawAmount": "23.72469206",
 "marginAvailable": true,
 "updateTime": 1617939110373
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 20
 }
 ]
}`

json

application/json

---

## Futures Account Balance V2 (USER\_DATA)

Futures Account Balance V2

WSS

v2/account.balance

wss://ws-fapi.binance.com/ws-fapi/v1

### Futures Account Balance V2 (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-usds-futures/general-info#endpoint-security-type)

### Futures Account Balance V2 (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight5

### Futures Account Balance V2 (USER\_DATA) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

v2/account.balance

Example: v2/account.balance

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64

Recv Window.

Example: 5000

### Futures Account Balance V2 (USER\_DATA) › Responses

Successful Response

Futures Account Balance V2

`id`

​string

Example: 605a6d20-6588-4cb9-afa0-b0ab087507ba

`status`

​integer · int64

Example: 200

`result`

​object[]

`accountAlias`

​string

unique account code

Example: SgsR

`asset`

​string

asset name

Example: USDT

`balance`

​string

wallet balance

Example: 122607.35137903

`crossWalletBalance`

​string

crossed wallet balance

Example: 23.72469206

`crossUnPnl`

​string

unrealized profit of crossed positions

Example: 0.00000000

`availableBalance`

​string

available balance

Example: 23.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out

Example: 23.72469206

`marginAvailable`

​boolean

whether the asset can be used as margin in Multi-Assets mode

Example: true

`updateTime`

​integer · int64

Example: 1617939110373

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

Example: 2400

`count`

​integer · int64

Example: 20

WSSv2/account.balance

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "v2/account.balance",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "v2/account.balance",
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
 "result": [
 {
 "accountAlias": "SgsR",
 "asset": "USDT",
 "balance": "122607.35137903",
 "crossWalletBalance": "23.72469206",
 "crossUnPnl": "0.00000000",
 "availableBalance": "23.72469206",
 "maxWithdrawAmount": "23.72469206",
 "marginAvailable": true,
 "updateTime": 1617939110373
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 20
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api/user-data-streams -->

# User Data Streams - Futures (USDⓈ-M) WebSocket API | Binance Developer Docs

Futures (USDⓈ-M) WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Futures (USDⓈ-M)](/en/docs/catalog#core-trading-derivatives-trading-usd-s-m-futures)
3. [WebSocket API](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api)

# User Data Streams

Endpoint

wss://ws-fapi.binance.com/ws-fapi/v1wss://testnet.binancefuture.com/ws-fapi/v1

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api/1.0.0/schema.yaml)

---

## Close User Data Stream (USER\_STREAM)

Close out a user data stream.

WSS

userDataStream.stop

wss://ws-fapi.binance.com/ws-fapi/v1

### Close User Data Stream (USER\_STREAM) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight1

### Close User Data Stream (USER\_STREAM) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

userDataStream.stop

Example: userDataStream.stop

`params`

​object · required

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Close User Data Stream (USER\_STREAM) › Responses

Successful Response

Close User Data Stream

`id`

​string

Example: 819e1b1b-8c06-485b-a13e-131326c69599

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

Example: 2400

`count`

​integer · int64

Example: 2

WSSuserDataStream.stop

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.stop",
 "params": {
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.stop",
 "params": {
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "819e1b1b-8c06-485b-a13e-131326c69599",
 "status": 200,
 "result": {},
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 2
 }
 ]
}`

json

application/json

---

## Keepalive User Data Stream (USER\_STREAM)

Keepalive a user data stream to prevent a time out. User data streams will close after 60 minutes. It's recommended to send a ping about every 60 minutes.

WSS

userDataStream.ping

wss://ws-fapi.binance.com/ws-fapi/v1

### Keepalive User Data Stream (USER\_STREAM) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight1

### Keepalive User Data Stream (USER\_STREAM) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

userDataStream.ping

Example: userDataStream.ping

`params`

​object · required

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Keepalive User Data Stream (USER\_STREAM) › Responses

Successful Response

Keepalive User Data Stream

`id`

​string

Example: 815d5fce-0880-4287-a567-80badf004c74

`status`

​integer · int64

Example: 200

`result`

​object

`listenKey`

​string

Example: 3HBntNTepshgEdjIwSUIBgB9keLyOCg5qv3n6bYAtktG8ejcaW5HXz9Vx1JgIieg

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

Example: 2400

`count`

​integer · int64

Example: 2

WSSuserDataStream.ping

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.ping",
 "params": {
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.ping",
 "params": {
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "815d5fce-0880-4287-a567-80badf004c74",
 "status": 200,
 "result": {
 "listenKey": "3HBntNTepshgEdjIwSUIBgB9keLyOCg5qv3n6bYAtktG8ejcaW5HXz9Vx1JgIieg"
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 2
 }
 ]
}`

json

application/json

---

## Start User Data Stream (USER\_STREAM)

Start a new user data stream. The stream will close after 60 minutes unless a keepalive is sent. If the account has an active `listenKey`, that `listenKey` will be returned and its validity will be extended for 60 minutes.

WSS

userDataStream.start

wss://ws-fapi.binance.com/ws-fapi/v1

### Start User Data Stream (USER\_STREAM) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight1

### Start User Data Stream (USER\_STREAM) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

userDataStream.start

Example: userDataStream.start

`params`

​object · required

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Start User Data Stream (USER\_STREAM) › Responses

Successful Response

Start User Data Stream

`id`

​string

Example: d3df8a61-98ea-4fe0-8f4e-0fcea5d418b0

`status`

​integer · int64

Example: 200

`result`

​object

`listenKey`

​string

Example: xs0mRXdAKlIPDRFrlPcw0qI41Eh3ixNntmymGyhrhgqo7L6FuLaWArTD7RLP

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

Example: 2400

`count`

​integer · int64

Example: 2

WSSuserDataStream.start

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.start",
 "params": {
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.start",
 "params": {
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
 "listenKey": "xs0mRXdAKlIPDRFrlPcw0qI41Eh3ixNntmymGyhrhgqo7L6FuLaWArTD7RLP"
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 2
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/quick-start -->

# Quick Start | Binance Developer Docs

1. Futures (USDⓈ-M)

Copy page

# Quick Start

## API Key Setup

* Some endpoints will require an API Key. Please refer to
  [this page](https://www.binance.com/en/support/faq/how-to-create-api-keys-on-binance-360002502072)
  regarding API key creation.
* Once API key is created, it is recommended to set IP restrictions on the key for security reasons.
* **Never share your API key/secret key to ANYONE.**

## API Key Restrictions

* After creating the API key, the default restrictions is `Enable Reading`.
* To **enable withdrawals via the API**, the API key restriction needs to be modified through the
  Binance UI.

## Enabling Accounts

### Account

A `SPOT` account is provided by default upon creation of a Binance Account.

### Futures Account

To enable a `FUTURES` account for Futures Trading, please refer to the
[Futures Trading Guide](https://www.binance.com/en/support/faq/a-beginner-s-guide-to-futures-trading-website-360039304272)

### Futures Testnet

Users can use the Futures Testnet to practice `FUTURES` trading.

Currently, this is only available via the API.

Please refer to the [Futures Demo Trading page](https://demo.binance.com/en/futures/BTCUSDT) for
more information and how to set up the Demo Trading API key.

### Option Account

To enable a `OPTION` account for Option Trading, please refer to the
[Option Trading Guide](https://www.binance.com/en/support/faq/introduction-to-binance-options-374321c9317c473480243365298b8706)

## API Library

### Python connector

This is a lightweight library that works as a connector to Binance public API, written in Python.

<https://github.com/binance/binance-connector-python>

### Java connector

This is a lightweight library that works as a connector to Binance public API, written for Java
users.

<https://github.com/binance/binance-connector-java>

Was this page helpful?

YesNo

Last modified on August 18, 2026

[Introduction](/en/docs/products/derivatives-trading-usds-futures/Introduction)[Change Log](/en/docs/products/derivatives-trading-usds-futures/change-log)

On this page

* [API Key Setup](/en/docs/products/derivatives-trading-usds-futures/quick-start#api-key-setup)
* [API Key Restrictions](/en/docs/products/derivatives-trading-usds-futures/quick-start#api-key-restrictions)
* [Enabling Accounts](/en/docs/products/derivatives-trading-usds-futures/quick-start#enabling-accounts)
  + [Account](/en/docs/products/derivatives-trading-usds-futures/quick-start#account)
  + [Futures Account](/en/docs/products/derivatives-trading-usds-futures/quick-start#futures-account)
  + [Futures Testnet](/en/docs/products/derivatives-trading-usds-futures/quick-start#futures-testnet)
  + [Option Account](/en/docs/products/derivatives-trading-usds-futures/quick-start#option-account)
* [API Library](/en/docs/products/derivatives-trading-usds-futures/quick-start#api-library)
  + [Python connector](/en/docs/products/derivatives-trading-usds-futures/quick-start#python-connector)
  + [Java connector](/en/docs/products/derivatives-trading-usds-futures/quick-start#java-connector)

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/advanced-trading-derivatives-trading-portfolio-margin-pro/api/rest-api -->

# Account - Portfolio Margin Pro REST API | Binance Developer Docs

Portfolio Margin Pro REST API

1. [API Reference](/en/docs/catalog)
2. [Portfolio Margin Pro](/en/docs/catalog#advanced-trading-derivatives-trading-portfolio-margin-pro)
3. [REST API](/en/docs/catalog/advanced-trading-derivatives-trading-portfolio-margin-pro/api/rest-api)

# Account

Endpoint

https://api.binance.comhttps://api1.binance.comhttps://api2.binance.comhttps://api3.binance.comhttps://api4.binance.com

[Download schema](/en/docs/catalog/advanced-trading-derivatives-trading-portfolio-margin-pro/api/rest-api/1.0.0/schema.yaml)

---

## BNB transfer (USER\_DATA)

BNB transfer can be between Margin Account and USDM Account

POST

/sapi/v1/portfolio/bnb-transfer

https://api.binance.com

### BNB transfer (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### BNB transfer (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### BNB transfer (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### BNB transfer (USER\_DATA) › Request Body

`amount`

​number · float · required

Example: 1.0

`transferSide`

​string · enum · required

Enum values:

TO\_UM

FROM\_UM

Example: TO\_UM

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

* You can only use this function 2 times per 10 minutes in a rolling manner

### BNB transfer (USER\_DATA) › Responses

200

BNB transfer

`tranId`

​integer · int64

tran Id.

Example: 100000001

POST/sapi/v1/portfolio/bnb-transfer

Loading…

`curl --request POST \
 --url https://api.binance.com/sapi/v1/portfolio/bnb-transfer \
 --header 'Content-Type: application/x-www-form-urlencoded' \
 --header 'X-MBX-APIKEY: <string>' \
 --data amount=1.0 \
 --data transferSide=TO_UM \
 --data timestamp=1770736694138`

Example Request Body

`{
 "amount": "1.0",
 "transferSide": "TO_UM",
 "timestamp": 1770736694138
}`

json

Example Responses

200

`{
 "tranId": 100000001
}`

json

application/json

---

## Get Auto-repay-futures Status (USER\_DATA)

Query Auto-repay-futures Status

GET

/sapi/v1/portfolio/repay-futures-switch

https://api.binance.com

### Get Auto-repay-futures Status (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Get Auto-repay-futures Status (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight30

### Get Auto-repay-futures Status (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Auto-repay-futures Status (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

### Get Auto-repay-futures Status (USER\_DATA) › Responses

200

Get Auto-repay-futures Status

`autoRepay`

​boolean

"true" for turn on the auto-repay futures; "false" for turn off the auto-repay futures

Example: true

GET/sapi/v1/portfolio/repay-futures-switch

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/repay-futures-switch?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "autoRepay": true
}`

json

application/json

---

## Change Auto-repay-futures Status (TRADE)

Change Auto-repay-futures Status

POST

/sapi/v1/portfolio/repay-futures-switch

https://api.binance.com

### Change Auto-repay-futures Status (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Change Auto-repay-futures Status (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### Change Auto-repay-futures Status (TRADE) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Change Auto-repay-futures Status (TRADE) › Request Body

`autoRepay`

​string · enum · required

`false` for turn off the auto-repay futures negative balance function

Enum values:

true

false

Example: true

Default: true

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

### Change Auto-repay-futures Status (TRADE) › Responses

200

Change Auto-repay-futures Status

`msg`

​string

msg.

Example: success

POST/sapi/v1/portfolio/repay-futures-switch

Loading…

`curl --request POST \
 --url https://api.binance.com/sapi/v1/portfolio/repay-futures-switch \
 --header 'Content-Type: application/x-www-form-urlencoded' \
 --header 'X-MBX-APIKEY: <string>' \
 --data autoRepay=true \
 --data timestamp=1770736694138`

Example Request Body

`{
 "autoRepay": "true",
 "timestamp": 1770736694138
}`

json

Example Responses

200

`{
 "msg": "success"
}`

json

application/json

---

## Fund Auto-collection (USER\_DATA)

Transfers all assets from Futures Account to Margin account

POST

/sapi/v1/portfolio/auto-collection

https://api.binance.com

### Fund Auto-collection (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Fund Auto-collection (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### Fund Auto-collection (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Fund Auto-collection (USER\_DATA) › Request Body

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

* The BNB would not be collected from UM-PM account to the Portfolio Margin account.
* You can only use this function 500 times per hour in a rolling manner.

### Fund Auto-collection (USER\_DATA) › Responses

200

Fund Auto-collection

`msg`

​string

msg.

Example: success

POST/sapi/v1/portfolio/auto-collection

Loading…

`curl --request POST \
 --url https://api.binance.com/sapi/v1/portfolio/auto-collection \
 --header 'Content-Type: application/x-www-form-urlencoded' \
 --header 'X-MBX-APIKEY: <string>' \
 --data timestamp=1770736694138`

Example Request Body

`{
 "timestamp": 1770736694138
}`

json

Example Responses

200

`{
 "msg": "success"
}`

json

application/json

---

## Fund Collection by Asset (USER\_DATA)

Transfers specific asset from Futures Account to Margin account

POST

/sapi/v1/portfolio/asset-collection

https://api.binance.com

### Fund Collection by Asset (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Fund Collection by Asset (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight60

### Fund Collection by Asset (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Fund Collection by Asset (USER\_DATA) › Request Body

`asset`

​string · required

Example: USDT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

* The BNB transfer is not be supported

### Fund Collection by Asset (USER\_DATA) › Responses

200

Fund Collection by Asset

`msg`

​string

msg.

Example: success

POST/sapi/v1/portfolio/asset-collection

Loading…

`curl --request POST \
 --url https://api.binance.com/sapi/v1/portfolio/asset-collection \
 --header 'Content-Type: application/x-www-form-urlencoded' \
 --header 'X-MBX-APIKEY: <string>' \
 --data asset=USDT \
 --data timestamp=1770736694138`

Example Request Body

`{
 "asset": "USDT",
 "timestamp": 1770736694138
}`

json

Example Responses

200

`{
 "msg": "success"
}`

json

application/json

---

## Get Delta Mode Status (USER\_DATA)

Query the Delta mode status of current account.

GET

/sapi/v1/portfolio/delta-mode

https://api.binance.com

### Get Delta Mode Status (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Get Delta Mode Status (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### Get Delta Mode Status (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Delta Mode Status (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

### Get Delta Mode Status (USER\_DATA) › Responses

200

Get Delta Mode Status

`deltaEnabled`

​boolean

delta Enabled.

Example: false

GET/sapi/v1/portfolio/delta-mode

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/delta-mode?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "deltaEnabled": false
}`

json

application/json

---

## Switch Delta Mode (TRADE)

Switch the Delta mode for existing PM PRO / PM RETAIL accounts.

POST

/sapi/v1/portfolio/delta-mode

https://api.binance.com

### Switch Delta Mode (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Switch Delta Mode (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### Switch Delta Mode (TRADE) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Switch Delta Mode (TRADE) › Request Body

`deltaEnabled`

​string · enum · required

`true` to enable Delta mode; `false` to disable Delta mode

Enum values:

true

false

Example: true

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

### Switch Delta Mode (TRADE) › Responses

200

Switch Delta Mode

`msg`

​string

msg.

Example: success

POST/sapi/v1/portfolio/delta-mode

Loading…

`curl --request POST \
 --url https://api.binance.com/sapi/v1/portfolio/delta-mode \
 --header 'Content-Type: application/x-www-form-urlencoded' \
 --header 'X-MBX-APIKEY: <string>' \
 --data deltaEnabled=true \
 --data timestamp=1770736694138`

Example Request Body

`{
 "deltaEnabled": "true",
 "timestamp": 1770736694138
}`

json

Example Responses

200

`{
 "msg": "success"
}`

json

application/json

---

## Get Portfolio Margin Pro Account Balance (USER\_DATA)

Query Portfolio Margin Pro account balance

GET

/sapi/v1/portfolio/balance

https://api.binance.com

### Get Portfolio Margin Pro Account Balance (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Get Portfolio Margin Pro Account Balance (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight20

### Get Portfolio Margin Pro Account Balance (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Portfolio Margin Pro Account Balance (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`asset`

​string

Example: BTC

`recvWindow`

​integer · int64

Example: 5000

### Get Portfolio Margin Pro Account Balance (USER\_DATA) › Responses

200

Get Portfolio Margin Pro Account Balance

​object

`asset`

​string

asset.

Example: USDT

`totalWalletBalance`

​string

total Wallet Balance.

Example: 122607.35137903

`crossMarginAsset`

​string

cross Margin Asset.

Example: 92.27530794

`crossMarginBorrowed`

​string

cross Margin Borrowed.

Example: 10.00000000

`crossMarginFree`

​string

cross Margin Free.

Example: 100.00000000

`crossMarginInterest`

​string

cross Margin Interest.

Example: 0.72469206

`crossMarginLocked`

​string

cross Margin Locked.

Example: 3.00000000

`umWalletBalance`

​string

um Wallet Balance.

Example: 0.00000000

`umUnrealizedPNL`

​string

um Unrealized PNL.

Example: 23.72469206

`cmWalletBalance`

​string

cm Wallet Balance.

Example: 23.72469206

`cmUnrealizedPNL`

​string

cm Unrealized PNL.

Example:

`updateTime`

​integer · int64

update Time.

Example: 1617939110373

`negativeBalance`

​string

negative Balance.

Example: 0

`optionWalletBalance`

​string

option Wallet Balance.

Example: 0

`optionEquity`

​string

option Equity.

Example: 0

GET/sapi/v1/portfolio/balance

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/balance?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "asset": "USDT",
 "totalWalletBalance": "122607.35137903",
 "crossMarginAsset": "92.27530794",
 "crossMarginBorrowed": "10.00000000",
 "crossMarginFree": "100.00000000",
 "crossMarginInterest": "0.72469206",
 "crossMarginLocked": "3.00000000",
 "umWalletBalance": "0.00000000",
 "umUnrealizedPNL": "23.72469206",
 "cmWalletBalance": "23.72469206",
 "cmUnrealizedPNL": "",
 "updateTime": 1617939110373,
 "negativeBalance": "0",
 "optionWalletBalance": "0",
 "optionEquity": "0"
 }
]`

json

application/json

---

## Get Portfolio Margin Pro Account Info (USER\_DATA)

Get Portfolio Margin Pro Account Info

GET

/sapi/v1/portfolio/account

https://api.binance.com

### Get Portfolio Margin Pro Account Info (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Get Portfolio Margin Pro Account Info (USER\_DATA) › Request Weight

This endpoint consumes account (UID)-based request weight. Heavier endpoints consume more of your account rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

Account Weight5

### Get Portfolio Margin Pro Account Info (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Portfolio Margin Pro Account Info (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

### Get Portfolio Margin Pro Account Info (USER\_DATA) › Responses

200

Get Portfolio Margin Pro Account Info

`uniMMR`

​string

Classic Portfolio margin account maintenance margin rate

Example: 5167.92171923

`accountEquity`

​string

Account equity, unit：USD

Example: 122607.35137903

`actualEquity`

​string

Actual equity, unit：USD

Example: 142607.35137903

`accountMaintMargin`

​string

Classic Portfolio margin account maintenance margin, unit：USD

Example: 23.72469206

`accountInitialMargin`

​string

Ignored for PM PRO and PM PRO SPAN

Example: 47.44938412

`totalAvailableBalance`

​string

Ignored for PM PRO and PM PRO SPAN

Example: 122,559.90199491

`accountStatus`

​string

Classic Portfolio margin account status:"NORMAL", "MARGIN\_CALL", "SUPPLY\_MARGIN", "REDUCE\_ONLY", "ACTIVE\_LIQUIDATION", "FORCE\_LIQUIDATION", "BANKRUPTED"

Example: NORMAL

`accountType`

​string

PM\_1 for PM PRO, PM\_2 for PM, PM\_3 for PM PRO SPAN

Example: PM\_1

GET/sapi/v1/portfolio/account

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/account?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "uniMMR": "5167.92171923",
 "accountEquity": "122607.35137903",
 "actualEquity": "142607.35137903",
 "accountMaintMargin": "23.72469206",
 "accountInitialMargin": "47.44938412",
 "totalAvailableBalance": "122,559.90199491",
 "accountStatus": "NORMAL",
 "accountType": "PM_1"
}`

json

application/json

---

## Get Portfolio Margin Pro SPAN Account Info (USER\_DATA)

Get Portfolio Margin Pro SPAN Account Info (For Portfolio Margin Pro SPAN users only)

GET

/sapi/v2/portfolio/account

https://api.binance.com

### Get Portfolio Margin Pro SPAN Account Info (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Get Portfolio Margin Pro SPAN Account Info (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight5

### Get Portfolio Margin Pro SPAN Account Info (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Portfolio Margin Pro SPAN Account Info (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

### Get Portfolio Margin Pro SPAN Account Info (USER\_DATA) › Responses

200

Get Portfolio Margin Pro SPAN Account Info

`uniMMR`

​string

uni MMR.

Example: 5167.92171923

`accountEquity`

​string

Account equity, unit：USD

Example: 122607.35137903

`actualEquity`

​string

Actual equity, unit：USD

Example: 142607.35137903

`accountMaintMargin`

​string

Account maintenance margin, unit：USD

Example: 23.72469206

`riskUnitMMList`

​object[]

`asset`

​string

asset.

Example: BTC

`uniMaintainUsd`

​string

uni Maintain Usd.

Example: 23.72469206

`marginMM`

​string

margin MM.

Example: 0.00000000

`otherMM`

​string

other MM.

Example: 0.00000000

`accountStatus`

​string

Classic Portfolio margin account status:"NORMAL", "MARGIN\_CALL", "SUPPLY\_MARGIN", "REDUCE\_ONLY", "ACTIVE\_LIQUIDATION", "FORCE\_LIQUIDATION", "BANKRUPTED"

Example: NORMAL

`accountType`

​string

PM\_1 for classic PM, PM\_2 for PM, PM\_3 for PM Pro(SPAN)

Example: PM\_3

GET/sapi/v2/portfolio/account

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v2/portfolio/account?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "uniMMR": "5167.92171923",
 "accountEquity": "122607.35137903",
 "actualEquity": "142607.35137903",
 "accountMaintMargin": "23.72469206",
 "riskUnitMMList": [
 {
 "asset": "BTC",
 "uniMaintainUsd": "23.72469206"
 }
 ],
 "marginMM": "0.00000000",
 "otherMM": "0.00000000",
 "accountStatus": "NORMAL",
 "accountType": "PM_3"
}`

json

application/json

---

## Get Transferable Earn Asset Balance for Portfolio Margin (USER\_DATA)

Get transferable earn asset balance for all types of Portfolio Margin account

GET

/sapi/v1/portfolio/earn-asset-balance

https://api.binance.com

### Get Transferable Earn Asset Balance for Portfolio Margin (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Get Transferable Earn Asset Balance for Portfolio Margin (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### Get Transferable Earn Asset Balance for Portfolio Margin (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Transferable Earn Asset Balance for Portfolio Margin (USER\_DATA) › Query Parameters

`asset`

​string · required

`LDUSDT` only

Example: LDUSDT

`transferType`

​string · enum · required

Enum values:

EARN\_TO\_FUTURE

FUTURE\_TO\_EARN

Example: EARN\_TO\_FUTURE

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

### Get Transferable Earn Asset Balance for Portfolio Margin (USER\_DATA) › Responses

200

Get Transferable Earn Asset Balance for Portfolio Margin

`asset`

​string

asset.

Example: LDUSDT

`amount`

​string

amount.

Example: 0.55

GET/sapi/v1/portfolio/earn-asset-balance

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/earn-asset-balance?asset=%3Cstring%3E&transferType=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "asset": "LDUSDT",
 "amount": "0.55"
}`

json

application/json

---

## Portfolio Margin Pro Bankruptcy Loan Repay (TRADE)

Repay Portfolio Margin Pro Bankruptcy Loan

POST

/sapi/v1/portfolio/repay

https://api.binance.com

### Portfolio Margin Pro Bankruptcy Loan Repay (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Portfolio Margin Pro Bankruptcy Loan Repay (TRADE) › Request Weight

This endpoint consumes account (UID)-based request weight. Heavier endpoints consume more of your account rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

Account Weight3000

### Portfolio Margin Pro Bankruptcy Loan Repay (TRADE) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Portfolio Margin Pro Bankruptcy Loan Repay (TRADE) › Request Body

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`from`

​string · enum

Enum values:

SPOT

MARGIN

Example: SPOT

Default: SPOT

`recvWindow`

​integer · int64

Example: 5000

* Please note that the API Key has enabled Spot & Margin Trading permissions to access this endpoint.

### Portfolio Margin Pro Bankruptcy Loan Repay (TRADE) › Responses

200

Portfolio Margin Pro Bankruptcy Loan Repay

`tranId`

​integer · int64

tran Id.

Example: 58203331886213500

POST/sapi/v1/portfolio/repay

Loading…

`curl --request POST \
 --url https://api.binance.com/sapi/v1/portfolio/repay \
 --header 'Content-Type: application/x-www-form-urlencoded' \
 --header 'X-MBX-APIKEY: <string>' \
 --data timestamp=1770736694138`

Example Request Body

`{
 "timestamp": 1770736694138
}`

json

Example Responses

200

`{
 "tranId": 58203331886213500
}`

json

application/json

---

## Query Portfolio Margin Pro Bankruptcy Loan Amount (USER\_DATA)

Query Portfolio Margin Pro Bankruptcy Loan Amount

GET

/sapi/v1/portfolio/pmLoan

https://api.binance.com

### Query Portfolio Margin Pro Bankruptcy Loan Amount (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Query Portfolio Margin Pro Bankruptcy Loan Amount (USER\_DATA) › Request Weight

This endpoint consumes account (UID)-based request weight. Heavier endpoints consume more of your account rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

Account Weight500

### Query Portfolio Margin Pro Bankruptcy Loan Amount (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Portfolio Margin Pro Bankruptcy Loan Amount (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

* If there’s no classic portfolio margin bankruptcy loan, the amount would be 0

### Query Portfolio Margin Pro Bankruptcy Loan Amount (USER\_DATA) › Responses

200

Portfolio Margin Pro Bankruptcy Loan Amount

`asset`

​string

asset.

Example: BUSD

`amount`

​string

portfolio margin bankruptcy loan amount in BUSD

Example: 579.45

GET/sapi/v1/portfolio/pmLoan

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/pmLoan?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "asset": "BUSD",
 "amount": "579.45"
}`

json

application/json

---

## Query Portfolio Margin Pro Bankruptcy Loan Repay History (USER\_DATA)

Query repay history of pmloan for portfolio margin pro.

GET

/sapi/v1/portfolio/pmloan-history

https://api.binance.com

### Query Portfolio Margin Pro Bankruptcy Loan Repay History (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Query Portfolio Margin Pro Bankruptcy Loan Repay History (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight500

### Query Portfolio Margin Pro Bankruptcy Loan Repay History (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Portfolio Margin Pro Bankruptcy Loan Repay History (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`startTime`

​integer · int64

Start time

Example: 1623319461670

`endTime`

​integer · int64

End time

Example: 1641782889000

`size`

​integer · int64 · max: 100

Number of results returned.

Example: 10

Default: 10

`current`

​integer · int64 · min: 1

Currently querying page. Start from 1.

Example: 1

Default: 1

`recvWindow`

​integer · int64

Example: 5000

* `startTime` and `endTime` cannot be longer than 360 days
* If `startTime` and `endTime` not sent, return records of the last 30 days by default.
* If `startTime`is sent and `endTime` is not sent, return records of [startTime, startTime+30d].
* If `startTime` is not sent and `endTime` is sent, return records of [endTime-30d, endTime].

### Query Portfolio Margin Pro Bankruptcy Loan Repay History (USER\_DATA) › Responses

200

Portfolio Margin Pro Bankruptcy Loan Repay History

`total`

​integer · int64

total.

Example: 3

`rows`

​object[]

`asset`

​string

asset.

Example: USDT

`amount`

​string

amount.

Example: 404.80294503

`repayTime`

​integer · int64

repay Time.

Example: 1731336427804

GET/sapi/v1/portfolio/pmloan-history

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/pmloan-history?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "total": 3,
 "rows": [
 {
 "asset": "USDT",
 "amount": "404.80294503",
 "repayTime": 1731336427804
 }
 ]
}`

json

application/json

---

## Query Portfolio Margin Pro Negative Balance Interest History (USER\_DATA)

Query interest history of negative balance for portfolio margin.

GET

/sapi/v1/portfolio/interest-history

https://api.binance.com

### Query Portfolio Margin Pro Negative Balance Interest History (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Query Portfolio Margin Pro Negative Balance Interest History (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight50

### Query Portfolio Margin Pro Negative Balance Interest History (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Portfolio Margin Pro Negative Balance Interest History (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`asset`

​string

Example: USDT

`startTime`

​integer · int64

Start time

Example: 1623319461670

`endTime`

​integer · int64

End time

Example: 1641782889000

`size`

​integer · int64 · max: 100

Number of results returned.

Example: 10

Default: 10

`recvWindow`

​integer · int64

Example: 5000

### Query Portfolio Margin Pro Negative Balance Interest History (USER\_DATA) › Responses

200

Portfolio Margin Pro Negative Balance Interest History

​object

`asset`

​string

asset.

Example: USDT

`interest`

​string

interest amount

Example: 24.4440

`interestAccruedTime`

​integer · int64

interest Accrued Time.

Example: 1670227200000

`interestRate`

​string

daily interest rate

Example: 0.0001164

`principal`

​string

principal.

Example: 210000

GET/sapi/v1/portfolio/interest-history

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/interest-history?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "asset": "USDT",
 "interest": "24.4440",
 "interestAccruedTime": 1670227200000,
 "interestRate": "0.0001164",
 "principal": "210000"
 }
]`

json

application/json

---

## Repay futures Negative Balance (USER\_DATA)

Repay futures Negative Balance

POST

/sapi/v1/portfolio/repay-futures-negative-balance

https://api.binance.com

### Repay futures Negative Balance (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Repay futures Negative Balance (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### Repay futures Negative Balance (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Repay futures Negative Balance (USER\_DATA) › Request Body

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`from`

​string · enum

Enum values:

SPOT

MARGIN

Example: SPOT

Default: SPOT

`recvWindow`

​integer · int64

Example: 5000

### Repay futures Negative Balance (USER\_DATA) › Responses

200

Repay futures Negative Balance

`msg`

​string

msg.

Example: success

POST/sapi/v1/portfolio/repay-futures-negative-balance

Loading…

`curl --request POST \
 --url https://api.binance.com/sapi/v1/portfolio/repay-futures-negative-balance \
 --header 'Content-Type: application/x-www-form-urlencoded' \
 --header 'X-MBX-APIKEY: <string>' \
 --data timestamp=1770736694138`

Example Request Body

`{
 "timestamp": 1770736694138
}`

json

Example Responses

200

`{
 "msg": "success"
}`

json

application/json

---

## Transfer LDUSDT/RWUSD for Portfolio Margin (TRADE)

Transfer LDUSDT/RWUSD as collateral for all types of Portfolio Margin account

POST

/sapi/v1/portfolio/earn-asset-transfer

https://api.binance.com

### Transfer LDUSDT/RWUSD for Portfolio Margin (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Transfer LDUSDT/RWUSD for Portfolio Margin (TRADE) › Request Weight

This endpoint consumes account (UID)-based request weight. Heavier endpoints consume more of your account rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

Account Weight1500

### Transfer LDUSDT/RWUSD for Portfolio Margin (TRADE) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Transfer LDUSDT/RWUSD for Portfolio Margin (TRADE) › Request Body

`asset`

​string · enum · required

Enum values:

LDUSDT

RWUSD

Example: LDUSDT

`transferType`

​string · enum · required

Enum values:

EARN\_TO\_FUTURE

FUTURE\_TO\_EARN

Example: EARN\_TO\_FUTURE

`amount`

​number · float · required

Example: 1

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

### Transfer LDUSDT/RWUSD for Portfolio Margin (TRADE) › Responses

200

Transfer LDUSDT/RWUSD for Portfolio Margin

`msg`

​string

msg.

Example: success

POST/sapi/v1/portfolio/earn-asset-transfer

Loading…

`curl --request POST \
 --url https://api.binance.com/sapi/v1/portfolio/earn-asset-transfer \
 --header 'Content-Type: application/x-www-form-urlencoded' \
 --header 'X-MBX-APIKEY: <string>' \
 --data asset=LDUSDT \
 --data transferType=EARN_TO_FUTURE \
 --data amount=1 \
 --data timestamp=1770736694138`

Example Request Body

`{
 "asset": "LDUSDT",
 "transferType": "EARN_TO_FUTURE",
 "amount": 1,
 "timestamp": 1770736694138
}`

json

Example Responses

200

`{
 "msg": "success"
}`

json

application/json

---

## Get Margin Call Level (USER\_DATA)

Get the margin call level for a Portfolio Margin account.

GET

/sapi/v1/portfolio/margin-call-level

https://api.binance.com

### Get Margin Call Level (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Get Margin Call Level (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### Get Margin Call Level (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Margin Call Level (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and
is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Request validity window in milliseconds

Example: 5000

### Get Margin Call Level (USER\_DATA) › Responses

200

Get Margin Call Level

`marginCallLevel`

​string

The margin call level value. Empty object returned if not set.

Example: 1.67354637

GET/sapi/v1/portfolio/margin-call-level

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/margin-call-level?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "marginCallLevel": "1.67354637"
}`

json

application/json

---

## Set Margin Call Level (USER\_DATA)

Set the margin call level for a Portfolio Margin account. When the account's uniMMR drops to the specified level, a notification will be sent via email and SMS.

POST

/sapi/v1/portfolio/margin-call-level

https://api.binance.com

### Set Margin Call Level (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Set Margin Call Level (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### Set Margin Call Level (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Set Margin Call Level (USER\_DATA) › Request Body

`marginCallLevel`

​number · float · required

The value must be within the range [1.1, 2.0].

Example: 1.5

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and
is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Request validity window in milliseconds

Example: 5000

### Set Margin Call Level (USER\_DATA) › Responses

200

Set Margin Call Level

`marginCallLevel`

​string

The margin call level that was set

Example: 1.67354637

POST/sapi/v1/portfolio/margin-call-level

Loading…

`curl --request POST \
 --url https://api.binance.com/sapi/v1/portfolio/margin-call-level \
 --header 'Content-Type: application/x-www-form-urlencoded' \
 --header 'X-MBX-APIKEY: <string>' \
 --data marginCallLevel=1.5 \
 --data timestamp=1770736694138`

Example Request Body

`{
 "marginCallLevel": 1.5,
 "timestamp": 1770736694138
}`

json

Example Responses

200

`{
 "marginCallLevel": "1.67354637"
}`

json

application/json

---

## Delete Margin Call Level (USER\_DATA)

Delete the margin call level for a Portfolio Margin account.

DELETE

/sapi/v1/portfolio/margin-call-level

https://api.binance.com

### Delete Margin Call Level (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Delete Margin Call Level (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight1500

### Delete Margin Call Level (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Delete Margin Call Level (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and
is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Request validity window in milliseconds

Example: 5000

### Delete Margin Call Level (USER\_DATA) › Responses

200

Delete Margin Call Level

`msg`

​string

Example: success

DELETE/sapi/v1/portfolio/margin-call-level

Loading…

`curl --request DELETE \
 --url 'https://api.binance.com/sapi/v1/portfolio/margin-call-level?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "msg": "success"
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/advanced-trading-derivatives-trading-portfolio-margin-pro/api/rest-api/market-data -->

# Market Data - Portfolio Margin Pro REST API | Binance Developer Docs

Portfolio Margin Pro REST API

1. [API Reference](/en/docs/catalog)
2. [Portfolio Margin Pro](/en/docs/catalog#advanced-trading-derivatives-trading-portfolio-margin-pro)
3. [REST API](/en/docs/catalog/advanced-trading-derivatives-trading-portfolio-margin-pro/api/rest-api)

# Market Data

Endpoint

https://api.binance.comhttps://api1.binance.comhttps://api2.binance.comhttps://api3.binance.comhttps://api4.binance.com

[Download schema](/en/docs/catalog/advanced-trading-derivatives-trading-portfolio-margin-pro/api/rest-api/1.0.0/schema.yaml)

---

## Get Portfolio Margin Asset Leverage (USER\_DATA)

Get Portfolio Margin Asset Leverage

GET

/sapi/v1/portfolio/margin-asset-leverage

https://api.binance.com

### Get Portfolio Margin Asset Leverage (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Get Portfolio Margin Asset Leverage (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight50

### Get Portfolio Margin Asset Leverage (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Portfolio Margin Asset Leverage (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

### Get Portfolio Margin Asset Leverage (USER\_DATA) › Responses

200

Get Portfolio Margin Asset Leverage

​object

`asset`

​string

asset.

Example: USDC

`leverage`

​integer · int64

leverage.

Example: 10

GET/sapi/v1/portfolio/margin-asset-leverage

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v1/portfolio/margin-asset-leverage?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "asset": "USDC",
 "leverage": 10
 }
]`

json

application/json

---

## Portfolio Margin Collateral Rate (MARKET\_DATA)

Portfolio Margin Collateral Rate

GET

/sapi/v1/portfolio/collateralRate

https://api.binance.com

### Portfolio Margin Collateral Rate (MARKET\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight50

### Portfolio Margin Collateral Rate (MARKET\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Portfolio Margin Collateral Rate (MARKET\_DATA) › Responses

200

Portfolio Margin Collateral Rate

​object

`asset`

​string

asset.

Example: USDC

`collateralRate`

​string

collateral Rate.

Example: 1.0000

GET/sapi/v1/portfolio/collateralRate

Loading…

`curl --request GET \
 --url https://api.binance.com/sapi/v1/portfolio/collateralRate \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "asset": "USDC",
 "collateralRate": "1.0000"
 }
]`

json

application/json

---

## Portfolio Margin Pro Tiered Collateral Rate (USER\_DATA)

Portfolio Margin PRO Tiered Collateral Rate

GET

/sapi/v2/portfolio/collateralRate

https://api.binance.com

### Portfolio Margin Pro Tiered Collateral Rate (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#endpoint-security-type)

### Portfolio Margin Pro Tiered Collateral Rate (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight50

### Portfolio Margin Pro Tiered Collateral Rate (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Portfolio Margin Pro Tiered Collateral Rate (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64

Example: 5000

### Portfolio Margin Pro Tiered Collateral Rate (USER\_DATA) › Responses

200

Portfolio Margin Pro Tiered Collateral Rate

​object

`asset`

​string

asset.

Example: BNB

`collateralInfo`

​object[]

`tierFloor`

​string

tier Floor.

Example: 0.0000

`tierCap`

​string

tier Cap.

Example: 1000.0000

`collateralRate`

​string

collateral Rate.

Example: 1.0000

`cum`

​string

account equity quick addition number

Example: 0.0000

GET/sapi/v2/portfolio/collateralRate

Loading…

`curl --request GET \
 --url 'https://api.binance.com/sapi/v2/portfolio/collateralRate?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "asset": "BNB",
 "collateralInfo": [
 {
 "tierFloor": "0.0000",
 "tierCap": "1000.0000",
 "collateralRate": "1.0000",
 "cum": "0.0000"
 }
 ]
 }
]`

json

application/json

---

## Query Portfolio Margin Asset Index Price (MARKET\_DATA)

Query Portfolio Margin Asset Index Price

GET

/sapi/v1/portfolio/asset-index-price

https://api.binance.com

### Query Portfolio Margin Asset Index Price (MARKET\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-portfolio-margin-pro/general-info#limits) section.

IP Weight

* 1 if `asset` is sent
* 50 if `asset` is not sent

### Query Portfolio Margin Asset Index Price (MARKET\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Query Portfolio Margin Asset Index Price (MARKET\_DATA) › Query Parameters

`asset`

​string

Example: BTC

### Query Portfolio Margin Asset Index Price (MARKET\_DATA) › Responses

200

Portfolio Margin Asset Index Price

​object

`asset`

​string

asset.

Example: BTC

`assetIndexPrice`

​string

in USD

Example: 28251.9136906

`time`

​integer · int64

time.

Example: 1683518338121

GET/sapi/v1/portfolio/asset-index-price

Loading…

`curl --request GET \
 --url https://api.binance.com/sapi/v1/portfolio/asset-index-price \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "asset": "BTC",
 "assetIndexPrice": "28251.9136906",
 "time": 1683518338121
 }
]`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api/account -->

# Account - Futures (USDⓈ-M) WebSocket API | Binance Developer Docs

Futures (USDⓈ-M) WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Futures (USDⓈ-M)](/en/docs/catalog#core-trading-derivatives-trading-usd-s-m-futures)
3. [WebSocket API](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api)

# Account

Endpoint

wss://ws-fapi.binance.com/ws-fapi/v1wss://testnet.binancefuture.com/ws-fapi/v1

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api/1.0.0/schema.yaml)

---

## Account Information (USER\_DATA)

Get current account information. User in single-asset/ multi-assets mode will see different value, see comments in response section for detail.

WSS

account.status

wss://ws-fapi.binance.com/ws-fapi/v1

### Account Information (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-usds-futures/general-info#endpoint-security-type)

### Account Information (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight5

### Account Information (USER\_DATA) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

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

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64

Recv Window.

Example: 5000

### Account Information (USER\_DATA) › Responses

Successful Response

Account Information

`id`

​string

Example: 605a6d20-6588-4cb9-afa0-b0ab087507ba

`status`

​integer · int64

Example: 200

`result`

​object

`feeTier`

​integer · int64

account commission tier

Example: 0

`canTrade`

​boolean

if can trade

Example: true

`canDeposit`

​boolean

if can transfer in asset

Example: true

`canWithdraw`

​boolean

if can transfer out asset

Example: true

`updateTime`

​integer · int64

reserved property, please ignore

Example: 0

`multiAssetsMargin`

​boolean

Example: true

`tradeGroupId`

​integer · int64

Example: -1

`totalInitialMargin`

​string

total initial margin required with current mark price (useless with isolated positions), only for USDT asset

Example: 0.00000000

`totalMaintMargin`

​string

the sum of USD value of all cross positions maintenance margin

Example: 0.00000000

`totalWalletBalance`

​string

total wallet balance, only for USDT asset

Example: 126.72469206

`totalUnrealizedProfit`

​string

total unrealized profit, only for USDT asset

Example: 0.00000000

`totalMarginBalance`

​string

total margin balance, only for USDT asset

Example: 126.72469206

`totalPositionInitialMargin`

​string

initial margin required for positions with current mark price, only for USDT asset

Example: 0.00000000

`totalOpenOrderInitialMargin`

​string

initial margin required for open orders with current mark price, only for USDT asset

Example: 0.00000000

`totalCrossWalletBalance`

​string

crossed wallet balance, only for USDT asset

Example: 126.72469206

`totalCrossUnPnl`

​string

unrealized profit of crossed positions, only for USDT asset

Example: 0.00000000

`availableBalance`

​string

available balance, only for USDT asset

Example: 126.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out, only for USDT asset

Example: 126.72469206

`assets`

​object[]

`asset`

​string

asset name

Example: USDT

`walletBalance`

​string

wallet balance

Example: 23.72469206

`unrealizedProfit`

​string

unrealized profit

Example: 0.00000000

`marginBalance`

​string

margin balance

Example: 23.72469206

`maintMargin`

​string

maintenance margin required

Example: 0.00000000

`initialMargin`

​string

total initial margin required with current mark price

Example: 0.00000000

`positionInitialMargin`

​string

initial margin required for positions with current mark price

Example: 0.00000000

`openOrderInitialMargin`

​string

initial margin required for open orders with current mark price

Example: 0.00000000

`crossWalletBalance`

​string

crossed wallet balance

Example: 23.72469206

`crossUnPnl`

​string

unrealized profit of crossed positions

Example: 0.00000000

`availableBalance`

​string

available balance, only for USDT asset

Example: 126.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out, only for USDT asset

Example: 23.72469206

`marginAvailable`

​boolean

whether the asset can be used as margin in Multi-Assets mode

Example: true

`updateTime`

​integer · int64

reserved property, please ignore

Example: 1625474304765

`positions`

​object[]

positions of all symbols in the market are returned

`symbol`

​string

symbol name

Example: BTCUSDT

`initialMargin`

​string

total initial margin required with current mark price

Example: 0

`maintMargin`

​string

maintenance margin required

Example: 0

`unrealizedProfit`

​string

unrealized profit

Example: 0.00000000

`positionInitialMargin`

​string

initial margin required for positions with current mark price

Example: 0

`openOrderInitialMargin`

​string

initial margin required for open orders with current mark price

Example: 0

`leverage`

​string

current initial leverage

Example: 100

`isolated`

​boolean

if the position is isolated

Example: true

`entryPrice`

​string

average entry price

Example: 0.00000

`maxNotional`

​string

maximum available notional with current leverage

Example: 250000

`bidNotional`

​string

bids notional, ignore

Example: 0

`askNotional`

​string

ask notional, ignore

Example: 0

`positionSide`

​string

position side

Example: BOTH

`positionAmt`

​string

position amount

Example: 0

`updateTime`

​integer · int64

reserved property, please ignore

Example: 0

`breakEvenPrice`

​string

average entry price

Example: 0.0

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

Example: 2400

`count`

​integer · int64

Example: 20

WSSaccount.status

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
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
 "feeTier": 0,
 "canTrade": true,
 "canDeposit": true,
 "canWithdraw": true,
 "updateTime": 0,
 "multiAssetsMargin": true,
 "tradeGroupId": -1,
 "totalInitialMargin": "0.00000000",
 "totalMaintMargin": "0.00000000",
 "totalWalletBalance": "126.72469206",
 "totalUnrealizedProfit": "0.00000000",
 "totalMarginBalance": "126.72469206",
 "totalPositionInitialMargin": "0.00000000",
 "totalOpenOrderInitialMargin": "0.00000000",
 "totalCrossWalletBalance": "126.72469206",
 "totalCrossUnPnl": "0.00000000",
 "availableBalance": "126.72469206",
 "maxWithdrawAmount": "126.72469206",
 "assets": [
 {
 "asset": "USDT",
 "walletBalance": "23.72469206",
 "unrealizedProfit": "0.00000000",
 "marginBalance": "23.72469206",
 "maintMargin": "0.00000000",
 "initialMargin": "0.00000000",
 "positionInitialMargin": "0.00000000",
 "openOrderInitialMargin": "0.00000000",
 "crossWalletBalance": "23.72469206",
 "crossUnPnl": "0.00000000",
 "availableBalance": "126.72469206",
 "maxWithdrawAmount": "23.72469206",
 "marginAvailable": true,
 "updateTime": 1625474304765
 }
 ],
 "positions": [
 {
 "symbol": "BTCUSDT",
 "initialMargin": "0",
 "maintMargin": "0",
 "unrealizedProfit": "0.00000000",
 "positionInitialMargin": "0",
 "openOrderInitialMargin": "0",
 "leverage": "100",
 "isolated": true,
 "entryPrice": "0.00000",
 "maxNotional": "250000",
 "bidNotional": "0",
 "askNotional": "0",
 "positionSide": "BOTH",
 "positionAmt": "0",
 "updateTime": 0,
 "breakEvenPrice": "0.0"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 20
 }
 ]
}`

json

application/json

---

## Account Information V2 (USER\_DATA)

Get current account information. User in single-asset/ multi-assets mode will see different value, see comments in response section for detail.

WSS

v2/account.status

wss://ws-fapi.binance.com/ws-fapi/v1

### Account Information V2 (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-usds-futures/general-info#endpoint-security-type)

### Account Information V2 (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight5

### Account Information V2 (USER\_DATA) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

v2/account.status

Example: v2/account.status

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64

Recv Window.

Example: 5000

### Account Information V2 (USER\_DATA) › Responses

Successful Response

Account Information V2

`id`

​string

Example: 605a6d20-6588-4cb9-afa0-b0ab087507ba

`status`

​integer · int64

Example: 200

`result`

​object

`totalInitialMargin`

​string

total initial margin required with current mark price (useless with isolated positions), only for USDT asset

Example: 0.00000000

`totalMaintMargin`

​string

the sum of USD value of all cross positions maintenance margin

Example: 0.00000000

`totalWalletBalance`

​string

total wallet balance, only for USDT asset

Example: 126.72469206

`totalUnrealizedProfit`

​string

total unrealized profit, only for USDT asset

Example: 0.00000000

`totalMarginBalance`

​string

total margin balance, only for USDT asset

Example: 126.72469206

`totalPositionInitialMargin`

​string

initial margin required for positions with current mark price, only for USDT asset

Example: 0.00000000

`totalOpenOrderInitialMargin`

​string

initial margin required for open orders with current mark price, only for USDT asset

Example: 0.00000000

`totalCrossWalletBalance`

​string

crossed wallet balance, only for USDT asset

Example: 126.72469206

`totalCrossUnPnl`

​string

unrealized profit of crossed positions, only for USDT asset

Example: 0.00000000

`availableBalance`

​string

available balance, only for USDT asset

Example: 126.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out, only for USDT asset

Example: 126.72469206

`assets`

​object[]

For assets that are quote assets, USDT/USDC/BTC

`asset`

​string

asset name

Example: USDT

`walletBalance`

​string

wallet balance

Example: 23.72469206

`unrealizedProfit`

​string

unrealized profit

Example: 0.00000000

`marginBalance`

​string

margin balance

Example: 23.72469206

`maintMargin`

​string

maintenance margin required

Example: 0.00000000

`initialMargin`

​string

total initial margin required with current mark price

Example: 0.00000000

`positionInitialMargin`

​string

initial margin required for positions with current mark price

Example: 0.00000000

`openOrderInitialMargin`

​string

initial margin required for open orders with current mark price

Example: 0.00000000

`crossWalletBalance`

​string

crossed wallet balance

Example: 23.72469206

`crossUnPnl`

​string

unrealized profit of crossed positions

Example: 0.00000000

`availableBalance`

​string

available balance, only for USDT asset

Example: 23.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out, only for USDT asset

Example: 23.72469206

`marginAvailable`

​boolean

whether the asset can be used as margin in Multi-Assets mode

Example: true

`updateTime`

​integer · int64

last update time

Example: 1625474304765

`positions`

​object[]

positions of all symbols user had position/ open orders are returned

`symbol`

​string

Example: BTCUSDT

`positionSide`

​string

position side

Example: BOTH

`positionAmt`

​string

Example: 1.000

`unrealizedProfit`

​string

unrealized profit

Example: 0.00000000

`isolatedMargin`

​string

Example: 0.00000000

`notional`

​string

Example: 0

`isolatedWallet`

​string

Example: 0

`initialMargin`

​string

total initial margin required with current mark price

Example: 0

`maintMargin`

​string

maintenance margin required

Example: 0

`updateTime`

​integer · int64

last update time

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

Example: 2400

`count`

​integer · int64

Example: 20

WSSv2/account.status

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "v2/account.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "v2/account.status",
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
 "totalInitialMargin": "0.00000000",
 "totalMaintMargin": "0.00000000",
 "totalWalletBalance": "126.72469206",
 "totalUnrealizedProfit": "0.00000000",
 "totalMarginBalance": "126.72469206",
 "totalPositionInitialMargin": "0.00000000",
 "totalOpenOrderInitialMargin": "0.00000000",
 "totalCrossWalletBalance": "126.72469206",
 "totalCrossUnPnl": "0.00000000",
 "availableBalance": "126.72469206",
 "maxWithdrawAmount": "126.72469206",
 "assets": [
 {
 "asset": "USDT",
 "walletBalance": "23.72469206",
 "unrealizedProfit": "0.00000000",
 "marginBalance": "23.72469206",
 "maintMargin": "0.00000000",
 "initialMargin": "0.00000000",
 "positionInitialMargin": "0.00000000",
 "openOrderInitialMargin": "0.00000000",
 "crossWalletBalance": "23.72469206",
 "crossUnPnl": "0.00000000",
 "availableBalance": "23.72469206",
 "maxWithdrawAmount": "23.72469206",
 "marginAvailable": true,
 "updateTime": 1625474304765
 }
 ],
 "positions": [
 {
 "symbol": "BTCUSDT",
 "positionSide": "BOTH",
 "positionAmt": "1.000",
 "unrealizedProfit": "0.00000000",
 "isolatedMargin": "0.00000000",
 "notional": "0",
 "isolatedWallet": "0",
 "initialMargin": "0",
 "maintMargin": "0",
 "updateTime": 0
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 20
 }
 ]
}`

json

application/json

---

## Futures Account Balance (USER\_DATA)

Futures Account Balance

WSS

account.balance

wss://ws-fapi.binance.com/ws-fapi/v1

### Futures Account Balance (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-usds-futures/general-info#endpoint-security-type)

### Futures Account Balance (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight5

### Futures Account Balance (USER\_DATA) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

account.balance

Example: account.balance

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64

Recv Window.

Example: 5000

### Futures Account Balance (USER\_DATA) › Responses

Successful Response

Futures Account Balance

`id`

​string

Example: 605a6d20-6588-4cb9-afa0-b0ab087507ba

`status`

​integer · int64

Example: 200

`result`

​object[]

`accountAlias`

​string

unique account code

Example: SgsR

`asset`

​string

asset name

Example: USDT

`balance`

​string

wallet balance

Example: 122607.35137903

`crossWalletBalance`

​string

crossed wallet balance

Example: 23.72469206

`crossUnPnl`

​string

unrealized profit of crossed positions

Example: 0.00000000

`availableBalance`

​string

available balance

Example: 23.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out

Example: 23.72469206

`marginAvailable`

​boolean

whether the asset can be used as margin in Multi-Assets mode

Example: true

`updateTime`

​integer · int64

Example: 1617939110373

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

Example: 2400

`count`

​integer · int64

Example: 20

WSSaccount.balance

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.balance",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.balance",
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
 "result": [
 {
 "accountAlias": "SgsR",
 "asset": "USDT",
 "balance": "122607.35137903",
 "crossWalletBalance": "23.72469206",
 "crossUnPnl": "0.00000000",
 "availableBalance": "23.72469206",
 "maxWithdrawAmount": "23.72469206",
 "marginAvailable": true,
 "updateTime": 1617939110373
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 20
 }
 ]
}`

json

application/json

---

## Futures Account Balance V2 (USER\_DATA)

Futures Account Balance V2

WSS

v2/account.balance

wss://ws-fapi.binance.com/ws-fapi/v1

### Futures Account Balance V2 (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-usds-futures/general-info#endpoint-security-type)

### Futures Account Balance V2 (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight5

### Futures Account Balance V2 (USER\_DATA) › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

v2/account.balance

Example: v2/account.balance

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value must reflect the current client time and is validated by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64

Recv Window.

Example: 5000

### Futures Account Balance V2 (USER\_DATA) › Responses

Successful Response

Futures Account Balance V2

`id`

​string

Example: 605a6d20-6588-4cb9-afa0-b0ab087507ba

`status`

​integer · int64

Example: 200

`result`

​object[]

`accountAlias`

​string

unique account code

Example: SgsR

`asset`

​string

asset name

Example: USDT

`balance`

​string

wallet balance

Example: 122607.35137903

`crossWalletBalance`

​string

crossed wallet balance

Example: 23.72469206

`crossUnPnl`

​string

unrealized profit of crossed positions

Example: 0.00000000

`availableBalance`

​string

available balance

Example: 23.72469206

`maxWithdrawAmount`

​string

maximum amount for transfer out

Example: 23.72469206

`marginAvailable`

​boolean

whether the asset can be used as margin in Multi-Assets mode

Example: true

`updateTime`

​integer · int64

Example: 1617939110373

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

Example: 2400

`count`

​integer · int64

Example: 20

WSSv2/account.balance

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "v2/account.balance",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "v2/account.balance",
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
 "result": [
 {
 "accountAlias": "SgsR",
 "asset": "USDT",
 "balance": "122607.35137903",
 "crossWalletBalance": "23.72469206",
 "crossUnPnl": "0.00000000",
 "availableBalance": "23.72469206",
 "maxWithdrawAmount": "23.72469206",
 "marginAvailable": true,
 "updateTime": 1617939110373
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 20
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api/market-data -->

# Market Data - Futures (USDⓈ-M) WebSocket API | Binance Developer Docs

Futures (USDⓈ-M) WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Futures (USDⓈ-M)](/en/docs/catalog#core-trading-derivatives-trading-usd-s-m-futures)
3. [WebSocket API](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api)

# Market Data

Endpoint

wss://ws-fapi.binance.com/ws-fapi/v1wss://testnet.binancefuture.com/ws-fapi/v1

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-api/1.0.0/schema.yaml)

---

## Order Book

Get current order book. Note that this request returns limited market
depth.

If you need to continuously monitor order book updates, please consider
using Websocket Market Streams:

* `<symbol>@depth<levels>`
* `<symbol>@depth`

You can use `depth` request together with `<symbol>@depth` streams to
maintain a local order book.

**Note:**

* Retail Price Improvement(RPI) orders are not visible and excluded in
  the response message.

WSS

depth

wss://ws-fapi.binance.com/ws-fapi/v1

### Order Book › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight

Adjusted based on the limit:

| Limit | Weight |
| --- | --- |
| 5, 10, 20, 50 | 2 |
| 100 | 5 |
| 500 | 10 |
| 1000 | 20 |

### Order Book › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

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

Symbol.

Example: BTCUSDT

`limit`

​integer · int64 · max: 1000

Valid limits:[5, 10, 20, 50, 100, 500, 1000]

Example: 10

Default: 500

### Order Book › Responses

Successful Response

Order Book

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

Example: 1027024

`E`

​integer · int64

Message output time

Example: 1589436922972

`T`

​integer · int64

Transaction time

Example: 1589436922959

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

Example: 2400

`count`

​integer · int64

Example: 5

WSSdepth

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "depth",
 "params": {
 "symbol": "BTCUSDT"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "depth",
 "params": {
 "symbol": "BTCUSDT"
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
 "lastUpdateId": 1027024,
 "E": 1589436922972,
 "T": 1589436922959
 },
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
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 5
 }
 ]
}`

json

application/json

---

## Symbol Order Book Ticker

Best price/qty on the order book for a symbol or symbols.

**Note:**

* Retail Price Improvement(RPI) orders are not visible and excluded in
  the response message.

WSS

ticker.book

wss://ws-fapi.binance.com/ws-fapi/v1

### Symbol Order Book Ticker › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight

2 for a single symbol;
5 when the symbol parameter is omitted

### Symbol Order Book Ticker › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

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

Symbol.

Example: BTCUSDT

* If the symbol is not sent, bookTickers for all symbols will be
  returned in an array.
* The field `X-MBX-USED-WEIGHT-1M` in response header is not accurate
  from this endpoint, please ignore.

### Symbol Order Book Ticker › Responses

Successful Response

Symbol Order Book Ticker

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

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "ticker.book"
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
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
 "lastUpdateId": 1027024,
 "symbol": "BTCUSDT",
 "bidPrice": "4.00000000",
 "bidQty": "431.00000000",
 "askPrice": "4.00000200",
 "askQty": "9.00000000",
 "time": 1589437530011
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 2
 }
 ]
}`

json

application/json

---

## Symbol Price Ticker

Latest price for a symbol or symbols.

WSS

ticker.price

wss://ws-fapi.binance.com/ws-fapi/v1

### Symbol Price Ticker › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-usds-futures/general-info#limits) section.

IP Weight

1 for a single symbol;
2 when the symbol parameter is omitted

### Symbol Price Ticker › Request Parameters

`id`

​string · required

Id.

Example: e9d6b4349871b40611412680b3445fac

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

Symbol.

Example: BTCUSDT

* If the symbol is not sent, prices for all symbols will be returned in an array.

### Symbol Price Ticker › Responses

Successful Response

Symbol Price Ticker

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

WSSticker.price

Loading…

`wscat -c wss://ws-fapi.binance.com/ws-fapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "ticker.price"
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "ticker.price"
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "9d32157c-a556-4d27-9866-66760a174b57",
 "status": 200,
 "result": {
 "symbol": "BTCUSDT",
 "price": "6000.01",
 "time": 1589437530011
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 2
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams -->

# Public - Futures (USDⓈ-M) WebSocket Market Streams | Binance Developer Docs

Futures (USDⓈ-M) WebSocket Market Streams

1. [API Reference](/en/docs/catalog)
2. [Futures (USDⓈ-M)](/en/docs/catalog#core-trading-derivatives-trading-usd-s-m-futures)
3. [WebSocket Market Streams](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams)

# Public

Endpoint

wss://fstream.binance.comwss://stream.binancefuture.com

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/1.0.0/schema.yaml)

---

## All Book Tickers Stream

Pushes any update to the best bid or ask's price or quantity in real-time for all symbols.

> **After CM migration**, this stream pushes the merged UM + CM universe (subscribable on both `fstream` and `dstream`); each payload is appended with a new `st` field (`1` = UM, `2` = CM) and a new `ps` field (pair symbol).

WSS

!bookTicker

wss://fstream.binance.com

Update Speed5s

### All Book Tickers Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/public/ws/!bookTicker`
* **Combined stream via URL:** `wss://fstream.binance.com/public/stream?streams=!bookTicker`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/public/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!bookTicker"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### All Book Tickers Stream › Responses

Raw StreamCombined Stream

All Book Tickers Stream

`e`

​string

event type

Example: bookTicker

`u`

​integer · int64

order book updateId

Example: 400900217

`E`

​integer · int64

event time

Example: 1568014460893

`T`

​integer · int64

transaction time

Example: 1568014460891

`s`

​string

symbol

Example: BNBUSDT

`b`

​string

best bid price

Example: 25.35190000

`B`

​string

best bid qty

Example: 31.21000000

`a`

​string

best ask price

Example: 25.36520000

`A`

​string

best ask qty

Example: 40.66000000

`ps`

​string

(After CM migration) Pair symbol

Example: BTCUSDT

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

* Retail Price Improvement(RPI) orders are not visible and excluded in the response message.

WSS!bookTicker

Loading…

`wscat -c wss://fstream.binance.com//public/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!bookTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!bookTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "bookTicker",
 "u": 400900217,
 "E": 1568014460893,
 "T": 1568014460891,
 "s": "BNBUSDT",
 "b": "25.35190000",
 "B": "31.21000000",
 "a": "25.36520000",
 "A": "40.66000000",
 "ps": "BTCUSDT",
 "st": 1
}`

json

application/json

---

## Diff. Book Depth Streams

Bids and asks, pushed every 250 milliseconds, 500 milliseconds, 100 milliseconds (if existing).

> **After CM migration**, the payload is appended with a new `st` field (`1` = UM, `2` = CM) and a new `ps` field (pair symbol).

WSS

{symbol}@depth@{updateSpeed}

wss://fstream.binance.com

Update Speed250ms, 500ms, 100ms

### Diff. Book Depth Streams › Stream parameters

`symbol`

​string · required

Trading pair symbol.

Example: btcusdt

`updateSpeed`

​string · enum

WebSocket stream update speed

Enum values:

100ms

500ms

Example: 100ms

### Diff. Book Depth Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/public/ws/{symbol}@depth@{updateSpeed}`
* **Combined stream via URL:** `wss://fstream.binance.com/public/stream?streams={symbol}@depth@{updateSpeed}`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/public/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@depth@100ms"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Diff. Book Depth Streams › Responses

Raw StreamCombined Stream

Diff. Book Depth Streams

`e`

​string

Event type.

Example: depthUpdate

`E`

​integer · int64

Event time.

Example: 123456789

`T`

​integer · int64

Transaction time.

Example: 123456788

`s`

​string

Symbol.

Example: BNBUSDT

`U`

​integer · int64

First update ID in the event.

Example: 157

`u`

​integer · int64

Final update ID in the event.

Example: 160

`pu`

​integer · int64

Final update ID in the previous stream event.

Example: 149

`b`

​array[]

Bid updates.

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

Ask updates.

​tuple[2] · minItems: 2 · maxItems: 2

`[0]`

​string · required

Price level to be updated

Example: 0.0026

`[1]`

​string · required

Quantity

Example: 100

`ps`

​string

(After CM migration) Pair symbol

Example: BTCUSDT

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

* Retail Price Improvement(RPI) orders are not visible and excluded in the response message.

WSS{symbol}@depth@{updateSpeed}

Loading…

`wscat -c wss://fstream.binance.com//public/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@depth@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@depth@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "depthUpdate",
 "E": 123456789,
 "T": 123456788,
 "s": "BNBUSDT",
 "U": 157,
 "u": 160,
 "pu": 149,
 "ps": "BTCUSDT",
 "st": 1
}`

json

application/json

---

## Individual Symbol Book Ticker Streams

Pushes any update to the best bid or ask's price or quantity in real-time for a specified symbol.

> **After CM migration**, the payload is appended with a new `st` field (`1` = UM, `2` = CM).

WSS

{symbol}@bookTicker

wss://fstream.binance.com

Update SpeedReal-time

### Individual Symbol Book Ticker Streams › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

### Individual Symbol Book Ticker Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/public/ws/{symbol}@bookTicker`
* **Combined stream via URL:** `wss://fstream.binance.com/public/stream?streams={symbol}@bookTicker`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/public/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@bookTicker"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Individual Symbol Book Ticker Streams › Responses

Raw StreamCombined Stream

Individual Symbol Book Ticker Streams

`e`

​string

event type

Example: bookTicker

`u`

​integer · int64

order book updateId

Example: 400900217

`E`

​integer · int64

event time

Example: 1568014460893

`T`

​integer · int64

transaction time

Example: 1568014460891

`s`

​string

symbol

Example: BNBUSDT

`ps`

​string

pair (After CM migration)

Example: BNBUSDT

`b`

​string

best bid price

Example: 25.35190000

`B`

​string

best bid qty

Example: 31.21000000

`a`

​string

best ask price

Example: 25.36520000

`A`

​string

best ask qty

Example: 40.66000000

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

Retail Price Improvement (RPI) orders are not visible and excluded in the response message.

WSS{symbol}@bookTicker

Loading…

`wscat -c wss://fstream.binance.com//public/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@bookTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@bookTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "bookTicker",
 "u": 400900217,
 "E": 1568014460893,
 "T": 1568014460891,
 "s": "BNBUSDT",
 "ps": "BNBUSDT",
 "b": "25.35190000",
 "B": "31.21000000",
 "a": "25.36520000",
 "A": "40.66000000",
 "st": 1
}`

json

application/json

---

## Partial Book Depth Streams

Top  bids and asks

> **After CM migration**, the payload is appended with a new `st` field (`1` = UM, `2` = CM) and a new `ps` field (pair symbol).

WSS

{symbol}@depth{levels}@{updateSpeed}

wss://fstream.binance.com

Update Speed250ms or 500ms or 100ms

### Partial Book Depth Streams › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

`levels`

​string · enum · required

The levels parameter

Enum values:

5

10

20

Example: 10

`updateSpeed`

​string · enum

WebSocket stream update speed

Enum values:

100ms

500ms

Example: 100ms

### Partial Book Depth Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/public/ws/{symbol}@depth{levels}@{updateSpeed}`
* **Combined stream via URL:** `wss://fstream.binance.com/public/stream?streams={symbol}@depth{levels}@{updateSpeed}`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/public/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@depth10@100ms"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Partial Book Depth Streams › Responses

Raw StreamCombined Stream

Partial Book Depth Streams

`e`

​string

Event type

Example: depthUpdate

`E`

​integer · int64

Event time

Example: 1571889248277

`T`

​integer · int64

Transaction time

Example: 1571889248276

`s`

​string

Symbol

Example: BTCUSDT

`U`

​integer · int64

First update ID in event

Example: 390497796

`u`

​integer · int64

Final update ID in event

Example: 390497878

`pu`

​integer · int64

Final update Id in last stream(ie `u` in last stream)

Example: 390497794

`b`

​array[]

Bids to be updated

`a`

​array[]

Asks to be updated

`ps`

​string

(After CM migration) Pair symbol

Example: BTCUSDT

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

Retail Price Improvement (RPI) orders are not visible and excluded in the response message.

WSS{symbol}@depth{levels}@{updateSpeed}

Loading…

`wscat -c wss://fstream.binance.com//public/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@depth10@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@depth10@100ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "depthUpdate",
 "E": 1571889248277,
 "T": 1571889248276,
 "s": "BTCUSDT",
 "U": 390497796,
 "u": 390497878,
 "pu": 390497794,
 "b": [
 [
 "7403.89"
 ]
 ],
 "a": [
 [
 "7405.96"
 ]
 ],
 "ps": "BTCUSDT",
 "st": 1
}`

json

application/json

---

## RPI Diff. Book Depth Streams

Bids and asks including RPI orders, pushed every 500 milliseconds

> **After CM migration**, the payload is appended with a new `st` field (`1` = UM, `2` = CM) and a new `ps` field (pair symbol).

WSS

{symbol}@rpiDepth@500ms

wss://fstream.binance.com

Update Speed500ms

### RPI Diff. Book Depth Streams › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

### RPI Diff. Book Depth Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/public/ws/{symbol}@rpiDepth@500ms`
* **Combined stream via URL:** `wss://fstream.binance.com/public/stream?streams={symbol}@rpiDepth@500ms`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/public/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@rpiDepth@500ms"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### RPI Diff. Book Depth Streams › Responses

Raw StreamCombined Stream

RPI Diff. Book Depth Streams

`e`

​string

Event type

Example: depthUpdate

`E`

​integer · int64

Event time

Example: 123456789

`T`

​integer · int64

Transaction time

Example: 123456788

`s`

​string

Symbol

Example: BNBUSDT

`U`

​integer · int64

First update ID in event

Example: 157

`u`

​integer · int64

Final update ID in event

Example: 160

`pu`

​integer · int64

Final update Id in last stream(ie `u` in last stream)

Example: 149

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

`ps`

​string

(After CM migration) Pair symbol

Example: BTCUSDT

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

* RPI(Retail Price Improvement) orders are included and aggreated in the response message. When the quantity of a price level to be updated is equal to 0, it means either all quotations for this price have been filled/canceled, or the quantity of crossed RPI orders for this price are hidden

WSS{symbol}@rpiDepth@500ms

Loading…

`wscat -c wss://fstream.binance.com//public/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@rpiDepth@500ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@rpiDepth@500ms"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "depthUpdate",
 "E": 123456789,
 "T": 123456788,
 "s": "BNBUSDT",
 "U": 157,
 "u": 160,
 "pu": 149,
 "ps": "BTCUSDT",
 "st": 1
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/ws-api -->

# Account - Futures (COIN-M) WebSocket API | Binance Developer Docs

Futures (COIN-M) WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Futures (COIN-M)](/en/docs/catalog#core-trading-derivatives-trading-coin-m-futures)
3. [WebSocket API](/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/ws-api)

# Account

Endpoint

wss://ws-dapi.binance.com/ws-dapi/v1wss://testnet.binancefuture.com/ws-dapi/v1

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/ws-api/1.0.0/schema.yaml)

---

## Account Information (USER\_DATA)

Get current account information. User in single-asset/ multi-assets mode
will see different value, see comments in response section for detail.

WSS

account.status

wss://ws-dapi.binance.com/ws-dapi/v1

### Account Information (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Account Information (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight5

### Account Information (USER\_DATA) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

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

Unix timestamp in milliseconds used to sign the request. The
value must reflect the current client time and is validated
by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

### Account Information (USER\_DATA) › Responses

Successful Response

Account Information

`id`

​string

positionId

Example: baaec739-c5cf-4920-b448-c0b9c5431410

`status`

​integer · int64

Example: 200

`result`

​object

Indicates that combined is set to true.

Indicates that combined is set to true.

`feeTier`

​integer · int64

Fee tier level.

Example: 0

`canTrade`

​boolean

Whether trading is enabled.

Example: true

`canDeposit`

​boolean

Whether deposits are enabled.

Example: true

`canWithdraw`

​boolean

Whether withdrawals are enabled.

Example: true

`updateTime`

​integer · int64

update time

Example: 0

`assets`

​object[]

Supported assets.

`asset`

​string

asset name

Example: WLD

`walletBalance`

​string

total wallet balance

Example: 0.00000000

`unrealizedProfit`

​string

unrealized profit or loss

Example: 0.00000000

`marginBalance`

​string

margin balance

Example: 0.00000000

`maintMargin`

​string

maintenance margin

Example: 0.00000000

`initialMargin`

​string

total intial margin required with the latest mark price

Example: 0.00000000

`positionInitialMargin`

​string

positions" margin required with the latest mark price

Example: 0.00000000

`openOrderInitialMargin`

​string

open orders" intial margin required with the latest mark price

Example: 0.00000000

`maxWithdrawAmount`

​string

maximum amount for transfer out

Example: 0.00000000

`crossWalletBalance`

​string

wallet balance for crossed margin

Example: 0.00000000

`crossUnPnl`

​string

total unrealized profit or loss of crossed positions

Example: 0.00000000

`availableBalance`

​string

available margin balance

Example: 0.00000000

`updateTime`

​integer · int64

update time

Example: 0

`positions`

​object[]

Position list.

`symbol`

​string

Trading symbol

Example: ETHUSD\_220930

`initialMargin`

​string

total intial margin required with the latest mark price

Example: 0

`maintMargin`

​string

maintenance margin

Example: 0

`unrealizedProfit`

​string

unrealized profit or loss

Example: 0.00000000

`positionInitialMargin`

​string

positions" margin required with the latest mark price

Example: 0

`openOrderInitialMargin`

​string

open orders" intial margin required with the latest mark price

Example: 0

`leverage`

​string

Leverage value.

Example: 7

`isolated`

​boolean

Whether isolated margin mode is enabled.

Example: false

`positionSide`

​string

Position side

Example: BOTH

`entryPrice`

​string

Position entry price.

Example: 0.00000000

`maxQty`

​string

maximum quantity of base asset

Example: 1000

`notionalValue`

​string

Notional value.

Example: 0

`isolatedWallet`

​string

Isolated wallet balance.

Example: 0

`updateTime`

​integer · int64

update time

Example: 0

`positionAmt`

​string

position amount

Example: 0

`breakEvenPrice`

​string

break-even price

Example: 0.00000000

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 10

WSSaccount.status

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.status",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
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
 "id": "baaec739-c5cf-4920-b448-c0b9c5431410",
 "status": 200,
 "result": {
 "feeTier": 0,
 "canTrade": true,
 "canDeposit": true,
 "canWithdraw": true,
 "updateTime": 0,
 "assets": [
 {
 "asset": "WLD",
 "walletBalance": "0.00000000",
 "unrealizedProfit": "0.00000000",
 "marginBalance": "0.00000000",
 "maintMargin": "0.00000000",
 "initialMargin": "0.00000000",
 "positionInitialMargin": "0.00000000",
 "openOrderInitialMargin": "0.00000000",
 "maxWithdrawAmount": "0.00000000",
 "crossWalletBalance": "0.00000000",
 "crossUnPnl": "0.00000000",
 "availableBalance": "0.00000000",
 "updateTime": 0
 }
 ],
 "positions": [
 {
 "symbol": "ETHUSD_220930",
 "initialMargin": "0",
 "maintMargin": "0",
 "unrealizedProfit": "0.00000000",
 "positionInitialMargin": "0",
 "openOrderInitialMargin": "0",
 "leverage": "7",
 "isolated": false,
 "positionSide": "BOTH",
 "entryPrice": "0.00000000",
 "maxQty": "1000",
 "notionalValue": "0",
 "isolatedWallet": "0",
 "updateTime": 0,
 "positionAmt": "0",
 "breakEvenPrice": "0.00000000"
 }
 ]
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 10
 }
 ]
}`

json

application/json

---

## Futures Account Balance (USER\_DATA)

Futures Account Balance

WSS

account.balance

wss://ws-dapi.binance.com/ws-dapi/v1

### Futures Account Balance (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Futures Account Balance (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight5

### Futures Account Balance (USER\_DATA) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

account.balance

Example: account.balance

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The
value must reflect the current client time and is validated
by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

### Futures Account Balance (USER\_DATA) › Responses

Successful Response

Futures Account Balance

`id`

​string

positionId

Example: 9328e612-1560-4108-979e-283bf85b5acb

`status`

​integer · int64

Example: 200

`result`

​object[]

Indicates that combined is set to true.

`accountAlias`

​string

unique account code

Example: fWAuTiuXoCuXmY

`asset`

​string

asset name

Example: WLD

`balance`

​string

Account balance.

Example: 0.00000000

`withdrawAvailable`

​string

Available amount for withdrawal.

Example: 0.00000000

`crossWalletBalance`

​string

wallet balance for crossed margin

Example: 0.00000000

`crossUnPnl`

​string

total unrealized profit or loss of crossed positions

Example: 0.00000000

`availableBalance`

​string

available margin balance

Example: 0.00000000

`updateTime`

​integer · int64

update time

Example: 0

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 10

WSSaccount.balance

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.balance",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.balance",
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
 "id": "9328e612-1560-4108-979e-283bf85b5acb",
 "status": 200,
 "result": [
 {
 "accountAlias": "fWAuTiuXoCuXmY",
 "asset": "WLD",
 "balance": "0.00000000",
 "withdrawAvailable": "0.00000000",
 "crossWalletBalance": "0.00000000",
 "crossUnPnl": "0.00000000",
 "availableBalance": "0.00000000",
 "updateTime": 0
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 10
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/market -->

# Market - Futures (USDⓈ-M) WebSocket Market Streams | Binance Developer Docs

Futures (USDⓈ-M) WebSocket Market Streams

1. [API Reference](/en/docs/catalog)
2. [Futures (USDⓈ-M)](/en/docs/catalog#core-trading-derivatives-trading-usd-s-m-futures)
3. [WebSocket Market Streams](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams)

# Market

Endpoint

wss://fstream.binance.comwss://stream.binancefuture.com

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/1.0.0/schema.yaml)

---

## Aggregate Trade Streams

The Aggregate Trade Streams push market trade information that is aggregated for fills with same price and taking side every 100 milliseconds. Only market trades will be aggregated, which means the insurance fund trades and ADL trades won't be aggregated.

> **After CM migration**, the payload is appended with a new `st` field (`1` = UM, `2` = CM).

WSS

{symbol}@aggTrade

wss://fstream.binance.com

Update Speed100ms

### Aggregate Trade Streams › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

### Aggregate Trade Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/{symbol}@aggTrade`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams={symbol}@aggTrade`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@aggTrade"]

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

Example: 123456789

`s`

​string

Symbol

Example: BNBUSDT

`a`

​integer · int64

Aggregate trade ID

Example: 5933014

`p`

​string

Price

Example: 0.001

`q`

​string

Quantity with all the market trades

Example: 100

`nq`

​string

Normal quantity without the trades involving RPI orders

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

Example: 123456785

`m`

​boolean

Is the buyer the market maker?

Example: true

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

* Retail Price Improvement(RPI) orders are aggregated into field q and without special tags to be distinguished.

WSS{symbol}@aggTrade

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@aggTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@aggTrade"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "aggTrade",
 "E": 123456789,
 "s": "BNBUSDT",
 "a": 5933014,
 "p": "0.001",
 "q": "100",
 "nq": "100",
 "f": 100,
 "l": 105,
 "T": 123456785,
 "m": true,
 "st": 1
}`

json

application/json

---

## All Market Liquidation Order Streams

The All Liquidation Order Snapshot Streams push force liquidation order information for all symbols in the market. For each symbol，only the latest one liquidation order within 1000ms will be pushed as the snapshot. If no liquidation happens in the interval of 1000ms, no stream will be pushed.

> **After CM migration**, this stream pushes the merged UM + CM universe (subscribable on both `fstream` and `dstream`); each payload is appended with a new `st` field (`1` = UM, `2` = CM) and a new `ps` field (pair symbol).

WSS

!forceOrder@arr

wss://fstream.binance.com

Update Speed1000ms

### All Market Liquidation Order Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/!forceOrder@arr`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams=!forceOrder@arr`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!forceOrder@arr"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### All Market Liquidation Order Streams › Responses

Raw StreamCombined Stream

All Market Liquidation Order Streams

`e`

​string

Event Type

Example: forceOrder

`E`

​integer · int64

Event Time

Example: 1568014460893

`o`

​object

Order Type

Order Type

`s`

​string

Symbol

Example: BTCUSDT

`S`

​string

Side

Example: SELL

`o`

​string

Order Type

Example: LIMIT

`f`

​string

Time in Force

Example: IOC

`q`

​string

Original Quantity

Example: 0.014

`p`

​string

Price

Example: 9910

`ap`

​string

Average Price

Example: 9910

`X`

​string

Order Status

Example: FILLED

`l`

​string

Order Last Filled Quantity

Example: 0.014

`z`

​string

Order Filled Accumulated Quantity

Example: 0.014

`T`

​integer · int64

Order Trade Time

Example: 1568014460893

`ps`

​string

(After CM migration) Pair symbol

Example: BTCUSDT

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

WSS!forceOrder@arr

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!forceOrder@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!forceOrder@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "forceOrder",
 "E": 1568014460893,
 "o": {
 "s": "BTCUSDT",
 "S": "SELL",
 "o": "LIMIT",
 "f": "IOC",
 "q": "0.014",
 "p": "9910",
 "ap": "9910",
 "X": "FILLED",
 "l": "0.014",
 "z": "0.014",
 "T": 1568014460893
 },
 "ps": "BTCUSDT",
 "st": 1
}`

json

application/json

---

## All Market Mini Tickers Stream

24hr rolling window mini-ticker statistics for all symbols. These are NOT the statistics of the UTC day, but a 24hr rolling window from requestTime to 24hrs before. Note that only tickers that have changed will be present in the array.

> **After CM migration**, this stream pushes the merged UM + CM universe (subscribable on both `fstream` and `dstream`); each payload is appended with a new `st` field (`1` = UM, `2` = CM) and a new `ps` field (pair symbol).

WSS

!miniTicker@arr

wss://fstream.binance.com

Update Speed1000ms

### All Market Mini Tickers Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/!miniTicker@arr`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams=!miniTicker@arr`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

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

Example: 123456789

`s`

​string

Symbol

Example: BNBUSDT

`c`

​string

Close price

Example: 0.0025

`o`

​string

Open price

Example: 0.0010

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.0010

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

`ps`

​string

(After CM migration) Pair symbol

Example: BTCUSDT

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

WSS!miniTicker@arr

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
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
 "E": 123456789,
 "s": "BNBUSDT",
 "c": "0.0025",
 "o": "0.0010",
 "h": "0.0025",
 "l": "0.0010",
 "v": "10000",
 "q": "18",
 "ps": "BTCUSDT",
 "st": 1
 }
]`

json

application/json

---

## All Market Tickers Streams

24hr rolling window ticker statistics for all symbols. These are NOT the statistics of the UTC day, but a 24hr rolling window from requestTime to 24hrs before. Note that only tickers that have changed will be present in the array.

> **After CM migration**, this stream pushes the merged UM + CM universe (subscribable on both `fstream` and `dstream`); each payload is appended with a new `st` field (`1` = UM, `2` = CM) and a new `ps` field (pair symbol).

WSS

!ticker@arr

wss://fstream.binance.com

Update Speed1000ms

### All Market Tickers Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/!ticker@arr`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams=!ticker@arr`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!ticker@arr"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### All Market Tickers Streams › Responses

Raw StreamCombined Stream

All Market Tickers Streams

​object

`e`

​string

Event type

Example: 24hrTicker

`E`

​integer · int64

Event time

Example: 123456789

`s`

​string

Symbol

Example: BNBUSDT

`p`

​string

Price change

Example: 0.0015

`P`

​string

Price change percent

Example: 250.00

`w`

​string

Weighted average price

Example: 0.0018

`c`

​string

Last price

Example: 0.0025

`Q`

​string

Last quantity

Example: 10

`o`

​string

Open price

Example: 0.0010

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.0010

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

Example: 86400000

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

`ps`

​string

(After CM migration) Pair symbol

Example: BTCUSDT

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

WSS!ticker@arr

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!ticker@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!ticker@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`[
 {
 "e": "24hrTicker",
 "E": 123456789,
 "s": "BNBUSDT",
 "p": "0.0015",
 "P": "250.00",
 "w": "0.0018",
 "c": "0.0025",
 "Q": "10",
 "o": "0.0010",
 "h": "0.0025",
 "l": "0.0010",
 "v": "10000",
 "q": "18",
 "O": 0,
 "C": 86400000,
 "F": 0,
 "L": 18150,
 "n": 18151,
 "ps": "BTCUSDT",
 "st": 1
 }
]`

json

application/json

---

## Composite Index Symbol Information Streams

Composite index information for index symbols pushed every second.

WSS

{symbol}@compositeIndex

wss://fstream.binance.com

Update Speed1000ms

### Composite Index Symbol Information Streams › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

### Composite Index Symbol Information Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/{symbol}@compositeIndex`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams={symbol}@compositeIndex`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@compositeIndex"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Composite Index Symbol Information Streams › Responses

Raw StreamCombined Stream

Composite Index Symbol Information Streams

`e`

​string

Event type

Example: compositeIndex

`E`

​integer · int64

Event time

Example: 1602310596000

`s`

​string

Symbol

Example: DEFIUSDT

`p`

​string

Price

Example: 554.41604065

`C`

​string

Base asset category.

Example: baseAsset

`c`

​object[]

Composition

`b`

​string

Base asset

Example: BAL

`q`

​string

Quote asset

Example: USDT

`w`

​string

Weight in quantity

Example: 1.04884844

`W`

​string

Weight in percentage

Example: 0.01457800

`i`

​string

Index price

Example: 24.33521021

WSS{symbol}@compositeIndex

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@compositeIndex"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@compositeIndex"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "compositeIndex",
 "E": 1602310596000,
 "s": "DEFIUSDT",
 "p": "554.41604065",
 "C": "baseAsset",
 "c": [
 {
 "b": "BAL",
 "q": "USDT",
 "w": "1.04884844",
 "W": "0.01457800",
 "i": "24.33521021"
 }
 ]
}`

json

application/json

---

## Continuous Contract Kline/Candlestick Streams

Continuous Contract Kline/Candlestick Streams

> **After CM migration**, both `fstream` and `dstream` may subscribe to either UM or CM symbols on this stream.

WSS

{pair}\_{contractType}@continuousKline\_{interval}

wss://fstream.binance.com

Update Speed250ms

### Continuous Contract Kline/Candlestick Streams › Stream parameters

`pair`

​string · required

Example: btcusdt

`contractType`

​string · enum · required

Enum values:

perpetual

current\_quarter

next\_quarter

tradifi\_perpetual

Example: next\_quarter

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

Example: 1m

### Continuous Contract Kline/Candlestick Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/{pair}_{contractType}@continuousKline_{interval}`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams={pair}_{contractType}@continuousKline_{interval}`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt\_next\_quarter@continuousKline\_1m"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Continuous Contract Kline/Candlestick Streams › Responses

Raw StreamCombined Stream

Continuous Contract Kline/Candlestick Streams

`e`

​string

Event type

Example: continuous\_kline

`E`

​integer · int64

Event time

Example: 1607443058651

`ps`

​string

Pair

Example: BTCUSDT

`ct`

​string

Contract type

Example: PERPETUAL

`k`

​object

Kline payload.

Kline payload.

`t`

​integer · int64

Kline start time

Example: 1607443020000

`T`

​integer · int64

Kline close time

Example: 1607443079999

`i`

​string

Interval

Example: 1m

`f`

​integer · int64

First updateId

Example: 116467658886

`L`

​integer · int64

Last updateId

Example: 116468012423

`o`

​string

Open price

Example: 18787.00

`c`

​string

Close price

Example: 18804.04

`h`

​string

High price

Example: 18804.04

`l`

​string

Low price

Example: 18786.54

`v`

​string

volume

Example: 197.664

`n`

​integer · int64

Number of trades

Example: 543

`x`

​boolean

Is this kline closed?

Example: false

`q`

​string

Quote asset volume

Example: 3715253.19494

`V`

​string

Taker buy volume

Example: 184.769

`Q`

​string

Taker buy quote asset volume

Example: 3472925.84746

`B`

​string

Ignore

Example: 0

WSS{pair}\_{contractType}@continuousKline\_{interval}

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt_next_quarter@continuousKline_1m"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt_next_quarter@continuousKline_1m"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "continuous_kline",
 "E": 1607443058651,
 "ps": "BTCUSDT",
 "ct": "PERPETUAL",
 "k": {
 "t": 1607443020000,
 "T": 1607443079999,
 "i": "1m",
 "f": 116467658886,
 "L": 116468012423,
 "o": "18787.00",
 "c": "18804.04",
 "h": "18804.04",
 "l": "18786.54",
 "v": "197.664",
 "n": 543,
 "x": false,
 "q": "3715253.19494",
 "V": "184.769",
 "Q": "3472925.84746",
 "B": "0"
 }
}`

json

application/json

---

## Contract Info Stream

ContractInfo stream pushes when contract info updates(listing/settlement/contract bracket update). bks field only shows up when bracket gets updated.

> **After CM migration**, this stream pushes the merged UM + CM universe (subscribable on both `fstream` and `dstream`); each payload is appended with a new `st` field (`1` = UM, `2` = CM).

WSS

!contractInfo

wss://fstream.binance.com

Update SpeedReal-time

### Contract Info Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/!contractInfo`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams=!contractInfo`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!contractInfo"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Contract Info Stream › Responses

Raw StreamCombined Stream

Contract Info Stream

`e`

​string

Event type.

Example: contractInfo

`E`

​integer · int64

Event time.

Example: 1669356423908

`s`

​string

Symbol.

Example: IOTAUSDT

`ct`

​string

Contract type.

Example: PERPETUAL

`dt`

​integer · int64

Delivery date time.

Example: 4133404800000

`ot`

​integer · int64

Onboard date time.

Example: 1569398400000

`cs`

​string

Contract status.

Example: TRADING

`bks`

​object[]

Notional bracket updates.

`bs`

​integer · int64

Notional bracket

Example: 1

`bnf`

​integer · int64

Floor notional of this bracket

Example: 0

`bnc`

​integer · int64

Cap notional of this bracket

Example: 5000

`mmr`

​number · float

Maintenance ratio for this bracket

Example: 0.01

`cf`

​integer · int64

Auxiliary number for quick calculation

Example: 0

`mi`

​integer · int64

Min leverage for this bracket

Example: 21

`ma`

​integer · int64

Max leverage for this bracket

Example: 50

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

WSS!contractInfo

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!contractInfo"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!contractInfo"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "contractInfo",
 "E": 1669356423908,
 "s": "IOTAUSDT",
 "ct": "PERPETUAL",
 "dt": 4133404800000,
 "ot": 1569398400000,
 "cs": "TRADING",
 "bks": [
 {
 "bs": 1,
 "bnf": 0,
 "bnc": 5000,
 "mmr": 0.01,
 "cf": 0,
 "mi": 21,
 "ma": 50
 }
 ],
 "st": 1
}`

json

application/json

---

## Individual Symbol Mini Ticker Stream

24hr rolling window mini-ticker statistics for a single symbol. These are NOT the statistics of the UTC day, but a 24hr rolling window from requestTime to 24hrs before.

> **After CM migration**, the payload is appended with a new `st` field (`1` = UM, `2` = CM) and a new `ps` field (pair symbol).

WSS

{symbol}@miniTicker

wss://fstream.binance.com

Update Speed2s

### Individual Symbol Mini Ticker Stream › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

### Individual Symbol Mini Ticker Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/{symbol}@miniTicker`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams={symbol}@miniTicker`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@miniTicker"]

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

Example: 123456789

`s`

​string

Symbol

Example: BNBUSDT

`c`

​string

Close price

Example: 0.0025

`o`

​string

Open price

Example: 0.0010

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.0010

`v`

​string

Total traded base asset volume

Example: 10000

`q`

​string

Total traded quote asset volume

Example: 18

`ps`

​string

(After CM migration) Pair symbol

Example: BTCUSDT

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

WSS{symbol}@miniTicker

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@miniTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@miniTicker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "24hrMiniTicker",
 "E": 123456789,
 "s": "BNBUSDT",
 "c": "0.0025",
 "o": "0.0010",
 "h": "0.0025",
 "l": "0.0010",
 "v": "10000",
 "q": "18",
 "ps": "BTCUSDT",
 "st": 1
}`

json

application/json

---

## Individual Symbol Ticker Streams

24hr rolling window ticker statistics for a single symbol. These are NOT the statistics of the UTC day, but a 24hr rolling window from requestTime to 24hrs before.

> **After CM migration**, the payload is appended with a new `st` field (`1` = UM, `2` = CM) and a new `ps` field (pair symbol).

WSS

{symbol}@ticker

wss://fstream.binance.com

Update Speed2000ms

### Individual Symbol Ticker Streams › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

### Individual Symbol Ticker Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/{symbol}@ticker`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams={symbol}@ticker`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@ticker"]

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

Example: 123456789

`s`

​string

Symbol

Example: BNBUSDT

`p`

​string

Price change

Example: 0.0015

`P`

​string

Price change percent

Example: 250.00

`w`

​string

Weighted average price

Example: 0.0018

`c`

​string

Last price

Example: 0.0025

`Q`

​string

Last quantity

Example: 10

`o`

​string

Open price

Example: 0.0010

`h`

​string

High price

Example: 0.0025

`l`

​string

Low price

Example: 0.0010

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

Example: 86400000

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

`ps`

​string

(After CM migration) Pair symbol

Example: BTCUSDT

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

WSS{symbol}@ticker

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@ticker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@ticker"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "24hrTicker",
 "E": 123456789,
 "s": "BNBUSDT",
 "p": "0.0015",
 "P": "250.00",
 "w": "0.0018",
 "c": "0.0025",
 "Q": "10",
 "o": "0.0010",
 "h": "0.0025",
 "l": "0.0010",
 "v": "10000",
 "q": "18",
 "O": 0,
 "C": 86400000,
 "F": 0,
 "L": 18150,
 "n": 18151,
 "ps": "BTCUSDT",
 "st": 1
}`

json

application/json

---

## Kline/Candlestick Streams

The Kline/Candlestick Stream push updates to the current klines/candlestick every 250 milliseconds (if existing).

> **After CM migration**, both `fstream` and `dstream` may subscribe to either UM or CM symbols on this stream.

WSS

{symbol}@kline\_{interval}

wss://fstream.binance.com

Update Speed250ms

### Kline/Candlestick Streams › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

`interval`

​string · enum · required

The interval parameter

Enum values:

1m

3m

5m

15m

30m

1h

2h

4h

show 7 more

Example: 1m

### Kline/Candlestick Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/{symbol}@kline_{interval}`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams={symbol}@kline_{interval}`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@kline\_1m"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Kline/Candlestick Streams › Responses

Raw StreamCombined Stream

Kline/Candlestick Streams

`e`

​string

Event type

Example: kline

`E`

​integer · int64

Event time

Example: 1638747660000

`s`

​string

Symbol

Example: BTCUSDT

`k`

​object

Kline payload.

Kline payload.

`t`

​integer · int64

Kline start time

Example: 1638747660000

`T`

​integer · int64

Kline close time

Example: 1638747719999

`s`

​string

Symbol

Example: BTCUSDT

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

Example: 0.0010

`c`

​string

Close price

Example: 0.0020

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

Example: 1.0000

`V`

​string

Taker buy base asset volume

Example: 500

`Q`

​string

Taker buy quote asset volume

Example: 0.500

`B`

​string

Ignore

Example: 123456

WSS{symbol}@kline\_{interval}

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@kline_1m"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@kline_1m"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "kline",
 "E": 1638747660000,
 "s": "BTCUSDT",
 "k": {
 "t": 1638747660000,
 "T": 1638747719999,
 "s": "BTCUSDT",
 "i": "1m",
 "f": 100,
 "L": 200,
 "o": "0.0010",
 "c": "0.0020",
 "h": "0.0025",
 "l": "0.0015",
 "v": "1000",
 "n": 100,
 "x": false,
 "q": "1.0000",
 "V": "500",
 "Q": "0.500",
 "B": "123456"
 }
}`

json

application/json

---

## Liquidation Order Streams

The Liquidation Order Snapshot Streams push force liquidation order information for specific symbol. For each symbol，only the latest one liquidation order within 1000ms will be pushed as the snapshot. If no liquidation happens in the interval of 1000ms, no stream will be pushed.

WSS

{symbol}@forceOrder

wss://fstream.binance.com

Update Speed1000ms

### Liquidation Order Streams › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

### Liquidation Order Streams › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/{symbol}@forceOrder`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams={symbol}@forceOrder`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@forceOrder"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Liquidation Order Streams › Responses

Raw StreamCombined Stream

Liquidation Order Streams

`e`

​string

Event Type

Example: forceOrder

`E`

​integer · int64

Event Time

Example: 1568014460893

`o`

​object

Order Type

Order Type

`s`

​string

Symbol

Example: BTCUSDT

`S`

​string

Side

Example: SELL

`o`

​string

Order Type

Example: LIMIT

`f`

​string

Time in Force

Example: IOC

`q`

​string

Original Quantity

Example: 0.014

`p`

​string

Price

Example: 9910

`ap`

​string

Average Price

Example: 9910

`X`

​string

Order Status

Example: FILLED

`l`

​string

Order Last Filled Quantity

Example: 0.014

`z`

​string

Order Filled Accumulated Quantity

Example: 0.014

`T`

​integer · int64

Order Trade Time

Example: 1568014460893

WSS{symbol}@forceOrder

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@forceOrder"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@forceOrder"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "forceOrder",
 "E": 1568014460893,
 "o": {
 "s": "BTCUSDT",
 "S": "SELL",
 "o": "LIMIT",
 "f": "IOC",
 "q": "0.014",
 "p": "9910",
 "ap": "9910",
 "X": "FILLED",
 "l": "0.014",
 "z": "0.014",
 "T": 1568014460893
 }
}`

json

application/json

---

## Mark Price Stream

Mark price and funding rate for a single symbol pushed every 3 seconds or every second.

> **After CM migration**, the payload is appended with a new `st` field (`1` = UM, `2` = CM); both `fstream` and `dstream` may subscribe to either UM or CM symbols on this stream.

WSS

{symbol}@markPrice@{updateSpeed}

wss://fstream.binance.com

### Mark Price Stream › Stream parameters

`symbol`

​string · required

The symbol parameter

Example: btcusdt

`updateSpeed`

​string · enum

WebSocket stream update speed

Enum values:

1s

Example: 1s

### Mark Price Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/{symbol}@markPrice@{updateSpeed}`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams={symbol}@markPrice@{updateSpeed}`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["btcusdt@markPrice@1s"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Mark Price Stream › Responses

Raw StreamCombined Stream

Mark Price Stream

`e`

​string

Event type

Example: markPriceUpdate

`E`

​integer · int64

Event time

Example: 1562305380000

`s`

​string

Symbol

Example: BTCUSDT

`p`

​string

Mark price

Example: 11794.15000000

`i`

​string

Index price

Example: 11784.62659091

`P`

​string

Estimated Settle Price, only useful in the last hour before the settlement starts

Example: 11784.25641265

`r`

​string

Funding rate

Example: 0.00038167

`ap`

​string

Mark price moving average

Example: 11794.15000000

`T`

​integer · int64

Next funding time

Example: 1562306400000

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

WSS{symbol}@markPrice@{updateSpeed}

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@markPrice@1s"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "btcusdt@markPrice@1s"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "markPriceUpdate",
 "E": 1562305380000,
 "s": "BTCUSDT",
 "p": "11794.15000000",
 "i": "11784.62659091",
 "P": "11784.25641265",
 "r": "0.00038167",
 "ap": "11794.15000000",
 "T": 1562306400000,
 "st": 1
}`

json

application/json

---

## Mark Price Stream for All market

Mark price and funding rate for all symbols pushed every 3 seconds or every second.

**Note:**

* TradFi symbols will be pushed through a seperate message.

> **After CM migration**, the payload is appended with a new `st` field (`1` = UM, `2` = CM); both `fstream` and `dstream` may subscribe to either UM or CM symbols on this stream.

WSS

!markPrice@arr@{updateSpeed}

wss://fstream.binance.com

Update Speed3s or 1s

### Mark Price Stream for All market › Stream parameters

`updateSpeed`

​string · enum

WebSocket stream update speed

Enum values:

1s

Example: 1s

### Mark Price Stream for All market › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/!markPrice@arr@{updateSpeed}`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams=!markPrice@arr@{updateSpeed}`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!markPrice@arr@1s"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Mark Price Stream for All market › Responses

Raw StreamCombined Stream

Mark Price Stream for All market

​object

`e`

​string

Event type

Example: markPriceUpdate

`E`

​integer · int64

Event time

Example: 1562305380000

`s`

​string

Symbol

Example: BTCUSDT

`p`

​string

Mark price

Example: 11185.87786614

`i`

​string

Index price

Example: 11784.62659091

`P`

​string

Estimated Settle Price, only useful in the last hour before the settlement starts

Example: 11784.25641265

`r`

​string

Funding rate

Example: 0.00030000

`ap`

​string

Mark price moving average

Example: 11185.87786614

`T`

​integer · int64

Next funding time

Example: 1562306400000

`st`

​integer

(After CM migration) Symbol type: 1 = UM, 2 = CM

Example: 1

WSS!markPrice@arr@{updateSpeed}

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!markPrice@arr@1s"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!markPrice@arr@1s"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`[
 {
 "e": "markPriceUpdate",
 "E": 1562305380000,
 "s": "BTCUSDT",
 "p": "11185.87786614",
 "i": "11784.62659091",
 "P": "11784.25641265",
 "r": "0.00030000",
 "ap": "11185.87786614",
 "T": 1562306400000,
 "st": 1
 }
]`

json

application/json

---

## Multi-Assets Mode Asset Index

Asset index price. Subscribe with `!assetIndex@arr` for all assets, or `<assetSymbol>@assetIndex` for a specific asset.

> **CM-UM Integration (Effective 2026-06-30):** Renamed from *Multi-Assets Mode Asset Index*. The stream `!assetIndex@arr` now additionally pushes COIN-M settlement-asset price index entries (e.g., `BTCUSD`, `ETHUSD`, `BNBUSD`). The on-the-wire stream key is unchanged; existing subscriptions continue to work.

WSS

!assetIndex@arr

wss://fstream.binance.com

Update Speed1s

### Multi-Assets Mode Asset Index › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/!assetIndex@arr`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams=!assetIndex@arr`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["!assetIndex@arr"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Multi-Assets Mode Asset Index › Responses

Raw StreamCombined Stream

Multi-Assets Mode Asset Index

​object

`e`

​string

Event type.

Example: assetIndexUpdate

`E`

​integer · int64

Event time.

Example: 1686749230000

`s`

​string

Asset index symbol.

Example: ADAUSD

`i`

​string

Index price.

Example: 0.27462452

`b`

​string

Bid buffer.

Example: 0.10000000

`a`

​string

Ask buffer.

Example: 0.10000000

`B`

​string

Bid rate.

Example: 0.24716207

`A`

​string

Ask rate.

Example: 0.30208698

`q`

​string

Auto exchange bid buffer.

Example: 0.05000000

`g`

​string

Auto exchange ask buffer.

Example: 0.05000000

`Q`

​string

Auto exchange bid rate.

Example: 0.26089330

`G`

​string

Auto exchange ask rate.

Example: 0.28835575

WSS!assetIndex@arr

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "!assetIndex@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "!assetIndex@arr"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`[
 {
 "e": "assetIndexUpdate",
 "E": 1686749230000,
 "s": "ADAUSD",
 "i": "0.27462452",
 "b": "0.10000000",
 "a": "0.10000000",
 "B": "0.24716207",
 "A": "0.30208698",
 "q": "0.05000000",
 "g": "0.05000000",
 "Q": "0.26089330",
 "G": "0.28835575"
 }
]`

json

application/json

---

## Trading Session Stream

Trading session information for the underlying assets of TradFi Perpetual contracts, covering the U.S. equity market, Korean equity market, Hong Kong equity market, China equity market, and the commodity market, is updated every second. Trading session information for different underlying markets is pushed in separate messages.

**Event type:**

* `EquityUpdate`: Session types for the U.S. equity market include "PRE\_MARKET", "REGULAR", "AFTER\_MARKET", "OVERNIGHT", and "NO\_TRADING".
* `CommodityUpdate`: Session types for the commodity market include "REGULAR" and "NO\_TRADING".
* `KR_EquityUpdate`: Session types for the Korean equity market include "REGULAR" and "NO\_TRADING".
* `HK_EquityUpdate`: Session types for the Hong Kong equity market include "REGULAR" and "NO\_TRADING".
* `CN_EquityUpdate`: Session types for the China equity market include "REGULAR" and "NO\_TRADING".

WSS

tradingSession

wss://fstream.binance.com

Update Speed1s

### Trading Session Stream › Request

You can subscribe to this stream using one of the following options:

* **Raw stream:** `wss://fstream.binance.com/market/ws/tradingSession`
* **Combined stream via URL:** `wss://fstream.binance.com/market/stream?streams=tradingSession`
* **Combined stream via request:** Connect to `wss://fstream.binance.com/market/stream`, then send the **SUBSCRIBE** request shown below.

`method`

​string · enum · required

WebSocket Streams method name.

Enum values:

SUBSCRIBE

Example: SUBSCRIBE

`params`

​string[] · required

List of streams to subscribe to.

Example: ["tradingSession"]

`id`

​string · required

Unique WebSocket request ID.

Example: e9d6b4349871b40611412680b3445fac

### Trading Session Stream › Responses

Raw StreamCombined Stream

Trading Session Stream

`e`

​string

Event type, can also be CommodityUpdate, KR\_EquityUpdate, HK\_EquityUpdate or CN\_EquityUpdate

Example: EquityUpdate

`E`

​integer · int64

Event time

Example: 1765244143062

`t`

​integer · int64

Session start time

Example: 1765242000000

`T`

​integer · int64

Session end time

Example: 1765270800000

`S`

​string

Session type

Example: OVERNIGHT

WSStradingSession

Loading…

`wscat -c wss://fstream.binance.com//market/stream -x '{
 "method": "SUBSCRIBE",
 "params": [
 "tradingSession"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}' -w 30`

Example Request

`{
 "method": "SUBSCRIBE",
 "params": [
 "tradingSession"
 ],
 "id": "e9d6b4349871b40611412680b3445fac"
}`

json

application/json

Example Responses

Raw StreamCombined Stream

`{
 "e": "EquityUpdate",
 "E": 1765244143062,
 "t": 1765242000000,
 "T": 1765270800000,
 "S": "OVERNIGHT"
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas -->

# Schemas | Binance Developer Docs

We value your privacy

We use cookies to analyze site usage and improve the documentation experience. Analytics are aggregated and do not include sensitive personal data.

[Privacy & cookies](https://www.binance.com/en/about-legal/privacy-portal)

RejectAccept

Futures (USDⓈ-M) WebSocket Market Streams

Futures (USDⓈ-M) WebSocket Market Streams

# Schemas

API Information

---

## accountConfigUpdate

`e`

​string · enum

Event Type

Enum values:

ACCOUNT\_CONFIG\_UPDATE

`E`

​integer · int64

Event Time

Example: 1611646737479

`T`

​integer · int64

Transaction Time

Example: 1611646737476

`ac`

​object

`ai`

​object

User's Account Configuration

## accountUpdate

`e`

​string · enum

Event Type

Enum values:

ACCOUNT\_UPDATE

`E`

​integer · int64

Event Time

Example: 1564745798939

`T`

​integer · int64

Transaction

Example: 1564745798938

`a`

​object

Update Data

## algoUpdate

`e`

​string · enum

Event Type

Enum values:

ALGO\_UPDATE

`T`

​integer · int64

Transaction Time

Example: 1750515742297

`E`

​integer · int64

Event Time

Example: 1750515742303

`o`

​object

## conditionalOrderTriggerReject

`e`

​string · enum

Event Type

Enum values:

CONDITIONAL\_ORDER\_TRIGGER\_REJECT

`E`

​integer · int64

Event Time

Example: 1685517224945

`T`

​integer · int64

Message send time

Example: 1685517224955

`or`

​object

## gridUpdate

`e`

​string · enum

Event Type

Enum values:

GRID\_UPDATE

`T`

​integer · int64

Transaction Time

Example: 1669262908216

`E`

​integer · int64

Event Time

Example: 1669262908218

`gu`

​object

## listenKeyExpired

`e`

​string · enum

Event Type

Enum values:

listenKeyExpired

`E`

​integer · int64

Event Time

Example: 1736996475556

`listenKey`

​string

Example: WsCMN0a4KHUPTQuX6IUnqEZfB1inxmv1qR4kbf1LuEjur5VdbzqvyxqG9TSjVVxv

## marginCall

`e`

​string · enum

Event Type

Enum values:

MARGIN\_CALL

`E`

​integer · int64

Event Time

Example: 1587727187525

`cw`

​string

Cross Wallet Balance. Only pushed with crossed position margin call

Example: 3.16812045

`p`

​object[]

Position(s) of Margin Call

## orderTradeUpdate

`e`

​string · enum

Event Type

Enum values:

ORDER\_TRADE\_UPDATE

`E`

​integer · int64

Event Time

Example: 1568879465651

`T`

​integer · int64

Transaction Time

Example: 1568879465650

`o`

​object

## strategyUpdate

`e`

​string · enum

Event Type

Enum values:

STRATEGY\_UPDATE

`T`

​integer · int64

Transaction Time

Example: 1669261797627

`E`

​integer · int64

Event Time

Example: 1669261797628

`su`

​object

## tradeLite

`e`

​string · enum

Event Type

Enum values:

TRADE\_LITE

`E`

​integer · int64

Event Time

Example: 1721895408092

`T`

​integer · int64

Transaction Time

Example: 1721895408214

`s`

​string

Symbol

Example: BTCUSDT

`q`

​string

Original Quantity

Example: 0.001

`p`

​string

Original Price

Example: 0

`m`

​boolean

Is this trade the maker side?

Example: false

`c`

​string

Client Order Id

Example: z8hcUoOsqEdKMeKPSABslD

`S`

​string

Side

Example: BUY

`L`

​string

Last Filled Price

Example: 64089.20

`l`

​string

Order Last Filled Quantity

Example: 0.040

`t`

​integer · int64

Trade Id

Example: 109100866

`i`

​integer · int64

Order Id

Example: 8886774

## User Data Stream Events

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
| ACCOUNT\_CONFIG\_UPDATE | type = object · e="ACCOUNT\_CONFIG\_UPDATE" |
| ACCOUNT\_UPDATE | type = object · e="ACCOUNT\_UPDATE" |
| ALGO\_UPDATE | type = object · e="ALGO\_UPDATE" |
| CONDITIONAL\_ORDER\_TRIGGER\_REJECT | type = object · e="CONDITIONAL\_ORDER\_TRIGGER\_REJECT" |
| GRID\_UPDATE | type = object · e="GRID\_UPDATE" |
| listenKeyExpired | type = object · e="listenKeyExpired" |
| MARGIN\_CALL | type = object · e="MARGIN\_CALL" |
| ORDER\_TRADE\_UPDATE | type = object · e="ORDER\_TRADE\_UPDATE" |
| STRATEGY\_UPDATE | type = object · e="STRATEGY\_UPDATE" |
| TRADE\_LITE | type = object · e="TRADE\_LITE" |

**Properties for ACCOUNT\_CONFIG\_UPDATE:**

`e`

​string · enum

Event Type

Enum values:

ACCOUNT\_CONFIG\_UPDATE

`E`

​integer · int64

Event Time

Example: 1611646737479

`T`

​integer · int64

Transaction Time

Example: 1611646737476

`ac`

​object

`ai`

​object

User's Account Configuration

On this page

* [accountConfigUpdate](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#accountconfigupdate)
* [accountUpdate](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#accountupdate)
* [algoUpdate](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#algoupdate)
* [conditionalOrderTriggerReject](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#conditionalordertriggerreject)
* [gridUpdate](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#gridupdate)
* [listenKeyExpired](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#listenkeyexpired)
* [marginCall](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#margincall)
* [orderTradeUpdate](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#ordertradeupdate)
* [strategyUpdate](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#strategyupdate)
* [tradeLite](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#tradelite)
* [User Data Stream Events](/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/~schemas#user-data-stream-events)

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/ws-api/user-data-streams -->

# User Data Streams - Futures (COIN-M) WebSocket API | Binance Developer Docs

Futures (COIN-M) WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Futures (COIN-M)](/en/docs/catalog#core-trading-derivatives-trading-coin-m-futures)
3. [WebSocket API](/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/ws-api)

# User Data Streams

Endpoint

wss://ws-dapi.binance.com/ws-dapi/v1wss://testnet.binancefuture.com/ws-dapi/v1

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/ws-api/1.0.0/schema.yaml)

---

## Close User Data Stream (USER\_STREAM)

Close out a user data stream.

WSS

userDataStream.stop

wss://ws-dapi.binance.com/ws-dapi/v1

### Close User Data Stream (USER\_STREAM) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1

### Close User Data Stream (USER\_STREAM) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

userDataStream.stop

Example: userDataStream.stop

`params`

​object · required

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Close User Data Stream (USER\_STREAM) › Responses

Successful Response

Close User Data Stream

`id`

​string

positionId

Example: 819e1b1b-8c06-485b-a13e-131326c69599

`status`

​integer · int64

Example: 200

`result`

​object

Indicates that combined is set to true.

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 2

WSSuserDataStream.stop

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.stop",
 "params": {
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.stop",
 "params": {
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "819e1b1b-8c06-485b-a13e-131326c69599",
 "status": 200,
 "result": {},
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 2
 }
 ]
}`

json

application/json

---

## Keepalive User Data Stream (USER\_STREAM)

Keepalive a user data stream to prevent a time out. User data streams
will close after 60 minutes. It's recommended to send a ping about every
60 minutes.

WSS

userDataStream.ping

wss://ws-dapi.binance.com/ws-dapi/v1

### Keepalive User Data Stream (USER\_STREAM) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1

### Keepalive User Data Stream (USER\_STREAM) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

userDataStream.ping

Example: userDataStream.ping

`params`

​object · required

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Keepalive User Data Stream (USER\_STREAM) › Responses

Successful Response

Keepalive User Data Stream

`id`

​string

positionId

Example: 815d5fce-0880-4287-a567-80badf004c74

`status`

​integer · int64

Example: 200

`result`

​object

Indicates that combined is set to true.

Indicates that combined is set to true.

`listenKey`

​string

Listen key.

Example: 3HBntNTepshgEdjIwSUIBgB9keLyOCg5qv3n6bYAtktG8ejcaW5HXz9Vx1JgIieg

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 2

WSSuserDataStream.ping

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.ping",
 "params": {
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.ping",
 "params": {
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "815d5fce-0880-4287-a567-80badf004c74",
 "status": 200,
 "result": {
 "listenKey": "3HBntNTepshgEdjIwSUIBgB9keLyOCg5qv3n6bYAtktG8ejcaW5HXz9Vx1JgIieg"
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 2
 }
 ]
}`

json

application/json

---

## Start User Data Stream (USER\_STREAM)

Start a new user data stream. The stream will close after 60 minutes
unless a keepalive is sent. If the account has an active `listenKey`,
that `listenKey` will be returned and its validity will be extended for
60 minutes.

WSS

userDataStream.start

wss://ws-dapi.binance.com/ws-dapi/v1

### Start User Data Stream (USER\_STREAM) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1

### Start User Data Stream (USER\_STREAM) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

userDataStream.start

Example: userDataStream.start

`params`

​object · required

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Start User Data Stream (USER\_STREAM) › Responses

Successful Response

Start User Data Stream

`id`

​string

positionId

Example: d3df8a61-98ea-4fe0-8f4e-0fcea5d418b0

`status`

​integer · int64

Example: 200

`result`

​object

Indicates that combined is set to true.

Indicates that combined is set to true.

`listenKey`

​string

Listen key.

Example: xs0mRXdAKlIPDRFrlPcw0qI41Eh3ixNntmymGyhrhgqo7L6FuLaWArTD7RLP

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 2

WSSuserDataStream.start

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.start",
 "params": {
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "userDataStream.start",
 "params": {
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
 "listenKey": "xs0mRXdAKlIPDRFrlPcw0qI41Eh3ixNntmymGyhrhgqo7L6FuLaWArTD7RLP"
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 2
 }
 ]
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api -->

# Account - Futures (COIN-M) REST API | Binance Developer Docs

Futures (COIN-M) REST API

1. [API Reference](/en/docs/catalog)
2. [Futures (COIN-M)](/en/docs/catalog#core-trading-derivatives-trading-coin-m-futures)
3. [REST API](/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api)

# Account

Endpoint

https://dapi.binance.comhttps://testnet.binancefuture.com

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/1.0.0/schema.yaml)

---

## Account Information (USER\_DATA)

Get current account information.

GET

/dapi/v1/account

https://dapi.binance.com

### Account Information (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Account Information (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight5

### Account Information (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Account Information (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* for One-way Mode user, the "positions" will only show the "BOTH" positions
* for Hedge Mode user, the "positions" will show "BOTH", "LONG", and "SHORT" positions.

### Account Information (USER\_DATA) › Responses

200

Account Information

`assets`

​object[]

Supported assets.

`asset`

​string

asset name

Example: BTC

`walletBalance`

​string

total wallet balance

Example: 0.00241969

`unrealizedProfit`

​string

unrealized profit or loss

Example: 0.00000000

`marginBalance`

​string

margin balance

Example: 0.00241969

`maintMargin`

​string

maintenance margin

Example: 0.00000000

`initialMargin`

​string

total intial margin required with the latest mark price

Example: 0.00000000

`positionInitialMargin`

​string

positions" margin required with the latest mark price

Example: 0.00000000

`openOrderInitialMargin`

​string

open orders" intial margin required with the latest mark price

Example: 0.00000000

`maxWithdrawAmount`

​string

maximum amount for transfer out

Example: 0.00241969

`crossWalletBalance`

​string

wallet balance for crossed margin

Example: 0.00241969

`crossUnPnl`

​string

total unrealized profit or loss of crossed positions

Example: 0.00000000

`availableBalance`

​string

available margin balance

Example: 0.00241969

`updateTime`

​integer · int64

update time

Example: 1625474304765

`positions`

​object[]

Position list.

`symbol`

​string

Trading symbol

Example: BTCUSD\_201225

`positionAmt`

​string

position amount

Example: 0

`initialMargin`

​string

total intial margin required with the latest mark price

Example: 0

`maintMargin`

​string

maintenance margin

Example: 0

`unrealizedProfit`

​string

unrealized profit or loss

Example: 0.00000000

`positionInitialMargin`

​string

positions" margin required with the latest mark price

Example: 0

`openOrderInitialMargin`

​string

open orders" intial margin required with the latest mark price

Example: 0

`leverage`

​string

Leverage value.

Example: 125

`isolated`

​boolean

Whether isolated margin mode is enabled.

Example: false

`positionSide`

​string

Position side

Example: BOTH

`entryPrice`

​string

Position entry price.

Example: 0.0

`breakEvenPrice`

​string

break-even price

Example: 0.0

`maxQty`

​string

maximum quantity of base asset

Example: 50

`updateTime`

​integer · int64

update time

Example: 0

`notionalValue`

​string

Notional value.

Example: 0

`canDeposit`

​boolean

Whether deposits are enabled.

Example: true

`canTrade`

​boolean

Whether trading is enabled.

Example: true

`canWithdraw`

​boolean

Whether withdrawals are enabled.

Example: true

`feeTier`

​integer · int64

Fee tier level.

Example: 2

`updateTime`

​integer · int64

update time

Example: 0

GET/dapi/v1/account

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/account?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "assets": [
 {
 "asset": "BTC",
 "walletBalance": "0.00241969",
 "unrealizedProfit": "0.00000000",
 "marginBalance": "0.00241969",
 "maintMargin": "0.00000000",
 "initialMargin": "0.00000000",
 "positionInitialMargin": "0.00000000",
 "openOrderInitialMargin": "0.00000000",
 "maxWithdrawAmount": "0.00241969",
 "crossWalletBalance": "0.00241969",
 "crossUnPnl": "0.00000000",
 "availableBalance": "0.00241969",
 "updateTime": 1625474304765
 }
 ],
 "positions": [
 {
 "symbol": "BTCUSD_201225",
 "positionAmt": "0",
 "initialMargin": "0",
 "maintMargin": "0",
 "unrealizedProfit": "0.00000000",
 "positionInitialMargin": "0",
 "openOrderInitialMargin": "0",
 "leverage": "125",
 "isolated": false,
 "positionSide": "BOTH",
 "entryPrice": "0.0",
 "breakEvenPrice": "0.0",
 "maxQty": "50",
 "updateTime": 0,
 "notionalValue": "0"
 }
 ],
 "canDeposit": true,
 "canTrade": true,
 "canWithdraw": true,
 "feeTier": 2,
 "updateTime": 0
}`

json

application/json

---

## Futures Account Balance (USER\_DATA)

Check futures account balance

GET

/dapi/v1/balance

https://dapi.binance.com

### Futures Account Balance (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Futures Account Balance (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1

### Futures Account Balance (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Futures Account Balance (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

### Futures Account Balance (USER\_DATA) › Responses

200

Futures Account Balance

​object

`accountAlias`

​string

unique account code

Example: SgsR

`asset`

​string

asset name

Example: BTC

`balance`

​string

Account balance.

Example: 0.00250000

`withdrawAvailable`

​string

Available amount for withdrawal.

Example: 0.00250000

`crossWalletBalance`

​string

wallet balance for crossed margin

Example: 0.00241969

`crossUnPnl`

​string

total unrealized profit or loss of crossed positions

Example: 0.00000000

`availableBalance`

​string

available margin balance

Example: 0.00241969

`updateTime`

​integer · int64

update time

Example: 1592468353979

GET/dapi/v1/balance

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/balance?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "accountAlias": "SgsR",
 "asset": "BTC",
 "balance": "0.00250000",
 "withdrawAvailable": "0.00250000",
 "crossWalletBalance": "0.00241969",
 "crossUnPnl": "0.00000000",
 "availableBalance": "0.00241969",
 "updateTime": 1592468353979
 }
]`

json

application/json

---

## Get Current Position Mode (USER\_DATA)

Get user's position mode (Hedge Mode or One-way Mode ) on ***EVERY symbol***

GET

/dapi/v1/positionSide/dual

https://dapi.binance.com

### Get Current Position Mode (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Get Current Position Mode (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight30

### Get Current Position Mode (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Current Position Mode (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

### Get Current Position Mode (USER\_DATA) › Responses

200

Get Current Position Mode

`dualSidePosition`

​boolean

Whether dual-side position mode is enabled.

Example: true

GET/dapi/v1/positionSide/dual

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/positionSide/dual?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "dualSidePosition": true
}`

json

application/json

---

## Get Download Id For Futures Order History (USER\_DATA)

Get Download Id For Futures Order History

GET

/dapi/v1/order/asyn

https://dapi.binance.com

### Get Download Id For Futures Order History (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Get Download Id For Futures Order History (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1000

### Get Download Id For Futures Order History (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Download Id For Futures Order History (USER\_DATA) › Query Parameters

`startTime`

​integer · int64 · required

Timestamp in ms

Example: 1623319461670

`endTime`

​integer · int64 · required

Timestamp in ms

Example: 1641782889000

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Request Limitation is 8 times per month, shared by front end download page and rest api
* This endpoint uses the IP rate limit bucket and costs 1000 weight per call. The maximum is 2 calls per minute; the 3rd call within the same minute will trigger a ban.
* The time between `startTime` and `endTime` can not be longer than 1 year

### Get Download Id For Futures Order History (USER\_DATA) › Responses

200

Get Download Id For Futures Order History

`avgCostTimestampOfLast30d`

​integer · int64

Average time taken for data download in the past 30 days

Example: 7241837

`downloadId`

​string

Download task ID.

Example: 546975389218332672

GET/dapi/v1/order/asyn

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/order/asyn?startTime=%3Cnumber%3E&endTime=%3Cnumber%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "avgCostTimestampOfLast30d": 7241837,
 "downloadId": "546975389218332672"
}`

json

application/json

---

## Get Download Id For Futures Trade History (USER\_DATA)

Get download id for futures trade history

GET

/dapi/v1/trade/asyn

https://dapi.binance.com

### Get Download Id For Futures Trade History (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Get Download Id For Futures Trade History (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1000

### Get Download Id For Futures Trade History (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Download Id For Futures Trade History (USER\_DATA) › Query Parameters

`startTime`

​integer · int64 · required

Timestamp in ms

Example: 1623319461670

`endTime`

​integer · int64 · required

Timestamp in ms

Example: 1641782889000

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Request Limitation is 8 times per month, shared by front end download page and rest api
* This endpoint uses the IP rate limit bucket and costs 1000 weight per call. The maximum is 2 calls per minute; the 3rd call within the same minute will trigger a ban.
* The time between `startTime` and `endTime` can not be longer than 1 year

### Get Download Id For Futures Trade History (USER\_DATA) › Responses

200

Get Download Id For Futures Trade History

`avgCostTimestampOfLast30d`

​integer · int64

Average time taken for data download in the past 30 days

Example: 7241837

`downloadId`

​string

Download task ID.

Example: 546975389218332672

GET/dapi/v1/trade/asyn

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/trade/asyn?startTime=%3Cnumber%3E&endTime=%3Cnumber%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "avgCostTimestampOfLast30d": 7241837,
 "downloadId": "546975389218332672"
}`

json

application/json

---

## Get Download Id For Futures Transaction History (USER\_DATA)

Get download id for futures transaction history

GET

/dapi/v1/income/asyn

https://dapi.binance.com

### Get Download Id For Futures Transaction History (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Get Download Id For Futures Transaction History (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1000

### Get Download Id For Futures Transaction History (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Download Id For Futures Transaction History (USER\_DATA) › Query Parameters

`startTime`

​integer · int64 · required

Timestamp in ms

Example: 1623319461670

`endTime`

​integer · int64 · required

Timestamp in ms

Example: 1641782889000

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Request Limitation is 8 times per month, shared by front end download page and rest api
* This endpoint uses the IP rate limit bucket and costs 1000 weight per call. The maximum is 2 calls per minute; the 3rd call within the same minute will trigger a ban.
* The time between `startTime` and `endTime` can not be longer than 1 year

### Get Download Id For Futures Transaction History (USER\_DATA) › Responses

200

Get Download Id For Futures Transaction History

`avgCostTimestampOfLast30d`

​integer · int64

Average time taken for data download in the past 30 days

Example: 7241837

`downloadId`

​string

Download task ID.

Example: 546975389218332672

GET/dapi/v1/income/asyn

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/income/asyn?startTime=%3Cnumber%3E&endTime=%3Cnumber%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "avgCostTimestampOfLast30d": 7241837,
 "downloadId": "546975389218332672"
}`

json

application/json

---

## Get Futures Order History Download Link by Id (USER\_DATA)

Get futures order history download link by Id

GET

/dapi/v1/order/asyn/id

https://dapi.binance.com

### Get Futures Order History Download Link by Id (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Get Futures Order History Download Link by Id (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight5

### Get Futures Order History Download Link by Id (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Futures Order History Download Link by Id (USER\_DATA) › Query Parameters

`downloadId`

​string · required

get by download id api

Example: 545923594199212032

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Download link expiration: 7 days

### Get Futures Order History Download Link by Id (USER\_DATA) › Responses

200

Get Futures Order History Download Link by Id

`downloadId`

​string

Download task ID.

Example: 545923594199212032

`status`

​string

Enum：completed，processing

Example: processing

`url`

​string

The link is mapped to download id

Example:

`notified`

​boolean

ignore

Example: false

`expirationTimestamp`

​integer · int64

The link would expire after this timestamp

Example: -1

`isExpired`

​string

Whether the record is expired.

Example: null

GET/dapi/v1/order/asyn/id

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/order/asyn/id?downloadId=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "downloadId": "545923594199212032",
 "status": "processing",
 "url": "",
 "notified": false,
 "expirationTimestamp": -1,
 "isExpired": "null"
}`

json

application/json

---

## Get Futures Trade Download Link by Id (USER\_DATA)

Get futures trade download link by Id

GET

/dapi/v1/trade/asyn/id

https://dapi.binance.com

### Get Futures Trade Download Link by Id (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Get Futures Trade Download Link by Id (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight5

### Get Futures Trade Download Link by Id (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Futures Trade Download Link by Id (USER\_DATA) › Query Parameters

`downloadId`

​string · required

get by download id api

Example: 545923594199212032

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Download link expiration: 7 days

### Get Futures Trade Download Link by Id (USER\_DATA) › Responses

200

Get Futures Trade Download Link by Id

`downloadId`

​string

Download task ID.

Example: 545923594199212032

`status`

​string

Enum：completed，processing

Example: processing

`url`

​string

The link is mapped to download id

Example:

`notified`

​boolean

ignore

Example: false

`expirationTimestamp`

​integer · int64

The link would expire after this timestamp

Example: -1

`isExpired`

​string

Whether the record is expired.

Example: null

GET/dapi/v1/trade/asyn/id

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/trade/asyn/id?downloadId=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "downloadId": "545923594199212032",
 "status": "processing",
 "url": "",
 "notified": false,
 "expirationTimestamp": -1,
 "isExpired": "null"
}`

json

application/json

---

## Get Futures Transaction History Download Link by Id (USER\_DATA)

Get futures transaction history download link by Id

GET

/dapi/v1/income/asyn/id

https://dapi.binance.com

### Get Futures Transaction History Download Link by Id (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Get Futures Transaction History Download Link by Id (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight5

### Get Futures Transaction History Download Link by Id (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Futures Transaction History Download Link by Id (USER\_DATA) › Query Parameters

`downloadId`

​string · required

get by download id api

Example: 545923594199212032

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Download link expiration: 7 days

### Get Futures Transaction History Download Link by Id (USER\_DATA) › Responses

200

Get Futures Transaction History Download Link by Id

`downloadId`

​string

Download task ID.

Example: 545923594199212032

`status`

​string

Enum：completed，processing

Example: processing

`url`

​string

The link is mapped to download id

Example:

`notified`

​boolean

ignore

Example: false

`expirationTimestamp`

​integer · int64

The link would expire after this timestamp

Example: -1

`isExpired`

​string

Whether the record is expired.

Example: null

GET/dapi/v1/income/asyn/id

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/income/asyn/id?downloadId=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "downloadId": "545923594199212032",
 "status": "processing",
 "url": "",
 "notified": false,
 "expirationTimestamp": -1,
 "isExpired": "null"
}`

json

application/json

---

## Get Income History (USER\_DATA)

Get income history

GET

/dapi/v1/income

https://dapi.binance.com

### Get Income History (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Get Income History (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight20

### Get Income History (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Get Income History (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`symbol`

​string

Symbol

Example: BTCUSDT

`incomeType`

​string · enum

Income type.

Enum values:

TRANSFER

WELCOME\_BONUS

FUNDING\_FEE

REALIZED\_PNL

COMMISSION

INSURANCE\_CLEAR

DELIVERED\_SETTELMENT

Example: TRANSFER

`startTime`

​integer · int64

Timestamp in ms to get funding from INCLUSIVE.

Example: 1623319461670

`endTime`

​integer · int64

Timestamp in ms to get funding until INCLUSIVE.

Example: 1641782889000

`page`

​integer · int64

Page number

Example: 1

`limit`

​integer · int64 · max: 1000

Maximum number of records to return.

Example: 30

Default: 100

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* If `incomeType`  is not sent, all kinds of flow will be returned
* "trandId" is unique in the same "incomeType" for a user
* The time between `startTime` and `endTime` can not be longer than 1 year

### Get Income History (USER\_DATA) › Responses

200

Get Income History

​object

`symbol`

​string

Trading symbol

Example:

`incomeType`

​string

income type

Example: TRANSFER

`income`

​string

income amount

Example: -0.37500000

`asset`

​string

asset name

Example: BTC

`info`

​string

extra information

Example: WITHDRAW

`time`

​integer · int64

Time

Example: 1570608000000

`tranId`

​string

transaction id

Example: 9689322392

`tradeId`

​string

Trade ID.

Example:

GET/dapi/v1/income

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/income?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "symbol": "",
 "incomeType": "TRANSFER",
 "income": "-0.37500000",
 "asset": "BTC",
 "info": "WITHDRAW",
 "time": 1570608000000,
 "tranId": "9689322392",
 "tradeId": ""
 }
]`

json

application/json

---

## Notional Bracket for Pair (USER\_DATA)

**Not recommended to continue using this v1 endpoint**

Get the pair's default notional bracket list, may return ambiguous
values when there have been multiple different `symbol` brackets under
the `pair`, suggest using the following `GET /dapi/v2/leverageBracket`
query instead to get the specific `symbol` notional bracket list.

GET

/dapi/v1/leverageBracket

https://dapi.binance.com

### Notional Bracket for Pair (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Notional Bracket for Pair (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1

### Notional Bracket for Pair (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Notional Bracket for Pair (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`pair`

​string

Example: BTCUSD

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

### Notional Bracket for Pair (USER\_DATA) › Responses

200

Notional Bracket for Pair

​object

`pair`

​string

Pair

Example: BTCUSD

`brackets`

​object[]

Leverage bracket details.

`bracket`

​integer · int64

bracket level

Example: 1

`initialLeverage`

​integer · int64

the maximum leverage

Example: 125

`qtyCap`

​integer · int64

upper edge of base asset quantity

Example: 50

`qtylFloor`

​integer · int64

lower edge of base asset quantity

Example: 0

`maintMarginRatio`

​number · float

Maintenance margin ratio.

Example: 0.004

`cum`

​number · float

Cumulative value.

Example: 0

GET/dapi/v1/leverageBracket

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/leverageBracket?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "pair": "BTCUSD",
 "brackets": [
 {
 "bracket": 1,
 "initialLeverage": 125,
 "qtyCap": 50,
 "qtylFloor": 0,
 "maintMarginRatio": 0.004,
 "cum": 0
 }
 ]
 }
]`

json

application/json

---

## Notional Bracket for Symbol (USER\_DATA)

Get the symbol's notional bracket list.

GET

/dapi/v2/leverageBracket

https://dapi.binance.com

### Notional Bracket for Symbol (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Notional Bracket for Symbol (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight

1 (after CM migration: 1 with `symbol` / 2 without `symbol`)

### Notional Bracket for Symbol (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### Notional Bracket for Symbol (USER\_DATA) › Query Parameters

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`symbol`

​string

Example: BTCUSD\_PERP

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

### Notional Bracket for Symbol (USER\_DATA) › Responses

200

Notional Bracket for Symbol

​object

`symbol`

​string

Trading symbol

Example: BTCUSD\_PERP

`notionalCoef`

​number · float

user symbol bracket multiplier, only appears when user's symbol bracket is adjusted

Example: 1.5

`brackets`

​object[]

Leverage bracket details.

`bracket`

​integer · int64

bracket level

Example: 1

`initialLeverage`

​integer · int64

the maximum leverage

Example: 125

`qtyCap`

​integer · int64

upper edge of base asset quantity

Example: 50

`qtylFloor`

​integer · int64

lower edge of base asset quantity

Example: 0

`maintMarginRatio`

​number · float

Maintenance margin ratio.

Example: 0.004

`cum`

​number · float

Cumulative value.

Example: 0

GET/dapi/v2/leverageBracket

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v2/leverageBracket?timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`[
 {
 "symbol": "BTCUSD_PERP",
 "notionalCoef": 1.5,
 "brackets": [
 {
 "bracket": 1,
 "initialLeverage": 125,
 "qtyCap": 50,
 "qtylFloor": 0,
 "maintMarginRatio": 0.004,
 "cum": 0
 }
 ]
 }
]`

json

application/json

---

## User Commission Rate (USER\_DATA)

Query user commission rate

GET

/dapi/v1/commissionRate

https://dapi.binance.com

### User Commission Rate (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### User Commission Rate (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight20

### User Commission Rate (USER\_DATA) › Headers

`X-MBX-APIKEY`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

### User Commission Rate (USER\_DATA) › Query Parameters

`symbol`

​string · required

Symbol

Example: BTCUSD\_PERP

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The value
must reflect the current client time and is validated by the server
for signed endpoints.

Example: 1770736694138

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

### User Commission Rate (USER\_DATA) › Responses

200

User Commission Rate

`symbol`

​string

Trading symbol

Example: BTCUSD\_PERP

`makerCommissionRate`

​string

0.015%

Example: 0.00015

`takerCommissionRate`

​string

Taker commission rate.

Example: 0.00040

GET/dapi/v1/commissionRate

Loading…

`curl --request GET \
 --url 'https://dapi.binance.com/dapi/v1/commissionRate?symbol=%3Cstring%3E&timestamp=%3Cnumber%3E' \
 --header 'X-MBX-APIKEY: <string>'`

Example Responses

200

`{
 "symbol": "BTCUSD_PERP",
 "makerCommissionRate": "0.00015",
 "takerCommissionRate": "0.00040"
}`

json

application/json

---

---

<!-- Fonte Oficial: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/ws-api/trade -->

# Trade - Futures (COIN-M) WebSocket API | Binance Developer Docs

Futures (COIN-M) WebSocket API

1. [API Reference](/en/docs/catalog)
2. [Futures (COIN-M)](/en/docs/catalog#core-trading-derivatives-trading-coin-m-futures)
3. [WebSocket API](/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/ws-api)

# Trade

Endpoint

wss://ws-dapi.binance.com/ws-dapi/v1wss://testnet.binancefuture.com/ws-dapi/v1

[Download schema](/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/ws-api/1.0.0/schema.yaml)

---

## Cancel Order (TRADE)

Cancel an active order.

WSS

order.cancel

wss://ws-dapi.binance.com/ws-dapi/v1

### Cancel Order (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Cancel Order (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1

### Cancel Order (TRADE) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

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

Example: BTCUSD\_PERP

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The
value must reflect the current client time and is validated
by the server for signed endpoints.

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

Example: 1

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Either `orderId` or `origClientOrderId` must be sent.

### Cancel Order (TRADE) › Responses

Successful Response

Cancel Order

`id`

​string

positionId

Example: a8627ea5-8b9f-452f-90ae-4136f2b442e2

`status`

​integer · int64

Example: 200

`result`

​object

Indicates that combined is set to true.

Indicates that combined is set to true.

`orderId`

​integer · int64

Sub-order ID

Example: 333245211

`symbol`

​string

Trading symbol

Example: BTCUSD\_PERP

`pair`

​string

Pair

Example: BTCUSD

`status`

​string

Status.

Example: CANCELED

`clientOrderId`

​string

Client order ID.

Example: 5SztZiGFAxgAqw4J9EN9fA

`price`

​string

Latest token price.

Example: 51000

`origQty`

​string

Original order quantity

Example: 1

`executedQty`

​string

Executed quantity

Example: 0

`cumQty`

​string

Cumulative filled quantity.

Example: 0

`timeInForce`

​string

Time in force

Example: GTC

`type`

​string

Order type.

Example: LIMIT

`reduceOnly`

​boolean

Whether the order is reduce-only.

Example: false

`closePosition`

​boolean

if Close-All

Example: false

`side`

​string

Trading side

Example: BUY

`positionSide`

​string

Position side

Example: BOTH

`stopPrice`

​string

please ignore when order type is TRAILING\_STOP\_MARKET

Example: 0

`workingType`

​string

Stop trigger price type.

Example: CONTRACT\_PRICE

`priceProtect`

​boolean

if conditional order trigger is protected

Example: false

`origType`

​string

Original order type.

Example: LIMIT

`updateTime`

​integer · int64

update time

Example: 1728416138285

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 6

WSSorder.cancel

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "order.cancel",
 "params": {
 "symbol": "BTCUSD_PERP",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "order.cancel",
 "params": {
 "symbol": "BTCUSD_PERP",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "a8627ea5-8b9f-452f-90ae-4136f2b442e2",
 "status": 200,
 "result": {
 "orderId": 333245211,
 "symbol": "BTCUSD_PERP",
 "pair": "BTCUSD",
 "status": "CANCELED",
 "clientOrderId": "5SztZiGFAxgAqw4J9EN9fA",
 "price": "51000",
 "origQty": "1",
 "executedQty": "0",
 "cumQty": "0",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "reduceOnly": false,
 "closePosition": false,
 "side": "BUY",
 "positionSide": "BOTH",
 "stopPrice": "0",
 "workingType": "CONTRACT_PRICE",
 "priceProtect": false,
 "origType": "LIMIT",
 "updateTime": 1728416138285
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 6
 }
 ]
}`

json

application/json

---

## Modify Order (TRADE)

Order modify function, currently only LIMIT order modification is
supported, modified orders will be reordered in the match queue

WSS

order.modify

wss://ws-dapi.binance.com/ws-dapi/v1

### Modify Order (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Modify Order (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight

1 on 10s order rate limit(X-MBX-ORDER-COUNT-10S);
1 on 1min order rate limit(X-MBX-ORDER-COUNT-1M);
1 on IP rate limit(x-mbx-used-weight-1m)

### Modify Order (TRADE) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

order.modify

Example: order.modify

`params`

​object · required

`symbol`

​string · required

Example: BTCUSD\_PERP

`side`

​string · enum · required

Enum values:

BUY

SELL

Example: BUY

`quantity`

​number · float · required

Order quantity, cannot be sent with `closePosition=true`

Example: 1.0

`price`

​number · float · required

Example: 1.0

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The
value must reflect the current client time and is validated
by the server for signed endpoints.

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

Example: 1

`priceMatch`

​string · enum

only avaliable for `LIMIT`/`STOP`/`TAKE_PROFIT` order; Can't be passed together with `price`

Enum values:

OPPONENT

OPPONENT\_5

OPPONENT\_10

OPPONENT\_20

QUEUE

QUEUE\_5

QUEUE\_10

QUEUE\_20

Example: OPPONENT

`modifyId`

​integer · int64

User-defined modification identifier, returned as-is in the response. Optional; not validated for uniqueness.

Example: 1

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Either `orderId` or `origClientOrderId` must be sent, and the `orderId` will prevail if both are sent.
* Both `quantity` and `price` must be sent.
* When the new `quantity` or `price` doesn't satisfy `PRICE_FILTER` / `PERCENT_FILTER` / `LOT_SIZE`, amendment will be rejected and the order will stay as it is.
* However the order will be cancelled by the amendment in the following situations:
  + when the order is in partially filled status and the new `quantity` <= `executedQty`
  + When the order is `GTX` and the new price will cause it to be executed immediately
* One order can only be modified for less than 10000 times.

### Modify Order (TRADE) › Responses

Successful Response

Modify Order

`id`

​string

positionId

Example: 88601d02-bd0d-430d-8733-2708a569ebda

`status`

​integer · int64

Example: 200

`result`

​object

Indicates that combined is set to true.

Indicates that combined is set to true.

`orderId`

​integer · int64

Sub-order ID

Example: 333245211

`symbol`

​string

Trading symbol

Example: BTCUSD\_PERP

`pair`

​string

Pair

Example: BTCUSD

`status`

​string

Status.

Example: NEW

`clientOrderId`

​string

Client order ID.

Example: 5SztZiGFAxgAqw4J9EN9fA

`modifyId`

​integer · int64

user-defined modification identifier, only returned if provided in the request

Example: 1

`price`

​string

Latest token price.

Example: 51000

`origQty`

​string

Original order quantity

Example: 1

`executedQty`

​string

Executed quantity

Example: 0

`cumQty`

​string

Cumulative filled quantity.

Example: 0

`timeInForce`

​string

Time in force

Example: GTC

`type`

​string

Order type.

Example: LIMIT

`reduceOnly`

​boolean

Whether the order is reduce-only.

Example: false

`closePosition`

​boolean

if Close-All

Example: false

`side`

​string

Trading side

Example: BUY

`positionSide`

​string

Position side

Example: BOTH

`stopPrice`

​string

please ignore when order type is TRAILING\_STOP\_MARKET

Example: 0

`workingType`

​string

Stop trigger price type.

Example: CONTRACT\_PRICE

`priceProtect`

​boolean

if conditional order trigger is protected

Example: false

`origType`

​string

Original order type.

Example: LIMIT

`updateTime`

​integer · int64

update time

Example: 1728415765493

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 6

WSSorder.modify

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "order.modify",
 "params": {
 "symbol": "BTCUSD_PERP",
 "side": "BUY",
 "quantity": "1.0",
 "price": "1.0",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "order.modify",
 "params": {
 "symbol": "BTCUSD_PERP",
 "side": "BUY",
 "quantity": "1.0",
 "price": "1.0",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "88601d02-bd0d-430d-8733-2708a569ebda",
 "status": 200,
 "result": {
 "orderId": 333245211,
 "symbol": "BTCUSD_PERP",
 "pair": "BTCUSD",
 "status": "NEW",
 "clientOrderId": "5SztZiGFAxgAqw4J9EN9fA",
 "modifyId": 1,
 "price": "51000",
 "origQty": "1",
 "executedQty": "0",
 "cumQty": "0",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "reduceOnly": false,
 "closePosition": false,
 "side": "BUY",
 "positionSide": "BOTH",
 "stopPrice": "0",
 "workingType": "CONTRACT_PRICE",
 "priceProtect": false,
 "origType": "LIMIT",
 "updateTime": 1728415765493
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 6
 }
 ]
}`

json

application/json

---

## New Order (TRADE)

Send in a new order.

WSS

order.place

wss://ws-dapi.binance.com/ws-dapi/v1

### New Order (TRADE) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### New Order (TRADE) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight0

### New Order (TRADE) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

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

Example: BTCUSD\_PERP

`side`

​string · enum · required

Enum values:

BUY

SELL

Example: BUY

`type`

​string · enum · required

**After CM migration, stop-type values (`STOP`, `STOP_MARKET`, `TAKE_PROFIT`, `TAKE_PROFIT_MARKET`, `TRAILING_STOP_MARKET`) are no longer accepted and will return `-4120`. Use the REST `/dapi/v1/algoOrder` endpoint instead.**

Enum values:

LIMIT

MARKET

STOP

STOP\_MARKET

TAKE\_PROFIT

TAKE\_PROFIT\_MARKET

TRAILING\_STOP\_MARKET

Example: LIMIT

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The
value must reflect the current client time and is validated
by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`positionSide`

​string · enum

Default `BOTH` for One-way Mode; `LONG` or `SHORT` for Hedge Mode. It must be sent in Hedge Mode.

Enum values:

BOTH

LONG

SHORT

Example: BOTH

`timeInForce`

​string · enum

Enum values:

GTC

IOC

FOK

GTX

Example: GTC

`quantity`

​number · float

Quantity measured by contract number, Cannot be sent with `closePosition`=`true`

Example: 1.0

`reduceOnly`

​string · enum

Cannot be sent in Hedge Mode; cannot be sent with `closePosition`=`true` (Close-All)"

Enum values:

true

false

Example: true

Default: false

`price`

​number · float

Example: 1.0

`newClientOrderId`

​string

A unique id among open orders. Automatically generated if not sent. Can only be string following the rule: `^[\.A-Z\:/a-z0-9_-]{1,36}$`

Example: 1

`stopPrice`

​number · float

Used with `STOP/STOP_MARKET` or `TAKE_PROFIT/TAKE_PROFIT_MARKET` orders.

Example: 1.0

`closePosition`

​string · enum

`true`, `false`；Close-All，used with `STOP_MARKET` or `TAKE_PROFIT_MARKET`.

Enum values:

true

false

Example: true

`activationPrice`

​number · float

Used with `TRAILING_STOP_MARKET` orders, default as the latest price(supporting different workingType)

Example: 1.0

`callbackRate`

​number · float

Used with `TRAILING_STOP_MARKET` orders, min 0.1, max 10 where 1 for 1%

Example: 5000.0

`workingType`

​string · enum

stopPrice triggered by: "MARK\_PRICE", "CONTRACT\_PRICE". Default "CONTRACT\_PRICE"

Enum values:

MARK\_PRICE

CONTRACT\_PRICE

Example: MARK\_PRICE

Default: CONTRACT\_PRICE

`priceProtect`

​string · enum

Used with `STOP/STOP_MARKET` or `TAKE_PROFIT/TAKE_PROFIT_MARKET` orders.'

Enum values:

true

false

Example: true

Default: false

`newOrderRespType`

​string · enum

Enum values:

ACK

RESULT

Example: ACK

Default: ACK

`priceMatch`

​string · enum

only available for `LIMIT`/`STOP`/`TAKE_PROFIT` order; Can't be passed together with `price`

Enum values:

OPPONENT

OPPONENT\_5

OPPONENT\_10

OPPONENT\_20

QUEUE

QUEUE\_5

QUEUE\_10

QUEUE\_20

Example: OPPONENT

`selfTradePreventionMode`

​string · enum

`NONE`: No STP / `EXPIRE_TAKER` taker order when STP triggers/ `EXPIRE_MAKER` taker order when STP triggers/ `EXPIRE_BOTH` both orders when STP triggers

Enum values:

NONE

EXPIRE\_TAKER

EXPIRE\_BOTH

EXPIRE\_MAKER

Example: NONE

Default: NONE

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Additional mandatory parameters based on `type`:
  | Type | Additional mandatory parameters | | :---: | --- | | `LIMIT` | `timeInForce`, `quantity`, `price` | | `MARKET` | `quantity` | | `STOP/TAKE_PROFIT` | `quantity`, `price`, `stopPrice` | | `STOP_MARKET/TAKE_PROFIT_MARKET` | `stopPrice` | | `TRAILING_STOP_MARKET` | `callbackRate` |
  + Order with type `STOP`, parameter `timeInForce` can be sent ( default `GTC`). \* Order with type `TAKE_PROFIT`, parameter `timeInForce` can be sent ( default `GTC`). \* Condition orders will be triggered when:
  + If parameter `priceProtect` is sent as true:
  + when price reaches the `stopPrice`，the difference rate between "MARK\_PRICE" and "CONTRACT\_PRICE" cannot be larger than the "triggerProtect" of the symbol
  + "triggerProtect" of a symbol can be got from `GET /dapi/v1/exchangeInfo`
  + `STOP`, `STOP_MARKET`:
  + BUY: latest price ("MARK\_PRICE" or "CONTRACT\_PRICE") >= `stopPrice`
  + SELL: latest price ("MARK\_PRICE" or "CONTRACT\_PRICE") <= `stopPrice`
  + `TAKE_PROFIT`, `TAKE_PROFIT_MARKET`:
  + BUY: latest price ("MARK\_PRICE" or "CONTRACT\_PRICE") <= `stopPrice`
  + SELL: latest price ("MARK\_PRICE" or "CONTRACT\_PRICE") >= `stopPrice`
  + `TRAILING_STOP_MARKET`:
  + BUY: the lowest price after order placed <= `activationPrice`, and the latest price >= the lowest price \* (1 + `callbackRate`)
  + SELL: the highest price after order placed >= `activationPrice`, and the latest price <= the highest price \* (1 - `callbackRate`)
  + For `TRAILING_STOP_MARKET`, if you got such error code.
  + BUY: `activationPrice` should be smaller than latest price.
  + SELL: `activationPrice` should be larger than latest price.
  + If `newOrderRespType` is sent as `RESULT`:
  + `MARKET` order: the final FILLED result of the order will be return directly.
  + `LIMIT` order with special `timeInForce`: the final status result of the order(FILLED or EXPIRED) will be returned directly.
  + `STOP_MARKET`, `TAKE_PROFIT_MARKET` with `closePosition=true`:
  + Follow the same rules for condition orders.
  + If triggered，**close all** current long position(if `SELL`) or current short position(if `BUY`).
  + Cannot be used with `quantity` parameter
  + Cannot be used with `reduceOnly` parameter
  + In Hedge Mode, cannot be used with `BUY` orders in `LONG` position side. and cannot be used with `SELL` orders in `SHORT` position side

### New Order (TRADE) › Responses

Successful Response

New Order

`id`

​string

positionId

Example: 60fa4366-f96e-42fe-a82b-f819952c6db4

`status`

​integer · int64

Example: 200

`result`

​object

Indicates that combined is set to true.

Indicates that combined is set to true.

`orderId`

​integer · int64

Sub-order ID

Example: 333245211

`symbol`

​string

Trading symbol

Example: BTCUSD\_PERP

`pair`

​string

Pair

Example: BTCUSD

`status`

​string

Status.

Example: NEW

`clientOrderId`

​string

Client order ID.

Example: 5SztZiGFAxgAqw4J9EN9fA

`price`

​string

Latest token price.

Example: 50000

`origQty`

​string

Original order quantity

Example: 1

`executedQty`

​string

Executed quantity

Example: 0

`cumQty`

​string

Cumulative filled quantity.

Example: 0

`timeInForce`

​string

Time in force

Example: GTC

`type`

​string

Order type.

Example: LIMIT

`reduceOnly`

​boolean

Whether the order is reduce-only.

Example: false

`closePosition`

​boolean

if Close-All

Example: false

`side`

​string

Trading side

Example: BUY

`positionSide`

​string

Position side

Example: BOTH

`stopPrice`

​string

please ignore when order type is TRAILING\_STOP\_MARKET

Example: 0

`workingType`

​string

Stop trigger price type.

Example: CONTRACT\_PRICE

`priceProtect`

​boolean

if conditional order trigger is protected

Example: false

`origType`

​string

Original order type.

Example: LIMIT

`updateTime`

​integer · int64

update time

Example: 1728413795125

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 6

WSSorder.place

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "order.place",
 "params": {
 "symbol": "BTCUSD_PERP",
 "side": "BUY",
 "type": "LIMIT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "order.place",
 "params": {
 "symbol": "BTCUSD_PERP",
 "side": "BUY",
 "type": "LIMIT",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "60fa4366-f96e-42fe-a82b-f819952c6db4",
 "status": 200,
 "result": {
 "orderId": 333245211,
 "symbol": "BTCUSD_PERP",
 "pair": "BTCUSD",
 "status": "NEW",
 "clientOrderId": "5SztZiGFAxgAqw4J9EN9fA",
 "price": "50000",
 "origQty": "1",
 "executedQty": "0",
 "cumQty": "0",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "reduceOnly": false,
 "closePosition": false,
 "side": "BUY",
 "positionSide": "BOTH",
 "stopPrice": "0",
 "workingType": "CONTRACT_PRICE",
 "priceProtect": false,
 "origType": "LIMIT",
 "updateTime": 1728413795125
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 6
 }
 ]
}`

json

application/json

---

## Position Information (USER\_DATA)

Get current position information.

WSS

account.position

wss://ws-dapi.binance.com/ws-dapi/v1

### Position Information (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Position Information (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight5

### Position Information (USER\_DATA) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

`method`

​string · enum · required

WebSocket API method name.

Enum values:

account.position

Example: account.position

`params`

​object · required

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The
value must reflect the current client time and is validated
by the server for signed endpoints.

Example: 1770736694138

`apiKey`

​string · required

An API Key is required to access this endpoint and must be included in the request headers. To create an API Key, refer to: <https://www.binance.com/en/support/faq/detail/360002502072>.

Example: API\_KEY

`marginAsset`

​string

Example: USDT

`pair`

​string

Example: BTCUSD

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Please use with user data stream `ACCOUNT_UPDATE` to meet your timeliness and accuracy needs.

### Position Information (USER\_DATA) › Responses

Successful Response

Position Information

`id`

​string

positionId

Example: 233b8741-a96d-48e8-8ce1-160f43548aeb

`status`

​integer · int64

Example: 200

`result`

​object[]

Indicates that combined is set to true.

`symbol`

​string

Trading symbol

Example: BTCUSD\_PERP

`positionAmt`

​string

position amount

Example: 0

`entryPrice`

​string

Position entry price.

Example: 0.00000000

`markPrice`

​string

mark price

Example: 62297.60417296

`unRealizedProfit`

​string

Unrealized profit.

Example: 0.00000000

`liquidationPrice`

​string

Liquidation price.

Example: 0

`leverage`

​string

Leverage value.

Example: 7

`maxQty`

​string

maximum quantity of base asset

Example: 100

`marginType`

​string

Margin type.

Example: cross

`isolatedMargin`

​string

Isolated margin amount.

Example: 0.00000000

`isAutoAddMargin`

​string

Whether auto-add margin is enabled.

Example: false

`positionSide`

​string

Position side

Example: BOTH

`notionalValue`

​string

Notional value.

Example: 0

`isolatedWallet`

​string

Isolated wallet balance.

Example: 0

`updateTime`

​integer · int64

update time

Example: 1726731195634

`breakEvenPrice`

​string

break-even price

Example: 0.00000000

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 10

WSSaccount.position

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.position",
 "params": {
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "account.position",
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
 "id": "233b8741-a96d-48e8-8ce1-160f43548aeb",
 "status": 200,
 "result": [
 {
 "symbol": "BTCUSD_PERP",
 "positionAmt": "0",
 "entryPrice": "0.00000000",
 "markPrice": "62297.60417296",
 "unRealizedProfit": "0.00000000",
 "liquidationPrice": "0",
 "leverage": "7",
 "maxQty": "100",
 "marginType": "cross",
 "isolatedMargin": "0.00000000",
 "isAutoAddMargin": "false",
 "positionSide": "BOTH",
 "notionalValue": "0",
 "isolatedWallet": "0",
 "updateTime": 1726731195634,
 "breakEvenPrice": "0.00000000"
 }
 ],
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 10
 }
 ]
}`

json

application/json

---

## Query Order (USER\_DATA)

Check an order's status.

* These orders will not be found:
  + order status is `CANCELED` or `EXPIRED` **AND** order has NO filled trade **AND** created time + 3 days < current time
  + order create time + 90 days < current time

WSS

order.status

wss://ws-dapi.binance.com/ws-dapi/v1

### Query Order (USER\_DATA) › Authorization

This is a signed endpoint and a **signature** must be included in the request parameters.Learn more about how to generate a valid **signature** in the [Endpoint Security Type](/en/docs/products/derivatives-trading-coin-futures/general-info#endpoint-security-type)

### Query Order (USER\_DATA) › Request Weight

This endpoint consumes IP-based request weight. Heavier endpoints consume more of your IP rate limit capacity.

Learn more in the [Rate limits](/en/docs/products/derivatives-trading-coin-futures/general-info#limits) section.

IP Weight1

### Query Order (USER\_DATA) › Request Parameters

`id`

​string · required

Example: e9d6b4349871b40611412680b3445fac

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

Example: BTCUSD\_PERP

`timestamp`

​integer · int64 · required

Unix timestamp in milliseconds used to sign the request. The
value must reflect the current client time and is validated
by the server for signed endpoints.

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

Example: 1

`recvWindow`

​integer · int64 · max: 60000

Example: 5000

* Either `orderId` or `origClientOrderId` must be sent.

### Query Order (USER\_DATA) › Responses

Successful Response

Order

`id`

​string

positionId

Example: 0ce5d070-a5e5-4ff2-b57f-1556741a4204

`status`

​integer · int64

Example: 200

`result`

​object

Indicates that combined is set to true.

Indicates that combined is set to true.

`orderId`

​integer · int64

Sub-order ID

Example: 328999071

`symbol`

​string

Trading symbol

Example: BTCUSD\_PERP

`pair`

​string

Pair

Example: BTCUSD

`status`

​string

Status.

Example: NEW

`clientOrderId`

​string

Client order ID.

Example: ArY8Ng1rln0s9x3fclmAHy

`price`

​string

Latest token price.

Example: 58000

`avgPrice`

​string

Average execution price

Example: 0.00

`origQty`

​string

Original order quantity

Example: 1

`executedQty`

​string

Executed quantity

Example: 0

`cumQty`

​string

Cumulative filled quantity.

Example: 0

`cumBase`

​string

Cumulative base asset amount.

Example: 0

`timeInForce`

​string

Time in force

Example: GTC

`type`

​string

Order type.

Example: LIMIT

`reduceOnly`

​boolean

Whether the order is reduce-only.

Example: false

`closePosition`

​boolean

if Close-All

Example: false

`side`

​string

Trading side

Example: BUY

`positionSide`

​string

Position side

Example: LONG

`stopPrice`

​string

please ignore when order type is TRAILING\_STOP\_MARKET

Example: 0

`workingType`

​string

Stop trigger price type.

Example: CONTRACT\_PRICE

`priceProtect`

​boolean

if conditional order trigger is protected

Example: false

`origType`

​string

Original order type.

Example: LIMIT

`selfTradePreventionMode`

​string

self trading preventation mode

Example: EXPIRE\_TAKER

`time`

​integer · int64

Time

Example: 1733740063619

`updateTime`

​integer · int64

update time

Example: 1733740063619

`priceMatch`

​string

price match mode

Example: NONE

`rateLimits`

​object[]

Rate limit definitions.

`rateLimitType`

​string

Rate limit type.

Example: REQUEST\_WEIGHT

`interval`

​string

Rate limit interval.

Example: MINUTE

`intervalNum`

​integer · int64

Rate limit interval multiplier.

Example: 1

`limit`

​integer · int64

Maximum allowed orders for this rule.

Example: 2400

`count`

​integer · int64

Total number of trades in the 24h window.

Example: 6

WSSorder.status

Loading…

`wscat -c wss://ws-dapi.binance.com/ws-dapi/v1 -x '{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "order.status",
 "params": {
 "symbol": "BTCUSD_PERP",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}'`

Example Request

`{
 "id": "e9d6b4349871b40611412680b3445fac",
 "method": "order.status",
 "params": {
 "symbol": "BTCUSD_PERP",
 "timestamp": 1770736694138,
 "apiKey": "API_KEY"
 }
}`

json

application/json

Example Responses

Successful Response

`{
 "id": "0ce5d070-a5e5-4ff2-b57f-1556741a4204",
 "status": 200,
 "result": {
 "orderId": 328999071,
 "symbol": "BTCUSD_PERP",
 "pair": "BTCUSD",
 "status": "NEW",
 "clientOrderId": "ArY8Ng1rln0s9x3fclmAHy",
 "price": "58000",
 "avgPrice": "0.00",
 "origQty": "1",
 "executedQty": "0",
 "cumQty": "0",
 "cumBase": "0",
 "timeInForce": "GTC",
 "type": "LIMIT",
 "reduceOnly": false,
 "closePosition": false,
 "side": "BUY",
 "positionSide": "LONG",
 "stopPrice": "0",
 "workingType": "CONTRACT_PRICE",
 "priceProtect": false,
 "origType": "LIMIT",
 "selfTradePreventionMode": "EXPIRE_TAKER",
 "time": 1733740063619,
 "updateTime": 1733740063619,
 "priceMatch": "NONE"
 },
 "rateLimits": [
 {
 "rateLimitType": "REQUEST_WEIGHT",
 "interval": "MINUTE",
 "intervalNum": 1,
 "limit": 2400,
 "count": 6
 }
 ]
}`

json

application/json

---

---

