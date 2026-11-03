import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import messages from '../../../messages/en.json';
import { ReplayControls } from './ReplayControls';

const render = (props: Partial<Parameters<typeof ReplayControls>[0]> = {}) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReplayControls
        playing={false}
        onTogglePlay={() => {}}
        position={1_800_000}
        onScrub={() => {}}
        clock="10:30:00"
        clockText="3 Nov 2026, 10:30:00"
        startLabel="10:00"
        endLabel="11:00"
        disabled={false}
        speed={60}
        onSpeed={() => {}}
        pickerValue="2026-11-03T10:00"
        pickerMax="2026-11-03T12:00"
        onPick={() => {}}
        runCount={3}
        {...props}
      />
    </NextIntlClientProvider>,
  );

describe('ReplayControls', () => {
  it('explains the page, shows the window bounds and the train count', () => {
    const html = render();
    expect(html).toContain('Watch how trains moved during a past hour.');
    expect(html).toContain('10:00');
    expect(html).toContain('11:00');
    expect(html).toContain('3 trains');
  });

  it('labels the play button by its action and swaps it while playing', () => {
    expect(render()).toContain('aria-label="Play"');
    expect(render({ playing: true })).toContain('aria-label="Pause"');
  });

  it('offers the four speeds as a radio group with the current one checked', () => {
    const html = render();
    expect(html.match(/role="radio"/g)).toHaveLength(4);
    expect(html).toContain('600×');
  });

  it('shows skeletons instead of the controls while loading, keeping the explanation', () => {
    const html = render({ view: 'loading', disabled: true });
    expect(html).toContain('Watch how trains moved');
    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('type="range"');
  });

  it('offers an earlier hour when a picked hour is empty', () => {
    const html = render({ view: 'empty', disabled: true, onEarlier: () => {} });
    expect(html).toContain('No positions saved for this hour.');
    expect(html).toContain('Try an hour earlier');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('says what failed and offers a retry', () => {
    const html = render({ view: 'error', disabled: true, onRetry: () => {} });
    expect(html).toContain('Could not load the positions for this hour.');
    expect(html).toContain('Retry');
  });

  it('says there is no recent data, with the picker still enabled', () => {
    const html = render({ view: 'none', hours: 6, disabled: true });
    expect(html).toContain('No positions in the last 6 hours.');
    expect(html).toContain('type="datetime-local"');
  });
});
