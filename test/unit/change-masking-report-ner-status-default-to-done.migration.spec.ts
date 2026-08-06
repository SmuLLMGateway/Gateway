import { ChangeMaskingReportNerStatusDefaultToDone2026080600000 } from '../../src/global/database/migration/change-masking-report-ner-status-default-to-done.migration.js';

describe('ChangeMaskingReportNerStatusDefaultToDone2026080600000', () => {
  const queryRunner = {
    hasTable: jest.fn(),
    hasColumn: jest.fn(),
    query: jest.fn(),
  };
  const migration = new ChangeMaskingReportNerStatusDefaultToDone2026080600000();

  beforeEach(() => {
    jest.clearAllMocks();
    queryRunner.hasTable.mockResolvedValue(true);
    queryRunner.hasColumn.mockResolvedValue(true);
    queryRunner.query.mockResolvedValue(undefined);
  });

  it('기존 PENDING NER 분기를 완료하고 새 기본값을 DONE으로 변경한다', async () => {
    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      "UPDATE `masking_report` SET `ner_status` = 'DONE', `status` = CASE WHEN `regex_status` = 'DONE' THEN 'DONE' ELSE `status` END WHERE `status` = 'PENDING' AND `ner_status` = 'PENDING'",
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      "ALTER TABLE `masking_report` ALTER COLUMN `ner_status` SET DEFAULT 'DONE'",
    );
  });

  it('필수 스키마가 없으면 안전하게 건너뛴다', async () => {
    queryRunner.hasTable.mockResolvedValue(false);

    await migration.up(queryRunner as never);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('down은 기본값만 PENDING으로 되돌린다', async () => {
    await migration.down(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledWith(
      "ALTER TABLE `masking_report` ALTER COLUMN `ner_status` SET DEFAULT 'PENDING'",
    );
  });
});
