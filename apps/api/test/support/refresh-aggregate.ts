const CONCURRENT = /concurrent refresh|concurrently (deleted|updated)/;

/**
 * Runs a continuous aggregate refresh, retrying while another test file refreshes at the same time
 * (TimescaleDB allows one refresh per aggregate at a time, and test files share the database).
 */
export async function withRefreshRetry<T>(refresh: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (attempt >= 20 || !CONCURRENT.test(message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}
