import { ProviderConfig } from '../../src/global/llm/config/provider.config.js';

describe('ProviderConfig', () => {
  const originalServerIp = process.env.PROVIDER_SERVER_IP;
  const originalServerPort = process.env.PROVIDER_SERVER_PORT;

  afterEach(() => {
    if (originalServerIp === undefined) {
      delete process.env.PROVIDER_SERVER_IP;
    } else {
      process.env.PROVIDER_SERVER_IP = originalServerIp;
    }
    if (originalServerPort === undefined) {
      delete process.env.PROVIDER_SERVER_PORT;
    } else {
      process.env.PROVIDER_SERVER_PORT = originalServerPort;
    }
  });

  it('IP와 포트로 Provider 서버의 베이스·상태 URL을 만든다', () => {
    process.env.PROVIDER_SERVER_IP = '127.0.0.1';
    process.env.PROVIDER_SERVER_PORT = '8001';

    const config = new ProviderConfig();

    expect(config.baseUrl).toBe('http://127.0.0.1:8001/');
    expect(config.healthUrl).toBe('http://127.0.0.1:8001/health');
    expect(config.requestTimeoutMs).toBe(90_000);
  });
});
