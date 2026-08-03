import type { MigrationInterface, QueryRunner } from 'typeorm';

const DEPARTMENT_TABLE = 'department';
const ACTIVE_API_KEY_TABLE = 'active_api_key';
const ACTIVE_LLM_TABLE = 'active_llm';
const LLM_DETAIL_MODEL_TABLE = 'llm_detail_model';

const DEPARTMENT_ID_COLUMN = 'department_id';
const ACTIVE_API_KEY_ID_COLUMN = 'active_api_key_id';
const API_KEY_COLUMN = 'api_key';
const SERVICE_TYPE_COLUMN = 'service_type';
const LLM_DETAIL_MODEL_ID_COLUMN = 'llm_detail_model_id';
const LLM_NAME_COLUMN = 'llm_name';

const LOCAL_LLM_SERVICE_TYPE = 'Local LLM';

/**
 * 로컬 LLM은 외부 Provider API 키와 무관하므로, 부서마다 api_key가 NULL인
 * 전용 active_api_key 행을 둡니다. 기존 local-* 모델 연결은 같은 부서의
 * 전용 키로 옮기고, llm_detail_model 카탈로그 행은 절대 삭제하지 않습니다.
 */
export class AddLocalLlmActiveApiKeys2026080400000
implements MigrationInterface {
  name = 'AddLocalLlmActiveApiKeys2026080400000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasActiveApiKeySchema(queryRunner))) {
      return;
    }

    // synchronize가 먼저 수행된 환경에서도 안전하게 동일한 nullable 스키마를
    // 보장합니다. MySQL DDL은 암시적으로 커밋되므로 이후 단계는 모두 재실행 가능해야 합니다.
    await queryRunner.query(
      'ALTER TABLE `' + ACTIVE_API_KEY_TABLE + '`'
        + ' MODIFY COLUMN `' + API_KEY_COLUMN + '` VARCHAR(1024) NULL',
    );

    if (!(await this.hasDepartmentSchema(queryRunner))) {
      return;
    }

    await this.ensureLocalLlmActiveApiKeys(queryRunner);

    if (!(await this.hasActiveLlmSchema(queryRunner))) {
      return;
    }

    await this.copyLegacyLocalLlmMappings(queryRunner);
    await this.removeLegacyLocalLlmMappings(queryRunner);
  }

  /**
   * 기존 외부 API 키 행에 있던 local-* 연결은 전용 Local LLM 키로 이관되므로,
   * 원래 어느 외부 키에 연결됐는지는 안전하게 되돌릴 수 없습니다.
   */
  async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }

  private async hasActiveApiKeySchema(queryRunner: QueryRunner): Promise<boolean> {
    if (!(await queryRunner.hasTable(ACTIVE_API_KEY_TABLE))) {
      return false;
    }

    const checks = await Promise.all([
      queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, ACTIVE_API_KEY_ID_COLUMN),
      queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, API_KEY_COLUMN),
      queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, SERVICE_TYPE_COLUMN),
      queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, DEPARTMENT_ID_COLUMN),
    ]);

    return checks.every(Boolean);
  }

  private async hasDepartmentSchema(queryRunner: QueryRunner): Promise<boolean> {
    return (
      await queryRunner.hasTable(DEPARTMENT_TABLE)
      && await queryRunner.hasColumn(DEPARTMENT_TABLE, DEPARTMENT_ID_COLUMN)
    );
  }

  private async hasActiveLlmSchema(queryRunner: QueryRunner): Promise<boolean> {
    const hasTables = await Promise.all([
      queryRunner.hasTable(ACTIVE_LLM_TABLE),
      queryRunner.hasTable(LLM_DETAIL_MODEL_TABLE),
    ]);
    if (!hasTables.every(Boolean)) {
      return false;
    }

    const checks = await Promise.all([
      queryRunner.hasColumn(ACTIVE_LLM_TABLE, ACTIVE_API_KEY_ID_COLUMN),
      queryRunner.hasColumn(ACTIVE_LLM_TABLE, LLM_DETAIL_MODEL_ID_COLUMN),
      queryRunner.hasColumn(LLM_DETAIL_MODEL_TABLE, LLM_DETAIL_MODEL_ID_COLUMN),
      queryRunner.hasColumn(LLM_DETAIL_MODEL_TABLE, LLM_NAME_COLUMN),
    ]);

    return checks.every(Boolean);
  }

  private async ensureLocalLlmActiveApiKeys(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // 부서별 service_type 유니크 제약과 함께 동작합니다. WHERE NOT EXISTS도 두어
    // 마이그레이션 재실행 시 같은 전용 키를 추가하지 않습니다.
    await queryRunner.query(
      'INSERT INTO `' + ACTIVE_API_KEY_TABLE + '` ('
        + '`' + API_KEY_COLUMN + '`, '
        + '`' + SERVICE_TYPE_COLUMN + '`, '
        + '`' + DEPARTMENT_ID_COLUMN + '`'
        + ') SELECT NULL, ?, `department`.`' + DEPARTMENT_ID_COLUMN + '`'
        + ' FROM `' + DEPARTMENT_TABLE + '` AS `department`'
        + ' WHERE NOT EXISTS ('
        + ' SELECT 1 FROM `' + ACTIVE_API_KEY_TABLE + '` AS `existing_active_api_key`'
        + ' WHERE `existing_active_api_key`.`' + DEPARTMENT_ID_COLUMN + '`'
        + ' = `department`.`' + DEPARTMENT_ID_COLUMN + '`'
        + ' AND `existing_active_api_key`.`' + SERVICE_TYPE_COLUMN + '` = ?'
        + ')',
      [LOCAL_LLM_SERVICE_TYPE, LOCAL_LLM_SERVICE_TYPE],
    );
    await queryRunner.query(
      'UPDATE `' + ACTIVE_API_KEY_TABLE + '`'
        + ' SET `' + API_KEY_COLUMN + '` = NULL'
        + ' WHERE `' + SERVICE_TYPE_COLUMN + '` = ?'
        + ' AND `' + API_KEY_COLUMN + '` IS NOT NULL',
      [LOCAL_LLM_SERVICE_TYPE],
    );
  }

  private async copyLegacyLocalLlmMappings(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // INSERT IGNORE는 active_llm의 (active_api_key_id, llm_detail_model_id)
    // 유니크 제약을 이용해 이미 이관된 연결을 중복 생성하지 않습니다.
    await queryRunner.query(
      'INSERT IGNORE INTO `' + ACTIVE_LLM_TABLE + '` ('
        + '`' + ACTIVE_API_KEY_ID_COLUMN + '`, '
        + '`' + LLM_DETAIL_MODEL_ID_COLUMN + '`'
        + ') SELECT `local_active_api_key`.`' + ACTIVE_API_KEY_ID_COLUMN + '`, '
        + '`legacy_local_mapping`.`' + LLM_DETAIL_MODEL_ID_COLUMN + '`'
        + ' FROM ('
        + ' SELECT DISTINCT `legacy_active_api_key`.`' + DEPARTMENT_ID_COLUMN + '`, '
        + '`legacy_active_llm`.`' + LLM_DETAIL_MODEL_ID_COLUMN + '`'
        + ' FROM `' + ACTIVE_LLM_TABLE + '` AS `legacy_active_llm`'
        + ' INNER JOIN `' + ACTIVE_API_KEY_TABLE + '` AS `legacy_active_api_key`'
        + ' ON `legacy_active_api_key`.`' + ACTIVE_API_KEY_ID_COLUMN + '`'
        + ' = `legacy_active_llm`.`' + ACTIVE_API_KEY_ID_COLUMN + '`'
        + ' INNER JOIN `' + LLM_DETAIL_MODEL_TABLE + '` AS `local_model`'
        + ' ON `local_model`.`' + LLM_DETAIL_MODEL_ID_COLUMN + '`'
        + ' = `legacy_active_llm`.`' + LLM_DETAIL_MODEL_ID_COLUMN + '`'
        + " WHERE LOWER(TRIM(`local_model`.`" + LLM_NAME_COLUMN + "`)) LIKE 'local-%'"
        + ' AND (`legacy_active_api_key`.`' + SERVICE_TYPE_COLUMN + '` IS NULL'
        + ' OR `legacy_active_api_key`.`' + SERVICE_TYPE_COLUMN + '` <> ?)'
        + ' ) AS `legacy_local_mapping`'
        + ' INNER JOIN `' + ACTIVE_API_KEY_TABLE + '` AS `local_active_api_key`'
        + ' ON `local_active_api_key`.`' + DEPARTMENT_ID_COLUMN + '`'
        + ' = `legacy_local_mapping`.`' + DEPARTMENT_ID_COLUMN + '`'
        + ' AND `local_active_api_key`.`' + SERVICE_TYPE_COLUMN + '` = ?',
      [LOCAL_LLM_SERVICE_TYPE, LOCAL_LLM_SERVICE_TYPE],
    );
  }

  private async removeLegacyLocalLlmMappings(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      'DELETE `legacy_active_llm` FROM `' + ACTIVE_LLM_TABLE + '`'
        + ' AS `legacy_active_llm`'
        + ' INNER JOIN `' + ACTIVE_API_KEY_TABLE + '` AS `legacy_active_api_key`'
        + ' ON `legacy_active_api_key`.`' + ACTIVE_API_KEY_ID_COLUMN + '`'
        + ' = `legacy_active_llm`.`' + ACTIVE_API_KEY_ID_COLUMN + '`'
        + ' INNER JOIN `' + LLM_DETAIL_MODEL_TABLE + '` AS `local_model`'
        + ' ON `local_model`.`' + LLM_DETAIL_MODEL_ID_COLUMN + '`'
        + ' = `legacy_active_llm`.`' + LLM_DETAIL_MODEL_ID_COLUMN + '`'
        + " WHERE LOWER(TRIM(`local_model`.`" + LLM_NAME_COLUMN + "`)) LIKE 'local-%'"
        + ' AND (`legacy_active_api_key`.`' + SERVICE_TYPE_COLUMN + '` IS NULL'
        + ' OR `legacy_active_api_key`.`' + SERVICE_TYPE_COLUMN + '` <> ?)',
      [LOCAL_LLM_SERVICE_TYPE],
    );
  }
}
