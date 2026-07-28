import {
  TableColumn,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';

const ACTIVE_API_KEY_TABLE = 'active_api_key';
const DEPARTMENT_TABLE = 'department';
const MEMBER_LIMIT_TABLE = 'member_limit';
const DEPARTMENT_LIMIT_COLUMN = 'department_limit';
const LIMIT_COLUMN = 'limit';
const USAGE_COLUMN = 'usage';

/**
 * 부서 공통 한도를 API 키 단위로 이관하고, API 키·회원별 현재 사용량을 초기화합니다.
 *
 * 기존 부서 한도는 해당 부서의 모든 활성 API 키에 복사합니다. MySQL DDL은 암시적으로
 * 커밋되므로, 재시도할 수 있도록 테이블·컬럼 존재 여부를 각각 확인합니다.
 */
export class MoveDepartmentQuotaToActiveApiKey2026072600002
implements MigrationInterface {
  name = 'MoveDepartmentQuotaToActiveApiKey2026072600002';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasActiveApiKeyTable = await queryRunner.hasTable(
      ACTIVE_API_KEY_TABLE,
    );
    const hasDepartmentTable = await queryRunner.hasTable(DEPARTMENT_TABLE);

    if (hasActiveApiKeyTable) {
      if (!(await queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, LIMIT_COLUMN))) {
        await queryRunner.addColumn(
          ACTIVE_API_KEY_TABLE,
          this.createQuotaColumn(LIMIT_COLUMN),
        );
      }
      if (!(await queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, USAGE_COLUMN))) {
        await queryRunner.addColumn(
          ACTIVE_API_KEY_TABLE,
          this.createQuotaColumn(USAGE_COLUMN),
        );
      }
    }

    if (
      hasActiveApiKeyTable
      && hasDepartmentTable
      && await queryRunner.hasColumn(DEPARTMENT_TABLE, DEPARTMENT_LIMIT_COLUMN)
    ) {
      await queryRunner.query(
        [
          'UPDATE `' + ACTIVE_API_KEY_TABLE + '` AS `active_api_key`',
          'INNER JOIN `' + DEPARTMENT_TABLE + '` AS `department`',
          '  ON `department`.`department_id` = `active_api_key`.`department_id`',
          'SET `active_api_key`.`limit` = `department`.`department_limit`',
        ].join('\n'),
      );
      await queryRunner.dropColumn(DEPARTMENT_TABLE, DEPARTMENT_LIMIT_COLUMN);
    }

    if (
      await queryRunner.hasTable(MEMBER_LIMIT_TABLE)
      && !(await queryRunner.hasColumn(MEMBER_LIMIT_TABLE, USAGE_COLUMN))
    ) {
      await queryRunner.addColumn(
        MEMBER_LIMIT_TABLE,
        this.createQuotaColumn(USAGE_COLUMN),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const hasActiveApiKeyTable = await queryRunner.hasTable(
      ACTIVE_API_KEY_TABLE,
    );
    const hasDepartmentTable = await queryRunner.hasTable(DEPARTMENT_TABLE);

    if (
      hasDepartmentTable
      && !(await queryRunner.hasColumn(DEPARTMENT_TABLE, DEPARTMENT_LIMIT_COLUMN))
    ) {
      await queryRunner.addColumn(
        DEPARTMENT_TABLE,
        this.createQuotaColumn(DEPARTMENT_LIMIT_COLUMN),
      );
    }

    if (
      hasActiveApiKeyTable
      && hasDepartmentTable
      && await queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, LIMIT_COLUMN)
    ) {
      await queryRunner.query(
        [
          'UPDATE `' + DEPARTMENT_TABLE + '` AS `department`',
          'LEFT JOIN (',
          '  SELECT',
          '    `department_id`,',
          '    CASE',
          '      WHEN SUM(CASE WHEN `limit` = 0 THEN 1 ELSE 0 END) > 0 THEN 0',
          '      ELSE MAX(`limit`)',
          '    END AS `department_limit`',
          '  FROM `' + ACTIVE_API_KEY_TABLE + '`',
          '  GROUP BY `department_id`',
          ') AS `active_api_key`',
          '  ON `active_api_key`.`department_id` = `department`.`department_id`',
          'SET `department`.`department_limit` = COALESCE(`active_api_key`.`department_limit`, 0)',
        ].join('\n'),
      );
    }

    if (
      hasActiveApiKeyTable
      && await queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, USAGE_COLUMN)
    ) {
      await queryRunner.dropColumn(ACTIVE_API_KEY_TABLE, USAGE_COLUMN);
    }
    if (
      hasActiveApiKeyTable
      && await queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, LIMIT_COLUMN)
    ) {
      await queryRunner.dropColumn(ACTIVE_API_KEY_TABLE, LIMIT_COLUMN);
    }
    if (
      await queryRunner.hasTable(MEMBER_LIMIT_TABLE)
      && await queryRunner.hasColumn(MEMBER_LIMIT_TABLE, USAGE_COLUMN)
    ) {
      await queryRunner.dropColumn(MEMBER_LIMIT_TABLE, USAGE_COLUMN);
    }
  }

  private createQuotaColumn(name: string): TableColumn {
    return new TableColumn({
      name,
      type: 'bigint',
      isNullable: false,
      default: '0',
    });
  }
}
