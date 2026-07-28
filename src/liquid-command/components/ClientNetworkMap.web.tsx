import { useMemo, type CSSProperties } from 'react';
import type { ClientListItem } from '@/types/modules/office';

export type ClientNetworkMapProps = {
  clients: ClientListItem[];
  tenantId?: string | null;
  height?: number;
  onClientSelect?: (clientId: string) => void;
};

type NetworkNode = {
  client: ClientListItem;
  x: number;
  y: number;
  kind: 'home' | 'person';
};

const NODE_POSITIONS = [
  [174, 70],
  [265, 118],
  [355, 95],
  [438, 138],
  [524, 104],
  [612, 148],
  [708, 117],
  [768, 178],
  [664, 224],
  [556, 198],
  [454, 244],
  [336, 210],
  [236, 248],
  [124, 204],
] as const;

const ROAD_PATHS = [
  'M-40 76 C130 46 224 98 354 62 S650 27 940 72',
  'M-30 236 C142 192 235 258 396 216 S698 158 940 210',
  'M90 -20 C126 68 88 142 160 340',
  'M258 -20 C286 82 236 164 304 340',
  'M454 -20 C420 90 505 148 474 340',
  'M690 -20 C612 90 736 180 710 340',
  'M830 -20 C784 96 852 192 802 340',
  'M-20 154 C164 114 278 174 420 146 S716 92 930 138',
  'M16 294 C202 256 330 310 494 270 S728 226 924 252',
] as const;

const BLOCK_PATHS = [
  'M26 18h112l-18 48H12z',
  'M156 8h108l18 64-120 12z',
  'M300 18h126l-20 72-104-10z',
  'M448 4h144l-34 74-126 4z',
  'M618 12h112l32 64-148 8z',
  'M772 4h112l-2 76-124-12z',
  'M14 94h126l14 62-144 16z',
  'M170 92h118l-18 74-126-8z',
  'M312 98h108l30 64-148 14z',
  'M470 92h124l12 70-142 12z',
  'M632 94h118l-20 72-126 8z',
  'M770 92h126l12 68-146 12z',
  'M20 184h122l-24 82-116-14z',
  'M160 186h132l18 76-154 2z',
  'M330 186h112l-18 82-118-6z',
  'M468 188h132l16 78-154 0z',
  'M640 184h112l-12 82-126-8z',
  'M778 184h116l18 76-144 8z',
] as const;

function networkNodes(clients: ClientListItem[]): NetworkNode[] {
  return clients.map((client, index) => {
    const [x, y] = NODE_POSITIONS[index % NODE_POSITIONS.length];
    const lap = Math.floor(index / NODE_POSITIONS.length);
    return {
      client,
      x: Math.min(852, x + lap * 14),
      y: Math.min(286, y + lap * 12),
      kind: index % 3 === 0 ? 'home' : 'person',
    };
  });
}

function PersonGlyph() {
  return (
    <>
      <circle cx="0" cy="-3.5" r="2.6" fill="currentColor" />
      <path d="M-4.2 5.4c.5-4 2-6 4.2-6s3.7 2 4.2 6z" fill="currentColor" />
    </>
  );
}

