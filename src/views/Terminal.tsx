import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { analyzeData } from '../utils/analysis';

interface Line {
  type: 'input' | 'output' | 'error' | 'nav';
  text: string;
}

export function TerminalView() {
  const [lines, setLines] = useState<Line[]>([
    { type: 'output', text: '> Welcome to OverGlass Terminal' },
    { type: 'output', text: '> Type "help" for available commands' },
    { type: 'output', text: '' },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const points = useAppStore(s => s.ingestionPoints);
  const feeds = useAppStore(s => s.videoFeeds);
  const setActiveView = useAppStore(s => s.setActiveView);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const handleSubmit = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setLines(prev => [...prev, { type: 'input', text: `❯ ${trimmed}` }]);

    const result = analyzeData(points, feeds, trimmed);

    // Check for navigation commands
    if (result.startsWith('__NAV:')) {
      const navMatch = result.match(/^__NAV:(\S+)__(.*)$/);
      if (navMatch) {
        const viewId = navMatch[1] as any;
        setActiveView(viewId);
        setLines(prev => [...prev, { type: 'nav', text: navMatch[2] }]);
      }
      return;
    }

    setLines(prev => [...prev, { type: 'output', text: result }, { type: 'output', text: '' }]);
  }, [points, feeds, setActiveView]);

  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Terminal</h1>
      <div className="flex-1 bg-surface-950 border border-surface-800 rounded-xl p-4 font-mono text-sm overflow-auto" ref={scrollRef}>
        {lines.map((line, i) => (
          <pre
            key={i}
            className={`whitespace-pre-wrap ${
              line.type === 'input' ? 'text-brand-400' :
              line.type === 'error' ? 'text-red-400' :
              line.type === 'nav' ? 'text-blue-400' :
              'text-green-400'
            }`}
          >
            {line.text}
          </pre>
        ))}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-brand-400">❯</span>
          <input
            type="text"
            className="flex-1 bg-transparent outline-none text-gray-200 caret-brand-400"
            placeholder="Enter command..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit(input);
                setInput('');
              }
            }}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
