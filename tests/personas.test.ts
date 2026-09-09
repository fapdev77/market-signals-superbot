import { describe, it, expect } from 'vitest';
import { DEFAULT_AI_PERSONAS, getAIPersonaById } from '../src/constants/aiPersonas';

describe('AI Trading Personas Suite', () => {
  it('loads all standard trading personas', () => {
    expect(DEFAULT_AI_PERSONAS.length).toBe(4);
    const ids = DEFAULT_AI_PERSONAS.map(p => p.id);
    expect(ids).toContain('conservative');
    expect(ids).toContain('aggressive');
    expect(ids).toContain('scalper');
    expect(ids).toContain('swing');
  });

  it('correctly retrieves persona by ID or falls back to conservative', () => {
    const scalper = getAIPersonaById('scalper');
    expect(scalper.name).toContain('Scalper');
    expect(scalper.riskTolerance).toBe('MEDIUM');

    const aggressive = getAIPersonaById('aggressive');
    expect(aggressive.riskTolerance).toBe('HIGH');
    expect(aggressive.minRRRatio).toBe(3.0);

    const fallback = getAIPersonaById('non-existent');
    expect(fallback.id).toBe('conservative');
  });
});
