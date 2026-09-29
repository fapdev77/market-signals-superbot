import path from 'path';
import { setDatabaseFilePathForTests } from '../server/db.js';

/**
 * Isolamento de testes (R-3/R-14).
 *
 * Antes daqui, todos os testes (exceto backtestDao) liam e escreviam o MESMO
 * `data/superbot.sqlite` usado pelo app. Como o sql.js mantém o banco inteiro
 * em memória e reescreve o arquivo a cada save, qualquer outro escritor — um
 * `npm run dev` aberto, outro worker — sobrescrevia silenciosamente o que o
 * worker acabara de migrar. O resultado eram execuções irreprodutíveis (o mesmo
 * teste passando/falhando sem mudança de código).
 *
 * Cada worker recebe agora o seu próprio arquivo, sob `data/` (já ignorado pelo
 * git), zerando o compartilhamento de estado entre testes.
 */
setDatabaseFilePathForTests(
  path.join(process.cwd(), 'data', 'test-dbs', `superbot.test.${process.pid}.sqlite`)
);

/**
 * Suítes de backtest/ingestão não devem depender da API da Binance. Com a flag
 * ligada, o engine cai no `seedSyntheticKlines` determinístico (derivado de
 * símbolo + startTime) em vez de fazer rede ou lançar erro.
 * `phase11Hotfix` remove a flag explicitamente no teste que valida o bloqueio.
 */
if (process.env.ALLOW_SYNTHETIC_DATA === undefined) {
  process.env.ALLOW_SYNTHETIC_DATA = 'true';
}
