import type { QueryRunner } from 'typeorm';
import { AddPromptLogUsage2026080200001 } from '../../src/global/database/migration/add-prompt-log-usage.migration.js';

describe('AddPromptLogUsage2026080200001', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };

  let migration: AddPromptLogUsage2026080200001;

  beforeEach(() => {
    migration = new AddPromptLogUsage2026080200001();
    queryRunner.query.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  it('prompt_log.usage를 nullable INT로 추가한다', async () => {
    mockSchema({ tables: ['prompt_log'], columns: [] });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `prompt_log` ADD COLUMN `usage` INT NULL',
    );
  });

  it('이미 usage가 있거나 prompt_log가 없으면 변경하지 않는다', async () => {
    mockSchema({ tables: ['prompt_log'], columns: ['prompt_log.usage'] });
    await migration.up(queryRunner as unknown as QueryRunner);
    mockSchema({ tables: [], columns: [] });
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('down은 usage 컬럼만 제거한다', async () => {
    mockSchema({ tables: ['prompt_log'], columns: ['prompt_log.usage'] });

    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `prompt_log` DROP COLUMN `usage`',
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
