import { expect, test } from '@playwright/test';
import { RUN, STATION_NAME } from './fixtures.js';

// A bare style keeps the map off the network: the tests need the Run layer, not the tiles.
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

test('map shows a live Run, its panel, and a searched Station board', async ({ page }) => {
  await page.goto('/en');

  // The map loads, and the Run from the stream is drawn at the initial map centre.
  const map = page.getByRole('region', { name: 'Map of live trains in Spain' });
  await expect(map.locator('canvas')).toBeVisible();
  await expect(async () => {
    await map.hover();
    await expect(map.locator('canvas')).toHaveCSS('cursor', 'pointer');
  }).toPass();

  // Selecting the Run opens its detail panel.
  await map.click();
  await expect(page).toHaveURL(new RegExp(`/runs/${RUN.serviceDate}/${RUN.trainNumber}`));
  const panel = page.getByRole('complementary', { name: `Run ${RUN.trainNumber}` });
  await expect(panel.getByRole('heading', { name: new RegExp(RUN.trainNumber) })).toBeVisible();
  await expect(panel.getByTestId('delay-badge')).toHaveText('5 min late');

  // Search a Station and open its board.
  await page.getByRole('combobox', { name: 'Search' }).fill('atocha');
  await page.getByRole('option', { name: STATION_NAME }).click();
  await expect(page.getByRole('heading', { name: STATION_NAME })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Departures' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('link', { name: new RegExp(RUN.trainNumber) })).toBeVisible();
});

test('alerts chip lists an alert and highlights its Lines when tapped', async ({ page }) => {
  await page.goto('/en');

  await page.getByRole('button', { name: '1 alert' }).click();
  const item = page.getByRole('button', { name: /Affects C1 and C5/ });
  await expect(item).toHaveAttribute('aria-pressed', 'false');
  await item.click();
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await item.click();
  await expect(item).toHaveAttribute('aria-pressed', 'false');
});

test('an over-filtered map says so, and clearing the filters brings the Run back', async ({
  page,
}) => {
  await page.goto('/en?line=NOPE');

  const map = page.getByRole('region', { name: 'Map of live trains in Spain' });
  await expect(page.getByText('No trains match the filters')).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page.getByText('No trains match the filters')).toBeHidden();
  await expect(async () => {
    await map.hover();
    await expect(map.locator('canvas')).toHaveCSS('cursor', 'pointer');
  }).toPass();
});
