import type { MigrationInterface, QueryRunner } from 'typeorm';

const PROMPT_LOG_TABLE = 'prompt_log';
const ACTIVE_API_KEY_COLUMN = 'active_api_key_id';

/** 프롬프트 이력에서 실제 외부 LLM API 키의 service_type을 조회할 수 있게 합니다. */
export class AddPromptLogActiveApiKey2026080200007 implements MigrationInterface {
  name = 'AddPromptLogActiveApiKey2026080200007';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(PROMPT_LOG_TABLE))
      || await queryRunner.hasColumn(PROMPT_LOG_TABLE, ACTIVE_API_KEY_COLUMN)
    ) {
      return;
    }

    await queryRunner.query(
      'ALTER TABLE `' + PROMPT_LOG_TABLE + '`'
        + ' ADD COLUMN `' + ACTIVE_API_KEY_COLUMN + '` BIGINT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasTable(PROMPT_LOG_TABLE)
      && await queryRunner.hasColumn(PROMPT_LOG_TABLE, ACTIVE_API_KEY_COLUMN)
    ) {
      await queryRunner.query(
        'ALTER TABLE `' + PROMPT_LOG_TABLE + '`'
          + ' DROP COLUMN `' + ACTIVE_API_KEY_COLUMN + '`',
      );
    }
  }
}
