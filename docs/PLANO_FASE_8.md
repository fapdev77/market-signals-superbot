# Plano da Fase 8 — `strict: true` e dívida de tipos

> Criado em 2026-10-01 (marco 7.6.4). Objetivo: habilitar `strict: true` no
> `tsconfig.json` de forma incremental, começando por `noImplicitAny` por diretório,
> sem quebrar a produção. A catraca de qualidade (`scripts/quality-baseline.ts`)
> acompanha o progresso.

## Estado de partida

- `tsc --noEmit` limpo hoje.
- `strict` desligado. Baseline de qualidade (catraca, só desce):
  `scripts/quality-baseline.json` → `explicitAny` e `emptyCatch`.
- Metas da Fase 7 (7.6.4): **≤ 200 `any`** e **≤ 8 `catch` vazios**.
- **Estado ao fim da Fase 7 (7.6.4):** baseline em `explicitAny: 167` e
  `emptyCatch: 8` — ambas as metas atingidas. A anotação redundante
  `catch (e: any)` foi removida em `src/` e `server/` (Onda 1 parcial): sem
  `useUnknownInCatchVariables`, o binding volta a ser `any` implícito, então a
  tipagem real do erro (Onda 1 completa) só rende após ligar `noImplicitAny`.

## Estratégia (por ondas, sempre com a suíte verde)

Cada onda é um PR pequeno e reversível. Após cada uma: `tsc --noEmit`, `vitest run`,
`npx tsx scripts/quality-baseline.ts --update` (só para baixo) e justificativa no PR.

1. **Onda 0 — `noImplicitAny` por diretório (folha → raiz).**
   Ligar `noImplicitAny` apenas para diretórios sem dependentes de tipo largos,
   começando por `server/utils`, depois `server/services`, `server/routes`,
   `server`, `src/components`. Motivo: encontra os `any` implícitos (parâmetros sem
   tipo) que o baseline não mede antes de tocar nos explícitos.
2. **Onda 1 — `catch (e: any)` → tratamento tipado.**
   Substituir por `unknown` + narrowing (`e instanceof Error ? e.message : String(e)`).
   ALTO rendimento: concentra centenas de casos e não altera runtime.
3. **Onda 2 — `Record<string, any>` → `Record<string, unknown>`** nos pontos internos
   (o baseline já trata muitos `.metadata`); onde o valor é realmente dinâmico,
   manter `unknown` e narrow na leitura.
4. **Onda 3 — reduzir `any` de fronteira** (`express.Request`, payloads de API) com
   tipos dedicados por rota; validar com `zod` (já em uso) na borda.
5. **Onda 4 — `strictNullChecks` por diretório** (o mais caro), depois
   `strictFunctionTypes` e `useUnknownInCatchVariables`; por último `strict: true`.

## Portões (gates)

- **Por onda:** `tsc --noEmit` limpo, suíte verde, baseline não subiu.
- **Global (fim da Fase 8):** `strict: true` sem supressões novas (`@ts-ignore`/`as any`),
  baseline `any`/`catch` dentro da meta, e um teste de fumaça end-to-end verde.

## Fora de escopo

- Reescrever arquitetura para satisfazer tipos. Tipos servem ao código, não o contrário:
  quando o custo de tipar excede o ganho, isolar a fronteira e seguir.

## Rastreamento

| Onda | Diretório(s) | Meta |
|---|---|---|
| 0 | `server/utils` | `noImplicitAny` ligado |
| 0 | `server/services` | `noImplicitAny` ligado |
| 0 | `server/routes`, `server` | `noImplicitAny` ligado |
| 0 | `src/components` | `noImplicitAny` ligado |
| 1 | global | zero `catch (e: any)` explícito ✅ (anotação removida na Fase 7; narrowing real após `noImplicitAny`) |
| 2 | global | `any` ≤ meta 7.6.4 ✅ (`explicitAny: 167`) |
| 4 | por diretório | `strictNullChecks` → `strict: true` |
