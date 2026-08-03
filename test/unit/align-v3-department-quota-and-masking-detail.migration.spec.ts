import type { QueryRunner } from 'typeorm';
import { AlignV3DepartmentQuotaAndMaskingDetail2026073100000 } from '../../src/global/database/migration/align-v3-department-quota-and-masking-detail.migration.js';

describe('AlignV3DepartmentQuotaAndMaskingDetail2026073100000', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    addColumn: jest.fn(),
    changeColumn: jest.fn(),
    dropColumn: jest.fn(),
    getTable: jest.fn(),
    dropForeignKey: jest.fn(),
    createIndex: jest.fn(),
    createForeignKey: jest.fn(),
    query: jest.fn(),
  };

  let migration: AlignV3DepartmentQuotaAndMaskingDetail2026073100000;

  beforeEach(() => {
    migration = new AlignV3DepartmentQuotaAndMaskingDetail2026073100000();
    queryRunner.addColumn.mockResolvedValue(undefined);
    queryRunner.changeColumn.mockResolvedValue(undefined);
    queryRunner.dropColumn.mockResolvedValue(undefined);
    queryRunner.getTable.mockResolvedValue({ foreignKeys: [], indices: [] });
    queryRunner.dropForeignKey.mockResolvedValue(undefined);
    queryRunner.createIndex.mockResolvedValue(undefined);
    queryRunner.createForeignKey.mockResolvedValue(undefined);
    queryRunner.query.mockImplementation(async (sql: string) => (
      sql.startsWith('SELECT') ? [{ unmapped_count: '0' }] : []
    ));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('기존 API_KEY 정책의 PRIVATE 분류만 SENSITIVE로 정규화한다', async () => {
    mockSchema({
      tables: ['policy'],
      columns: ['policy.masking_content', 'policy.masking_class'],
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      "UPDATE `policy` SET `masking_class` = 'SENSITIVE'"
        + " WHERE `masking_content` = 'API_KEY'"
        + " AND `masking_class` = 'PRIVATE'",
    );
  });

  it('v3 스키마에서는 활성 API 키의 레거시 쿼터 컬럼을 다시 만들지 않는다', async () => {
    mockSchema({
      tables: [
        'department',
        'active_api_key',
        'masking_detail',
        'department_policy',
      ],
      columns: [
        'department.department_code',
        'department.limit',
        'department.usage',
        'department.recent_use_percent',
        'department.must_filtering',
        'active_api_key.active_api_key_id',
        'masking_detail.department_policy_id',
        'masking_detail.end_idx',
      ],
    });
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).not.toHaveBeenCalledWith(
      'active_api_key',
      expect.anything(),
    );
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'masking_detail',
      'end_idx',
    );
    expect(queryRunner.changeColumn).toHaveBeenCalledWith(
      'masking_detail',
      'department_policy_id',
      expect.objectContaining({ isNullable: false }),
    );
    expect(queryRunner.createIndex).toHaveBeenCalledWith(
      'masking_detail',
      expect.objectContaining({
        name: 'IDX_masking_detail_department_policy_id',
        columnNames: ['department_policy_id'],
      }),
    );
    expect(queryRunner.createForeignKey).toHaveBeenCalledWith(
      'masking_detail',
      expect.objectContaining({
        name: 'FK_masking_detail_department_policy',
        columnNames: ['department_policy_id'],
        referencedTableName: 'department_policy',
        referencedColumnNames: ['department_policy_id'],
      }),
    );
  });

  it('레거시 API 키 쿼터를 부서로 이관한 뒤 키 단위 컬럼을 제거한다', async () => {
    mockSchema({
      tables: [
        'department',
        'active_api_key',
        'masking_detail',
        'masking_report',
        'member_department',
        'department_policy',
      ],
      columns: [
        'department.department_limit',
        'active_api_key.limit',
        'active_api_key.usage',
        'active_api_key.recent_use_percent',
        'masking_detail.policy_id',
        'masking_detail.end_idx',
      ],
    });
    const legacyPolicyForeignKey = { columnNames: ['policy_id'] };
    queryRunner.getTable.mockResolvedValue({
      foreignKeys: [legacyPolicyForeignKey],
      indices: [],
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'department',
      expect.objectContaining({ name: 'department_code', length: '10' }),
    );
    expect(queryRunner.addColumn).toHaveBeenCalledWith(
      'department',
      expect.objectContaining({ name: 'limit', type: 'bigint', default: '0' }),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'SET `department`.`usage` = COALESCE(`legacy`.`usage`, 0)',
    ));
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'department_policy_id',
    ));
    for (const column of ['limit', 'usage', 'recent_use_percent']) {
      expect(queryRunner.dropColumn).toHaveBeenCalledWith(
        'active_api_key',
        column,
      );
    }
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'department',
      'department_limit',
    );
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'masking_detail',
      'policy_id',
    );
    expect(queryRunner.dropForeignKey).toHaveBeenCalledWith(
      expect.anything(),
      legacyPolicyForeignKey,
    );
  });

  it('부분 실패 뒤 다시 실행해도 대상 쿼터 컬럼이 이미 있으면 레거시 값을 다시 이관한다', async () => {
    mockSchema({
      tables: [
        'department',
        'active_api_key',
        'masking_detail',
        'department_policy',
      ],
      columns: [
        'department.department_code',
        'department.limit',
        'department.usage',
        'department.recent_use_percent',
        'department.must_filtering',
        'active_api_key.limit',
        'active_api_key.usage',
        'active_api_key.recent_use_percent',
        'masking_detail.department_policy_id',
      ],
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'SET `department`.`limit` = COALESCE(`legacy`.`limit`, 0)',
    ));
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      'SET `department`.`usage` = COALESCE(`legacy`.`usage`, 0)',
    ));
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'active_api_key',
      'limit',
    );
    expect(queryRunner.dropColumn).toHaveBeenCalledWith(
      'active_api_key',
      'usage',
    );
  });

  it('부서 정책을 유일하게 결정할 수 없는 마스킹 상세는 삭제하지 않고 중단한다', async () => {
    mockSchema({
      tables: [
        'department',
        'active_api_key',
        'masking_detail',
        'masking_report',
        'member_department',
        'department_policy',
      ],
      columns: [
        'department.department_limit',
        'active_api_key.limit',
        'active_api_key.usage',
        'masking_detail.policy_id',
        'masking_detail.end_idx',
      ],
    });
    queryRunner.query.mockImplementation(async (sql: string) => (
      sql.startsWith('SELECT') ? [{ unmapped_count: '2' }] : []
    ));

    await expect(migration.up(queryRunner as unknown as QueryRunner))
      .rejects.toThrow('변환에 실패한 2건');

    expect(queryRunner.dropColumn).not.toHaveBeenCalledWith(
      'masking_detail',
      'policy_id',
    );
    expect(queryRunner.dropColumn).not.toHaveBeenCalledWith(
      'masking_detail',
      'end_idx',
    );
    expect(queryRunner.dropColumn).not.toHaveBeenCalledWith(
      'department',
      'department_limit',
    );
    expect(queryRunner.dropColumn).not.toHaveBeenCalledWith(
      'active_api_key',
      'limit',
    );
    expect(queryRunner.addColumn).not.toHaveBeenCalledWith(
      'department',
      expect.anything(),
    );
  });

  it('이미 존재하는 v3 FK와 인덱스는 중복 생성하지 않는다', async () => {
    mockSchema({
      tables: ['masking_detail', 'department_policy'],
      columns: ['masking_detail.department_policy_id'],
    });
    queryRunner.getTable.mockResolvedValue({
      indices: [{
        name: 'IDX_masking_detail_department_policy_id',
        columnNames: ['department_policy_id'],
      }],
      foreignKeys: [{
        columnNames: ['department_policy_id'],
        referencedTableName: 'department_policy',
        referencedColumnNames: ['department_policy_id'],
      }],
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.createIndex).not.toHaveBeenCalled();
    expect(queryRunner.createForeignKey).not.toHaveBeenCalled();
  });

  it('prompt_log 상태를 PENDING 기본값의 NOT NULL 컬럼으로 정규화한다', async () => {
    mockSchema({
      tables: ['prompt_log'],
      columns: ['prompt_log.status'],
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining(
      "WHEN UPPER(TRIM(`status`)) = 'MASKING' THEN 'MASKING'",
    ));
    expect(queryRunner.changeColumn).toHaveBeenCalledWith(
      'prompt_log',
      'status',
      expect.objectContaining({
        type: 'varchar',
        length: '10',
        isNullable: false,
        default: "'PENDING'",
      }),
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
