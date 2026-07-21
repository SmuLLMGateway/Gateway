import type { TypeOrmModuleOptions } from "@nestjs/typeorm";

export function createDatabaseConfig(): TypeOrmModuleOptions {
    return {
        type: 'mysql',
        host: requireEnvironment('DB_HOST'),
        port: readPort(),
        username: requireEnvironment('DB_USERNAME'),
        password: requireEnvironment('DB_PASSWORD'),
        database: requireEnvironment('DB_NAME'),
        charset: 'utf8mb4',
        timezone: 'Z',
        supportBigNumbers: true,
        bigNumberStrings: true,
        autoLoadEntities: true,
        synchronize: true,
        migrationsRun: false,
        // 인증 토큰 같은 쿼리 파라미터가 개발 로그에 노출되지 않도록
        // SQL query/error 로깅은 활성화하지 않습니다.
        logging: process.env.NODE_ENV === 'development'
            ? ['schema', 'warn']
            : false,
        retryAttempts: 5,
        retryDelay: 3000
    };
}

function requireEnvironment(key: string): string {
    const value = process.env[key];

    if (value === undefined || value === '') {
        throw new Error(`${key} 환경 변수가 필요합니다.`);
    }

    return value;
}

function readPort(): number {
    const port = Number(process.env.DB_PORT ?? 3306);

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error('DB_PORT는 1부터 65535 사이의 정수여야 합니다.');
    }

    return port;
}