function HomeGlyph() {
  return (
    <>
      <path d="M-5 0 0-4.7 5 0v6h-10z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M-1.4 6V2.2h2.8V6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  );
}

function MapToolIcon({
  kind,
}: {
  kind: 'layers' | 'locate' | 'plus' | 'minus' | 'navigate';
}) {
  const path = {
    layers: 'M4 7.5 12 3l8 4.5-8 4.5-8-4.5Zm0 4L12 16l8-4.5M4 15.5 12 20l8-4.5',
    locate: 'M12 5.25A6.75 6.75 0 1 0 18.75 12 6.76 6.76 0 0 0 12 5.25Zm0-3v3m0 13.5v3m6.75-9.75h3M2.25 12h3',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    navigate: 'm4 5 16-2-7 18-2.5-7.5L4 5Z',
  }[kind];
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20">
      <path
        d={path}
        fill={kind === 'navigate' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ClientNetworkMap({
  clients,
  height = 346,
  onClientSelect,
}: ClientNetworkMapProps) {
  const nodes = useMemo(() => networkNodes(clients), [clients]);

  return (
    <div
      aria-label={`Stilisiertes Versorgungsnetz mit ${clients.length} Klientinnen und Klienten`}
      style={{ ...styles.stage, height }}
    >
      <svg
        aria-hidden="true"
        preserveAspectRatio="none"
        style={styles.svg}
        viewBox="0 0 900 320"
      >
        <defs>
          <linearGradient id="healthos-map-base" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#06172f" />
            <stop offset=".48" stopColor="#04142b" />
            <stop offset="1" stopColor="#020b1a" />
          </linearGradient>
          <radialGradient id="healthos-map-focus" cx=".56" cy=".54" r=".62">
            <stop offset="0" stopColor="#0d4d93" stopOpacity=".34" />
            <stop offset=".56" stopColor="#082856" stopOpacity=".16" />
            <stop offset="1" stopColor="#020a18" stopOpacity="0" />
          </radialGradient>
          <pattern id="healthos-map-grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M34 0H0V34" fill="none" stroke="#2e71b8" strokeOpacity=".09" strokeWidth=".7" />
          </pattern>
          <filter id="healthos-node-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="900" height="320" fill="url(#healthos-map-base)" />
        <rect width="900" height="320" fill="url(#healthos-map-grid)" />
        <rect width="900" height="320" fill="url(#healthos-map-focus)" />
        <g fill="#0a2850" fillOpacity=".32" stroke="#2264a5" strokeOpacity=".13" strokeWidth=".8">
          {BLOCK_PATHS.map((path) => <path key={path} d={path} />)}
        </g>
        <g fill="none" strokeLinecap="round">
          {ROAD_PATHS.map((path, index) => (
            <g key={path}>
              <path d={path} stroke="#071226" strokeWidth={index < 2 ? 13 : 8} />
              <path d={path} stroke="#174b84" strokeOpacity=".36" strokeWidth={index < 2 ? 3.2 : 2.2} />
              <path d={path} stroke="#4a8bc9" strokeOpacity=".13" strokeWidth=".8" />
            </g>
          ))}
        </g>
        {nodes.map(({ client, x, y, kind }, index) => (
          <g
            key={client.id}
            aria-label={`${client.firstName} ${client.lastName}`}
            onClick={() => onClientSelect?.(client.id)}
            role="button"
            style={{ cursor: 'pointer', color: '#eaf5ff' }}
            tabIndex={0}
          >
            <circle
              cx={x}
              cy={y}
              fill="none"
              r="13"
              stroke="#2392ff"
              strokeOpacity=".7"
              strokeWidth="2"
            >
              <animate
                attributeName="r"
                begin={`${(index % 8) * 0.18}s`}
                dur="2.15s"
                repeatCount="indefinite"
                values="13;29"
              />
              <animate
                attributeName="stroke-opacity"
                begin={`${(index % 8) * 0.18}s`}
                dur="2.15s"
                repeatCount="indefinite"
                values=".68;0"
              />
            </circle>
            <circle
              cx={x}
              cy={y}
              fill="#0a2b57"
              filter="url(#healthos-node-glow)"
              r="14"
              stroke="#2f96ff"
              strokeWidth="1.4"
            />
            <circle cx={x} cy={y} fill="#0f6fd2" fillOpacity=".45" r="9.5" />
            <g transform={`translate(${x} ${y})`}>
              {kind === 'home' ? <HomeGlyph /> : <PersonGlyph />}
            </g>
          </g>
        ))}
      </svg>

      <div aria-hidden="true" style={styles.leftTools}>
        <div style={{ ...styles.toolButton, ...styles.toolButtonActive }}>
          <MapToolIcon kind="layers" />
        </div>
        <div style={styles.toolButton}>
          <MapToolIcon kind="locate" />
        </div>
      </div>
      <div aria-hidden="true" style={styles.rightTools}>
        <div style={styles.toolButton}><MapToolIcon kind="plus" /></div>
        <div style={styles.toolButton}><MapToolIcon kind="minus" /></div>
        <div style={{ ...styles.toolButton, color: '#86c4ff' }}>
          <MapToolIcon kind="navigate" />
        </div>
      </div>

      {!clients.length ? (
        <div style={styles.empty}>
          <strong style={styles.emptyTitle}>Keine Klient:innen im aktuellen Mandantenkontext</strong>
          <span style={styles.emptyDetail}>Neue Stammdaten erscheinen hier automatisch.</span>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  stage: {
    position: 'relative',
    width: '100%',
    minHeight: 250,
    overflow: 'hidden',
    borderRadius: 11,
    border: '1px solid rgba(112,181,255,.32)',
    background: '#020b1a',
    boxShadow: 'inset 0 0 46px rgba(0,0,0,.42), 0 0 26px rgba(22,131,255,.1)',
  },
  svg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  leftTools: {
    position: 'absolute',
    left: 14,
    top: 14,
    display: 'grid',
    overflow: 'hidden',
    border: '1px solid rgba(112,181,255,.26)',
    borderRadius: 11,
    background: 'rgba(3,16,35,.9)',
    boxShadow: '0 12px 28px rgba(0,0,0,.25)',
  },
  rightTools: {
    position: 'absolute',
    right: 15,
    bottom: 15,
    display: 'grid',
    overflow: 'hidden',
    border: '1px solid rgba(112,181,255,.26)',
    borderRadius: 11,
    background: 'rgba(3,16,35,.92)',
    boxShadow: '0 12px 28px rgba(0,0,0,.25)',
  },
  toolButton: {
    width: 38,
    height: 38,
    display: 'grid',
    placeItems: 'center',
    color: 'rgba(255,255,255,.86)',
    borderBottom: '1px solid rgba(255,255,255,.08)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 20,
    lineHeight: 1,
  },
  toolButtonActive: {
    color: '#78bcff',
    background: 'rgba(22,131,255,.16)',
  },
  empty: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeContent: 'center',
    gap: 6,
    padding: 28,
    color: '#fff',
    textAlign: 'center',
    background: 'rgba(2,11,26,.7)',
  },
  emptyTitle: {
    fontSize: 15,
  },
  emptyDetail: {
    color: 'rgba(255,255,255,.58)',
    fontSize: 12,
  },
};
