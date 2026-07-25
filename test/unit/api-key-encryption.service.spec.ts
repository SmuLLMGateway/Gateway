import { randomBytes } from 'node:crypto';
import { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import { LlmProvider } from '../../src/global/llm/enum/llm-provider.enum.js';

describe('ApiKeyEncryptionService', () => {
  const originalKey = process.env.API_KEY_ENCRYPTION_KEY;
  const departmentId = '10';
  const provider = LlmProvider.GPT;

  beforeEach(() => {
    process.env.API_KEY_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.API_KEY_ENCRYPTION_KEY;
    } else {
      process.env.API_KEY_ENCRYPTION_KEY = originalKey;
    }
  });

  it('API 키를 AES-256-GCM envelope로 암호화하고 복호화한다', () => {
    const service = new ApiKeyEncryptionService();
    const plaintext = 'sk-sensitive-api-key';
    const encrypted = service.encrypt(plaintext, departmentId, provider);

    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encrypted).not.toContain(plaintext);
    expect(service.decrypt(encrypted, departmentId, provider)).toBe(plaintext);
  });

  it('같은 키도 매번 다른 nonce로 암호화한다', () => {
    const service = new ApiKeyEncryptionService();

    expect(service.encrypt('same-key', departmentId, provider)).not.toBe(
      service.encrypt('same-key', departmentId, provider),
    );
  });

  it('부서 또는 provider context가 다르면 복호화를 거부한다', () => {
    const service = new ApiKeyEncryptionService();
    const encrypted = service.encrypt('secret', departmentId, provider);

    expect(() => service.decrypt(
      encrypted,
      '11',
      provider,
    )).toThrow('API 키 복호화에 실패했습니다.');
  });

  it('암호문이 변조되면 복호화를 거부한다', () => {
    const service = new ApiKeyEncryptionService();
    const encrypted = service.encrypt('secret', departmentId, provider);
    const parts = encrypted.split('.');
    const ciphertext = Buffer.from(parts[3]!, 'base64url');
    ciphertext[0] = ciphertext[0]! ^ 1;
    parts[3] = ciphertext.toString('base64url');
    const tampered = parts.join('.');

    expect(() => service.decrypt(tampered, departmentId, provider)).toThrow(
      'API 키 복호화에 실패했습니다.',
    );
  });

  it('32바이트 Base64가 아닌 환경변수는 거부한다', () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'invalid-key';

    expect(() => new ApiKeyEncryptionService()).toThrow(
      'API_KEY_ENCRYPTION_KEY는 32바이트 Base64 값이어야 합니다.',
    );
  });
});
