import { AddPromptLogModelName2026080200008 } from '../../src/global/database/migration/add-prompt-log-model-name.migration.js';

describe('AddPromptLogModelName2026080200008', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };
  const migration = new AddPromptLogModelName2026080200008();

  beforeEach(() => {
    jest.clearAllMocks();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockResolvedValue(false);
    queryRunner.query.mockResolvedValue(undefined);
  });

  it('세부 모델명 열을 추가하고 기존 이력 모델 분류를 정규화한다', async () => {
    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      'ALTER TABLE `prompt_log` ADD COLUMN `model_name` VARCHAR(50) NULL',
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      3,
      "UPDATE `prompt_log` SET `model_type` = CASE WHEN LOWER(`model_type`) LIKE 'gpt%' THEN 'GPT' WHEN LOWER(`model_type`) LIKE 'gemini%' THEN 'Gemini' WHEN LOWER(`model_type`) LIKE 'claude%' THEN 'Claude' WHEN LOWER(`model_type`) LIKE 'local%' THEN 'Local LLM' ELSE `model_type` END WHERE `model_type` IS NOT NULL",
    );
  });
});
