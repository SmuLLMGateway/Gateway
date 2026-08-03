import { FixApiKeyMaskingClass2026080200004 } from '../../src/global/database/migration/fix-api-key-masking-class.migration.js';

describe('FixApiKeyMaskingClass2026080200004', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };
  const migration = new FixApiKeyMaskingClass2026080200004();

  beforeEach(() => {
    jest.clearAllMocks();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockResolvedValue(true);
    queryRunner.query.mockResolvedValue(undefined);
  });

  it('기존 API_KEY 정책을 PRIVATE로 보정한다', async () => {
    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledWith(
      "UPDATE `policy` SET `masking_class` = 'PRIVATE' WHERE `masking_content` = 'API_KEY' AND `masking_class` <> 'PRIVATE'",
    );
  });

  it('정책 테이블이 없으면 보정하지 않는다', async () => {
    queryRunner.hasTable.mockResolvedValue(false);

    await migration.up(queryRunner as never);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
