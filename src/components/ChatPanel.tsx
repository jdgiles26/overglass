import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { analyzeData } from '../utils/analysis';
import { X, Send } from 'lucide-react';

export function ChatPanel() {
  const showChat = useAppStore(s => s.showChat);
  const toggleChat = useAppStore(s => s.toggleChat);
  const points = useAppStore(s => s.ingestionPoints);
  const feeds = useAppStore(s => s.videoFeeds);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: 'assistant', text: 'Ask me about connectors, feeds, latency, errors, or type "help" for commands.' },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);

    const result = analyzeData(points, feeds, trimmed);
    const cleanResult = result.startsWith('__NAV:') ? 'Navigating... (use the sidebar instead)' : result;
    setMessages(prev => [...prev, { role: 'assistant', text: cleanResult }]);
    setInput('');
  }, [points, feeds]);

  if (!showChat) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[480px] bg-surface-900 border border-surface-800 rounded-xl flex flex-col shadow-2xl z-50 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <h3 className="font-semibold text-sm">OverGlass Assistant</h3>
        <button onClick={toggleChat} className="text-gray-500 hover:text-gray-300">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-3" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block px-3 py-2 rounded-lg max-w-[85%] ${
              m.role === 'user'
                ? 'bg-brand-500/20 text-brand-300'
                : 'bg-surface-800 text-gray-300'
            }`}>
              <pre className="whitespace-pre-wrap font-mono text-xs">{m.text}</pre>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-surface-800">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
          className="flex gap-2"
        >
          <input
            type="text"
            className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand-500/50"
            placeholder="Ask about your data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="p-1.5 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
