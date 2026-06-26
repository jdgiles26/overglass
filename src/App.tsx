import { useEffect, lazy, Suspense } from 'react';
import { MessageSquare } from 'lucide-react';
import { useAppStore } from './store';
import { useKeyboardShortcuts } from './hooks/useShortcuts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChatPanel } from './components/ChatPanel';
import type { ViewId } from './types';

/* ─── Eagerly loaded views ─── */
import { DashboardView } from './views/Dashboard';
import { ConnectorsView } from './views/Connectors';
import { AnalystView } from './views/Analyst';
import { CVAgentView } from './views/CVAgent';
import { AlertsView } from './views/Alerts';
import { PipelineView } from './views/Pipeline';
import { TerminalView } from './views/Terminal';
import { SettingsView } from './views/Settings';

/* ─── Lazy-loaded views (heavy dependencies) ─── */
const MapViewLazy = lazy(() => import('./views/MapView').then(m => ({ default: m.MapView })));
const VideoViewLazy = lazy(() => import('./views/Video').then(m => ({ default: m.VideoView })));
const ConnectorsConfigLazy = lazy(() => import('./views/ConnectorsConfig').then(m => ({ default: m.ConnectorsConfigView })));
const ThreatIntelLazy = lazy(() => import('./views/ThreatIntel').then(m => ({ default: m.ThreatIntelView })));
const ScreenshotHistoryLazy = lazy(() => import('./views/ScreenshotHistory').then(m => ({ default: m.ScreenshotHistoryView })));
const RulesEngineLazy = lazy(() => import('./views/RulesEngine').then(m => ({ default: m.RulesEngineView })));
const TimelineLazy = lazy(() => import('./views/Timeline').then(m => ({ default: m.TimelineView })));
const NetworkScanLazy = lazy(() => import('./views/NetworkScan').then(m => ({ default: m.NetworkScanView })));

const navItems: { id: ViewId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'globe', label: 'Globe', icon: '🌍' },
  { id: 'connectors', label: 'Connectors', icon: '🔌' },
  { id: 'connectors-config', label: 'Config', icon: '⚙️' },
  { id: 'video', label: 'Video', icon: '📹' },
  { id: 'network', label: 'Network', icon: '🛰️' },
  { id: 'threat-intel', label: 'Threat Intel', icon: '🔍' },
  { id: 'screenshots', label: 'Screenshots', icon: '📸' },
  { id: 'analyst', label: 'Analyst', icon: '🧠' },
  { id: 'cv-agent', label: 'CV Agent', icon: '🤖' },
  { id: 'alerts', label: 'Alerts', icon: '⚠️' },
  { id: 'rules', label: 'Rules', icon: '⚡' },
  { id: 'pipeline', label: 'Pipeline', icon: '🔄' },
  { id: 'timeline', label: 'Timeline', icon: '📜' },
  { id: 'terminal', label: 'Terminal', icon: '💻' },
  { id: 'settings', label: 'Settings', icon: '🛠' },
];

function ViewLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </div>
    }>
      {children}
    </Suspense>
  );
}

function ActiveViewRouter() {
  const activeView = useAppStore(s => s.activeView);

  switch (activeView) {
    case 'dashboard': return <DashboardView />;
    case 'globe': return <ViewLoader><MapViewLazy /></ViewLoader>;
    case 'connectors': return <ConnectorsView />;
    case 'connectors-config': return <ViewLoader><ConnectorsConfigLazy /></ViewLoader>;
    case 'video': return <ViewLoader><VideoViewLazy /></ViewLoader>;
    case 'network': return <ViewLoader><NetworkScanLazy /></ViewLoader>;
    case 'threat-intel': return <ViewLoader><ThreatIntelLazy /></ViewLoader>;
    case 'screenshots': return <ViewLoader><ScreenshotHistoryLazy /></ViewLoader>;
    case 'analyst': return <AnalystView />;
    case 'cv-agent': return <CVAgentView />;
    case 'alerts': return <AlertsView />;
    case 'rules': return <ViewLoader><RulesEngineLazy /></ViewLoader>;
    case 'pipeline': return <PipelineView />;
    case 'timeline': return <ViewLoader><TimelineLazy /></ViewLoader>;
    case 'terminal': return <TerminalView />;
    case 'settings': return <SettingsView />;
    default: return <DashboardView />;
  }
}

export default function App() {
  const activeView = useAppStore(s => s.activeView);
  const setActiveView = useAppStore(s => s.setActiveView);
  const refreshData = useAppStore(s => s.refreshData);
  const settings = useAppStore(s => s.settings);
  const toggleChat = useAppStore(s => s.toggleChat);
  const showChat = useAppStore(s => s.showChat);

  // Auto-refresh
  useEffect(() => {
    if (!settings.autoRefresh) return;
    const interval = setInterval(refreshData, settings.refreshInterval);
    return () => clearInterval(interval);
  }, [settings.autoRefresh, settings.refreshInterval, refreshData]);

  // Keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen bg-surface-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-surface-900 border-r border-surface-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-surface-800">
          <h1 className="text-lg font-bold text-brand-400">OverGlass</h1>
          <p className="text-xs text-gray-500">Data Fabric v3.0</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeView === item.id
                  ? 'bg-brand-500/10 text-brand-400'
                  : 'text-gray-400 hover:bg-surface-800 hover:text-gray-200'
              }`}
            >
              <span className="text-xs w-5 text-center">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-surface-800 space-y-2">
          <button
            onClick={toggleChat}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
              showChat
                ? 'bg-brand-500/10 text-brand-400'
                : 'text-gray-500 hover:bg-surface-800 hover:text-gray-300'
            }`}
          >
            <MessageSquare size={14} />
            Assistant
          </button>
          <div className="text-xs text-gray-600">
            {settings.autoRefresh ? `Auto-refresh: ${settings.refreshInterval / 1000}s` : 'Auto-refresh: off'}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <ErrorBoundary>
          <ActiveViewRouter />
        </ErrorBoundary>
      </main>

      {/* Floating chat panel */}
      <ChatPanel />
    </div>
  );
}
