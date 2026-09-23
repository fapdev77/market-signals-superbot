import React, { useState, useEffect } from 'react';
import { AlertSoundProfile, AlertAudioConfig } from '../types';
import { 
  Volume2, 
  VolumeX, 
  Volume1, 
  Play, 
  Check, 
  Settings2, 
  Radio, 
  Sparkles, 
  Music, 
  Sliders, 
  Bell, 
  ChevronDown, 
  ChevronUp, 
  X 
} from 'lucide-react';
import { getAudioConfig, saveAudioConfig, playSignalTone } from '../utils/soundAlerts';
import { Tooltip } from './Tooltip';

interface AlertSoundSettingsMenuProps {
  onConfigChange?: (config: AlertAudioConfig) => void;
}

interface SoundProfileOption {
  id: AlertSoundProfile;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
}

const SOUND_PROFILES: SoundProfileOption[] = [
  {
    id: 'SYNTH_CHIME',
    name: 'Synth Chime (Padrão)',
    category: 'Eletrônico',
    description: 'Acorde senoidal clássico de trading com subida melódica D5 -> A5.',
    icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />
  },
  {
    id: 'RADAR_BEEP',
    name: 'Radar Beep',
    category: 'Tático / Bloomberg',
    description: 'Pulsos duplos quadrados estilo radar militar de alta frequência.',
    icon: <Radio className="w-3.5 h-3.5 text-cyan-400" />
  },
  {
    id: 'CRYSTAL_BELL',
    name: 'Crystal Bell',
    category: 'Harmônico',
    description: 'Sino com 3 harmônicos cristalinos com decay longo e aveludado.',
    icon: <Bell className="w-3.5 h-3.5 text-emerald-400" />
  },
  {
    id: 'CYBER_PULSE',
    name: 'Cyber Pulse',
    category: 'Sci-Fi / Synthwave',
    description: 'Sweep de dente-de-serra com filtro ressonante cyberpunk.',
    icon: <Music className="w-3.5 h-3.5 text-purple-400" />
  },
  {
    id: 'ZEN_GONG',
    name: 'Zen Gong',
    category: 'Acústico / Calmo',
    description: 'Ressonância grave e relaxante de gongo acústico sem estresse.',
    icon: <Sliders className="w-3.5 h-3.5 text-yellow-400" />
  }
];

export const AlertSoundSettingsMenu: React.FC<AlertSoundSettingsMenuProps> = ({
  onConfigChange
}) => {
  const [config, setConfig] = useState<AlertAudioConfig>(() => getAudioConfig());
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [previewDirection, setPreviewDirection] = useState<'LONG' | 'SHORT' | 'ALERT'>('LONG');

  // Sync state changes with persistence
  const updateConfig = (newConfig: Partial<AlertAudioConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    saveAudioConfig(updated);
    if (onConfigChange) {
      onConfigChange(updated);
    }
  };

  const handleTestSound = (profileToTest?: AlertSoundProfile) => {
    playSignalTone(previewDirection, {
      enabled: true,
      volume: config.volume,
      profile: profileToTest || config.profile
    });
  };

  const currentProfileInfo = SOUND_PROFILES.find(p => p.id === config.profile) || SOUND_PROFILES[0];

  return (
    <div className="relative">
      <Tooltip
        position="top"
        title="Configurações de Áudio dos Alarmes"
        badge={config.enabled ? `${Math.round(config.volume * 100)}% VOL` : 'MUDO'}
        content="Personalize o perfil do sintetizador sonoro (Radar, Crystal Bell, Cyber, Zen) e ajuste o volume de aviso dos alarmes de preço."
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1.5 border active:scale-95 ${
            isOpen
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
              : !config.enabled
                ? 'bg-[#050505] text-neutral-500 border-white/5 hover:text-neutral-300'
                : 'bg-[#050505] text-neutral-300 border-white/10 hover:border-white/20 hover:text-white'
          }`}
          aria-label="Configurar Áudio dos Alarmes"
        >
          {!config.enabled || config.volume === 0 ? (
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
          ) : config.volume < 0.4 ? (
            <Volume1 className="w-3.5 h-3.5 text-cyan-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span className="hidden sm:inline font-mono">
            {config.enabled ? `${Math.round(config.volume * 100)}%` : 'Mudo'}
          </span>
          <Settings2 className="w-3 h-3 text-neutral-400" />
        </button>
      </Tooltip>

      {/* Popover Settings Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-50 w-80 sm:w-88 bg-[#0B0B0B] border border-white/15 rounded-2xl shadow-2xl p-4 font-sans text-xs animate-fade-in backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Settings2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs font-mono">
                  Sons dos Alarmes de Preço
                </h4>
                <p className="text-[10px] text-neutral-400">
                  Web Audio API: Síntese pura em tempo real
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Master Enable & Volume Slider */}
          <div className="mt-3.5 space-y-3 bg-[#050505] p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-200 flex items-center gap-1.5">
                {config.enabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                )}
                Sons de Notificação Ativos
              </span>
              <button
                type="button"
                onClick={() => updateConfig({ enabled: !config.enabled })}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  config.enabled ? 'bg-cyan-500' : 'bg-neutral-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Volume Range Control */}
            <div className={`space-y-1.5 transition-opacity ${config.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-neutral-400 font-bold uppercase tracking-wider">Volume do Alarme</span>
                <span className="font-mono font-bold text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20">
                  {Math.round(config.volume * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <VolumeX className="w-3 h-3 text-neutral-500" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.volume}
                  onChange={(e) => updateConfig({ volume: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
                <Volume2 className="w-3 h-3 text-cyan-400" />
              </div>
            </div>
          </div>

          {/* Sound Profiles Selector */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                Perfil Sonoro do Sintetizador
              </span>
              <span className="text-[9px] text-neutral-500 font-mono">
                {SOUND_PROFILES.length} perfis
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {SOUND_PROFILES.map((profile) => {
                const isSelected = config.profile === profile.id;
                return (
                  <div
                    key={profile.id}
                    onClick={() => updateConfig({ profile: profile.id })}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                        : 'bg-[#050505] border-white/5 hover:border-white/15 hover:bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg bg-neutral-900 border border-white/5 flex-shrink-0 mt-0.5">
                        {profile.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-white' : 'text-neutral-300'}`}>
                            {profile.name}
                          </span>
                          <span className="text-[8px] bg-neutral-900 text-neutral-400 font-mono px-1 py-0.5 rounded border border-white/5">
                            {profile.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 leading-tight mt-0.5 line-clamp-1">
                          {profile.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestSound(profile.id);
                        }}
                        title={`Ouvir prévia de ${profile.name}`}
                        className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-cyan-400 border border-white/10 transition active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>

                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected 
                          ? 'border-cyan-400 bg-cyan-500 text-black' 
                          : 'border-white/15 bg-neutral-900'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test & Preview Bar */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-neutral-500 font-mono">Modo de Teste:</span>
              <div className="flex items-center bg-neutral-900 p-0.5 rounded-lg border border-white/5 text-[9px] font-mono">
                {(['LONG', 'SHORT', 'ALERT'] as const).map(dir => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setPreviewDirection(dir)}
                    className={`px-1.5 py-0.5 rounded font-bold transition ${
                      previewDirection === dir
                        ? 'bg-neutral-800 text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTestSound()}
              disabled={!config.enabled}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Ouvir Alerta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
