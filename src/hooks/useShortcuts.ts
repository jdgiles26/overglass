import { useEffect } from 'react';
import { useAppStore } from '../store';
import type { ViewId } from '../types';

export function useKeyboardShortcuts() {
  const setActiveView = useAppStore(s => s.setActiveView);
  const toggleChat = useAppStore(s => s.toggleChat);
  const toggleAlerts = useAppStore(s => s.toggleAlerts);
  const toggleGlobeMode = useAppStore(s => s.toggleGlobeMode);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, ViewId> = {
        '1': 'dashboard', '2': 'globe', '3': 'connectors', '4': 'video',
        '5': 'analyst', '6': 'cv-agent', '7': 'alerts', '8': 'pipeline', '9': 'terminal',
      };
      if (map[e.key]) { setActiveView(map[e.key]); return; }
      if (e.key === 'g') toggleGlobeMode();
      if (e.key === 'c') toggleChat();
      if (e.key === 'a') toggleAlerts();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveView, toggleChat, toggleAlerts, toggleGlobeMode]);
}
