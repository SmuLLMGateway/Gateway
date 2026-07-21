import { Injectable } from '@nestjs/common';

@Injectable()
export class SecurityConfig {
  readonly secret = this.requireSecret('JWT_SECRET');
  readonly accessExpiresInSeconds = this.requirePositiveNumber(
    'JWT_ACCESS_EXPIRES_IN_SECONDS',
    900,
  );
  readonly refreshExpiresInSeconds = this.requirePositiveNumber(
    'JWT_REFRESH_EXPIRES_IN_SECONDS',
    604800,
  );

  private requireSecret(key: string): string {
    const value = process.env[key];

    if (!value || value.length < 32) {
      throw new Error(`${key}는 32자 이상의 값으로 설정해야 합니다.`);
    }

    return value;
  }

  private requirePositiveNumber(key: string, defaultValue: number): number {
    const rawValue = process.env[key];
    const value = rawValue === undefined ? defaultValue : Number(rawValue);

    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${key}는 양의 정수(초)여야 합니다.`);
    }

    return value;
  }
}
