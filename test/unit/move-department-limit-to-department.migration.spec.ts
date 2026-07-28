import type { QueryRunner } from 'typeorm';
import { MoveDepartmentLimitToDepartment2026072600001 } from '../../src/global/database/migration/move-department-limit-to-department.migration.js';

describe('MoveDepartmentLimitToDepartment2026072600001', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    addColumn: jest.fn(),
    dropColumn: jest.fn(),
    query: jest.fn(),
  };

  let migration: MoveDepartmentLimitToDepartment2026072600001;

  beforeEach(() => {
    migration = new MoveDepartmentLimitToDepartment2026072600001();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockImplementation(async (
      tableName: string,
      columnName: string,
    ) => tableName === 'active_api_key' && columnName === 'department_limit');
    queryRunner.addColumn.mockResolvedValue(undefined);
    queryRunner.dropColumn.mockResolvedValue(undefined);
    queryRunner.query.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('기존 키별 한도를 부서 한도로 이관하고 키 테이블 컬럼을 제거한다', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'department',
      expect.objectContaining({
        name: 'department_limit',
        type: 'bigint',
        isNullable: false,
        default: '0',
      }),
    );
    // 0은 무제한이므로, 키 중 하나라도 0이면 부서도 0으로 보존한다.
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'SUM(CASE WHEN `department_limit` = 0 THEN 1 ELSE 0 END) > 0 THEN 0',
    ));
    // 모든 기존 키가 제한값이면 가장 큰 값을 부서의 공통 한도로 사용한다.
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'MAX(`department_limit`)',
    ));
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'COALESCE(`active_api_key`.`department_limit`, 0)',
    ));
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'active_api_key',
      'department_limit',
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

  it('down은 부서 한도를 모든 API 키에 복사한 뒤 부서 컬럼을 제거한다', async () => {
    queryRunner.hasColumn.mockImplementation(async (
      tableName: string,
      columnName: string,
    ) => tableName === 'department' && columnName === 'department_limit');

    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'active_api_key',
      expect.objectContaining({
        name: 'department_limit',
        type: 'bigint',
        isNullable: false,
        default: '0',
      }),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'SET `active_api_key`.`department_limit` = `department`.`department_limit`',
    ));
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'department',
      'department_limit',
    );
  });
});
