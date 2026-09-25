import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, HardDrive, RefreshCw, Sparkles, Trash2, Download, 
  ShieldCheck, AlertTriangle, Cpu, Layers, CheckCircle2, ChevronDown, 
  ChevronUp, Server, Info, ArrowUpRight, Wrench, ShieldAlert
} from 'lucide-react';
import { SystemDatabaseStats, SystemTableInfo, ClientStorageItem } from '../types';
import { useToast } from './Toast';
import { ResetConfirmModal } from './ResetConfirmModal';

interface SystemDatabaseSettingsProps {
  onFactoryResetComplete?: () => void;
}

export const SystemDatabaseSettings: React.FC<SystemDatabaseSettingsProps> = ({
  onFactoryResetComplete
}) => {
  const [dbStats, setDbStats] = useState<SystemDatabaseStats | null>(null);
  const [clientStorage, setClientStorage] = useState<ClientStorageItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVacuuming, setIsVacuuming] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [clearingTableName, setClearingTableName] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const { showToast } = useToast();

  // Scan client localStorage keys
  const scanClientStorage = useCallback(() => {
    const items: ClientStorageItem[] = [];
    const keyDefinitions: Record<string, { label: string; category: ClientStorageItem['category'] }> = {
      paper_trading_account_state: { label: 'Paper Trading: Saldo e Patrimônio', category: 'paper_trading' },
      paper_trading_orders: { label: 'Paper Trading: Ordens Pendentes', category: 'paper_trading' },
      paper_trading_positions: { label: 'Paper Trading: Posições Abertas', category: 'paper_trading' },
      paper_trading_history: { label: 'Paper Trading: Diário de Trades Fechados', category: 'paper_trading' },
      paper_trading_settings: { label: 'Paper Trading: Configurações de Taxas & Slippage', category: 'paper_trading' },
      user_price_alerts: { label: 'Alertas de Preço do Usuário', category: 'alerts' },
      dashboard_layout_preferences: { label: 'Dashboard: Layout & Grid Preferences', category: 'layout' },
      prime_confluence_threshold: { label: 'Filtro: Corte de Confluência Prime', category: 'preferences' },
      alert_sound_settings: { label: 'Áudio: Preferências de Sintetizador', category: 'preferences' },
      ai_review_cache: { label: 'IA: Cache de Auditorias Rápidas', category: 'cache' }
    };

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Check predefined keys
    Object.keys(keyDefinitions).forEach(k => {
      const val = localStorage.getItem(k);
      if (val !== null) {
        const sizeBytes = new Blob([val]).size;
        let count: number | undefined;
        let summary = 'Dados salvos';

        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            count = parsed.length;
            summary = `${parsed.length} itens armazenados`;
          } else if (typeof parsed === 'object' && parsed !== null) {
            count = Object.keys(parsed).length;
            summary = `Objeto com ${count} propriedades`;
          } else {
            summary = `Valor: ${String(parsed)}`;
          }
        } catch {
          summary = `${val.length} caracteres`;
        }

        items.push({
          key: k,
          label: keyDefinitions[k].label,
          category: keyDefinitions[k].category,
          sizeBytes,
          sizeFormatted: formatBytes(sizeBytes),
          itemCount: count,
          previewSummary: summary
        });
      }
    });

    setClientStorage(items);
  }, []);

  // Fetch SQLite stats from backend
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/system/database-info');
      if (res.ok) {
        const data: SystemDatabaseStats = await res.json();
        setDbStats(data);
      } else {
        throw new Error('Falha na resposta do servidor.');
      }
    } catch (err: any) {
      console.error('Error fetching database info:', err);
      showToast('error', 'Falha ao Carregar Telemetria', 'Não foi possível obter dados do banco de dados.');
    } finally {
      setIsLoading(false);
      scanClientStorage();
    }
  }, [showToast, scanClientStorage]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Execute SQLite VACUUM
  const handleVacuum = async () => {
    if (isVacuuming) return;
    setIsVacuuming(true);
    try {
      const res = await fetch('/api/system/database-vacuum', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Otimização Concluída (VACUUM)', data.message);
        await fetchStats();
      } else {
        throw new Error(data.error || 'Falha na otimização.');
      }
    } catch (err: any) {
      console.error('Vacuum error:', err);
      showToast('error', 'Erro na Otimização', err.message || 'Falha ao compactar o banco de dados.');
    } finally {
      setIsVacuuming(false);
    }
  };

  // Export full backup
  const handleExportBackup = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/system/database-export?download=1');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `superbot-sqlite-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('success', 'Backup Exportado', 'Download do banco de dados concluído com sucesso.');
      } else {
        throw new Error('Erro ao gerar exportação.');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      showToast('error', 'Falha na Exportação', err.message || 'Não foi possível baixar o backup.');
    } finally {
      setIsExporting(false);
    }
  };

  // Clear single SQLite table
  const handleClearTable = async (tableName: string) => {
    if (clearingTableName) return;
    const confirm = window.confirm(`Deseja realmente limpar todos os dados da tabela "${tableName}"? Esta ação removerá os registros mas manterá a estrutura da tabela.`);
    if (!confirm) return;

    setClearingTableName(tableName);
    try {
      const res = await fetch('/api/system/table-clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Tabela Limpa', data.message);
        await fetchStats();
      } else {
        throw new Error(data.error || 'Falha ao limpar tabela.');
      }
    } catch (err: any) {
      console.error('Clear table error:', err);
      showToast('error', 'Erro ao Limpar Tabela', err.message || 'Falha na exclusão dos dados.');
    } finally {
      setClearingTableName(null);
    }
  };

  // Clear single localStorage key
  const handleClearClientKey = (key: string, label: string) => {
    const confirm = window.confirm(`Deseja limpar os dados locais de "${label}"?`);
    if (!confirm) return;

    try {
      localStorage.removeItem(key);
      scanClientStorage();
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('paper_trading_updated'));
      showToast('success', 'Item Removido', `Dados de "${label}" foram limpos do navegador.`);
    } catch (err) {
      showToast('error', 'Falha ao Remover', 'Não foi possível apagar a chave local.');
    }
  };

  // Calculate total client storage bytes
  const totalClientBytes = clientStorage.reduce((acc, item) => acc + item.sizeBytes, 0);
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Ribbon */}
      <div className="bg-[#0b0c14] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                  Central de Sistema & Inspecção de Database
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  SQLITE 3.x
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Integridade OK
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Auditoria de tabelas, integridade de storage, compactação WAL/VACUUM e redefinição global do sistema.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 self-stretch lg:self-auto justify-end flex-wrap">
            <button
              onClick={handleVacuum}
              disabled={isVacuuming || isLoading}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-white/10 hover:border-cyan-500/40 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Compacta o banco de dados e remove páginas órfãs com SQLite VACUUM"
            >
              <Wrench className={`w-3.5 h-3.5 text-cyan-400 ${isVacuuming ? 'animate-spin' : ''}`} />
              <span>{isVacuuming ? 'Otimizando...' : 'Compactar (VACUUM)'}</span>
            </button>

            <button
              onClick={handleExportBackup}
              disabled={isExporting || isLoading}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-500/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Exporta todas as tabelas e dados para um arquivo JSON no seu dispositivo"
            >
              <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Exportando...' : 'Exportar Backup JSON'}</span>
            </button>

            <button
              onClick={fetchStats}
              disabled={isLoading}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-white/10 transition cursor-pointer"
              title="Atualizar métricas"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Storage Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          {/* Card 1: SQLite File Size */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> Banco SQLite
              </span>
              <span className="font-mono text-[11px] text-neutral-500">Disco</span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {dbStats ? dbStats.fileSizeFormatted : '...'}
            </div>
            <div className="text-[11px] text-neutral-400 font-mono truncate" title={dbStats?.filePath}>
              {dbStats?.fileName || 'superbot.sqlite'}
            </div>
          </div>

          {/* Card 2: Total Records */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Layers className="w-3.5 h-3.5 text-emerald-400" /> Registros Totais
              </span>
              <span className="font-mono text-[11px] text-neutral-500">7 Tabelas</span>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              {dbStats ? dbStats.totalRows.toLocaleString() : '...'}
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">
              {dbStats ? `${dbStats.pageCount} páginas (${dbStats.pageSize}B)` : '...'}
            </div>
          </div>

          {/* Card 3: LocalStorage Usage */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Server className="w-3.5 h-3.5 text-purple-400" /> Navegador (Local)
              </span>
              <span className="font-mono text-[11px] text-neutral-500">{clientStorage.length} chaves</span>
            </div>
            <div className="text-lg font-bold font-mono text-purple-300">
              {formatBytes(totalClientBytes)}
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">
              Paper Trading & Layouts
            </div>
          </div>

          {/* Card 4: Server Memory / Heap */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Cpu className="w-3.5 h-3.5 text-amber-400" /> Node.js Heap
              </span>
              <span className="font-mono text-[11px] text-neutral-500">Uptime: {dbStats ? `${Math.floor(dbStats.system.uptimeSeconds / 60)}m` : '...'}</span>
            </div>
            <div className="text-lg font-bold font-mono text-amber-300">
              {dbStats ? formatBytes(dbStats.system.heapUsedBytes) : '...'}
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">
              RSS: {dbStats ? formatBytes(dbStats.system.rssBytes) : '...'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Tables Breakdown + LocalStorage Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: SQLite Tables Inspector */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#0b0c14] border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Tabelas do Banco de Dados SQLite
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Estrutura relacional e volumetria persistida em disco (`/data/superbot.sqlite`).
                </p>
              </div>
              <span className="text-xs text-neutral-400 font-mono">
                {dbStats?.tables.length || 0} entidades
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-neutral-900/80 text-neutral-400 font-mono uppercase tracking-wider text-[11px] border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">Tabela & Finalidade</th>
                    <th className="py-3 px-3 text-right">Registros</th>
                    <th className="py-3 px-3 text-right">Tamanho Est.</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {isLoading && !dbStats ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-neutral-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                        Carregando metadados do banco...
                      </td>
                    </tr>
                  ) : dbStats?.tables.map(table => {
                    const isExpanded = expandedTable === table.name;
                    return (
                      <React.Fragment key={table.name}>
                        <tr className="hover:bg-white/[0.02] transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExpandedTable(isExpanded ? null : table.name)}
                                className="p-1 rounded hover:bg-white/10 text-neutral-400 transition"
                                title="Visualizar colunas e tipos"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              <div>
                                <span className="font-mono font-bold text-white text-xs block">
                                  {table.name}
                                </span>
                                <span className="text-[11px] text-neutral-400 block max-w-sm">
                                  {table.description}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-semibold text-white">
                            {table.rowCount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-neutral-400">
                            {formatBytes(table.estimatedSizeBytes)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {table.isClearable ? (
                              <button
                                onClick={() => handleClearTable(table.name)}
                                disabled={clearingTableName === table.name || table.rowCount === 0}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center gap-1 ml-auto cursor-pointer ${
                                  table.rowCount > 0
                                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    : 'bg-neutral-900 text-neutral-600 border-white/5 cursor-not-allowed'
                                }`}
                                title={`Limpar todos os registros da tabela ${table.name}`}
                              >
                                <Trash2 className="w-3 h-3" />
                                {clearingTableName === table.name ? 'Limpando...' : 'Limpar'}
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-neutral-500 uppercase px-2 py-0.5 rounded bg-neutral-900/60 border border-white/5">
                                Protegida
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Collapsible Schema Drawer */}
                        {isExpanded && (
                          <tr className="bg-neutral-950/60 border-t border-b border-white/5">
                            <td colSpan={4} className="py-3 px-6">
                              <div className="space-y-1.5">
                                <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                                  Esquema de Colunas ({table.columns.length} campos):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {table.columns.map((col, idx) => (
                                    <span 
                                      key={idx}
                                      className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-neutral-300"
                                    >
                                      {col}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Browser Storage & Danger Zone */}
        <div className="space-y-6">
          {/* Browser Storage (LocalStorage) Inspector */}
          <div className="bg-[#0b0c14] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-400" />
                  Armazenamento Local
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Chaves salvas no LocalStorage do navegador.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-purple-300">
                {formatBytes(totalClientBytes)}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {clientStorage.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  Nenhuma chave do SuperBot encontrada no LocalStorage.
                </div>
              ) : (
                clientStorage.map(item => (
                  <div
                    key={item.key}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-semibold text-neutral-200 block truncate" title={item.key}>
                        {item.label}
                      </span>
                      <span className="text-[11px] text-neutral-400 font-mono block">
                        {item.previewSummary} • {item.sizeFormatted}
                      </span>
                    </div>

                    <button
                      onClick={() => handleClearClientKey(item.key, item.label)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-300 border border-white/5 hover:border-rose-500/30 transition shrink-0 cursor-pointer"
                      title={`Limpar ${item.label}`}
                      aria-label={`Limpar ${item.label}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* DANGER ZONE: GLOBAL FACTORY RESET */}
          <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wider">
                  Zona de Perigo: Reset Global
                </h3>
                <p className="text-xs text-rose-200/70 mt-0.5">
                  Restauração total para o padrão de fábrica
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Zera todas as tabelas SQLite, limpa o histórico de Paper Trading, remove alertas e redefine os pesos quantitativos para as recomendações originais.
            </p>

            <button
              onClick={() => setIsResetModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wider uppercase transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Restaurar Padrão de Fábrica</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation 2-Step Modal */}
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccessReset={() => {
          fetchStats();
          if (onFactoryResetComplete) {
            onFactoryResetComplete();
          }
        }}
      />
    </div>
  );
};
