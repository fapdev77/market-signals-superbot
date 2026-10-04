/**
 * SDD Fase 9 / S2 — hook de calibração de score para a UI.
 *
 * Busca a expectativa calibrada por tier UMA vez por sessão (cache de módulo) e devolve
 * uma função de lookup. Sem ele, cada surface que mostra score precisaria repetir o
 * fetch — e o resultado previsível de repetir o fetch é uma tela que exibe um número sem
 * base rate justamente quando a chamada falha.
 *
 * Falha de rede NÃO vira zero: devolve `null` e a UI passa a exibir "sem base rate",
 * que é a informação correta.
 */
import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import type { ScoreCalibrationLike } from '../utils/scoreDisplay';
import { tierKeyForScore } from '../utils/scoreTier';

type Cache = {
  tiers: Record<string, ScoreCalibrationLike>;
  minSample: number;
} | null;

let cache: Cache = null;
let inFlight: Promise<Cache> | null = null;

async function load(): Promise<Cache> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = apiClient
      .getScoreCalibration()
      .then(res => {
        cache = {
          tiers: (res && res.tiers) || {},
          minSample: (res && res.minSampleForCalibration) || 30
        };
        return cache;
      })
      .catch(() => {
        // Deixa `cache` nulo de propósito: a próxima chamada tenta de novo, e a UI já
        // recebeu a resposta honesta ("sem base rate").
        return null;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Limpa o cache — usado por testes e por uma ação manual de recarregar. */
export function resetScoreCalibrationCache(): void {
  cache = null;
}

/**
 * Devolve a calibração do tier de um score, ou `null` enquanto não há resposta.
 *
 * `null` é um estado de primeira classe: significa "a tela não tem base rate ainda" e
 * precisa ser tratado como tal, não convertido em 0.
 */
export function useScoreCalibration(): (
  score: number
) => ScoreCalibrationLike | null {
  const [tiers, setTiers] = useState<Record<string, ScoreCalibrationLike>>({});

  useEffect(() => {
    let alive = true;
    load().then(res => {
      if (alive && res) setTiers(res.tiers);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (score: number) => {
    if (!Number.isFinite(score)) return null;
    // Mesma funcao que o servidor usou para agrupar o ledger — nao uma reimplementacao.
    return tiers[tierKeyForScore(score)] || null;
  };
}