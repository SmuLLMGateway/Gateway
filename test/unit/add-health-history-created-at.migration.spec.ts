import { AddHealthHistoryCreatedAt2026080200003 } from '../../src/global/database/migration/add-health-history-created-at.migration.js';

describe('AddHealthHistoryCreatedAt2026080200003', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };
  const migration = new AddHealthHistoryCreatedAt2026080200003();

  beforeEach(() => {
    jest.clearAllMocks();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockResolvedValue(false);
    queryRunner.query.mockResolvedValue(undefined);
  });

  it('health_history에 created_at timestamp 기본값을 추가한다', async () => {
    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `health_history` ADD COLUMN `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
  });

  it('이미 컬럼이 있으면 아무 작업도 하지 않는다', async () => {
    queryRunner.hasColumn.mockResolvedValue(true);

    await migration.up(queryRunner as never);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('down에서 created_at을 제거한다', async () => {
    queryRunner.hasColumn.mockResolvedValue(true);

    await migration.down(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `health_history` DROP COLUMN `created_at`',
    );
  });
});
