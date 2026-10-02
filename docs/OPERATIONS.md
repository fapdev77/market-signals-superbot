# Runbook Operacional do Superbot (Fase 5 / M4)

Este documento descreve os procedimentos operacionais para implantação, supervisão, contingência e manutenção do Superbot em ambiente de produção local/servidor.

---

## 1. Inicialização e Supervisão

### 1.1 Política de Rede (M4.1)
- Por padrão, o Superbot escuta exclusivamente em `127.0.0.1:3000`.
- Em produção (`NODE_ENV=production`), a tentativa de vincular a `0.0.0.0` falha imediatamente a menos que `ALLOW_PUBLIC_BIND=true` seja fornecida explicitamente (recomendado apenas dentro de contêineres Docker isolados com porta mapeada para localhost no host).
- Para acesso remoto, utilize sempre uma VPN (Tailscale, WireGuard) ou proxy reverso seguro (Nginx/Caddy com terminação TLS e autenticação).

### 1.2 Docker Compose (M4.9)
Para subir o serviço gerenciado com reinicialização automática e volume persistente:
```bash
docker compose up -d
docker compose logs -f
```

Verificação de saúde do contêiner:
```bash
docker compose ps
curl -i http://127.0.0.1:3000/api/health
```

**Como o bind funciona no contêiner (6.8.4):** dentro do contêiner o processo escuta em
`HOST=0.0.0.0` (obrigatório — `127.0.0.1` dentro do contêiner só aceitaria tráfego interno), com
`ALLOW_PUBLIC_BIND=true` para atravessar o guard de produção. A exposição ao host é controlada pelo
mapeamento de portas do `docker-compose.yml`, publicado **somente em `127.0.0.1:3000:3000`** —
nunca `3000:3000` puro, que publicaria o serviço em todas as interfaces do host. O acesso remoto
continua sendo por VPN/proxy reverso com TLS (seção 1.1).

### 1.3 Systemd Unit
Exemplo de configuração para implantação nativa em Linux (`/etc/systemd/system/superbot.service`):
```ini
[Unit]
Description=Superbot Binance Futures Signal Engine
After=network.target

[Service]
Type=simple
User=superbot
WorkingDirectory=/opt/superbot
ExecStart=/usr/bin/npm start
Restart=unless-stopped
RestartSec=10
KillSignal=SIGTERM
TimeoutStopSec=15
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Comandos de gerenciamento:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now superbot
sudo systemctl status superbot
sudo journalctl -u superbot -f
```

### 1.4 Desligamento Gracioso (Graceful Shutdown)
Ao receber `SIGTERM` ou `SIGINT`, o processo grava qualquer escrita pendente coalescida no disco de forma atômica e finaliza com código 0.

---

## 2. Autenticação e Gestão de Tokens (M4.8)

- **Em produção**, se `API_AUTH_TOKEN` não for fornecido no ambiente, o sistema gera dinamicamente um token criptográfico de alta entropia e o salva no arquivo:
  `data/session-token` (com permissões POSIX restritas `0600`).
- O token **nunca** é exposto em logs em produção (apenas o caminho do arquivo é informado).
- **Rotação de Token:**
  Para rotacionar o token em produção, defina a variável `API_AUTH_TOKEN` no `.env` ou delete `data/session-token` e reinicie o processo para gerar um novo token.
  Procedimento com zero downtime parcial: (1) gere o novo token; (2) atualize o `.env`/segredo do orquestrador; (3) reinicie o serviço (`docker compose up -d` recria o contêiner; `systemctl restart superbot`); (4) invalide o token antigo distribuindo o novo aos clientes da API e da UI (a UI pede o token novamente ao receber 401 no stream `/api/stream/tickers`). Tokens anteriores deixam de valer imediatamente no restart — coordene a troca com os consumidores.

---

## 3. Integridade do Banco e Procedimento de Backup / Restauração (M4.3)

### 3.1 Integridade no Boot
- Ao iniciar, o sistema executa `PRAGMA quick_check;` no arquivo `data/superbot.sqlite`.
- Se o arquivo estiver corrompido, o sistema busca automaticamente o backup válido mais recente em `data/backups/` e o restaura.
- Se nenhum backup válido estiver disponível, o processo recusa iniciar e emite erro crítico no log para evitar perda de dados.

### 3.2 Rotina de Backup e Retenção
- Backups automáticos ocorrem a cada 6 horas salvando cópias atômicas em `data/backups/superbot-backup-<data>.db`.
- **Política de retenção:**
  - Mantém incondicionalmente os últimos 8 backups (últimas 48 horas).
  - Mantém 1 backup diário por 14 dias para históricos anteriores ao 8º.
  - Backups mais antigos que 14 dias são podados automaticamente.

### 3.3 Replicação Externa (Recomendada)
Para proteger contra falhas de hardware, configure sincronização periódica de `data/backups/` para armazenamento externo via `rclone` ou `rsync`:
```bash
# Exemplo com rsync para servidor remoto
rsync -avz --delete /opt/superbot/data/backups/ backup-server:/storage/superbot-backups/
```

