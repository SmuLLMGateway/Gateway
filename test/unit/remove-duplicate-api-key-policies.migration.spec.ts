import { RemoveDuplicateApiKeyPolicies2026080200006 } from '../../src/global/database/migration/remove-duplicate-api-key-policies.migration.js';

describe('RemoveDuplicateApiKeyPolicies2026080200006', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };
  const migration = new RemoveDuplicateApiKeyPolicies2026080200006();

  beforeEach(() => {
    jest.clearAllMocks();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockResolvedValue(true);
    queryRunner.query.mockResolvedValue(undefined);
  });

  it('부서 정책·탐지 이력·프리셋 연결을 보존하며 중복 API_KEY 정책을 병합한다', async () => {
    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledTimes(7);
    expect(queryRunner.query.mock.calls.flat().join('\n')).toContain(
      'UPDATE `masking_detail` AS `detail`',
    );
    expect(queryRunner.query.mock.calls.flat().join('\n')).toContain(
      'DELETE `duplicate_policy` FROM `policy` AS `duplicate_policy`',
    );
    expect(queryRunner.query.mock.calls.flat().join('\n')).toContain(
      "`duplicate_policy`.`masking_content` = 'API_KEY'",
    );
  });

  it('필수 테이블이나 열이 없으면 데이터 변경을 수행하지 않는다', async () => {
    queryRunner.hasTable.mockResolvedValueOnce(false);

    await migration.up(queryRunner as never);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
