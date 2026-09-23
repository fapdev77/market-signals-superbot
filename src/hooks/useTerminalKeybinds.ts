import { useEffect } from 'react';

interface KeybindOptions {
  onNavigateTab: (tab: string) => void;
  onOpenCommandPalette: () => void;
  onToggleLiveStream?: () => void;
  onCloseModals?: () => void;
  enabled?: boolean;
}

export const useTerminalKeybinds = ({
  onNavigateTab,
  onOpenCommandPalette,
  onToggleLiveStream,
  onCloseModals,
  enabled = true
}: KeybindOptions) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing inside an input, textarea or select
      const activeElement = document.activeElement;
      const isInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        (activeElement as HTMLElement).isContentEditable
      );

      // Ctrl+K or Cmd+K always opens Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (isInput) return;

      // Escape key closes modals
      if (e.key === 'Escape') {
        if (onCloseModals) onCloseModals();
        return;
      }

      // Space key pauses/resumes stream
      if (e.code === 'Space') {
        e.preventDefault();
        if (onToggleLiveStream) onToggleLiveStream();
        return;
      }

      // 1-9 direct tab switching
      switch (e.key) {
        case '1':
          onNavigateTab('dashboard');
          break;
        case '2':
          onNavigateTab('heatmap');
          break;
        case '3':
          onNavigateTab('volume_screener');
          break;
        case '4':
          onNavigateTab('screener');
          break;
        case '5':
          onNavigateTab('signals');
          break;
        case '6':
          onNavigateTab('risk');
          break;
        case '7':
          onNavigateTab('ai_motor');
          break;
        case '8':
          onNavigateTab('chart');
          break;
        case '9':
          onNavigateTab('backtest');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onNavigateTab, onOpenCommandPalette, onToggleLiveStream, onCloseModals]);
};
