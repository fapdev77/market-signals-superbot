import React, { useState, useEffect } from 'react';
import { getErrorMessage } from '../utils/errors';
import { Lock, Key, ShieldCheck, AlertTriangle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { getStoredAuthToken, setStoredAuthToken, clearStoredAuthToken, apiFetch } from '../services/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTokenInput(getStoredAuthToken() || '');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Por favor, informe o token de acesso.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const trimmed = tokenInput.trim();
      const res = await apiFetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmed })
      });

      const data = await res.json();
      if (data.valid) {
        setStoredAuthToken(trimmed);
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose?.();
        }, 600);
      } else {
        setError('Token de autenticação inválido. Verifique o valor no terminal ou nas variáveis de ambiente.');
      }
    } catch (err) {
      setError(`Erro ao validar token: ${getErrorMessage(err) || 'Falha de conexão'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="w-full max-w-md bg-[#0C0D12] border border-orange-500/30 rounded-xl p-6 shadow-2xl shadow-orange-500/10 relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Acesso Seguro • Bearer Token</h2>
            <p className="text-[11px] text-neutral-400">Autenticação Fail-Closed (Fase 1.1 Hotfix)</p>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed mb-4 font-sans">
          Para proteger as operações quantitativas e o motor de inteligência artificial, informe o 
          <code className="text-orange-400 px-1 py-0.5 bg-white/5 rounded mx-1">API_AUTH_TOKEN</code>.
          Caso esteja rodando sem variável de ambiente configurada, o token gerado aleatoriamente para esta sessão foi impresso no terminal do servidor.
        </p>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs font-sans">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Autenticação confirmada com sucesso!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center justify-between">
              <span>Token de Acesso</span>
              {getStoredAuthToken() && (
                <button
                  type="button"
                  onClick={() => {
                    clearStoredAuthToken();
                    setTokenInput('');
                  }}
                  className="text-[10px] text-neutral-500 hover:text-rose-400 transition"
                >
                  Limpar Token Salvo
                </button>
              )}
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Cole o Bearer Token aqui..."
                className="w-full px-3.5 py-2.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isLoading || success}
              className="flex-1 py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-black font-bold text-xs uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Key className="w-4 h-4" />
              <span>{isLoading ? 'Verificando...' : 'Autenticar'}</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs uppercase tracking-wider rounded-lg transition"
              >
                Fechar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
