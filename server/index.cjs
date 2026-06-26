/* ─── OverGlass RTSP → HLS Proxy Server ─── */
const express = require('express');
const { spawn } = require('child_process');
const { mkdirSync, rmSync, existsSync, readdirSync, statSync, unlinkSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const VITE_ORIGIN = process.env.VITE_ORIGIN || 'http://localhost:3000';

/* ─── Config ─── */
const STREAM_DIR = join(__dirname, '..', '.streams');
const MAX_STREAMS = 8;
const SEGMENT_DURATION = 2; // seconds
const SEGMENT_COUNT = 3;    // keep 3 segments in playlist

let ffmpegAvailable = false;
let ffmpegPath = 'ffmpeg';

/* Check ffmpeg availability on startup */
try {
  const result = execSync('which ffmpeg').toString().trim();
  ffmpegPath = result;
  ffmpegAvailable = true;
  console.log(`[proxy] ffmpeg found at: ${ffmpegPath}`);
} catch {
  ffmpegAvailable = false;
  console.warn('[proxy] ffmpeg NOT found. RTSP transcoding will not work.');
  console.warn('[proxy] Install ffmpeg: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)');
}

/* Ensure stream directory exists */
try { mkdirSync(STREAM_DIR, { recursive: true }); } catch { /* ignore */ }

/* ─── Stream Manager ─── */
const streams = new Map(); // id → { process, url, status, createdAt, lastSegment, health }

function generateStreamId() {
  return crypto.randomBytes(4).toString('hex');
}

function getStreamDir(streamId) {
  return join(STREAM_DIR, streamId);
}

function cleanStreamDir(streamId) {
  const dir = getStreamDir(streamId);
  try {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

/* Parse RTSP URL with optional credentials */
function parseRTSPUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol,
      host: urlObj.hostname,
      port: urlObj.port || '554',
      path: urlObj.pathname,
      username: urlObj.username || '',
      password: urlObj.password || '',
      fullUrl: url,
    };
  } catch {
    return { fullUrl: url, host: '', port: '554' };
  }
}

