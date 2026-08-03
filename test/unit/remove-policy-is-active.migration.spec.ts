import { RemovePolicyIsActive2026080200005 } from '../../src/global/database/migration/remove-policy-is-active.migration.js';

describe('RemovePolicyIsActive2026080200005', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };
  const migration = new RemovePolicyIsActive2026080200005();

  beforeEach(() => {
    jest.clearAllMocks();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockResolvedValue(true);
    queryRunner.query.mockResolvedValue(undefined);
  });

  it('policy.is_active 컬럼을 제거한다', async () => {
    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `policy` DROP COLUMN `is_active`',
    );
  });

  it('컬럼이 없으면 삭제하지 않는다', async () => {
    queryRunner.hasColumn.mockResolvedValue(false);

    await migration.up(queryRunner as never);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
