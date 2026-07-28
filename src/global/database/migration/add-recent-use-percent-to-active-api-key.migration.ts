import {
  TableColumn,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';

const ACTIVE_API_KEY_TABLE = 'active_api_key';
const RECENT_USE_PERCENT_COLUMN = 'recent_use_percent';

/** active_api_key에 직전 집계 사용률을 추가합니다. */
export class AddRecentUsePercentToActiveApiKey2026072600003
implements MigrationInterface {
  name = 'AddRecentUsePercentToActiveApiKey2026072600003';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(ACTIVE_API_KEY_TABLE))
      || await queryRunner.hasColumn(
        ACTIVE_API_KEY_TABLE,
        RECENT_USE_PERCENT_COLUMN,
      )
    ) {
      return;
    }

    await queryRunner.addColumn(
      ACTIVE_API_KEY_TABLE,
      this.createRecentUsePercentColumn(),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasTable(ACTIVE_API_KEY_TABLE)
      && await queryRunner.hasColumn(
        ACTIVE_API_KEY_TABLE,
        RECENT_USE_PERCENT_COLUMN,
      )
    ) {
      await queryRunner.dropColumn(
        ACTIVE_API_KEY_TABLE,
        RECENT_USE_PERCENT_COLUMN,
      );
    }
  }

  private createRecentUsePercentColumn(): TableColumn {
    return new TableColumn({
      name: RECENT_USE_PERCENT_COLUMN,
      type: 'bigint',
      isNullable: false,
      default: '0',
    });
  }
}
