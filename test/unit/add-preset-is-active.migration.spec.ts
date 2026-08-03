import type { QueryRunner } from 'typeorm';
import { AddPresetIsActive2026080200000 } from '../../src/global/database/migration/add-preset-is-active.migration.js';

describe('AddPresetIsActive2026080200000', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };

  let migration: AddPresetIsActive2026080200000;

  beforeEach(() => {
    migration = new AddPresetIsActive2026080200000();
    queryRunner.query.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  it('preset.is_active를 NOT NULL DEFAULT TRUE로 추가한다', async () => {
    mockSchema({ tables: ['preset'], columns: [] });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `preset` ADD COLUMN `is_active` TINYINT NOT NULL DEFAULT 1',
    );
  });

  it('기존 NULL 값은 TRUE로 보정한 뒤 제약을 정렬한다', async () => {
    mockSchema({ tables: ['preset'], columns: ['preset.is_active'] });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      'UPDATE `preset` SET `is_active` = 1 WHERE `is_active` IS NULL',
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      'ALTER TABLE `preset` MODIFY COLUMN `is_active` TINYINT NOT NULL DEFAULT 1',
    );
  });

  it('down은 is_active 컬럼만 제거한다', async () => {
    mockSchema({ tables: ['preset'], columns: ['preset.is_active'] });

    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `preset` DROP COLUMN `is_active`',
    );
  });

  function mockSchema(input: {
    readonly tables: readonly string[];
    readonly columns: readonly string[];
  }): void {
    const tables = new Set(input.tables);
    const columns = new Set(input.columns);
    queryRunner.hasTable.mockImplementation(async (table: string) => tables.has(table));
    queryRunner.hasColumn.mockImplementation(async (table: string, column: string) =>
      columns.has(`${table}.${column}`));
  }
});
