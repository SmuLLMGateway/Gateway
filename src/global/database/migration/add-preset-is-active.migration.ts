import type { MigrationInterface, QueryRunner } from 'typeorm';

const PRESET_TABLE = 'preset';
const IS_ACTIVE_COLUMN = 'is_active';

/** 프리셋의 현재 활성 여부를 관리합니다. */
export class AddPresetIsActive2026080200000 implements MigrationInterface {
  name = 'AddPresetIsActive2026080200000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(PRESET_TABLE))) {
      return;
    }

    if (!(await queryRunner.hasColumn(PRESET_TABLE, IS_ACTIVE_COLUMN))) {
      await queryRunner.query(
        'ALTER TABLE `' + PRESET_TABLE + '`'
          + ' ADD COLUMN `' + IS_ACTIVE_COLUMN + '` TINYINT NOT NULL DEFAULT 1',
      );
      return;
    }

    await queryRunner.query(
      'UPDATE `' + PRESET_TABLE + '`'
        + ' SET `' + IS_ACTIVE_COLUMN + '` = 1'
        + ' WHERE `' + IS_ACTIVE_COLUMN + '` IS NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `' + PRESET_TABLE + '`'
        + ' MODIFY COLUMN `' + IS_ACTIVE_COLUMN + '` TINYINT NOT NULL DEFAULT 1',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasTable(PRESET_TABLE)
      && await queryRunner.hasColumn(PRESET_TABLE, IS_ACTIVE_COLUMN)
    ) {
      await queryRunner.query(
        'ALTER TABLE `' + PRESET_TABLE + '`'
          + ' DROP COLUMN `' + IS_ACTIVE_COLUMN + '`',
      );
    }
  }
}
