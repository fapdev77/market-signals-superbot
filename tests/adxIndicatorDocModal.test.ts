import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ADXIndicatorDocModal } from '../src/components/ADXIndicatorDocModal';

describe('ADXIndicatorDocModal', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToString(React.createElement(ADXIndicatorDocModal, {
      isOpen: false,
      onClose: () => {}
    }));
    expect(html).toBe('');
  });

  it('renders full documentation modal when isOpen is true', () => {
    const html = renderToString(React.createElement(ADXIndicatorDocModal, {
      isOpen: true,
      onClose: () => {}
    }));

    // Verify presence of title and key conceptual sections
    expect(html).toContain('Estimated ADX (10–65)');
    expect(html).toContain('DOCUMENTAÇÃO TÉCNICA');
    expect(html).toContain('O que é o Estimated ADX');
    expect(html).toContain('Escala de Níveis e Regimes Operacionais');
    expect(html).toContain('Lateral / Consolidação');
    expect(html).toContain('Tendência Forte (Ideal)');
    expect(html).toContain('Clímax / Exaustão Parabólica');
    expect(html).toContain('Exemplos Práticos: Mercado Lateral vs. Forte Momentum');
    expect(html).toContain('Cenário 1: ADX Baixo (~14.5)');
    expect(html).toContain('Cenário 2: ADX Alto (~36.2)');
    expect(html).toContain('Cenário 3: ADX Extremo');
    expect(html).toContain('Como Combinar o ADX com os Sinais do SuperBot');
    expect(html).toContain('Golden Pocket');
  });
});
