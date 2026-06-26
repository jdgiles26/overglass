/* ─── Network Scanner ─── */
import type { DiscoveredDevice } from '../types';

const COMMON_PORTS = [80, 443, 8080, 8443, 3000, 554, 8080];

function guessDeviceType(hostname: string, openPorts: number[]): DiscoveredDevice['deviceType'] {
  const h = hostname.toLowerCase();
  const portSet = new Set(openPorts);

  if (h.includes('router') || h.includes('gateway') || h.includes('asus') || h.includes('netgear') || h.includes('tplink') || h.includes('dlink')) return 'router';
  if (h.includes('camera') || h.includes('cam') || h.includes('dahua') || h.includes('hikvision') || portSet.has(554)) return 'camera';
  if (h.includes('nas') || h.includes('synology') || h.includes('qnap')) return 'server';
  if (portSet.has(3000) || portSet.has(8080) || portSet.has(8443)) return 'server';
  if (h.includes('printer') || h.includes('hp-') || h.includes('brother')) return 'iot';
  if (h.includes('phone') || h.includes('iphone') || h.includes('android')) return 'phone';
  if (h.includes('desktop') || h.includes('macbook') || h.includes('laptop') || h.includes('pc-')) return 'computer';
  return 'unknown';
}

function extractHostname(headers: Headers): string {
  const server = headers.get('server') ?? '';
  const powered = headers.get('x-powered-by') ?? '';
  const title = headers.get('title') ?? '';
  return server || powered || title || '';
}

/* Probe a single IP:port combination */
export async function probePort(ip: string, port: number): Promise<{ open: boolean; headers?: Record<string, string> }> {
  const protocol = port === 443 ? 'https' : 'http';
  const url = `${protocol}://${ip}:${port}`;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: AbortSignal.timeout(2000),
    });
    // With no-cors, we get an opaque response
    // But if it doesn't throw, the port is likely open
    if (res.type === 'opaque') {
      return { open: true };
    }
    const hdrs: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      hdrs[key] = value;
    });
    return { open: true, headers: hdrs };
  } catch {
    return { open: false };
  }
}

/* Parse subnet string like "192.168.1.0/24" */
function parseSubnet(subnet: string): { base: string; start: number; end: number } | null {
  const match = subnet.match(/^(\d+\.\d+\.\d+)\.(\d+)\/(\d+)$/);
  if (!match) return null;

  const prefix = match[1];
  const startIp = parseInt(match[2]);
  const cidr = parseInt(match[3]);

  if (cidr < 24 || cidr > 32) return null;

  const hostBits = 32 - cidr;
  const count = Math.pow(2, hostBits);
  const baseNum = (startIp & ~((count - 1)));
  return { base: prefix, start: baseNum, end: baseNum + Math.min(count - 1, 254) };
}

/* Scan a subnet for devices */
export async function scanSubnet(
  subnet: string,
  onProgress?: (current: number, total: number, ip: string) => void,
): Promise<DiscoveredDevice[]> {
  const parsed = parseSubnet(subnet);
  if (!parsed) return [];

  const devices: DiscoveredDevice[] = [];

  // Scan in batches of 10 to avoid overwhelming the network
  const batchSize = 10;
  for (let i = parsed.start; i <= parsed.end; i += batchSize) {
    const batch: Promise<void>[] = [];
    for (let j = i; j < Math.min(i + batchSize, parsed.end + 1); j++) {
      const ip = `${parsed.base}.${j}`;
      onProgress?.(j - parsed.start, parsed.end - parsed.start + 1, ip);

      batch.push((async () => {
        // Probe port 80 first (fastest indicator)
        const result = await probePort(ip, 80);
        if (!result.open) return;

        // Probe additional common ports
        const openPorts = [80];
        const additionalPorts = [443, 8080, 8443, 3000, 554];
        const portResults = await Promise.all(
          additionalPorts.map(p => probePort(ip, p))
        );
        portResults.forEach((pr, idx) => {
          if (pr.open) openPorts.push(additionalPorts[idx]);
        });

        const hostname = result.headers ? Object.values(result.headers).join(' ') : '';
        const deviceType = guessDeviceType(hostname, openPorts);

        devices.push({
          id: `device-${ip.replace(/\./g, '-')}`,
          ip,
          hostname: hostname || ip,
          lastSeen: new Date().toISOString(),
          openPorts: [...new Set(openPorts)],
          deviceType,
          headers: result.headers,
          firstSeen: new Date().toISOString(),
          status: 'online',
        });
      })());
    }

    await Promise.all(batch);
    // Small delay between batches
    await new Promise(r => setTimeout(r, 100));
  }

  return devices;
}
