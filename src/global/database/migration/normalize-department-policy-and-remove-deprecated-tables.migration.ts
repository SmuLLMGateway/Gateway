import type { MigrationInterface, QueryRunner } from 'typeorm';

const DEPARTMENT_POLICY_TABLE = 'department_policy';
const MEMBER_DEPARTMENT_TABLE = 'member_department';
const PROMPT_MASKING_TABLE = 'prompt_masking';
const PROMPT_LOG_TABLE = 'prompt_log';
const POLICY_TABLE = 'policy';

const IS_ACTIVE_COLUMN = 'is_active';
const ROLE_COLUMN = 'role';

/**
 * API 명세 v3 ERD에서 확정된 기본값과 제거 대상 구조를 정렬합니다.
 *
 * MySQL DDL은 암시적으로 커밋되므로 각 단계는 존재 여부를 다시 확인해 재실행할 수
 * 있게 구현합니다. prompt_masking은 사용처가 제거된 테이블이므로 행을 포함해 삭제합니다.
 * 다만 다른 테이블이 이를 참조하는 경우에는 그 관계를 임의로 끊지 않고 중단합니다.
 */
export class NormalizeDepartmentPolicyAndRemoveDeprecatedTables2026073100001
implements MigrationInterface {
  name = 'NormalizeDepartmentPolicyAndRemoveDeprecatedTables2026073100001';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureDepartmentPolicyActiveDefault(queryRunner);
    await this.dropMemberDepartmentRole(queryRunner);
    await this.dropPromptMasking(queryRunner);
  }

  /**
   * role 및 prompt_masking의 기존 데이터는 up에서 의도적으로 삭제됩니다.
   * 따라서 down은 롤백 바이너리의 기동을 위한 빈 스키마만 복원하며, 삭제된 값/행은
   * 복구하지 않습니다. 데이터 복구가 필요하면 마이그레이션 전 백업에서 복원해야 합니다.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await this.restoreDepartmentPolicyWithoutDefault(queryRunner);
    await this.restoreMemberDepartmentRole(queryRunner);
    await this.restorePromptMaskingSchema(queryRunner);
  }

  private async ensureDepartmentPolicyActiveDefault(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (!(await queryRunner.hasTable(DEPARTMENT_POLICY_TABLE))) {
      return;
    }

    if (!(await queryRunner.hasColumn(DEPARTMENT_POLICY_TABLE, IS_ACTIVE_COLUMN))) {
      await queryRunner.query(
        'ALTER TABLE `' + DEPARTMENT_POLICY_TABLE + '`'
          + ' ADD COLUMN `' + IS_ACTIVE_COLUMN + '` TINYINT NOT NULL DEFAULT 1',
      );
      return;
    }

    // NOT NULL 변경 전에 기존 NULL을 v3 기본값(TRUE)으로 보정합니다.
    await queryRunner.query(
      'UPDATE `' + DEPARTMENT_POLICY_TABLE + '`'
        + ' SET `' + IS_ACTIVE_COLUMN + '` = 1'
        + ' WHERE `' + IS_ACTIVE_COLUMN + '` IS NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `' + DEPARTMENT_POLICY_TABLE + '`'
        + ' MODIFY COLUMN `' + IS_ACTIVE_COLUMN + '` TINYINT NOT NULL DEFAULT 1',
    );
  }

  private async dropMemberDepartmentRole(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable(MEMBER_DEPARTMENT_TABLE))
      || !(await queryRunner.hasColumn(MEMBER_DEPARTMENT_TABLE, ROLE_COLUMN))
    ) {
      return;
    }

    await queryRunner.query(
      'ALTER TABLE `' + MEMBER_DEPARTMENT_TABLE + '`'
        + ' DROP COLUMN `' + ROLE_COLUMN + '`',
    );
  }

  private async dropPromptMasking(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(PROMPT_MASKING_TABLE))) {
      return;
    }

    await this.assertPromptMaskingHasNoInboundForeignKeys(queryRunner);
    // DROP TABLE은 해당 테이블 자신이 가진 FK와 인덱스만 함께 제거합니다. 외부
    // 참조는 위에서 검사해 발견 시 실패하므로, 의도하지 않은 관계를 지우지 않습니다.
    await queryRunner.query('DROP TABLE `' + PROMPT_MASKING_TABLE + '`');
  }

  private async assertPromptMaskingHasNoInboundForeignKeys(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // QueryRunner#getTables는 일부 TypeORM 버전에서 존재하지 않는
    // typeorm_metadata 테이블을 읽으려 합니다. information_schema를 직접 조회해
    // 실제 FK만 확인하면 메타데이터 보조 테이블 유무와 무관하게 동작합니다.
    const rows = await queryRunner.query([
      'SELECT TABLE_NAME AS `table_name`, COLUMN_NAME AS `column_name`',
      'FROM information_schema.KEY_COLUMN_USAGE',
      'WHERE REFERENCED_TABLE_SCHEMA = DATABASE()',
      "  AND REFERENCED_TABLE_NAME = 'prompt_masking'",
    ].join('\n')) as Array<{
      readonly table_name?: string;
      readonly column_name?: string;
    }>;
    const references = rows.map((row) =>
      `${row.table_name ?? 'unknown'}.${row.column_name ?? 'unknown'}`);

    if (references.length > 0) {
      throw new Error(
        `${PROMPT_MASKING_TABLE} 테이블을 참조하는 외래 키가 있습니다: `
          + `${references.join(', ')}. 참조를 명시적으로 이전한 뒤 다시 실행하세요.`,
      );
    }
  }

  private async restoreDepartmentPolicyWithoutDefault(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (
      !(await queryRunner.hasTable(DEPARTMENT_POLICY_TABLE))
      || !(await queryRunner.hasColumn(DEPARTMENT_POLICY_TABLE, IS_ACTIVE_COLUMN))
    ) {
      return;
    }

    // v3 전 스키마에는 DEFAULT가 없었습니다. 값은 보존하고 정의만 되돌립니다.
    await queryRunner.query(
      'ALTER TABLE `' + DEPARTMENT_POLICY_TABLE + '`'
        + ' MODIFY COLUMN `' + IS_ACTIVE_COLUMN + '` TINYINT NOT NULL',
    );
  }

  private async restoreMemberDepartmentRole(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(MEMBER_DEPARTMENT_TABLE))) {
      return;
    }

    if (!(await queryRunner.hasColumn(MEMBER_DEPARTMENT_TABLE, ROLE_COLUMN))) {
      // 기존 행에 NOT NULL 컬럼을 추가하려면 일시적인 기본값이 필요합니다.
      await queryRunner.query(
        'ALTER TABLE `' + MEMBER_DEPARTMENT_TABLE + '`'
          + ' ADD COLUMN `' + ROLE_COLUMN + "` VARCHAR(10) NOT NULL DEFAULT ''",
      );
    }

    // 과거 테이블 정의에는 기본값이 없었으므로, 빈 문자열로 채운 뒤 기본값은 제거합니다.
    await queryRunner.query(
      'ALTER TABLE `' + MEMBER_DEPARTMENT_TABLE + '`'
        + ' MODIFY COLUMN `' + ROLE_COLUMN + '` VARCHAR(10) NOT NULL',
    );
  }

  private async restorePromptMaskingSchema(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(PROMPT_MASKING_TABLE)) {
      return;
    }

    const hasPromptLogTable = await queryRunner.hasTable(PROMPT_LOG_TABLE);
    const hasPolicyTable = await queryRunner.hasTable(POLICY_TABLE);
    if (!hasPromptLogTable || !hasPolicyTable) {
      throw new Error(
        `${PROMPT_MASKING_TABLE} 스키마를 되돌리려면 ${PROMPT_LOG_TABLE}와 `
          + `${POLICY_TABLE} 테이블이 필요합니다.`,
      );
    }

    await queryRunner.query([
      'CREATE TABLE `prompt_masking` (',
      '  `prompt_masking_id` BIGINT NOT NULL AUTO_INCREMENT,',
      '  `masking_text` VARCHAR(255) NULL,',
      '  `prompt_log_id` BIGINT NOT NULL,',
      '  `policy_id` BIGINT NOT NULL,',
      '  PRIMARY KEY (`prompt_masking_id`),',
      '  CONSTRAINT `FK_prompt_masking_prompt_log`',
      + ' FOREIGN KEY (`prompt_log_id`) REFERENCES `prompt_log` (`prompt_log_id`),',
      '  CONSTRAINT `FK_prompt_masking_policy`'
      + ' FOREIGN KEY (`policy_id`) REFERENCES `policy` (`policy_id`)',
      ') ENGINE=InnoDB',
    ].join('\n'));
  }
}
