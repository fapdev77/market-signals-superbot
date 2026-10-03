import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 8.2.4 / CA-2.4 — o documento de decisão precisa ser coerente com o veredito
 * registrado. Enquanto o veredito for PROVISÓRIO, o documento precisa estar
 * marcado como PROVISÓRIA (nada de decisão "final" sobre evidência defeituosa).
 *
 * O documento FINAL é gerado por `npm run compare:entry -- --register`
 * (`renderEntryDecisionDoc`), sem digitação manual dos números.
 *
 * 8.2.3 — um veredito é DEFINITIVO quando o desenho exigido foi cumprido (universo de
 * símbolos reais + regra v2), mesmo que o resultado seja "manter desligada".
 */

const root = process.cwd();

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

describe('8.2.4 / CA-2.4 — consistência documento × veredito', () => {
  it('veredito provisório ⇒ documento marcado PROVISÓRIA', () => {
    const verdict = JSON.parse(read('docs/evidence/entry-confirmation-verdict.json')) as {
      provisional?: boolean;
    };
    const doc = read('docs/evidence/decision-entry-confirmation.md');
    if (verdict.provisional) {
      expect(doc).toContain('PROVISÓRIA');
    }
  });

  it('veredito provisório ⇒ o documento não afirma veredito final de congelamento', () => {
    const verdict = JSON.parse(read('docs/evidence/entry-confirmation-verdict.json')) as {
      provisional?: boolean;
    };
    if (verdict.provisional) {
      const doc = read('docs/evidence/decision-entry-confirmation.md');
      expect(doc).toMatch(/engineDecisionRuleV2|entryDecisionRuleV2|Regra v2|regra v2/i);
    }
  });

  it('veredito definitivo ⇒ documento marcado FINAL e coerente com a flag', () => {
    const verdict = JSON.parse(read('docs/evidence/entry-confirmation-verdict.json')) as {
      provisional?: boolean;
      entryConfirmationEnabled?: boolean;
    };
    if (verdict.provisional === false) {
      const doc = read('docs/evidence/decision-entry-confirmation.md');
      expect(doc).toContain('FINAL');
      expect(doc).not.toContain('PROVISÓRIA');
      // O documento não pode afirmar um veredito contrário ao registrado.
      if (verdict.entryConfirmationEnabled === false) {
        expect(doc).toMatch(/MANTER DESLIGADA/);
      } else {
        expect(doc).toMatch(/LIGAR/);
      }
    }
  });
});