/* ─── Middleware ─── */
app.use(cors({ origin: [VITE_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'], credentials: false }));
app.use(express.json({ limit: '1mb' }));

/* Health check */
app.get('/api/health', (_req, res) => {
  const activeStreams = Array.from(streams.entries()).map(([id, s]) => ({
    id,
    url: s.url,
    status: s.status,
    createdAt: s.createdAt,
    lastSegment: s.lastSegment,
    pid: s.process?.pid,
  }));
  res.json({
    status: 'ok',
    ffmpeg: ffmpegAvailable,
    ffmpegPath,
    activeStreams: activeStreams.length,
    maxStreams: MAX_STREAMS,
    streams: activeStreams,
  });
});

/* Start RTSP → HLS transcoding */
app.post('/api/proxy/start', (req, res) => {
  if (!ffmpegAvailable) {
    return res.status(503).json({
      error: 'ffmpeg not available',
      message: 'Install ffmpeg: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)',
    });
  }

  if (streams.size >= MAX_STREAMS) {
    return res.status(429).json({
      error: 'Max streams reached',
      message: `Maximum ${MAX_STREAMS} simultaneous streams. Stop one first.`,
    });
  }

  const { url, options = {} } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing required field: url' });
  }

  // Check if already transcoding this URL
  for (const [, existing] of streams) {
    if (existing.url === url && existing.status === 'live') {
      return res.json({
        streamId: streams.entries().find(([, s]) => s.url === url && s.status === 'live')?.[0],
        status: 'already_running',
        message: 'Already transcoding this URL',
        hlsUrl: `/api/proxy/stream/${streams.entries().find(([, s]) => s.url === url && s.status === 'live')?.[0]}/index.m3u8`,
      });
    }
  }

  const streamId = generateStreamId();
  const streamDir = getStreamDir(streamId);

  try { mkdirSync(streamDir, { recursive: true }); } catch { /* ignore */ }

  const parsed = parseRTSPUrl(url);

  // Build ffmpeg arguments
  const resolution = options.resolution || '1280x720';
  const codec = options.codec || 'libx264';
  const audioCodec = options.audio ? 'aac' : 'none';

  const ffmpegArgs = [
    '-rtsp_transport', 'tcp',
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-strict', 'experimental',
    '-i', url,
    '-c:v', codec,
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-s', resolution,
    '-r', String(options.fps || 25),
    '-g', String(SEGMENT_DURATION * (options.fps || 25)),
    '-keyint_min', String(SEGMENT_DURATION * (options.fps || 25)),
    '-sc_threshold', '0',
    '-f', 'hls',
    '-hls_time', String(SEGMENT_DURATION),
    '-hls_list_size', String(SEGMENT_COUNT),
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', join(streamDir, 'seg_%03d.ts'),
    '-hls_segment_type', 'mpegts',
    join(streamDir, 'index.m3u8'),
  ];

  // Add audio if requested
  if (audioCodec === 'aac') {
    ffmpegArgs.splice(ffmpegArgs.indexOf('-c:v') + 2, 0,
      '-c:a', 'aac', '-ar', '44100', '-ac', '1'
    );
  } else {
    ffmpegArgs.splice(ffmpegArgs.indexOf('-c:v') + 2, 0, '-an');
  }

  console.log(`[proxy] Starting stream ${streamId}: ${url}`);
  console.log(`[proxy] ffmpeg args: ${ffmpegArgs.join(' ')}`);

  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FFREPORT: `file=${join(streamDir, 'ffmpeg.log')}` },
  });

  let stderrOutput = '';
  ffmpegProcess.stderr.on('data', (data) => {
    stderrOutput += data.toString();
    // Check for new segment creation
    if (data.toString().includes('Opening')) {
      const info = streams.get(streamId);
      if (info) info.lastSegment = new Date().toISOString();
    }
  });

  ffmpegProcess.stdout.on('data', () => {});

  ffmpegProcess.on('error', (err) => {
    console.error(`[proxy] ffmpeg error for ${streamId}:`, err.message);
    const info = streams.get(streamId);
    if (info) info.status = 'error';
  });

  ffmpegProcess.on('exit', (code, signal) => {
    console.log(`[proxy] ffmpeg exited for ${streamId}: code=${code}, signal=${signal}`);
    const info = streams.get(streamId);
    if (info && info.status === 'live') {
      info.status = 'stopped';
    }
    // Clean up after delay
    setTimeout(() => cleanStreamDir(streamId), 5000);
  });

  streams.set(streamId, {
    process: ffmpegProcess,
    url,
    status: 'starting',
    createdAt: new Date().toISOString(),
    lastSegment: null,
    pid: ffmpegProcess.pid,
    stderrOutput: '',
  });

  // Check if stream is alive after a short delay
  setTimeout(() => {
    const info = streams.get(streamId);
    if (info && info.status === 'starting') {
      // Check if index.m3u8 exists
      if (existsSync(join(streamDir, 'index.m3u8'))) {
        info.status = 'live';
      }
    }
  }, 3000);

  // Periodic health check
  const healthCheck = setInterval(() => {
    const info = streams.get(streamId);
    if (!info || info.status !== 'live') {
      clearInterval(healthCheck);
      return;
    }
    const indexPath = join(streamDir, 'index.m3u8');
    if (existsSync(indexPath)) {
      try {
        const stat = statSync(indexPath);
        const age = Date.now() - stat.mtimeMs;
        // If m3u8 hasn't been updated in 10s, stream might be dead
        if (age > 10000 && info.lastSegment) {
          info.health = 'stale';
        } else {
          info.health = 'healthy';
        }
      } catch { /* ignore */ }
    }
  }, 5000);

  res.json({
    streamId,
    status: 'starting',
    hlsUrl: `/api/proxy/stream/${streamId}/index.m3u8`,
    message: 'Transcoding started. HLS manifest will be available shortly.',
  });
});

/* Stop a transcoding stream */
app.delete('/api/proxy/stop', (req, res) => {
  const { streamId } = req.body;
  if (!streamId) {
    return res.status(400).json({ error: 'Missing required field: streamId' });
  }

  const info = streams.get(streamId);
  if (!info) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  if (info.process && !info.process.killed) {
    info.process.kill('SIGTERM');
    // Force kill after 3s if still running
    setTimeout(() => {
      if (info.process && !info.process.killed) {
        info.process.kill('SIGKILL');
      }
    }, 3000);
  }

  info.status = 'stopped';
  res.json({ status: 'stopped', streamId });
});

