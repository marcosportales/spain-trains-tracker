import { expect, type Page, test } from '@playwright/test';

// Madrid Atocha-Almudena Grandes: always has long-distance traffic.
const STATION_CODE = '02002';
const BOARD_PATH = `/es/stations/${STATION_CODE}`;
const STALE_BANNER = /No se pudo actualizar/;
const BOARD_REFRESH_MS = 30_000;

// A bare style keeps the map off the network: these tests need the panels, not the tiles.
test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eee' } }],
      },
    }),
  );
});

/** Train numbers of the first page of the active tab, in board order. */
async function trainNumbers(page: Page): Promise<string[]> {
  const links = page.getByRole('tabpanel').getByRole('link');
  const texts = await links.allInnerTexts();
  return texts.map((text) => text.trim().match(/^\d+/)?.[0] ?? '');
}

for (const [tab, name] of [
  ['departures', 'Salidas'],
  ['arrivals', 'Llegadas'],
] as const) {
  test(`every ${tab} entry opens its Run`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(BOARD_PATH);
    await page.getByRole('tab', { name }).click();
    const numbers = await trainNumbers(page);
    expect(numbers.length, `no ${tab} on the board`).toBeGreaterThan(0);

    for (const [index, trainNumber] of numbers.entries()) {
      expect(trainNumber, `entry ${index} has no Train number`).not.toBe('');
      await page.goto(BOARD_PATH);
      await page.getByRole('tab', { name }).click();
      await page.getByRole('tabpanel').getByRole('link').nth(index).click();
      await expect(page).toHaveURL(new RegExp(`/runs/[\\d-]+/${trainNumber}$`));
      const panel = page.getByRole('complementary', { name: `Circulación ${trainNumber}` });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('heading').first()).toContainText(trainNumber);
      await expect(page.getByText('This page could not be found')).toHaveCount(0);
    }
  });
}

test('an unknown Run is a real 404', async ({ page }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const response = await page.goto(`/es/runs/${today}/99999`);
  expect(response?.status()).toBe(404);
});

test('the board shows no stale banner while the API is up', async ({ page }) => {
  await page.clock.install();
  await page.goto(BOARD_PATH);
  const refreshed = page.waitForResponse((res) =>
    res.url().includes(`/stations/${STATION_CODE}/board`),
  );
  await page.clock.runFor(BOARD_REFRESH_MS + 1_000);
  expect((await refreshed).ok()).toBe(true);
  await expect(page.getByText(STALE_BANNER)).toHaveCount(0);
});

test('the board shows the stale banner when the API is down', async ({ page }) => {
  await page.clock.install();
  await page.goto(BOARD_PATH);
  await page.route(`**/stations/${STATION_CODE}/board`, (route) => route.abort());
  await page.clock.runFor(BOARD_REFRESH_MS + 1_000);
  await expect(page.getByText(STALE_BANNER)).toBeVisible();
});
