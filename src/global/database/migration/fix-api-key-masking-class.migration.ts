import type { MigrationInterface, QueryRunner } from 'typeorm';

const POLICY_TABLE = 'policy';
const MASKING_CONTENT_COLUMN = 'masking_content';
const MASKING_CLASS_COLUMN = 'masking_class';

/** API_KEY 정책의 올바른 분류를 PRIVATE로 보정합니다. */
export class FixApiKeyMaskingClass2026080200004 implements MigrationInterface {
  name = 'FixApiKeyMaskingClass2026080200004';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(POLICY_TABLE))
      || !(await queryRunner.hasColumn(POLICY_TABLE, MASKING_CONTENT_COLUMN))
      || !(await queryRunner.hasColumn(POLICY_TABLE, MASKING_CLASS_COLUMN))
    ) {
      return;
    }

    await queryRunner.query(
      'UPDATE `' + POLICY_TABLE + '`'
        + " SET `" + MASKING_CLASS_COLUMN + "` = 'PRIVATE'"
        + " WHERE `" + MASKING_CONTENT_COLUMN + "` = 'API_KEY'"
        + " AND `" + MASKING_CLASS_COLUMN + "` <> 'PRIVATE'",
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // API_KEY가 SENSITIVE였던 과거 분류는 잘못된 값이므로 되돌리지 않습니다.
  }
}
