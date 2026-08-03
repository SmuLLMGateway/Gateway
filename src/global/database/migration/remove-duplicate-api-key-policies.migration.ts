import type { MigrationInterface, QueryRunner } from 'typeorm';

const POLICY_TABLE = 'policy';
const PRESET_POLICY_TABLE = 'preset_policy';
const DEPARTMENT_POLICY_TABLE = 'department_policy';
const MASKING_DETAIL_TABLE = 'masking_detail';

/**
 * API_KEY의 과거 분류 변경으로 생성된 중복 정책을 하나의 정책으로 합칩니다.
 *
 * 부서 정책과 탐지 이력은 보존한 채 가장 오래된 API_KEY 정책으로 연결을 옮긴 후,
 * 중복된 정책 행만 제거합니다.
 */
export class RemoveDuplicateApiKeyPolicies2026080200006
implements MigrationInterface {
  name = 'RemoveDuplicateApiKeyPolicies2026080200006';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasRequiredSchema(queryRunner))) {
      return;
    }

    // 동일 부서에 API_KEY 정책이 둘 이상 있으면, 활성 여부와 탐지 이력을
    // 가장 오래된 정책의 부서 연결에 먼저 합칩니다.
    await queryRunner.query(
      'UPDATE `department_policy` AS `canonical_department_policy`'
        + ' INNER JOIN `department_policy` AS `duplicate_department_policy`'
        + ' ON `canonical_department_policy`.`department_id`'
        + ' = `duplicate_department_policy`.`department_id`'
        + ' INNER JOIN `policy` AS `duplicate_policy`'
        + ' ON `duplicate_policy`.`policy_id`'
        + ' = `duplicate_department_policy`.`policy_id`'
        + this.canonicalPolicyJoin('`canonical_department_policy`.`policy_id`')
        + ' SET `canonical_department_policy`.`is_active` ='
        + ' IF(`canonical_department_policy`.`is_active` = 1'
        + ' OR `duplicate_department_policy`.`is_active` = 1, 1, 0)'
        + " WHERE `duplicate_policy`.`masking_content` = 'API_KEY'"
        + ' AND `duplicate_policy`.`policy_id` <> `canonical_policy`.`policy_id`',
    );
    await queryRunner.query(
      'UPDATE `masking_detail` AS `detail`'
        + ' INNER JOIN `department_policy` AS `duplicate_department_policy`'
        + ' ON `duplicate_department_policy`.`department_policy_id`'
        + ' = `detail`.`department_policy_id`'
        + ' INNER JOIN `department_policy` AS `canonical_department_policy`'
        + ' ON `canonical_department_policy`.`department_id`'
        + ' = `duplicate_department_policy`.`department_id`'
        + ' INNER JOIN `policy` AS `duplicate_policy`'
        + ' ON `duplicate_policy`.`policy_id`'
        + ' = `duplicate_department_policy`.`policy_id`'
        + this.canonicalPolicyJoin('`canonical_department_policy`.`policy_id`')
        + ' SET `detail`.`department_policy_id`'
        + ' = `canonical_department_policy`.`department_policy_id`'
        + " WHERE `duplicate_policy`.`masking_content` = 'API_KEY'"
        + ' AND `duplicate_policy`.`policy_id` <> `canonical_policy`.`policy_id`',
    );
    await queryRunner.query(
      'DELETE `duplicate_department_policy` FROM `department_policy`'
        + ' AS `duplicate_department_policy`'
        + ' INNER JOIN `department_policy` AS `canonical_department_policy`'
        + ' ON `canonical_department_policy`.`department_id`'
        + ' = `duplicate_department_policy`.`department_id`'
        + ' INNER JOIN `policy` AS `duplicate_policy`'
        + ' ON `duplicate_policy`.`policy_id`'
        + ' = `duplicate_department_policy`.`policy_id`'
        + this.canonicalPolicyJoin('`canonical_department_policy`.`policy_id`')
        + " WHERE `duplicate_policy`.`masking_content` = 'API_KEY'"
        + ' AND `duplicate_policy`.`policy_id` <> `canonical_policy`.`policy_id`',
    );
    await queryRunner.query(
      'UPDATE `department_policy` AS `department_policy`'
        + ' INNER JOIN `policy` AS `duplicate_policy`'
        + ' ON `duplicate_policy`.`policy_id` = `department_policy`.`policy_id`'
        + this.canonicalPolicyJoin()
        + ' SET `department_policy`.`policy_id` = `canonical_policy`.`policy_id`'
        + " WHERE `duplicate_policy`.`masking_content` = 'API_KEY'"
        + ' AND `duplicate_policy`.`policy_id` <> `canonical_policy`.`policy_id`',
    );

    // 프리셋 연결은 정책 이력이 없으므로 동일한 연결을 하나만 남긴 뒤 옮깁니다.
    await queryRunner.query(
      'DELETE `duplicate_preset_policy` FROM `preset_policy` AS `duplicate_preset_policy`'
        + ' INNER JOIN `preset_policy` AS `canonical_preset_policy`'
        + ' ON `canonical_preset_policy`.`policy_preset_id`'
        + ' = `duplicate_preset_policy`.`policy_preset_id`'
        + ' INNER JOIN `policy` AS `duplicate_policy`'
        + ' ON `duplicate_policy`.`policy_id` = `duplicate_preset_policy`.`policy_id`'
        + this.canonicalPolicyJoin('`canonical_preset_policy`.`policy_id`')
        + " WHERE `duplicate_policy`.`masking_content` = 'API_KEY'"
        + ' AND `duplicate_policy`.`policy_id` <> `canonical_policy`.`policy_id`',
    );
    await queryRunner.query(
      'UPDATE `preset_policy` AS `preset_policy`'
        + ' INNER JOIN `policy` AS `duplicate_policy`'
        + ' ON `duplicate_policy`.`policy_id` = `preset_policy`.`policy_id`'
        + this.canonicalPolicyJoin()
        + ' SET `preset_policy`.`policy_id` = `canonical_policy`.`policy_id`'
        + " WHERE `duplicate_policy`.`masking_content` = 'API_KEY'"
        + ' AND `duplicate_policy`.`policy_id` <> `canonical_policy`.`policy_id`',
    );
    await queryRunner.query(
      'DELETE `duplicate_policy` FROM `policy` AS `duplicate_policy`'
        + this.canonicalPolicyJoin()
        + " WHERE `duplicate_policy`.`masking_content` = 'API_KEY'"
        + ' AND `duplicate_policy`.`policy_id` <> `canonical_policy`.`policy_id`',
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // 중복 정책을 병합한 뒤에는 원래의 중복 관계를 복원할 수 없습니다.
  }

  private async hasRequiredSchema(queryRunner: QueryRunner): Promise<boolean> {
    const checks = await Promise.all([
      queryRunner.hasTable(POLICY_TABLE),
      queryRunner.hasColumn(POLICY_TABLE, 'policy_id'),
      queryRunner.hasColumn(POLICY_TABLE, 'masking_content'),
      queryRunner.hasTable(PRESET_POLICY_TABLE),
      queryRunner.hasColumn(PRESET_POLICY_TABLE, 'policy_id'),
      queryRunner.hasColumn(PRESET_POLICY_TABLE, 'policy_preset_id'),
      queryRunner.hasTable(DEPARTMENT_POLICY_TABLE),
      queryRunner.hasColumn(DEPARTMENT_POLICY_TABLE, 'department_policy_id'),
      queryRunner.hasColumn(DEPARTMENT_POLICY_TABLE, 'department_id'),
      queryRunner.hasColumn(DEPARTMENT_POLICY_TABLE, 'policy_id'),
      queryRunner.hasColumn(DEPARTMENT_POLICY_TABLE, 'is_active'),
      queryRunner.hasTable(MASKING_DETAIL_TABLE),
      queryRunner.hasColumn(MASKING_DETAIL_TABLE, 'department_policy_id'),
    ]);

    return checks.every(Boolean);
  }

  private canonicalPolicyJoin(policyIdColumn?: string): string {
    // 집계 파생 테이블을 사용해, 삭제 대상 policy 테이블을 같은 쿼리의
    // 서브쿼리에서 다시 참조할 때 발생할 수 있는 MySQL 1093 오류를 피합니다.
    return ' INNER JOIN ('
      + ' SELECT MIN(`policy_id`) AS `policy_id`'
      + " FROM `policy` WHERE `masking_content` = 'API_KEY'"
      + ' ) AS `canonical_policy`'
      + (policyIdColumn === undefined
        ? ' ON 1 = 1'
        : ' ON `canonical_policy`.`policy_id` = ' + policyIdColumn);
  }
}
