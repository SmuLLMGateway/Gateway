import type { MigrationInterface, QueryRunner } from 'typeorm';

const PROMPT_LOG_TABLE = 'prompt_log';
const USAGE_COLUMN = 'usage';

/** 외부 LLM 호출에 사용한 사용량을 보존합니다. */
export class AddPromptLogUsage2026080200001 implements MigrationInterface {
  name = 'AddPromptLogUsage2026080200001';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(PROMPT_LOG_TABLE))
      || await queryRunner.hasColumn(PROMPT_LOG_TABLE, USAGE_COLUMN)
    ) {
      return;
    }

    await queryRunner.query(
      'ALTER TABLE `' + PROMPT_LOG_TABLE + '`'
        + ' ADD COLUMN `' + USAGE_COLUMN + '` DECIMAL(20,6) NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasTable(PROMPT_LOG_TABLE)
      && await queryRunner.hasColumn(PROMPT_LOG_TABLE, USAGE_COLUMN)
    ) {
      await queryRunner.query(
        'ALTER TABLE `' + PROMPT_LOG_TABLE + '`'
          + ' DROP COLUMN `' + USAGE_COLUMN + '`',
      );
    }
  }
}
