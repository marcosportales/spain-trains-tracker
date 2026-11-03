import type { StationBoardEntry } from '@stt/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { BoardTable } from './BoardTable';

const entry = (over: Partial<StationBoardEntry> = {}): StationBoardEntry => ({
  trainNumber: '03063',
  serviceDate: '2026-10-31',
  serviceType: 'ave',
  counterpartStationCode: '71801',
  scheduledAt: '2026-10-31T09:00:00Z',
  ...over,
});

const render = (entries: StationBoardEntry[], tab: 'departures' | 'arrivals' = 'departures') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <BoardTable entries={entries} tab={tab} names={() => 'Barcelona'} />
    </NextIntlClientProvider>,
  );

describe('BoardTable', () => {
  it('strikes the scheduled time of a delayed row and shows the new one', () => {
    const html = render([
      entry({ estimatedAt: '2026-10-31T09:10:00Z', delaySeconds: 600, serviceStatus: 'scheduled' }),
    ]);
    expect(html).toMatch(/<s[^>]*>10:00<\/s>/);
    expect(html).toContain('10:10');
  });

  it('does not strike an on-time row', () => {
    expect(render([entry()])).not.toContain('<s>');
  });

  it('reads Origin on arrivals and Destination on departures', () => {
    expect(render([entry()], 'arrivals')).toContain('>Origin<');
    expect(render([entry()])).toContain('>Destination<');
  });

  it('has exactly one link per row, the train cell, and the line chip', () => {
    const html = render([entry({ lineCode: 'C1' }), entry({ trainNumber: '03064' })]);
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('Train 03063');
    expect(html).toContain('>C1<');
  });

  it('titles the truncated station name', () => {
    expect(render([entry()])).toContain('title="Barcelona"');
  });
});
