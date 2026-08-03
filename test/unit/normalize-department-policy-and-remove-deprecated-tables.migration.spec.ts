import type { QueryRunner } from 'typeorm';
import { NormalizeDepartmentPolicyAndRemoveDeprecatedTables2026073100001 } from '../../src/global/database/migration/normalize-department-policy-and-remove-deprecated-tables.migration.js';

describe('NormalizeDepartmentPolicyAndRemoveDeprecatedTables2026073100001', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };

  let migration: NormalizeDepartmentPolicyAndRemoveDeprecatedTables2026073100001;

  beforeEach(() => {
    migration = new NormalizeDepartmentPolicyAndRemoveDeprecatedTables2026073100001();
    queryRunner.query.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('department_policy.is_active를 NULL 보정 후 NOT NULL DEFAULT TRUE로 정렬한다', async () => {
    mockSchema({
      tables: ['department_policy'],
      columns: ['department_policy.is_active'],
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      'UPDATE `department_policy` SET `is_active` = 1 WHERE `is_active` IS NULL',
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      'ALTER TABLE `department_policy` MODIFY COLUMN `is_active` TINYINT NOT NULL DEFAULT 1',
    );
  });

  it('is_active가 없으면 DEFAULT TRUE 정의로 추가한다', async () => {
    mockSchema({
      tables: ['department_policy'],
      columns: [],
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `department_policy` ADD COLUMN `is_active` TINYINT NOT NULL DEFAULT 1',
    );
  });

  it('member_department.role을 존재할 때만 제거한다', async () => {
    mockSchema({
      tables: ['member_department'],
      columns: ['member_department.role'],
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `member_department` DROP COLUMN `role`',
    );
  });

  it('prompt_masking은 자신을 참조하는 FK가 없을 때만 삭제한다', async () => {
    mockSchema({
      tables: ['prompt_masking'],
      columns: [],
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP TABLE `prompt_masking`',
    );
  });

  it('다른 테이블이 prompt_masking을 참조하면 삭제하지 않고 중단한다', async () => {
    mockSchema({
      tables: ['prompt_masking'],
      columns: [],
    });
    queryRunner.query.mockResolvedValueOnce([{
      table_name: 'audit_reference',
      column_name: 'prompt_masking_id',
    }]);

    await expect(migration.up(queryRunner as unknown as QueryRunner))
      .rejects.toThrow('prompt_masking 테이블을 참조하는 외래 키가 있습니다');

    expect(queryRunner.query).not.toHaveBeenCalledWith(
      'DROP TABLE `prompt_masking`',
    );
  });

  it('up을 다시 실행해도 이미 제거된 구조에는 쓰기 작업을 하지 않는다', async () => {
    mockSchema({ tables: [], columns: [] });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('down은 is_active 기본값을 제거하고 빈 role 및 prompt_masking 스키마만 복원한다', async () => {
    mockSchema({
      tables: ['department_policy', 'member_department', 'prompt_log', 'policy'],
      columns: ['department_policy.is_active'],
    });

    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `department_policy` MODIFY COLUMN `is_active` TINYINT NOT NULL',
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      "ALTER TABLE `member_department` ADD COLUMN `role` VARCHAR(10) NOT NULL DEFAULT ''",
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `member_department` MODIFY COLUMN `role` VARCHAR(10) NOT NULL',
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE `prompt_masking`'),
    );
  });

  it('down은 prompt_log 또는 policy가 없으면 빈 테이블도 임의로 만들지 않는다', async () => {
    mockSchema({
      tables: ['member_department'],
      columns: [],
    });

    await expect(migration.down(queryRunner as unknown as QueryRunner))
      .rejects.toThrow('prompt_masking 스키마를 되돌리려면');

    expect(queryRunner.query).not.toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE `prompt_masking`'),
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
