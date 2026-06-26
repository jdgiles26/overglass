/* ─── Screenshot Capture & Change Detection ─── */
import type { ScreenshotRecord } from '../types';

/* Simple hash function for DOM content */
export async function computeDOMHash(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(10000) });
    // no-cors gives opaque response; we can't read body
    // Use a simple hash of the URL + timestamp as a proxy for change detection
    // Real change detection requires a server-side proxy
    return hashString(url + '-' + res.status);
  } catch {
    return hashString(url + '-error-' + Date.now());
  }
}

/* Generate thumbnail URL via thum.io (free, no key needed) */
export function getThumbnailUrl(url: string, width = 1280): string {
  return `https://image.thum.io/get/width/${width}/${encodeURIComponent(url)}`;
}

/* Capture screenshot via thum.io as an image */
export async function captureScreenshot(
  connectorId: string,
  connectorName: string,
  url: string,
  prevHash: string | undefined,
): Promise<{ record: ScreenshotRecord; changed: boolean } | null> {
  try {
    const newHash = await computeDOMHash(url);
    const changed = prevHash !== undefined && prevHash !== newHash;

    // Use thum.io thumbnail as base64
    const thumbUrl = getThumbnailUrl(url);
    const thumbnail = thumbUrl; // Store URL reference instead of base64 to save localStorage space

    const record: ScreenshotRecord = {
      id: `ss-${connectorId}-${Date.now()}`,
      connectorId,
      connectorName,
      url,
      timestamp: new Date().toISOString(),
      thumbnail,
      domHash: newHash,
      width: 1280,
      height: 800,
      changed,
    };

    return { record, changed };
  } catch {
    return null;
  }
}

/* Get stored screenshots for a connector */
export function getConnectorScreenshots(connectorId: string): ScreenshotRecord[] {
  try {
    const raw = localStorage.getItem('overglass-screenshots');
    if (!raw) return [];
    const all: ScreenshotRecord[] = JSON.parse(raw);
    return all.filter(s => s.connectorId === connectorId);
  } catch {
    return [];
  }
}

/* Save screenshots, keeping only last 10 per connector */
export function saveScreenshot(record: ScreenshotRecord): ScreenshotRecord[] {
  try {
    const raw = localStorage.getItem('overglass-screenshots');
    const all: ScreenshotRecord[] = raw ? JSON.parse(raw) : [];
    all.push(record);

    // Keep only last 10 per connector
    const counts = new Map<string, number>();
    const filtered: ScreenshotRecord[] = [];
    for (let i = all.length - 1; i >= 0; i--) {
      const cId = all[i].connectorId;
      const count = counts.get(cId) ?? 0;
      if (count < 10) {
        filtered.unshift(all[i]);
        counts.set(cId, count + 1);
      }
    }

    localStorage.setItem('overglass-screenshots', JSON.stringify(filtered));
    return filtered.filter(s => s.connectorId === record.connectorId);
  } catch {
    return [];
  }
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
