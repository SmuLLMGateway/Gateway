import type { MigrationInterface, QueryRunner } from 'typeorm';

const MASKING_REPORT_TABLE = 'masking_report';
const MASKING_TEXT_COLUMN = 'masking_text';
const ORIGINAL_TEXT_COLUMN = 'original_text';

/** 실제 LLM 전송에 사용할 마스킹 완료 본문을 분석 리포트에 보관합니다. */
export class AddMaskingReportMaskingText2026080800001
implements MigrationInterface {
  name = 'AddMaskingReportMaskingText2026080800001';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(MASKING_REPORT_TABLE))) {
      return;
    }

    if (!(await queryRunner.hasColumn(MASKING_REPORT_TABLE, MASKING_TEXT_COLUMN))) {
      // TEXT DEFAULT는 MySQL 호환성 이슈가 있어, 기존 행을 채운 뒤 NOT NULL로 바꿉니다.
      await queryRunner.query(
        'ALTER TABLE `' + MASKING_REPORT_TABLE + '`'
          + ' ADD COLUMN `' + MASKING_TEXT_COLUMN + '` TEXT NULL',
      );
    }

    if (await queryRunner.hasColumn(MASKING_REPORT_TABLE, ORIGINAL_TEXT_COLUMN)) {
      await queryRunner.query(
        'UPDATE `' + MASKING_REPORT_TABLE + '`'
          + ' SET `' + MASKING_TEXT_COLUMN + '` = `' + ORIGINAL_TEXT_COLUMN + '`'
          + ' WHERE `' + MASKING_TEXT_COLUMN + '` IS NULL',
      );
    }

    await queryRunner.query(
      'ALTER TABLE `' + MASKING_REPORT_TABLE + '`'
        + ' MODIFY COLUMN `' + MASKING_TEXT_COLUMN + '` TEXT NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasTable(MASKING_REPORT_TABLE)
      && await queryRunner.hasColumn(MASKING_REPORT_TABLE, MASKING_TEXT_COLUMN)
    ) {
      await queryRunner.query(
        'ALTER TABLE `' + MASKING_REPORT_TABLE + '`'
          + ' DROP COLUMN `' + MASKING_TEXT_COLUMN + '`',
      );
    }
  }
}
