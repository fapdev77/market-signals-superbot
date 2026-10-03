import React, { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../utils/errors';
import { ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useToast } from './Toast';

/**
 * R-17 — Kill-switch e postura de risco visíveis na UI.
 *
 * Mostra o estado do halt (ativo, motivo, quem ativou, quando) e a postura agregada da
 * carteira (sinais abertos, risco %, limites), com botões de ativar/desativar que pedem
 * motivo com confirmação — consumindo os endpoints existentes
 * (`GET /api/system/risk-status` e `POST /api/system/kill-switch`, que já grava audit-log).
 *
 * Critérios:
 *  (1) ativar pela UI interrompe emissões no próximo tick (o motor consulta isTradingHalted());
 *  (2) o polling de 15s propaga o estado para outros clientes;
 *  (3) a ação aparece em /api/system/audit-logs (gravada pelo endpoint POST).
 */

interface RiskStatusPayload {
  killSwitch: {
    enabled: boolean;
    reason: string | null;
    activatedAt: number | null;
    activatedBy: string | null;
  };
  limits: {
    maxConcurrentSignals: number;
    maxSignalsPerCategory: number;
    maxPortfolioRiskPct: number;
    riskPerTradePct: number;
    accountEquity: number;
    [key: string]: unknown;
  };
  portfolio: {
    allowed: boolean;
    reasons: string[];
    concurrentCount: number;
    categoryCounts: Record<string, number>;
    openRiskPct: number;
  };
}

const fmtWhen = (ts: number | null): string =>
  ts ? new Date(ts).toLocaleString() : '—';

export const KillSwitchPanel: React.FC = () => {
  const { showToast } = useToast();
  const [status, setStatus] = useState<RiskStatusPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  const load = useCallback(() => {
    apiClient.getRiskStatus()
      .then(setStatus)
      .catch(() => { /* mantém o último snapshot; o painel mostra "—" até a 1ª resposta */ });
  }, []);

  useEffect(() => {
    load();
    // R-17 (critério 2): outros clientes enxergam a mudança em seguida.
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const doToggle = async (enabled: boolean, motive?: string) => {
    setBusy(true);
    try {
      await apiClient.setKillSwitch(enabled, motive);
      setActivating(false);
      setConfirmingDisable(false);
      setReason('');
      showToast(
        enabled ? 'info' : 'success',
        enabled ? 'Trading suspenso' : 'Trading reativado',
        enabled ? 'Kill-switch ativo — emissões suprimidas no próximo tick.' : 'Emissão de sinais liberada.'
      );
      load();
    } catch (err) {
      showToast('error', 'Falha no kill-switch', getErrorMessage(err) || 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const halted = status?.killSwitch.enabled ?? false;
  const portfolio = status?.portfolio;

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 font-mono text-xs space-y-3 shadow-2xl ${halted ? 'bg-rose-950/20 border-rose-500/40' : 'bg-[#0A0B0E] border-emerald-500/30'}`}>
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border ${halted ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
            {halted ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wide">Postura de Risco & Kill-Switch</h3>
            <p className="text-[11px] text-neutral-400">
              {halted
                ? 'Geração de sinais SUPRIMIDA globalmente.'
                : 'Emissão de sinais conforme limites de risco.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-300 transition"
          title="Atualizar agora"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Halt banner */}
      {halted && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2.5 space-y-0.5">
          <div className="font-black text-rose-300 uppercase text-[11px]">⛔ Trading suspenso</div>
          <div className="text-neutral-200">Motivo: {status?.killSwitch.reason}</div>
          <div className="text-[10px] text-neutral-400">
            Por {status?.killSwitch.activatedBy || '—'} em {fmtWhen(status?.killSwitch.activatedAt ?? null)}
          </div>
        </div>
      )}

      {/* Portfolio posture */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
          <span className="text-[10px] text-neutral-400 uppercase block">Sinais Abertos</span>
          <span className="text-base font-black text-white tabular-nums">
            {portfolio ? `${portfolio.concurrentCount}/${status?.limits.maxConcurrentSignals ?? '—'}` : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
          <span className="text-[10px] text-neutral-400 uppercase block">Risco Agregado</span>
          <span className={`text-base font-black tabular-nums ${
            portfolio && status && portfolio.openRiskPct >= status.limits.maxPortfolioRiskPct ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {portfolio ? `${portfolio.openRiskPct}%` : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
          <span className="text-[10px] text-neutral-400 uppercase block">Emissão</span>
          <span className={`text-base font-black uppercase ${portfolio?.allowed ? 'text-emerald-400' : 'text-amber-400'}`}>
            {portfolio ? (portfolio.allowed ? 'Liberada' : 'Limitada') : '—'}
          </span>
        </div>
      </div>

      {portfolio && portfolio.reasons.length > 0 && (
        <ul className="text-[10px] text-amber-300/90 list-disc list-inside space-y-0.5">
          {portfolio.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}

      {/* Actions */}
      <div className="pt-1 space-y-2">
        {!halted && !activating && (
          <button
            type="button"
            onClick={() => setActivating(true)}
            disabled={busy}
            className="w-full px-3 py-2 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white font-black text-[11px] uppercase transition disabled:opacity-50 cursor-pointer"
          >
            Suspender Trading (Kill-Switch)
          </button>
        )}

        {!halted && activating && (
          <div className="space-y-2 rounded-xl bg-black/40 border border-rose-500/30 p-3">
            <label className="block text-[10px] font-bold text-neutral-300 uppercase">
              Motivo da suspensão (mín. 3 caracteres) — fica no audit-log
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex.: evento de mercado anômalo / manutenção"
              className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-neutral-100 text-xs focus:outline-none focus:border-rose-500/50"
              maxLength={200}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || reason.trim().length < 3}
                onClick={() => doToggle(true, reason.trim())}
                className="flex-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] uppercase transition disabled:opacity-40 cursor-pointer"
              >
                {busy ? 'Aplicando...' : 'Confirmar suspensão'}
              </button>
              <button
                type="button"
                onClick={() => { setActivating(false); setReason(''); }}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-300 font-bold text-[11px] transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {halted && !confirmingDisable && (
          <button
            type="button"
            onClick={() => setConfirmingDisable(true)}
            disabled={busy}
            className="w-full px-3 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white font-black text-[11px] uppercase transition disabled:opacity-50 cursor-pointer"
          >
            Reativar Trading
          </button>
        )}

        {halted && confirmingDisable && (
          <div className="space-y-2 rounded-xl bg-black/40 border border-emerald-500/30 p-3">
            <p className="text-[11px] text-neutral-300">
              Confirmar a reativação? A emissão de sinais volta no próximo tick.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => doToggle(false)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase transition disabled:opacity-40 cursor-pointer"
              >
                {busy ? 'Aplicando...' : 'Confirmar reativação'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDisable(false)}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-300 font-bold text-[11px] transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
