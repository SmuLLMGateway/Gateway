import {
  TableColumn,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';

const DEPARTMENT_TABLE = 'department';
const ACTIVE_API_KEY_TABLE = 'active_api_key';
const DEPARTMENT_LIMIT_COLUMN = 'department_limit';

/**
 * API 키별 부서 한도 설정을 부서 공통 설정으로 이관합니다.
 *
 * 0은 무제한이므로 기존 키 중 하나라도 0이면 부서 한도를 0으로 보존합니다.
 * 모두 유한값이면 가장 큰 값을 사용해 기존 사용 가능 한도를 축소하지 않습니다.
 * MySQL DDL은 암시적으로 커밋되므로 재시도할 수 있도록 컬럼 존재 여부를 확인합니다.
 */
export class MoveDepartmentLimitToDepartment2026072600001
implements MigrationInterface {
  name = 'MoveDepartmentLimitToDepartment2026072600001';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(DEPARTMENT_TABLE))) {
      return;
    }

    if (!(await queryRunner.hasColumn(
      DEPARTMENT_TABLE,
      DEPARTMENT_LIMIT_COLUMN,
    ))) {
      await queryRunner.addColumn(
        DEPARTMENT_TABLE,
        this.createDepartmentLimitColumn(),
      );
    }

    if (
      !(await queryRunner.hasTable(ACTIVE_API_KEY_TABLE))
      || !(await queryRunner.hasColumn(
        ACTIVE_API_KEY_TABLE,
        DEPARTMENT_LIMIT_COLUMN,
      ))
    ) {
      return;
    }

    await queryRunner.query(`
      UPDATE \`${DEPARTMENT_TABLE}\` AS \`department\`
      LEFT JOIN (
        SELECT
          \`department_id\`,
          CASE
            WHEN SUM(CASE WHEN \`department_limit\` = 0 THEN 1 ELSE 0 END) > 0 THEN 0
            ELSE MAX(\`department_limit\`)
          END AS \`department_limit\`
        FROM \`${ACTIVE_API_KEY_TABLE}\`
        GROUP BY \`department_id\`
      ) AS \`active_api_key\`
        ON \`active_api_key\`.\`department_id\` = \`department\`.\`department_id\`
      SET \`department\`.\`department_limit\` = COALESCE(\`active_api_key\`.\`department_limit\`, 0)
    `);
    await queryRunner.dropColumn(
      ACTIVE_API_KEY_TABLE,
      DEPARTMENT_LIMIT_COLUMN,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(DEPARTMENT_TABLE))
      || !(await queryRunner.hasTable(ACTIVE_API_KEY_TABLE))
      || !(await queryRunner.hasColumn(
        DEPARTMENT_TABLE,
        DEPARTMENT_LIMIT_COLUMN,
      ))
    ) {
      return;
    }

    if (!(await queryRunner.hasColumn(
      ACTIVE_API_KEY_TABLE,
      DEPARTMENT_LIMIT_COLUMN,
    ))) {
      await queryRunner.addColumn(
        ACTIVE_API_KEY_TABLE,
        this.createDepartmentLimitColumn(),
      );
    }

    await queryRunner.query(`
      UPDATE \`${ACTIVE_API_KEY_TABLE}\` AS \`active_api_key\`
      INNER JOIN \`${DEPARTMENT_TABLE}\` AS \`department\`
        ON \`department\`.\`department_id\` = \`active_api_key\`.\`department_id\`
      SET \`active_api_key\`.\`department_limit\` = \`department\`.\`department_limit\`
    `);
    await queryRunner.dropColumn(DEPARTMENT_TABLE, DEPARTMENT_LIMIT_COLUMN);
  }

  private createDepartmentLimitColumn(): TableColumn {
    return new TableColumn({
      name: DEPARTMENT_LIMIT_COLUMN,
      type: 'bigint',
      isNullable: false,
      default: '0',
    });
  }
}
