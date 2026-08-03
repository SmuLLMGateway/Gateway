import type { MigrationInterface, QueryRunner } from 'typeorm';

const POLICY_TABLE = 'policy';
const IS_ACTIVE_COLUMN = 'is_active';

/** 전역 정책 활성 여부를 프리셋 매핑으로 일원화하며 policy.is_active를 제거합니다. */
export class RemovePolicyIsActive2026080200005 implements MigrationInterface {
  name = 'RemovePolicyIsActive2026080200005';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
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

  async down(_queryRunner: QueryRunner): Promise<void> {
    // 과거 policy.is_active 값은 활성 프리셋 관계로 복원할 수 없어 되돌리지 않습니다.
  }
}
