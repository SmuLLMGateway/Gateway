import type { MigrationInterface, QueryRunner } from 'typeorm';

const PROMPT_LOG_TABLE = 'prompt_log';
const MODEL_NAME_COLUMN = 'model_name';

/** 이력용 모델 분류와 실제 Provider 호출 모델명을 분리합니다. */
export class AddPromptLogModelName2026080200008 implements MigrationInterface {
  name = 'AddPromptLogModelName2026080200008';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(PROMPT_LOG_TABLE))
      || await queryRunner.hasColumn(PROMPT_LOG_TABLE, MODEL_NAME_COLUMN)
    ) {
      return;
    }

    await queryRunner.query(
      'ALTER TABLE `' + PROMPT_LOG_TABLE + '`'
        + ' ADD COLUMN `' + MODEL_NAME_COLUMN + '` VARCHAR(50) NULL',
    );
    // 기존 세부 모델명은 실제 호출 모델명으로 보존하고, 목록 응답용 분류만
    // active_api_key.service_type과 같은 canonical 값으로 정규화합니다.
    await queryRunner.query(
      'UPDATE `' + PROMPT_LOG_TABLE + '`'
        + ' SET `' + MODEL_NAME_COLUMN + '` = `model_type`'
        + ' WHERE `' + MODEL_NAME_COLUMN + '` IS NULL'
        + ' AND `model_type` IS NOT NULL',
    );
    await queryRunner.query(
      'UPDATE `' + PROMPT_LOG_TABLE + '` SET `model_type` = CASE'
        + " WHEN LOWER(`model_type`) LIKE 'gpt%' THEN 'GPT'"
        + " WHEN LOWER(`model_type`) LIKE 'gemini%' THEN 'Gemini'"
        + " WHEN LOWER(`model_type`) LIKE 'claude%' THEN 'Claude'"
        + " WHEN LOWER(`model_type`) LIKE 'local%' THEN 'Local LLM'"
        + ' ELSE `model_type` END'
        + ' WHERE `model_type` IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasTable(PROMPT_LOG_TABLE)
      && await queryRunner.hasColumn(PROMPT_LOG_TABLE, MODEL_NAME_COLUMN)
    ) {
      await queryRunner.query(
        'ALTER TABLE `' + PROMPT_LOG_TABLE + '`'
          + ' DROP COLUMN `' + MODEL_NAME_COLUMN + '`',
      );
    }
  }
}
