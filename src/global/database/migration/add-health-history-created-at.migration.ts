import type { MigrationInterface, QueryRunner } from 'typeorm';

const HEALTH_HISTORY_TABLE = 'health_history';
const CREATED_AT_COLUMN = 'created_at';

/** 상태 점검 이력의 보관 기간 정리에 사용할 생성 시각을 추가합니다. */
export class AddHealthHistoryCreatedAt2026080200003 implements MigrationInterface {
  name = 'AddHealthHistoryCreatedAt2026080200003';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(HEALTH_HISTORY_TABLE))
      || await queryRunner.hasColumn(HEALTH_HISTORY_TABLE, CREATED_AT_COLUMN)
    ) {
      return;
    }

    await queryRunner.query(
      'ALTER TABLE `' + HEALTH_HISTORY_TABLE + '`'
        + ' ADD COLUMN `' + CREATED_AT_COLUMN + '` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasTable(HEALTH_HISTORY_TABLE)
      && await queryRunner.hasColumn(HEALTH_HISTORY_TABLE, CREATED_AT_COLUMN)
    ) {
      await queryRunner.query(
        'ALTER TABLE `' + HEALTH_HISTORY_TABLE + '`'
          + ' DROP COLUMN `' + CREATED_AT_COLUMN + '`',
      );
    }
  }
}
