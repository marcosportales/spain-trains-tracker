import { expect, test } from '@playwright/test';
import { PUNCTUALITY_LINE, RUN, SERVICE_DATE, STATION_NAME } from './fixtures.js';

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
  // Runs come first, with the Service type for screen readers and the route on the right.
  const options = page.getByRole('option');
  await expect(options.first()).toContainText('AVE, Run 03063');
  await expect(options.first()).toContainText('Madrid Atocha → Sevilla-Santa Justa');
  await expect(options.nth(1)).toHaveText(STATION_NAME);
  await page.getByRole('option', { name: STATION_NAME }).click();
  await expect(page.getByRole('heading', { name: STATION_NAME })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Departures' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('link', { name: new RegExp(RUN.trainNumber) })).toBeVisible();
});

test.describe('search suggestions', () => {
  test('focusing the empty bar offers delayed Runs and the main Stations, with the keyboard', async ({
    page,
  }) => {
    await page.goto('/en');
    const search = page.getByRole('combobox', { name: 'Search' });
    await search.focus();

    const options = page.getByRole('option');
    await expect(options).toHaveCount(5);
    await expect(options.first()).toContainText('Run 03063');
    await expect(options.nth(1)).toHaveText('Madrid Atocha');
    await expect(options.nth(4)).toHaveText('Sevilla-Santa Justa');

    // Typing 2+ characters replaces them with matches.
    await search.fill('atocha');
    await expect(options.nth(1)).toHaveText(STATION_NAME);
    await search.clear();
    await expect(options).toHaveCount(5);

    await search.press('ArrowDown');
    await search.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/stations\/60000$/);
  });

  test('shows a loading state, and the Stations alone when the Runs fail', async ({ page }) => {
    await page.route('**/search/suggestions', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 500, body: '{}' });
    });
    await page.goto('/en');
    await page.getByRole('combobox', { name: 'Search' }).focus();

    await expect(page.getByText('Loading trains…', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(4);
    await expect(page.getByText('Loading trains…', { exact: true }).first()).toBeHidden();
    await expect(page.getByText(/unavailable/)).toBeHidden();
  });
});

test.describe('search recents', () => {
  const STORE_KEY = 'stt.search.recents';
  const staleRun = {
    kind: 'run',
    id: 'run:2026-10-01:99999',
    hit: { trainNumber: '99999', serviceDate: '2026-10-01', serviceType: 'ave' },
  };

  test.beforeEach(async ({ page }) => {
    // The mock API is pinned to SERVICE_DATE, so pin "today" to it too.
    await page.clock.setFixedTime(new Date(`${SERVICE_DATE}T10:00:00+01:00`));
  });

  test('remember picks: add, dedupe, cap at 4, then clear', async ({ page }) => {
    await page.goto('/en');
    const search = page.getByRole('combobox', { name: 'Search' });
    const recents = page.getByRole('group', { name: 'Recent' });
    await search.focus();
    await expect(recents).toBeHidden();

    // Pick the main Stations one after another, each from the empty state.
    for (const name of [
      'Madrid Atocha',
      'Madrid Chamartín',
      'Barcelona Sants',
      'Sevilla-Santa Justa',
    ]) {
      await page.goto('/en');
      await search.focus();
      await page.getByRole('option', { name, exact: true }).click();
      await expect(page).toHaveURL(/\/stations\//);
    }
    // A fifth, distinct pick (the Run) pushes the oldest out.
    await page.goto('/en');
    await search.focus();
    await page.getByRole('option', { name: /Run 03063/ }).click();
    await expect(page).toHaveURL(/\/runs\//);

    await page.goto('/en');
    await search.focus();
    await expect(recents.getByRole('option')).toHaveText([
      /Run 03063/,
      'Sevilla-Santa Justa',
      'Barcelona Sants',
      'Madrid Chamartín',
    ]);

    // Picking an older Recent again moves it to the top without duplicating it.
    await recents.getByRole('option', { name: 'Barcelona Sants' }).click();
    await page.goto('/en');
    await search.focus();
    await expect(recents.getByRole('option')).toHaveCount(4);
    await expect(recents.getByRole('option').first()).toHaveText('Barcelona Sants');

    await recents.getByRole('button', { name: 'Clear' }).click();
    await expect(recents).toBeHidden();
    await page.reload();
    await search.focus();
    await expect(recents).toBeHidden();
    await expect(page.getByRole('option')).toHaveCount(5);
  });

  test('drops Runs from past Service dates and tolerates a corrupt store', async ({ page }) => {
    await page.addInitScript(
      ([key, stale]) => {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(
            key,
            JSON.stringify([
              stale,
              {
                kind: 'station',
                id: 'station:60000',
                hit: { stationCode: '60000', name: 'Madrid Atocha' },
              },
            ]),
          );
        }
      },
      [STORE_KEY, staleRun] as const,
    );
    await page.goto('/en');
    await page.getByRole('combobox', { name: 'Search' }).focus();
    const recents = page.getByRole('group', { name: 'Recent' });
    await expect(recents.getByRole('option')).toHaveText(['Madrid Atocha']);
    await expect(page.getByText('Run 99999')).toBeHidden();

    await page.evaluate((key) => localStorage.setItem(key, '{broken'), STORE_KEY);
    await page.reload();
    await page.getByRole('combobox', { name: 'Search' }).focus();
    await expect(recents).toBeHidden();
    await expect(page.getByRole('option')).toHaveCount(5);
  });
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

  test('the search icon opens the suggestions panel, focused and full width', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: 'Open search' }).click();
    const search = page.getByRole('combobox', { name: 'Search' });
    await expect(search).toBeFocused();

    const list = page.getByRole('listbox', { name: 'Search' });
    await expect(page.getByRole('option')).toHaveCount(5);
    const bar = await page.getByRole('banner').boundingBox();
    const panel = await list.boundingBox();
    expect(Math.abs((panel?.x ?? 0) - (bar?.x ?? 99))).toBeLessThan(1);
    expect(Math.abs((panel?.width ?? 0) - (bar?.width ?? 0))).toBeLessThan(1);

    await page.getByRole('button', { name: 'Close search' }).click();
    await expect(list).toBeHidden();
  });

  test('the menu holds the nav', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'Replay' }).click();
    await expect(page).toHaveURL(/\/en\/replay$/);
    await expect(page.getByRole('link', { name: 'Replay' })).toBeHidden();
  });
});

test('punctuality page shows the headline, a ranking bar and the by-hour summary', async ({
  page,
}) => {
  await page.goto('/en/punctuality');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'In the last 7 days, 87% of trains reached their destination less than 5 min late',
  );
  const ranking = page.getByRole('list', { name: 'Line ranking' });
  await expect(
    ranking.getByRole('button', { name: new RegExp(PUNCTUALITY_LINE.code) }),
  ).toBeVisible();
  await expect(page.getByText('Delays cluster between 8:00 and 10:00')).toBeVisible();
});
