import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { AlignV3DepartmentQuotaAndMaskingDetail2026073100000 } from '../migration/align-v3-department-quota-and-masking-detail.migration.js';
import { NormalizeDepartmentPolicyAndRemoveDeprecatedTables2026073100001 } from '../migration/normalize-department-policy-and-remove-deprecated-tables.migration.js';
import { AddPolicyIsActive2026073100002 } from '../migration/add-policy-is-active.migration.js';
import { AddPresetIsActive2026080200000 } from '../migration/add-preset-is-active.migration.js';
import { AddPromptLogUsage2026080200001 } from '../migration/add-prompt-log-usage.migration.js';
import { ChangeUsageToDecimal2026080200002 } from '../migration/change-usage-to-decimal.migration.js';
import { AddHealthHistoryCreatedAt2026080200003 } from '../migration/add-health-history-created-at.migration.js';
import { FixApiKeyMaskingClass2026080200004 } from '../migration/fix-api-key-masking-class.migration.js';
import { RemovePolicyIsActive2026080200005 } from '../migration/remove-policy-is-active.migration.js';
import { RemoveDuplicateApiKeyPolicies2026080200006 } from '../migration/remove-duplicate-api-key-policies.migration.js';
import { AddPromptLogActiveApiKey2026080200007 } from '../migration/add-prompt-log-active-api-key.migration.js';
import { AddPromptLogModelName2026080200008 } from '../migration/add-prompt-log-model-name.migration.js';
import { AddLocalLlmActiveApiKeys2026080400000 } from '../migration/add-local-llm-active-api-keys.migration.js';
import { ChangeMaskingReportNerStatusDefaultToDone2026080600000 } from '../migration/change-masking-report-ner-status-default-to-done.migration.js';

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
        migrations: [
            AlignV3DepartmentQuotaAndMaskingDetail2026073100000,
            NormalizeDepartmentPolicyAndRemoveDeprecatedTables2026073100001,
            AddPolicyIsActive2026073100002,
            AddPresetIsActive2026080200000,
            AddPromptLogUsage2026080200001,
            ChangeUsageToDecimal2026080200002,
            AddHealthHistoryCreatedAt2026080200003,
            FixApiKeyMaskingClass2026080200004,
            RemovePolicyIsActive2026080200005,
            RemoveDuplicateApiKeyPolicies2026080200006,
            AddPromptLogActiveApiKey2026080200007,
            AddPromptLogModelName2026080200008,
            AddLocalLlmActiveApiKeys2026080400000,
            ChangeMaskingReportNerStatusDefaultToDone2026080600000
        ],
        migrationsRun: true,
        migrationsTransactionMode: 'each',
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
