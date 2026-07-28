import type { QueryRunner } from 'typeorm';
import { AddRecentUsePercentToActiveApiKey2026072600003 } from '../../src/global/database/migration/add-recent-use-percent-to-active-api-key.migration.js';

describe('AddRecentUsePercentToActiveApiKey2026072600003', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    addColumn: jest.fn(),
    dropColumn: jest.fn(),
  };

  let migration: AddRecentUsePercentToActiveApiKey2026072600003;

  beforeEach(() => {
    migration = new AddRecentUsePercentToActiveApiKey2026072600003();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockResolvedValue(false);
    queryRunner.addColumn.mockResolvedValue(undefined);
    queryRunner.dropColumn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('직전 사용률을 bigint NOT NULL DEFAULT 0으로 추가한다', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'active_api_key',
      expect.objectContaining({
        name: 'recent_use_percent',
        type: 'bigint',
        isNullable: false,
        default: '0',
      }),
    );
  });

  it('이미 컬럼이 있거나 테이블이 없으면 다시 추가하지 않는다', async () => {
    queryRunner.hasColumn.mockResolvedValueOnce(true);
    await migration.up(queryRunner as unknown as QueryRunner);
    expect(queryRunner.addColumn).not.toHaveBeenCalled();

    jest.clearAllMocks();
    queryRunner.hasTable.mockResolvedValueOnce(false);
    await migration.up(queryRunner as unknown as QueryRunner);
    expect(queryRunner.addColumn).not.toHaveBeenCalled();
  });

  it('down은 추가한 컬럼만 제거한다', async () => {
    queryRunner.hasColumn.mockResolvedValueOnce(true);
    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'active_api_key',
      'recent_use_percent',
    );
  });
});
