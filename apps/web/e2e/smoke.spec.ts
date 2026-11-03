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
  const panel = page.getByRole('complementary', { name: `Train ${RUN.trainNumber}` });
  await expect(panel.getByTestId('run-headline')).toHaveText(
    'Running 5 min late · next stop Sevilla-Santa Justa, 11:45',
  );
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

test('the nav marks the current page', async ({ page }) => {
  await page.goto('/en');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Map' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Replay' })).not.toHaveAttribute('aria-current');

  await nav.getByRole('link', { name: 'Replay' }).click();
  await expect(page).toHaveURL(/\/en\/replay$/);
  await expect(nav.getByRole('link', { name: 'Replay' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Map' })).not.toHaveAttribute('aria-current');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the bar fits, and the search expands and collapses', async ({ page }) => {
    await page.goto('/en');
    const fits = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    expect(await fits()).toBe(true);
    await expect(page.getByRole('combobox', { name: 'Search' })).toBeHidden();

    await page.getByRole('button', { name: 'Open search' }).click();
    const search = page.getByRole('combobox', { name: 'Search' });
    await expect(search).toBeFocused();
    expect(await fits()).toBe(true);

    await page.keyboard.press('Escape');
    await expect(search).toBeHidden();
    await page.getByRole('button', { name: 'Open search' }).click();
    await page.getByRole('button', { name: 'Close search' }).click();
    await expect(search).toBeHidden();
  });

  test('the menu holds the nav', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'Replay' }).click();
    await expect(page).toHaveURL(/\/en\/replay$/);
    await expect(page.getByRole('link', { name: 'Replay' })).toBeHidden();
  });
});