/* Stop all streams */
app.delete('/api/proxy/stop-all', (_req, res) => {
  for (const [id, info] of streams) {
    if (info.process && !info.process.killed) {
      info.process.kill('SIGTERM');
    }
    info.status = 'stopped';
    cleanStreamDir(id);
  }
  streams.clear();
  res.json({ status: 'all_stopped' });
});

/* Get stream status */
app.get('/api/proxy/status/:streamId', (req, res) => {
  const { streamId } = req.params;
  const info = streams.get(streamId);
  if (!info) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  const streamDir = getStreamDir(streamId);
  let segments = [];
  try {
    if (existsSync(streamDir)) {
      segments = readdirSync(streamDir)
        .filter(f => f.endsWith('.ts'))
        .map(f => {
          try {
            const stat = statSync(join(streamDir, f));
            return { name: f, size: stat.size, mtime: stat.mtime };
          } catch {
            return { name: f, size: 0, mtime: null };
          }
        })
        .sort((a, b) => (b.mtime?.getTime() ?? 0) - (a.mtime?.getTime() ?? 0));
    }
  } catch { /* ignore */ }

  res.json({
    streamId,
    status: info.status,
    health: info.health,
    url: info.url,
    pid: info.process?.pid,
    createdAt: info.createdAt,
    lastSegment: info.lastSegment,
    segmentCount: segments.length,
    totalSize: segments.reduce((sum, s) => sum + s.size, 0),
  });
});

/* Serve HLS manifest */
app.get('/api/proxy/stream/:streamId/index.m3u8', (req, res) => {
  const { streamId } = req.params;
  const info = streams.get(streamId);
  if (!info) {
    return res.status(404).send('#EXTM3U\n# Stream not found');
  }

  const indexPath = join(getStreamDir(streamId), 'index.m3u8');

  // Wait for m3u8 to be created (up to 15s after stream start)
  if (!existsSync(indexPath)) {
    if (info.status === 'starting') {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      // Return a waiting playlist
      return res.send('#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXT-X-VERSION:3\n# Stream starting...\n#EXT-X-ENDLIST');
    }
    return res.status(410).send('#EXTM3U\n# Stream ended');
  }

  try {
    const content = require('fs').readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.send(content);
  } catch {
    res.status(500).send('#EXTM3U\n# Error reading manifest');
  }
});

/* Serve HLS segments */
app.get('/api/proxy/stream/:streamId/:segment', (req, res) => {
  const { streamId, segment } = req.params;
  const info = streams.get(streamId);

  if (!info) {
    return res.status(404).send('Segment not found');
  }

  const segmentPath = join(getStreamDir(streamId), segment);

  if (!existsSync(segmentPath)) {
    return res.status(404).send('Segment not found');
  }

  try {
    const stat = statSync(segmentPath);
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=60');
    require('fs').createReadStream(segmentPath).pipe(res);
  } catch {
    res.status(500).send('Error reading segment');
  }
});

/* ─── Start Server ─── */
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     OverGlass RTSP → HLS Proxy Server     ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  Port:       ${String(PORT).padEnd(29)}║`);
  console.log(`║  ffmpeg:     ${(ffmpegAvailable ? '✅ Available' : '❌ NOT FOUND').padEnd(29)}║`);
  console.log(`║  Max streams: ${String(MAX_STREAMS).padEnd(28)}║`);
  console.log(`║  Stream dir:  ${STREAM_DIR.substring(0, 29).padEnd(29)}║`);
  console.log(`║  Vite origin: ${VITE_ORIGIN.substring(0, 29).padEnd(29)}║`);
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});

/* Graceful shutdown */
process.on('SIGTERM', () => {
  console.log('[proxy] SIGTERM received, stopping all streams...');
  for (const [, info] of streams) {
    if (info.process && !info.process.killed) {
      info.process.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGINT', () => {
  console.log('[proxy] SIGINT received, stopping all streams...');
  for (const [, info] of streams) {
    if (info.process && !info.process.killed) {
      info.process.kill('SIGTERM');
    }
  }
  // Clean up stream dirs
  for (const [id] of streams) {
    cleanStreamDir(id);
  }
  setTimeout(() => process.exit(0), 1000);
});
