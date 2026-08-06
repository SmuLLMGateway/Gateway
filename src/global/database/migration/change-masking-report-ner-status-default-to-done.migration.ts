import type { MigrationInterface, QueryRunner } from 'typeorm';

const MASKING_REPORT_TABLE = 'masking_report';
const REPORT_STATUS_COLUMN = 'status';
const REGEX_STATUS_COLUMN = 'regex_status';
const NER_STATUS_COLUMN = 'ner_status';

/** NER 탐지가 중지된 기간에는 새 분석 리포트의 NER 상태를 완료로 시작합니다. */
export class ChangeMaskingReportNerStatusDefaultToDone2026080600000
implements MigrationInterface {
  name = 'ChangeMaskingReportNerStatusDefaultToDone2026080600000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasRequiredColumns(queryRunner))) {
      return;
    }

    // 기존에 NER 응답만 기다리던 리포트도 정규식 결과만으로 완료될 수 있게 합니다.
    await queryRunner.query(
      'UPDATE `' + MASKING_REPORT_TABLE + '`'
        + ' SET `' + NER_STATUS_COLUMN + '` = \'DONE\','
        + ' `' + REPORT_STATUS_COLUMN + '` = CASE'
        + ' WHEN `' + REGEX_STATUS_COLUMN + '` = \'DONE\' THEN \'DONE\''
        + ' ELSE `' + REPORT_STATUS_COLUMN + '` END'
        + ' WHERE `' + REPORT_STATUS_COLUMN + '` = \'PENDING\''
        + ' AND `' + NER_STATUS_COLUMN + '` = \'PENDING\'',
    );

    await queryRunner.query(
      'ALTER TABLE `' + MASKING_REPORT_TABLE + '`'
        + ' ALTER COLUMN `' + NER_STATUS_COLUMN + '` SET DEFAULT \'DONE\'',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasRequiredColumns(queryRunner))) {
      return;
    }

    await queryRunner.query(
      'ALTER TABLE `' + MASKING_REPORT_TABLE + '`'
        + ' ALTER COLUMN `' + NER_STATUS_COLUMN + '` SET DEFAULT \'PENDING\'',
    );
  }

  private async hasRequiredColumns(queryRunner: QueryRunner): Promise<boolean> {
    if (!(await queryRunner.hasTable(MASKING_REPORT_TABLE))) {
      return false;
    }

    const columns = await Promise.all([
      queryRunner.hasColumn(MASKING_REPORT_TABLE, REPORT_STATUS_COLUMN),
      queryRunner.hasColumn(MASKING_REPORT_TABLE, REGEX_STATUS_COLUMN),
      queryRunner.hasColumn(MASKING_REPORT_TABLE, NER_STATUS_COLUMN),
    ]);

    return columns.every(Boolean);
  }
}
