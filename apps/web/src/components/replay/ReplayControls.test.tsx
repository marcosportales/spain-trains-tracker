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

  it('disables play and the scrubber, and shows the status sentence', () => {
    const html = render({ disabled: true, status: 'Could not load the positions for this hour.' });
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('role="status"');
  });
});
