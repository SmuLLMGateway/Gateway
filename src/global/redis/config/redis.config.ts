import { Injectable } from '@nestjs/common';
import type { RedisClientOptions } from 'redis';

@Injectable()
export class RedisConfig {
  readonly host = process.env.REDIS_HOST?.trim() || 'localhost';
  readonly port = this.readInteger('REDIS_PORT', 6379, 1, 65535);
  readonly username = this.readOptionalString('REDIS_USERNAME');
  readonly password = this.readOptionalString('REDIS_PASSWORD');
  readonly database = this.readInteger('REDIS_DATABASE', 0, 0);
  readonly tls = this.readBoolean('REDIS_TLS', false);
  readonly connectTimeoutMs = this.readInteger(
    'REDIS_CONNECT_TIMEOUT_MS',
    3000,
    1,
  );

  createClientOptions(): RedisClientOptions {
    const socket = this.tls
      ? {
          host: this.host,
          port: this.port,
          tls: true as const,
          connectTimeout: this.connectTimeoutMs,
          reconnectStrategy: false as const,
        }
      : {
          host: this.host,
          port: this.port,
          connectTimeout: this.connectTimeoutMs,
          reconnectStrategy: false as const,
        };

    return {
      socket,
      username: this.username,
      password: this.password,
      database: this.database,
      disableOfflineQueue: true,
    };
  }

  private readOptionalString(key: string): string | undefined {
    const value = process.env[key]?.trim();
    return value ? value : undefined;
  }

  private readBoolean(key: string, defaultValue: boolean): boolean {
    const rawValue = process.env[key]?.trim().toLowerCase();

    if (rawValue === undefined || rawValue === '') {
      return defaultValue;
    }

    if (rawValue === 'true') {
      return true;
    }

    if (rawValue === 'false') {
      return false;
    }

    throw new Error(`${key}는 true 또는 false여야 합니다.`);
  }

  private readInteger(
    key: string,
    defaultValue: number,
    minimum: number,
    maximum = Number.MAX_SAFE_INTEGER,
  ): number {
    const rawValue = process.env[key];
    const value = rawValue === undefined || rawValue === ''
      ? defaultValue
      : Number(rawValue);

    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${key} 환경 변수 값이 올바르지 않습니다.`);
    }

    return value;
  }
}
