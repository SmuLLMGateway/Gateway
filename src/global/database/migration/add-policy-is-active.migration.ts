import type { MigrationInterface, QueryRunner } from 'typeorm';

const POLICY_TABLE = 'policy';
const IS_ACTIVE_COLUMN = 'is_active';

/**
 * 정책 활성 여부를 정책 자체에서 관리할 수 있도록 v3 policy 테이블에 추가합니다.
 *
 * MySQL DDL은 암시적으로 커밋되므로, 부분 실행 뒤 다시 실행해도 안전하도록
 * 테이블/컬럼 존재 여부를 확인하고 기존 NULL 값은 기본값(TRUE)으로 보정합니다.
 */
export class AddPolicyIsActive2026073100002 implements MigrationInterface {
  name = 'AddPolicyIsActive2026073100002';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(POLICY_TABLE))) {
      return;
    }

    if (!(await queryRunner.hasColumn(POLICY_TABLE, IS_ACTIVE_COLUMN))) {
      await queryRunner.query(
        'ALTER TABLE `' + POLICY_TABLE + '`'
          + ' ADD COLUMN `' + IS_ACTIVE_COLUMN + '` TINYINT NOT NULL DEFAULT 1',
      );
      return;
    }

    // NOT NULL 제약을 적용하기 전에 기존 NULL을 TRUE로 정렬합니다.
    await queryRunner.query(
      'UPDATE `' + POLICY_TABLE + '`'
        + ' SET `' + IS_ACTIVE_COLUMN + '` = 1'
        + ' WHERE `' + IS_ACTIVE_COLUMN + '` IS NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `' + POLICY_TABLE + '`'
        + ' MODIFY COLUMN `' + IS_ACTIVE_COLUMN + '` TINYINT NOT NULL DEFAULT 1',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasTable(POLICY_TABLE)
      && await queryRunner.hasColumn(POLICY_TABLE, IS_ACTIVE_COLUMN)
    ) {
      await queryRunner.query(
        'ALTER TABLE `' + POLICY_TABLE + '`'
          + ' DROP COLUMN `' + IS_ACTIVE_COLUMN + '`',
      );
    }
  }
}
