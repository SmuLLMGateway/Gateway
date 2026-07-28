import type { QueryRunner } from 'typeorm';
import { MoveMustFilteringToDepartment2026072600000 } from '../../src/global/database/migration/move-must-filtering-to-department.migration.js';

describe('MoveMustFilteringToDepartment2026072600000', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    addColumn: jest.fn(),
    dropColumn: jest.fn(),
    query: jest.fn(),
  };

  let migration: MoveMustFilteringToDepartment2026072600000;

  beforeEach(() => {
    migration = new MoveMustFilteringToDepartment2026072600000();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockImplementation(async (
      tableName: string,
      columnName: string,
    ) => tableName === 'active_api_key' && columnName === 'must_filtering');
    queryRunner.addColumn.mockResolvedValue(undefined);
    queryRunner.dropColumn.mockResolvedValue(undefined);
    queryRunner.query.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('기존 키별 값을 부서별 안전한 OR 값으로 이관하고 키 테이블 컬럼을 제거한다', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'department',
      expect.objectContaining({
        name: 'must_filtering',
        type: 'boolean',
        isNullable: false,
        default: '1',
      }),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'MAX(CASE WHEN `must_filtering` = 1 THEN 1 ELSE 0 END)',
    ));
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'COALESCE(`active_api_key`.`must_filtering`, 1)',
    ));
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'active_api_key',
      'must_filtering',
    );
  });

  it('새 DB처럼 department 테이블이 없으면 동기화 이전에 아무 작업도 하지 않는다', async () => {
    queryRunner.hasTable.mockResolvedValueOnce(false);

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.hasColumn).not.toHaveBeenCalled();
    expect(queryRunner.addColumn).not.toHaveBeenCalled();
    expect(queryRunner.query).not.toHaveBeenCalled();
    expect(queryRunner.dropColumn).not.toHaveBeenCalled();
  });

  it('down은 부서 값을 모든 API 키에 복사한 뒤 부서 컬럼을 제거한다', async () => {
    queryRunner.hasColumn.mockImplementation(async (
      tableName: string,
      columnName: string,
    ) => tableName === 'department' && columnName === 'must_filtering');

    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'active_api_key',
      expect.objectContaining({ name: 'must_filtering' }),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'SET `active_api_key`.`must_filtering` = `department`.`must_filtering`',
    ));
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'department',
      'must_filtering',
    );
  });
});
