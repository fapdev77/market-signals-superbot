# Universo monitorado — reconciliação de fontes

> Gerado por `npm run audit:universe` em 2026-09-30T11:42:33.380Z. Não editar à mão.

## Contagem real por grupo

| Grupo | Fonte | Símbolos |
| --- | --- | ---: |
| Ticker 24h | REST `/fapi/v1/ticker/24hr` | 787 |
| exchangeInfo (total) | REST `/fapi/v1/exchangeInfo` | 919 |
| WS `!ticker@arr` (10s) | WebSocket `/market` | 492 |
| Universo candidato | exchangeInfo TRADING + PERPETUAL/TRADIFI_PERPETUAL + USDT | 739 |

### exchangeInfo por `status`

- `TRADING`: 787
- `SETTLING`: 131
- `PENDING_TRADING`: 1

### exchangeInfo por `contractType`

- `PERPETUAL`: 702
- `TRADIFI_PERPETUAL`: 213
- `CURRENT_QUARTER`: 2
- `NEXT_QUARTER`: 2

## Diferença REST × WS

- Diferença absoluta: 295 símbolos.
- No WS e ausentes no REST `ticker/24hr`: BTCUSD_PERP, LINKUSD_PERP, SUIUSD_PERP, ETHUSD_PERP, DOGEUSD_PERP, SOLUSD_PERP, BCHUSD_PERP, ETHUSD_261225, BNBUSD_PERP, XRPUSD_PERP, ADAUSD_PERP, UNIUSD_PERP
- No REST e ausentes no WS: CETUSUSDT, BREVUSDT, SMCIUSDT, MOONSHOTUSDT, MEGAUSDT, CXMTUSDT, GIGADEVUSDT, BRKBUSDT, USTCUSDT, RIVNUSDT, EGLDUSDT, DODOXUSDT, TXNUSDT, 1INCHUSDT, FRAXUSDT, GEVUSDT, CSCOUSDT, XPDUSDT, PAYPUSDT, NOKUSDT

### Nota sobre o "787 × 987" do smoke

O smoke anterior somava os tickers de CADA mensagem do WS (5 mensagens → 987 tickers), não símbolos únicos:
há repetição entre snapshots. Contando símbolos ÚNICOS em 10s, o WS entregou 492.
O REST `ticker/24hr` lista 787 símbolos — exatamente o número de símbolos `TRADING` do `exchangeInfo` (787).
Os símbolos vistos apenas no WS são majoritariamente `*_PERP` (coin-margined), que não pertencem ao `/fapi` (USDⓈ-margined).
Portanto não havia "200 símbolos faltando": era contagem cumulativa (com duplicatas) contra contagem única.

## Fonte que define o universo

O universo monitorado é definido pelo **`exchangeInfo`** com `status == TRADING`,
`contractType` em `PERPETUAL`/`TRADIFI_PERPETUAL` e moeda de cotação `USDT`
(decisão formalizada em 6.4.6). O WS `!ticker@arr` é apenas fonte de preço, não de universo.
