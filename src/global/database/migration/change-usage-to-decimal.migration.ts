import type { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = ['prompt_log', 'member_limit', 'department'] as const;

/** Provider의 total_usd를 손실 없이 보관하도록 사용량을 소수점으로 전환합니다. */
export class ChangeUsageToDecimal2026080200002 implements MigrationInterface {
  name = 'ChangeUsageToDecimal2026080200002';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      if (await queryRunner.hasTable(table) && await queryRunner.hasColumn(table, 'usage')) {
        await queryRunner.query(
          'ALTER TABLE `' + table + '` MODIFY COLUMN `usage` DECIMAL(20,6)'
            + (table === 'prompt_log' ? ' NULL' : ' NOT NULL DEFAULT 0'),
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // 소수점 사용량을 정수로 되돌리면 손실되므로 의도적으로 되돌리지 않습니다.
    void queryRunner;
  }
}
