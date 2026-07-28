import {
  TableColumn,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';

const DEPARTMENT_TABLE = 'department';
const ACTIVE_API_KEY_TABLE = 'active_api_key';
const MUST_FILTERING_COLUMN = 'must_filtering';

/**
 * API 키별 강제 필터링 설정을 부서 공통 설정으로 이관합니다.
 *
 * 여러 API 키의 기존 값이 다르면 하나라도 true인 부서를 true로 보존합니다.
 * MySQL DDL은 암시적으로 커밋되므로 재시도할 수 있도록 컬럼 존재 여부를 확인합니다.
 */
export class MoveMustFilteringToDepartment2026072600000
implements MigrationInterface {
  name = 'MoveMustFilteringToDepartment2026072600000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(DEPARTMENT_TABLE))) {
      return;
    }

    if (!(await queryRunner.hasColumn(DEPARTMENT_TABLE, MUST_FILTERING_COLUMN))) {
      await queryRunner.addColumn(
        DEPARTMENT_TABLE,
        this.createMustFilteringColumn(),
      );
    }

    if (
      !(await queryRunner.hasTable(ACTIVE_API_KEY_TABLE))
      || !(await queryRunner.hasColumn(
        ACTIVE_API_KEY_TABLE,
        MUST_FILTERING_COLUMN,
      ))
    ) {
      return;
    }

    await queryRunner.query(`
      UPDATE \`${DEPARTMENT_TABLE}\` AS \`department\`
      LEFT JOIN (
        SELECT
          \`department_id\`,
          MAX(CASE WHEN \`must_filtering\` = 1 THEN 1 ELSE 0 END) AS \`must_filtering\`
        FROM \`${ACTIVE_API_KEY_TABLE}\`
        GROUP BY \`department_id\`
      ) AS \`active_api_key\`
        ON \`active_api_key\`.\`department_id\` = \`department\`.\`department_id\`
      SET \`department\`.\`must_filtering\` = COALESCE(\`active_api_key\`.\`must_filtering\`, 1)
    `);
    await queryRunner.dropColumn(ACTIVE_API_KEY_TABLE, MUST_FILTERING_COLUMN);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(DEPARTMENT_TABLE))
      || !(await queryRunner.hasTable(ACTIVE_API_KEY_TABLE))
      || !(await queryRunner.hasColumn(
        DEPARTMENT_TABLE,
        MUST_FILTERING_COLUMN,
      ))
    ) {
      return;
    }

    if (!(await queryRunner.hasColumn(
      ACTIVE_API_KEY_TABLE,
      MUST_FILTERING_COLUMN,
    ))) {
      await queryRunner.addColumn(
        ACTIVE_API_KEY_TABLE,
        this.createMustFilteringColumn(),
      );
    }

    await queryRunner.query(`
      UPDATE \`${ACTIVE_API_KEY_TABLE}\` AS \`active_api_key\`
      INNER JOIN \`${DEPARTMENT_TABLE}\` AS \`department\`
        ON \`department\`.\`department_id\` = \`active_api_key\`.\`department_id\`
      SET \`active_api_key\`.\`must_filtering\` = \`department\`.\`must_filtering\`
    `);
    await queryRunner.dropColumn(DEPARTMENT_TABLE, MUST_FILTERING_COLUMN);
  }

  private createMustFilteringColumn(): TableColumn {
    return new TableColumn({
      name: MUST_FILTERING_COLUMN,
      type: 'boolean',
      isNullable: false,
      default: '1',
    });
  }
}
