/* ─── Video View: Real video players with RTSP→HLS proxy support ─── */
import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store';
import type { VideoFeed } from '../types';

/* ─── Proxy server URL ─── */
const PROXY_BASE = 'http://localhost:3001';

/* ─── Player strategy determination ─── */
function determinePlayerStrategy(feed: VideoFeed): 'rtsp-proxy' | 'hls' | 'mp4' | 'iframe' | 'unavailable' {
  const url = feed.url.toLowerCase();
  if (url.startsWith('rtsp://')) return 'rtsp-proxy';
  if (url.endsWith('.m3u8') || url.includes('m3u8') || feed.type === 'hls') return 'hls';
  if (url.endsWith('.mp4') || url.endsWith('.webm')) return 'mp4';
  if (url.startsWith('http://') || url.startsWith('https://')) return 'iframe';
  return 'unavailable';
}

/* ─── RTSP Proxy Player ─── */
function RTSPProxyPlayer({ feed, onDelete }: { feed: VideoFeed; onDelete?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<unknown>(null);
  const [proxyState, setProxyState] = useState<'idle' | 'starting' | 'connecting' | 'live' | 'error' | 'stopped'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [proxyAvailable, setProxyAvailable] = useState<boolean | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check proxy availability
  useEffect(() => {
    fetch(`${PROXY_BASE}/api/health`, { signal: AbortSignal.timeout(3000) })
      .then(res => res.json())
      .then(data => {
        setProxyAvailable(data.status === 'ok');
        if (!data.ffmpeg) {
          setErrorMessage('ffmpeg not available on the proxy server. Install ffmpeg and restart the proxy.');
          setProxyState('error');
        }
      })
      .catch(() => {
        setProxyAvailable(false);
        setErrorMessage('RTSP proxy server not running. Start it with: npm run server');
        setProxyState('error');
      });

    return () => {
      // Cleanup: stop stream when component unmounts
      if (streamId) {
        fetch(`${PROXY_BASE}/api/proxy/stop`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ streamId }),
        }).catch(() => {});
      }
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    };
  }, []);

  // Start RTSP → HLS transcoding
  const startProxy = useCallback(async () => {
    setProxyState('starting');
    setErrorMessage(null);

    try {
      const res = await fetch(`${PROXY_BASE}/api/proxy/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: feed.url,
          options: {
            resolution: feed.width > 0 ? `${Math.min(feed.width, 1920)}x${Math.min(feed.height, 1080)}` : '1280x720',
            fps: feed.fps || 25,
            audio: false,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message || `Proxy error ${res.status}`);
      }

      const data = await res.json();
      const sid = data.streamId;
      setStreamId(sid);

      if (data.status === 'already_running') {
        attachHLS(sid);
        return;
      }

      // Wait for HLS manifest to be ready, then attach player
      setProxyState('connecting');
      pollForManifest(sid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start proxy';
      setErrorMessage(msg);
      setProxyState('error');
    }
  }, [feed.url, feed.width, feed.height, feed.fps]);

  // Poll for manifest availability
  const pollForManifest = useCallback((sid: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds

    const poll = () => {
      attempts++;
      fetch(`${PROXY_BASE}/api/proxy/stream/${sid}/index.m3u8`, { signal: AbortSignal.timeout(2000) })
        .then(res => {
          if (res.ok) {
            const text = res.text();
            text.then(content => {
              if (!content.includes('not found') && !content.includes('ended')) {
                setProxyState('live');
                attachHLS(sid);
                return;
              }
            });
          }
          if (attempts < maxAttempts) {
            retryTimerRef.current = setTimeout(poll, 500);
          } else {
            setErrorMessage('Timeout waiting for HLS manifest. Check RTSP URL and proxy server.');
            setProxyState('error');
          }
        })
        .catch(() => {
          if (attempts < maxAttempts) {
            retryTimerRef.current = setTimeout(poll, 500);
          } else {
            setErrorMessage('Could not connect to proxy stream.');
            setProxyState('error');
          }
        });
    };
    poll();
  }, []);

  // Attach hls.js to the video element
  const attachHLS = useCallback((sid: string) => {
    import('hls.js').then(Hls => {
      const video = videoRef.current;
      if (!video) return;

      if (hlsRef.current) {
        (hlsRef.current as { destroy: () => void }).destroy();
      }

      const hlsUrl = `${PROXY_BASE}/api/proxy/stream/${sid}/index.m3u8`;

      if (Hls.default.isSupported()) {
        const hls = new Hls.default({
          enableWorker: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
          liveDurationInfinity: true,
          lowLatencyMode: true,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          fragLoadingMaxRetry: 10,
          manifestLoadingMaxRetry: 10,
          levelLoadingMaxRetry: 10,
        });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(Hls.default.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {
            // Autoplay blocked — user needs to click play
          });
        });

        hls.on(Hls.default.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.default.ErrorTypes.NETWORK_ERROR:
                console.warn('[RTSP] Network error, attempting recovery...');
                hls.startLoad();
                break;
              case Hls.default.ErrorTypes.MEDIA_ERROR:
                console.warn('[RTSP] Media error, attempting recovery...');
                hls.recoverMediaError();
                break;
              default:
                console.error('[RTSP] Fatal error:', data);
                setProxyState('error');
                setErrorMessage(`Stream error: ${data.details}`);
                // Auto-reconnect after 3s
                retryTimerRef.current = setTimeout(() => {
                  setProxyState('connecting');
                  startProxy();
                }, 3000);
                break;
            }
          }
        });

        // Track live status
        hls.on(Hls.default.Events.LEVEL_LOADED, () => {
          setProxyState('live');
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => {});
        });
      }
    });
  }, [startProxy]);

  // Periodically check proxy health
  useEffect(() => {
    if (!streamId || proxyState !== 'live') return;

    checkTimerRef.current = setInterval(() => {
      fetch(`${PROXY_BASE}/api/proxy/status/${streamId}`, { signal: AbortSignal.timeout(2000) })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'stopped' && proxyState === 'live') {
            setProxyState('stopped');
            setErrorMessage('Transcoding stopped unexpectedly.');
            // Auto-reconnect
            retryTimerRef.current = setTimeout(() => startProxy(), 3000);
          }
          if (data.health === 'stale' && proxyState === 'live') {
            // Stream is stale but might recover
          }
        })
        .catch(() => {});
    }, 10000);

    return () => {
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    };
  }, [streamId, proxyState, startProxy]);

  // Start proxy on mount
  useEffect(() => {
    if (proxyAvailable === true && proxyState === 'idle') {
      startProxy();
    }
  }, [proxyAvailable, proxyState, startProxy]);

  const handleStop = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    if (hlsRef.current) {
      (hlsRef.current as { destroy: () => void }).destroy();
      hlsRef.current = null;
    }
    if (streamId) {
      fetch(`${PROXY_BASE}/api/proxy/stop`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId }),
      }).catch(() => {});
      setStreamId(null);
    }
    setProxyState('idle');
  }, [streamId]);

  const handleRestart = useCallback(() => {
    handleStop();
    setTimeout(() => startProxy(), 500);
  }, [handleStop, startProxy]);

  const statusColor = proxyState === 'live' ? 'text-green-400' :
    proxyState === 'error' ? 'text-red-400' :
    proxyState === 'starting' || proxyState === 'connecting' ? 'text-yellow-400' :
    'text-gray-400';

  return (
    <div className="aspect-video bg-surface-800 relative">
      {/* Status overlay */}
      {(proxyState === 'starting' || proxyState === 'connecting') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-800 z-10">
          <div className="animate-spin w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full mb-3" />
          <div className="text-sm text-gray-400">{proxyState === 'starting' ? 'Starting transcoder...' : 'Connecting to stream...'}</div>
          <div className="text-xs text-gray-600 mt-1">RTSP → HLS via ffmpeg</div>
        </div>
      )}

      {proxyState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-800 z-10">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-sm text-red-400 mb-1">{errorMessage}</div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleRestart} className="px-3 py-1.5 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 text-xs">
              🔄 Retry
            </button>
            {proxyAvailable === false && (
              <div className="text-xs text-gray-500 text-center max-w-[250px]">
                Run the proxy server: <code className="bg-surface-700 px-1 rounded">npm run dev:all</code>
              </div>
            )}
          </div>
        </div>
      )}

      {proxyState === 'stopped' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-800 z-10">
          <div className="text-2xl mb-2">⏹️</div>
          <div className="text-sm text-gray-400">Stream stopped</div>
          <button onClick={handleRestart} className="px-3 py-1.5 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 text-xs mt-2">
            🔄 Restart
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        playsInline
        muted
      />

      {/* RTSP status badge */}
      <div className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] rounded-full bg-black/60 backdrop-blur-sm ${statusColor} z-10`}>
        {proxyState === 'live' ? '🔴 LIVE' : proxyState === 'starting' ? '⏳ TRANSCODING' : proxyState.toUpperCase()}
      </div>

      {/* Control buttons */}
      {proxyState === 'live' && (
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <button onClick={handleStop} className="px-2 py-1 text-[10px] rounded bg-black/60 text-red-400 hover:bg-red-500/30 backdrop-blur-sm" title="Stop stream">
            ⏹ Stop
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── HLS Player ─── */
function HLSPlayer({ feed }: { feed: VideoFeed }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hlsRef = useRef<unknown>(null);

  useEffect(() => {
    let mounted = true;
    const video = videoRef.current;
    if (!video) return;

    import('hls.js').then(Hls => {
      if (!mounted) return;
      if (Hls.default.isSupported()) {
        const hls = new Hls.default({ enableWorker: true });
        hls.loadSource(feed.url);
        hls.attachMedia(video);
        hls.on(Hls.default.Events.MANIFEST_PARSED, () => {
          if (mounted) {
            setLoading(false);
            video.play().catch(() => {});
          }
        });
        hls.on(Hls.default.Events.ERROR, (_: unknown, data: { fatal: boolean; type: string }) => {
          if (data.fatal && mounted) {
            setError(`HLS error: ${data.type}`);
            setLoading(false);
          }
        });
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = feed.url;
        video.addEventListener('loadedmetadata', () => {
          if (mounted) { setLoading(false); video.play().catch(() => {}); }
        });
      } else {
        setError('HLS not supported');
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) { setError('Failed to load HLS'); setLoading(false); }
    });

    return () => {
      mounted = false;
      if (hlsRef.current) (hlsRef.current as { destroy: () => void }).destroy();
    };
  }, [feed.url]);

  if (error) {
    return (
      <div className="aspect-video bg-surface-800 flex items-center justify-center">
        <div className="text-center text-gray-500 text-sm">⚠ {error}</div>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-surface-800 relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-500 text-sm animate-pulse">Loading stream...</div>
        </div>
      )}
      <video ref={videoRef} className="w-full h-full object-contain" controls playsInline muted />
    </div>
  );
}

/* ─── MP4 Player ─── */
function MP4Player({ feed }: { feed: VideoFeed }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="aspect-video bg-surface-800">
      {error ? (
        <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">⚠ {error}</div>
      ) : (
        <video src={feed.url} className="w-full h-full object-contain" controls playsInline muted onError={() => setError('Failed to load video')} />
      )}
    </div>
  );
}

/* ─── Iframe Player ─── */
function IFramePlayer({ feed }: { feed: VideoFeed }) {
  const [error, setError] = useState(false);
  return (
    <div className="aspect-video bg-surface-800 relative">
      {error ? (
        <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">⚠ Embed blocked (CORS/X-Frame-Options)</div>
      ) : (
        <iframe
          src={feed.url}
          className="w-full h-full"
          allow="autoplay; fullscreen; encrypted-media"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin"
          title={feed.name}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

/* ─── Unavailable Player ─── */
function UnavailablePlayer({ feed }: { feed: VideoFeed }) {
  return (
    <div className="aspect-video bg-surface-800 flex flex-col items-center justify-center gap-2">
      <div className="text-gray-600 text-lg">📹</div>
      <div className="text-gray-500 text-sm text-center px-4">No player available for {feed.type}</div>
      <div className="text-gray-600 text-xs text-center px-4 max-w-[250px] truncate">{feed.url}</div>
    </div>
  );
}

/* ─── Feed Card ─── */
function FeedCard({ feed, onDelete }: { feed: VideoFeed; onDelete?: () => void }) {
  const strategy = determinePlayerStrategy(feed);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  const PlayerComponent = {
    'rtsp-proxy': RTSPProxyPlayer,
    'hls': HLSPlayer,
    'mp4': MP4Player,
    'iframe': IFramePlayer,
    'unavailable': UnavailablePlayer,
  }[strategy];

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-surface-950">
          <h3 className="text-sm font-semibold">{feed.name}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{strategy.toUpperCase()}</span>
            <button onClick={() => setFullscreen(false)} className="text-gray-400 hover:text-white text-sm">✕ Exit</button>
          </div>
        </div>
        <div className="flex-1">
          <PlayerComponent feed={feed} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-900/30 border border-surface-800 rounded-xl overflow-hidden">
      <PlayerComponent feed={feed} />
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm truncate">{feed.name}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-0.5 text-[10px] rounded-full ${
              strategy === 'rtsp-proxy' ? 'bg-blue-500/20 text-blue-400' :
              feed.status === 'live' ? 'bg-green-500/20 text-green-400' :
              feed.status === 'offline' ? 'bg-gray-500/20 text-gray-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {strategy === 'rtsp-proxy' ? 'RTSP→HLS' : strategy.toUpperCase()}
            </span>
            <button onClick={() => setFullscreen(true)} className="text-gray-500 hover:text-gray-300 text-xs" title="Fullscreen">⛶</button>
            {onDelete && (
              <button onClick={onDelete} className="text-gray-500 hover:text-red-400 text-xs" title="Delete feed">🗑️</button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 truncate">{feed.location}</p>
        <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-400">
          <span>{feed.resolution}</span>
          <span>{feed.fps}fps</span>
          <span>{feed.codec}</span>
          <span>{feed.bitrate}</span>
        </div>
        <div className="mt-1 text-[10px] text-gray-600 truncate font-mono">{feed.url}</div>
      </div>
    </div>
  );
}

/* ─── Video View ─── */
export function VideoView() {
  const feeds = useAppStore(s => s.videoFeeds);
  const connectors = useAppStore(s => s.ingestionPoints);
  const removeConnector = useAppStore(s => s.removeConnector);

  // Combine video feeds with RTSP connectors that aren't in feeds
  const allFeeds = feeds;

  // Check proxy status
  const [proxyStatus, setProxyStatus] = useState<{ available: boolean; ffmpeg: boolean; activeStreams: number } | null>(null);

  useEffect(() => {
    const checkProxy = () => {
      fetch(`${PROXY_BASE}/api/health`, { signal: AbortSignal.timeout(3000) })
        .then(res => res.json())
        .then(data => setProxyStatus({ available: true, ffmpeg: data.ffmpeg, activeStreams: data.activeStreams }))
        .catch(() => setProxyStatus({ available: false, ffmpeg: false, activeStreams: 0 }));
    };
    checkProxy();
    const interval = setInterval(checkProxy, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video Feeds ({allFeeds.length})</h1>
          <p className="text-xs text-gray-500 mt-1">
            RTSP streams are transcoded to HLS via the proxy server (ffmpeg)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {proxyStatus && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${proxyStatus.available ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-500">
                Proxy: {proxyStatus.available ? 'Online' : 'Offline'}
                {proxyStatus.available && ` · ${proxyStatus.activeStreams} streams`}
                {!proxyStatus.ffmpeg && ' · No ffmpeg'}
              </span>
            </div>
          )}
          {!proxyStatus?.available && (
            <button
              onClick={() => window.open('https://github.com/overglass/overglass-replica#rtsp-setup', '_blank')}
              className="px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg hover:bg-yellow-500/20 text-xs"
            >
              ℹ️ Setup Guide
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allFeeds.map(f => (
          <FeedCard
            key={f.id}
            feed={f}
            onDelete={f.type === 'rtsp' ? () => {
              if (confirm(`Remove feed "${f.name}"?`)) {
                removeConnector(f.id);
              }
            } : undefined}
          />
        ))}
      </div>

      {allFeeds.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <div className="text-4xl mb-4">📹</div>
          <p>No video feeds configured</p>
          <p className="text-sm text-gray-600 mt-1">Add connectors with video URLs in the Connector Configuration page</p>
        </div>
      )}

      {/* Setup instructions when proxy is offline */}
      {proxyStatus && !proxyStatus.available && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mt-4">
          <h3 className="font-semibold text-yellow-400 mb-2">RTSP Proxy Server Not Running</h3>
          <div className="text-sm text-gray-400 space-y-2">
            <p>RTSP streams require the companion proxy server for transcoding. Start it with:</p>
            <pre className="bg-surface-800 rounded-lg p-3 text-xs font-mono text-green-400">
              npm run dev:all
            </pre>
            <p className="text-xs text-gray-500">
              This runs both the Vite dev server (port 3000) and the RTSP proxy (port 3001) simultaneously.
              ffmpeg must be installed on your system: <code className="bg-surface-800 px-1 rounded">brew install ffmpeg</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
