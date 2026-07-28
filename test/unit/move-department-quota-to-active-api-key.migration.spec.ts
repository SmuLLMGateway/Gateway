import type { QueryRunner } from 'typeorm';
import { MoveDepartmentQuotaToActiveApiKey2026072600002 } from '../../src/global/database/migration/move-department-quota-to-active-api-key.migration.js';

describe('MoveDepartmentQuotaToActiveApiKey2026072600002', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    addColumn: jest.fn(),
    dropColumn: jest.fn(),
    query: jest.fn(),
  };

  let migration: MoveDepartmentQuotaToActiveApiKey2026072600002;

  beforeEach(() => {
    migration = new MoveDepartmentQuotaToActiveApiKey2026072600002();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockImplementation(async (
      tableName: string,
      columnName: string,
    ) => tableName === 'department' && columnName === 'department_limit');
    queryRunner.addColumn.mockResolvedValue(undefined);
    queryRunner.dropColumn.mockResolvedValue(undefined);
    queryRunner.query.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('부서 한도를 모든 활성 API 키에 복사하고 사용량 컬럼을 초기화한다', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'active_api_key',
      expect.objectContaining({
        name: 'limit',
        type: 'bigint',
        isNullable: false,
        default: '0',
      }),
    );
    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'active_api_key',
      expect.objectContaining({
        name: 'usage',
        type: 'bigint',
        isNullable: false,
        default: '0',
      }),
    );
    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'member_limit',
      expect.objectContaining({
        name: 'usage',
        type: 'bigint',
        isNullable: false,
        default: '0',
      }),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'SET `active_api_key`.`limit` = `department`.`department_limit`',
    ));
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'department',
      'department_limit',
    );
  });

  it('활성 API 키 테이블이 없으면 부서 한도를 삭제하지 않는다', async () => {
    queryRunner.hasTable.mockImplementation(async (tableName: string) =>
      tableName !== 'active_api_key',
    );

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).not.toHaveBeenCalled();
    expect(queryRunner.dropColumn).not.toHaveBeenCalledWith(
      'department',
      'department_limit',
    );
  });

  it('down은 키별 한도를 부서 공통 한도로 복원하고 새 컬럼을 제거한다', async () => {
    queryRunner.hasColumn.mockImplementation(async (
      tableName: string,
      columnName: string,
    ) => (
      (tableName === 'active_api_key' && ['limit', 'usage'].includes(columnName))
      || (tableName === 'member_limit' && columnName === 'usage')
    ));

    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'department',
      expect.objectContaining({
        name: 'department_limit',
        type: 'bigint',
        isNullable: false,
        default: '0',
      }),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'SUM(CASE WHEN `limit` = 0 THEN 1 ELSE 0 END) > 0 THEN 0',
    ));
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'active_api_key',
      'limit',
    );
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'active_api_key',
      'usage',
    );
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'member_limit',
      'usage',
    );
  });
});