### 3.4 Restauração Manual
Caso seja necessário restaurar um backup manualmente:
```bash
# 1. Pare o serviço
sudo systemctl stop superbot # ou docker compose down

# 2. Substitua o banco pelo backup desejado
cp data/backups/superbot-backup-2026-09-30T12-00-00-000Z.db data/superbot.sqlite

# 3. Inicie o serviço
sudo systemctl start superbot # ou docker compose up -d
```

---

## 4. Kill-Switch Operacional e Limites de Risco (M4.2)

### 4.1 Uso do Kill-Switch
O kill-switch suspende a emissão de novos sinais enquanto continua monitorando o mercado e gerenciando posições ativas.
- **Ativação:**
  ```bash
  curl -X POST http://127.0.0.1:3000/api/system/kill-switch \
    -H "Authorization: Bearer <TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"enabled": true, "reason": "Manutenção programada da infraestrutura"}'
  ```
- **Desativação:**
  ```bash
  curl -X POST http://127.0.0.1:3000/api/system/kill-switch \
    -H "Authorization: Bearer <TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}'
  ```
- O estado do kill-switch é persistido na tabela `app_state`. Se o sistema reiniciar, ele permanece suspenso até desativação deliberada.
- **Fail-closed:** Se a tabela `app_state` estiver corrompida ou ilegível, o sistema inicia suspenso por segurança.

### 4.2 Ajuste dos Limites de Risco
Endpoint auditado para alterar limites em tempo de execução:
```bash
curl -X POST http://127.0.0.1:3000/api/system/risk-limits \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "accountEquity": 25000,
    "riskPerTradePct": 1.0,
    "maxConcurrentSignals": 6,
    "maxPortfolioRiskPct": 5.0,
    "maxSignalsPerCategory": 2
  }'
```

---

## 5. Resposta a Incidentes

### 5.1 Erros de Rate Limit (HTTP 429) e IP Ban (HTTP 418)
- O `RateLimiter` interno monitora os cabeçalhos `x-mbx-used-weight-1m`.
- Se 429 ou 418 for retornado pela Binance:
  - O cooldown automático é ativado (pausando requisições REST durante a penalidade).
  - Um alerta crítico é emitido via `AlertService` para Webhook/Telegram.
  - Ações recomendadas: verificar se scripts externos ou múltiplos clientes estão utilizando o mesmo IP de saída.

### 5.2 Erros Geográficos ou de Restrição (HTTP 403 / 451)
- Binance Futures possui restrições territoriais.
- Se ocorrer 403/451, o endpoint marca falha no feed correspondente e aciona fallback para modo preservado. Verifique a rota de rede/VPN do host.

### 5.3 Deriva de Relógio (M4.6)
- Se a diferença entre o relógio local e o servidor da Binance (`/fapi/v1/time`) ultrapassar 2 segundos:
  - O status do sistema é marcado como `DEGRADADO` e novos sinais são bloqueados no DataGate.
  - Alerta é enviado via Telegram/Webhook.
  - Correção no host Linux:
    ```bash
    sudo timedatectl set-ntp true
    sudo systemctl restart systemd-timesyncd # ou chronyd
    ```

## 6. Ledger & Confirmação de Entrada (Fase 7)

### 6.1 Robustez do ledger (7.3)
- **Gravação de `EXPIRED`:** usa a mesma rotina de **3 tentativas + backoff** dos demais eventos.
  Em falha persistente, incrementa `ledger_write_failures` e emite o alerta
  `operational.ledger_write_failed` (deduplicado por janela). O sweep é **fail-open**: o sinal já
  fica `EXPIRED` em `trade_signals`.
- **Reconciliação períodica (7.3.2):** `reconcileLedgerWithSignals()` roda no boot, **após cada sweep**
  e a cada `LEDGER_RECONCILE_INTERVAL_MS` (default 15 min). Se criar qualquer evento retroativo,
  emite `operational.ledger_reconciled` (MEDIUM, uma vez por janela) — indica falha que passou despercebida.
- **Invariantes (7.3.3):** `GET /api/system/metrics` expõe `ledgerInvariantViolations`
  (`{ terminalSignalsMissingEvent, orphanEvents, total }`). Valor > 0 após a reconciliação gera
  alerta `ledger_write_failed` (HIGH).

### 6.2 Confirmação de entrada (`ENTRY_CONFIRMATION_ENABLED`, 7.2)
- Default `true` desde a decisão 7.2 (2026-10-02). Quando `true`, sinais nascem `PENDING_ENTRY` e só ativam com toque da zona **e**
  confirmação R1–R5; sem preenchimento em N velas 1m, o pendente vira `ENTRY_NOT_FILLED` (não-evento para o R).
- A decisão está registrada em `docs/evidence/decision-entry-confirmation.md`; a evidência pareada
  (controle × confirmação) em `docs/evidence/entry-confirmation-comparison-<data>.md`, gerada com
  `npm run compare:entry`.

### 5.4 Gatilhos de Reabertura de Decisão do Banco (M4.5)
- Arquivo SQLite > 250 MB.
- p95 da duração de gravação > 500 ms.
- Necessidade de múltiplas instâncias concorrentes.
Ao disparar qualquer um desses alertas, abra a issue de migração para banco dedicado (ex: PostgreSQL/Cloud SQL) conforme planejado.
