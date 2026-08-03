import type { QueryRunner } from 'typeorm';
import { AddPolicyIsActive2026073100002 } from '../../src/global/database/migration/add-policy-is-active.migration.js';

describe('AddPolicyIsActive2026073100002', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };

  let migration: AddPolicyIsActive2026073100002;

  beforeEach(() => {
    migration = new AddPolicyIsActive2026073100002();
    queryRunner.query.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('policy.is_active를 NOT NULL DEFAULT TRUE로 추가한다', async () => {
    mockSchema({ tables: ['policy'], columns: [] });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `policy` ADD COLUMN `is_active` TINYINT NOT NULL DEFAULT 1',
    );
  });

  it('기존 is_active의 NULL을 TRUE로 보정한 뒤 제약을 정렬한다', async () => {
    mockSchema({ tables: ['policy'], columns: ['policy.is_active'] });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      'UPDATE `policy` SET `is_active` = 1 WHERE `is_active` IS NULL',
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      'ALTER TABLE `policy` MODIFY COLUMN `is_active` TINYINT NOT NULL DEFAULT 1',
    );
  });

  it('policy 테이블이 없으면 아무 변경도 하지 않는다', async () => {
    mockSchema({ tables: [], columns: [] });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('down은 추가한 is_active 컬럼만 제거한다', async () => {
    mockSchema({ tables: ['policy'], columns: ['policy.is_active'] });

    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `policy` DROP COLUMN `is_active`',
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
