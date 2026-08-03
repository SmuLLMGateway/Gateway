import { AddLocalLlmActiveApiKeys2026080400000 } from '../../src/global/database/migration/add-local-llm-active-api-keys.migration.js';

describe('AddLocalLlmActiveApiKeys2026080400000', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };
  const migration = new AddLocalLlmActiveApiKeys2026080400000();

  beforeEach(() => {
    jest.clearAllMocks();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockResolvedValue(true);
    queryRunner.query.mockResolvedValue(undefined);
  });

  it('Local LLM NULL 키를 모든 부서에 보충하고 기존 local-* 연결만 이관한다', async () => {
    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      'ALTER TABLE `active_api_key` MODIFY COLUMN `api_key` VARCHAR(1024) NULL',
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO `active_api_key`'),
      ['Local LLM', 'Local LLM'],
    );
    expect(queryRunner.query.mock.calls[1]?.[0]).toContain('SELECT NULL, ?');
    expect(queryRunner.query.mock.calls[1]?.[0]).toContain(
      '`existing_active_api_key`.`service_type` = ?',
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('SET `api_key` = NULL'),
      ['Local LLM'],
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT IGNORE INTO `active_llm`'),
      ['Local LLM', 'Local LLM'],
    );
    expect(queryRunner.query.mock.calls[3]?.[0]).toContain(
      "LOWER(TRIM(`local_model`.`llm_name`)) LIKE 'local-%'",
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('DELETE `legacy_active_llm` FROM `active_llm`'),
      ['Local LLM'],
    );
  });

  it('active_api_key 스키마가 없으면 안전하게 건너뛴다', async () => {
    queryRunner.hasTable.mockImplementation(async (table: string) => (
      table !== 'active_api_key'
    ));

    await migration.up(queryRunner as never);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('down은 외부 API 키별 기존 연결을 임의로 복원하지 않는다', async () => {
    await expect(migration.down(queryRunner as never)).resolves.toBeUndefined();
    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
