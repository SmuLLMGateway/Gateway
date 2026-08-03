import { AddPromptLogActiveApiKey2026080200007 } from '../../src/global/database/migration/add-prompt-log-active-api-key.migration.js';

describe('AddPromptLogActiveApiKey2026080200007', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };
  const migration = new AddPromptLogActiveApiKey2026080200007();

  beforeEach(() => {
    jest.clearAllMocks();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockResolvedValue(false);
    queryRunner.query.mockResolvedValue(undefined);
  });

  it('prompt_log에 외부 API 키 참조를 추가한다', async () => {
    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `prompt_log` ADD COLUMN `active_api_key_id` BIGINT NULL',
    );
  });

  it('열이 이미 있으면 변경하지 않는다', async () => {
    queryRunner.hasColumn.mockResolvedValue(true);

    await migration.up(queryRunner as never);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
