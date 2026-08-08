import type { MigrationInterface, QueryRunner } from 'typeorm';

const DEPARTMENT_TABLE = 'department';
const ACTIVE_LOCAL_LLM_COLUMN = 'active_local_llm';

/** 부서별 LPL(Local NER·LLM) 호출 허용 여부를 보관합니다. */
export class AddDepartmentActiveLocalLlm2026080800000
implements MigrationInterface {
  name = 'AddDepartmentActiveLocalLlm2026080800000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(DEPARTMENT_TABLE))
      || await queryRunner.hasColumn(DEPARTMENT_TABLE, ACTIVE_LOCAL_LLM_COLUMN)
    ) {
      return;
    }

    // 기존 부서는 이전 동작을 보존하도록 기본적으로 Local LLM을 허용합니다.
    await queryRunner.query(
      'ALTER TABLE `' + DEPARTMENT_TABLE + '`'
        + ' ADD COLUMN `' + ACTIVE_LOCAL_LLM_COLUMN + '` TINYINT NOT NULL DEFAULT 1',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasTable(DEPARTMENT_TABLE)
      && await queryRunner.hasColumn(DEPARTMENT_TABLE, ACTIVE_LOCAL_LLM_COLUMN)
    ) {
      await queryRunner.query(
        'ALTER TABLE `' + DEPARTMENT_TABLE + '`'
          + ' DROP COLUMN `' + ACTIVE_LOCAL_LLM_COLUMN + '`',
      );
    }
  }
}
