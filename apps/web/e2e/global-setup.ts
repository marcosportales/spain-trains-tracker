import { MOCK_API_PORT } from './fixtures.js';
import { startMockApi } from './mock-api.js';

export default async function globalSetup() {
  const server = await startMockApi(MOCK_API_PORT);
  return () => {
    server.closeAllConnections();
    server.close();
  };
}
