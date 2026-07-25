import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { LlmProvider } from '../enum/llm-provider.enum.js';

const ALGORITHM = 'aes-256-gcm';
const ENVELOPE_VERSION = 'v1';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;

@Injectable()
export class ApiKeyEncryptionService {
  private readonly key: Buffer;

  constructor() {
    this.key = this.readEncryptionKey();
  }

  encrypt(apiKey: string, departmentId: string, provider: LlmProvider): string {
    const context = this.createContext(departmentId, provider);
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(apiKey, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      ENVELOPE_VERSION,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(envelope: string, departmentId: string, provider: LlmProvider): string {
    const context = this.createContext(departmentId, provider);
    const [version, encodedIv, encodedAuthTag, encodedCiphertext, extra] =
      envelope.split('.');

    if (
      version !== ENVELOPE_VERSION
      || encodedIv === undefined
      || encodedAuthTag === undefined
      || encodedCiphertext === undefined
      || extra !== undefined
    ) {
      throw new Error('API 키 암호문 형식이 올바르지 않습니다.');
    }

    const iv = Buffer.from(encodedIv, 'base64url');
    const authTag = Buffer.from(encodedAuthTag, 'base64url');
    const ciphertext = Buffer.from(encodedCiphertext, 'base64url');
    if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
      throw new Error('API 키 암호문 형식이 올바르지 않습니다.');
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
      });
      decipher.setAAD(Buffer.from(context, 'utf8'));
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error('API 키 복호화에 실패했습니다.');
    }
  }

  private readEncryptionKey(): Buffer {
    const encodedKey = process.env.API_KEY_ENCRYPTION_KEY;
    if (encodedKey === undefined || encodedKey.length === 0) {
      throw new Error('API_KEY_ENCRYPTION_KEY 환경 변수가 필요합니다.');
    }

    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== KEY_LENGTH_BYTES || key.toString('base64') !== encodedKey) {
      throw new Error('API_KEY_ENCRYPTION_KEY는 32바이트 Base64 값이어야 합니다.');
    }

    return key;
  }

  private createContext(departmentId: string, provider: LlmProvider): string {
    return `department:${departmentId}:provider:${provider}`;
  }
}
