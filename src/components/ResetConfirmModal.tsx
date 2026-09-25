import React, { useState } from 'react';
import { AlertTriangle, Trash2, Download, X, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { useToast } from './Toast';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessReset: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onSuccessReset
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === 'RESETAR';

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      // 1. Fetch server database export
      const res = await fetch('/api/system/database-export');
      let serverData = {};
      if (res.ok) {
        serverData = await res.json();
      }

      // 2. Collect all localStorage keys related to SuperBot
      const localData: Record<string, any> = {};
      const targetKeys = [
        'paper_trading_account_state',
        'paper_trading_orders',
        'paper_trading_positions',
        'paper_trading_history',
        'paper_trading_settings',
        'user_price_alerts',
        'dashboard_layout_preferences',
        'prime_confluence_threshold',
        'alert_sound_settings',
        'ai_review_cache'
      ];

      targetKeys.forEach(k => {
        try {
          const val = localStorage.getItem(k);
          if (val) localData[k] = JSON.parse(val);
        } catch {
          localData[k] = localStorage.getItem(k);
        }
      });

      const fullBackup = {
        metadata: {
          app: 'Market Signals SuperBot',
          backupType: 'PRE_FACTORY_RESET',
          createdAt: new Date().toISOString(),
          timestamp: Date.now()
        },
        serverDatabase: serverData,
        browserStorage: localData
      };

      const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `superbot-backup-pre-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setHasDownloadedBackup(true);
      showToast('success', 'Backup Exportado com Sucesso', 'Arquivo de segurança salvo no seu computador.');
    } catch (err: any) {
      console.error('Backup download error:', err);
      showToast('error', 'Falha ao Exportar Backup', 'Não foi possível compilar o arquivo de backup.');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleExecuteFactoryReset = async () => {
    if (!isConfirmed || isResetting) return;
    setIsResetting(true);

    try {
      // 1. Call server factory reset endpoint
      const res = await fetch('/api/system/factory-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error || 'Erro ao redefinir banco no servidor.');
      }

      // 2. Clean up browser localStorage
      const keysToClear = [
        'paper_trading_account_state',
        'paper_trading_orders',
        'paper_trading_positions',
        'paper_trading_history',
        'paper_trading_settings',
        'user_price_alerts',
        'dashboard_layout_preferences',
        'prime_confluence_threshold',
        'alert_sound_settings',
        'ai_review_cache',
        'screener_selected_tab',
        'active_trading_tab'
      ];

      keysToClear.forEach(k => {
        try {
          localStorage.removeItem(k);
        } catch {
          // ignore
        }
      });

      // Dispatch storage and paper trading updated events
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('paper_trading_updated'));

      showToast('success', 'Reset de Fábrica Concluído', 'Aplicação reiniciada com as configurações e dados padrão de fábrica.');

      // Close modal and invoke callback
      onClose();
      onSuccessReset();
    } catch (err: any) {
      console.error('Factory reset failed:', err);
      showToast('error', 'Erro no Reset de Fábrica', err?.message || 'Falha ao redefinir o sistema.');
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-[#090a0f] border border-rose-500/30 rounded-2xl shadow-2xl shadow-rose-950/40 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="factory-reset-title"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-rose-950/30 border-b border-rose-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 id="factory-reset-title" className="text-base font-bold text-white tracking-wide">
                Restaurar Padrão de Fábrica (Reset Global)
              </h2>
              <p className="text-xs text-rose-300/80">
                Ação destrutiva e irreversível para recuperar a aplicação
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isResetting}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm text-neutral-300 overflow-y-auto max-h-[75vh]">
          {/* Warning Banner */}
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed text-rose-200/90">
              <span className="font-bold text-rose-300 block text-sm">
                Atenção: Todos os dados personalizados serão apagados!
              </span>
              Esta operação zera o banco de dados do servidor e o armazenamento local do navegador, retornando o SuperBot ao estado limpo de fábrica recém-instalado.
            </div>
          </div>

          {/* Action Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> O Que Será Apagado:
              </span>
              <ul className="space-y-1 text-neutral-400 list-disc list-inside">
                <li>Histórico de sinais e auditorias antigas</li>
                <li>Snapshots periódicos e watchlist</li>
                <li>Simulação de Paper Trading (saldo e ordens)</li>
                <li>Alertas de preços personalizados</li>
                <li>Layouts de tela customizados</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> O Que Será Restaurado:
              </span>
              <ul className="space-y-1 text-neutral-400 list-disc list-inside">
                <li>Pesos quantitativos de confluência padrão</li>
                <li>Configuração original dos modelos LLM</li>
                <li>Sinais sementes de calibração (30 dias)</li>
                <li>Saldo virtual padrão de $10.000 (Paper)</li>
                <li>Corte de confluência no Golden Pocket (60%)</li>
              </ul>
            </div>
          </div>

          {/* Backup Action Card */}
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="font-semibold text-cyan-300 block">
                {hasDownloadedBackup ? '✓ Backup baixado com sucesso!' : 'Deseja salvar um backup antes?'}
              </span>
              <span className="text-neutral-400">
                Gera um arquivo JSON com todas as tabelas SQLite e configurações.
              </span>
            </div>
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isDownloadingBackup || isResetting}
              className={`px-3.5 py-2 rounded-lg font-medium flex items-center gap-2 transition shrink-0 ${
                hasDownloadedBackup 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30'
              }`}
            >
              {isDownloadingBackup ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {hasDownloadedBackup ? 'Baixar Novamente' : 'Baixar Backup (JSON)'}
            </button>
          </div>

          {/* Typing confirmation */}
          <div className="space-y-2 pt-1 border-t border-white/10">
            <label htmlFor="confirm-reset-input" className="block text-xs font-medium text-neutral-300">
              Para confirmar, digite <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">RESETAR</span> no campo abaixo:
            </label>
            <input
              id="confirm-reset-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite RESETAR"
              disabled={isResetting}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-sm tracking-wider focus:outline-none focus:border-rose-500 transition placeholder:text-neutral-600"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="px-4 py-2 rounded-xl text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-white/10 transition text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecuteFactoryReset}
            disabled={!isConfirmed || isResetting}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              isConfirmed && !isResetting
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50 cursor-pointer'
                : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
            }`}
          >
            {isResetting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Restaurando Padrão de Fábrica...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Reset Global</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
