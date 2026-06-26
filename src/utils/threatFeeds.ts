/* ─── Threat Feed Fetcher ─── */
import type { ThreatIndicator } from '../types';

/* URLhaus — free, no API key needed */
export async function fetchURLhaus(): Promise<ThreatIndicator[]> {
  try {
    const res = await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/', {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const urls: unknown[] = data.urls ?? [];
    return urls.slice(0, 50).map((u: unknown) => {
      const item = u as Record<string, unknown>;
      const threatStr = (item.threat as string) ?? 'unknown';
      let type: ThreatIndicator['type'] = 'other';
      if (threatStr.includes('malware')) type = 'malware';
      else if (threatStr.includes('phishing')) type = 'phishing';
      else if (threatStr.includes('c2') || threatStr.includes('command')) type = 'c2';
      else if (threatStr.includes('ransomware')) type = 'ransomware';
      else if (threatStr.includes('botnet')) type = 'botnet';
      else if (threatStr.includes('spam')) type = 'spam';
      else if (threatStr.includes('exploit')) type = 'exploit';
      else type = 'suspicious';

      return {
        id: `urlhaus-${item.id ?? Math.random().toString(36).slice(2)}`,
        type,
        source: 'URLhaus',
        url: (item.url as string) ?? '',
        host: extractHost((item.url as string) ?? ''),
        threat: threatStr,
        date: (item.date_added as string) ?? '',
        description: (item.threat as string) ?? '',
        tags: [(item.threat_tags as string[]) ?? []].flat().slice(0, 3),
        severity: type === 'malware' || type === 'ransomware' || type === 'c2' ? 'critical' as const :
          type === 'phishing' || type === 'exploit' ? 'high' as const :
          type === 'botnet' ? 'medium' as const : 'low' as const,
      };
    });
  } catch {
    return [];
  }
}

/* Shodan InternetDB — free IP reputation API */
export async function fetchShodanIP(ip: string): Promise<ThreatIndicator[]> {
  try {
    const res = await fetch(`https://internetdb.shodan.io/${ip}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const vulns: string[] = data.vulns ?? [];
    if (vulns.length === 0) return [];

    return [{
      id: `shodan-${ip}`,
      type: 'exploit',
      source: 'Shodan InternetDB',
      url: `https://${ip}`,
      host: ip,
      threat: `${vulns.length} known vulnerabilities`,
      date: new Date().toISOString(),
      description: `Open ports: ${(data.ports ?? []).join(', ')}. Vulns: ${vulns.slice(0, 5).join(', ')}`,
      tags: vulns.slice(0, 5),
      severity: vulns.length > 10 ? 'critical' : vulns.length > 3 ? 'high' : 'medium',
    }];
  } catch {
    return [];
  }
}

/* CISA KEV — Known Exploited Vulnerabilities (cached JSON) */
let kevCache: ThreatIndicator[] | null = null;
export async function fetchCISAKEV(): Promise<ThreatIndicator[]> {
  if (kevCache) return kevCache;
  try {
    const res = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const vulns: unknown[] = data.vulnerabilities ?? [];
    kevCache = vulns.slice(0, 30).map((v: unknown) => {
      const item = v as Record<string, unknown>;
      return {
        id: `kev-${item.cveID ?? Math.random().toString(36).slice(2)}`,
        type: 'exploit',
        source: 'CISA KEV',
        url: (item.reference ?? '') as string,
        host: '',
        threat: (item.cveID ?? '') as string,
        date: (item.dateAdded ?? '') as string,
        description: `${(item.product ?? '')} ${(item.vendorProject ?? '')} — ${(item.vulnerabilityName ?? '')}`,
        tags: [(item.cveID ?? '') as string],
        severity: ((item.severity ?? 'medium') as string) as ThreatIndicator['severity'],
      };
    });
    return kevCache;
  } catch {
    return [];
  }
}

/* Cross-reference threats with monitored connectors */
export function correlateWithConnectors(
  threats: ThreatIndicator[],
  connectors: { url?: string; id: string; name: string }[]
): { threat: ThreatIndicator; connectorId: string; connectorName: string }[] {
  const matches: { threat: ThreatIndicator; connectorId: string; connectorName: string }[] = [];
  for (const threat of threats) {
    if (!threat.host) continue;
    for (const c of connectors) {
      const connUrl = c.url ?? '';
      if (connUrl.includes(threat.host) || connUrl === threat.url) {
        matches.push({ threat, connectorId: c.id, connectorName: c.name });
      }
    }
  }
  return matches;
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
