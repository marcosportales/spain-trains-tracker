import { ImageResponse } from 'next/og';
import { SERVICE_TYPE_COLORS } from '../map/live/live-runs';
import type { DelayBadge } from '../run/run-detail-view';
import { OG_SIZE, type RunOgContent, type StationOgContent } from './og-content';

const BADGE_COLORS: Record<DelayBadge, { bg: string; fg: string }> = {
  on_time: { bg: '#dcfce7', fg: '#166534' },
  minor: { bg: '#fef3c7', fg: '#92400e' },
  major: { bg: '#fee2e2', fg: '#991b1b' },
  cancelled: { bg: '#1f2937', fg: '#ffffff' },
  unknown: { bg: '#f3f4f6', fg: '#374151' },
};

const frame = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  padding: 64,
  background: '#ffffff',
  color: '#111827',
  fontFamily: 'sans-serif',
} as const;

function Badge({ badge, text, size }: { badge: DelayBadge; text: string; size: number }) {
  const { bg, fg } = BADGE_COLORS[badge];
  return (
    <div
      style={{
        display: 'flex',
        background: bg,
        color: fg,
        fontSize: size,
        fontWeight: 600,
        padding: `${size / 4}px ${size / 1.5}px`,
        borderRadius: 999,
      }}
    >
      {text}
    </div>
  );
}

function Brand({ name }: { name: string }) {
  return <div style={{ display: 'flex', fontSize: 28, color: '#6b7280' }}>{name}</div>;
}

export type RunOgLabels = {
  appName: string;
  serviceType: string;
  badge: string;
};

export function runOgImage(content: RunOgContent, labels: RunOgLabels): ImageResponse {
  return new ImageResponse(
    <div style={{ ...frame, justifyContent: 'space-between' }}>
      <Brand name={labels.appName} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 40 }}>
          <div
            style={{
              display: 'flex',
              width: 36,
              height: 36,
              borderRadius: 999,
              marginRight: 20,
              background: SERVICE_TYPE_COLORS[content.serviceType],
            }}
          />
          {labels.serviceType}
        </div>
        <div style={{ display: 'flex', fontSize: 168, fontWeight: 700 }}>{content.trainNumber}</div>
        {content.lineCode && (
          <div style={{ display: 'flex', fontSize: 48, color: '#4b5563' }}>{content.lineCode}</div>
        )}
      </div>
      <div style={{ display: 'flex' }}>
        <Badge badge={content.badge} text={labels.badge} size={44} />
      </div>
    </div>,
    OG_SIZE,
  );
}

export type StationOgLabels = {
  appName: string;
  heading: string;
  empty: string;
  /** Localised delay badge text for each departure, in order. */
  badges: string[];
};

export function stationOgImage(content: StationOgContent, labels: StationOgLabels): ImageResponse {
  return new ImageResponse(
    <div style={frame}>
      <Brand name={labels.appName} />
      <div style={{ display: 'flex', fontSize: 80, fontWeight: 700, marginTop: 24 }}>
        {content.stationName}
      </div>
      <div style={{ display: 'flex', fontSize: 36, color: '#4b5563', marginBottom: 32 }}>
        {labels.heading}
      </div>
      {content.departures.length === 0 && (
        <div style={{ display: 'flex', fontSize: 40, color: '#6b7280' }}>{labels.empty}</div>
      )}
      {content.departures.map((d, i) => (
        <div
          key={`${d.trainNumber}-${d.time}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 44,
            padding: '12px 0',
            borderTop: '2px solid #e5e7eb',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                width: 28,
                height: 28,
                borderRadius: 999,
                marginRight: 16,
                background: SERVICE_TYPE_COLORS[d.serviceType],
              }}
            />
            <div style={{ display: 'flex', fontWeight: 700, marginRight: 24 }}>{d.time}</div>
            <div style={{ display: 'flex' }}>
              {d.trainNumber}
              {d.lineCode ? ` · ${d.lineCode}` : ''}
            </div>
          </div>
          <Badge badge={d.badge} text={labels.badges[i] ?? ''} size={32} />
        </div>
      ))}
    </div>,
    OG_SIZE,
  );
}
