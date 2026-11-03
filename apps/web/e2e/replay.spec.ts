import { expect, test } from '@playwright/test';

// A bare style keeps the map off the network: the tests need the controls, not the tiles.
const BLANK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e5e7eb' } }],
};

test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({ json: BLANK_STYLE }),
  );
});

test('Replay opens on the latest hour with data, and play advances the clock', async ({ page }) => {
  await page.goto('/en/replay');

  // The last full hour is empty, so it lands on the one before: its start label is shown.
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  start.setUTCHours(start.getUTCHours() - 2);
  const label = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
  }).format(start);
  const panel = page.getByRole('region', { name: 'Replay controls' });
  await expect(panel.getByText(label, { exact: true }).first()).toBeVisible();
  await expect(panel.getByText('No positions saved')).toHaveCount(0);

  const clock = panel.locator('span[aria-hidden="true"].tabular-nums');
  const before = await clock.textContent();
  await panel.getByRole('button', { name: 'Play' }).click();
  await expect(clock).not.toHaveText(before ?? '');
});
