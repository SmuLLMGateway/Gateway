import {
  TableColumn,
  TableForeignKey,
  TableIndex,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';

const DEPARTMENT_TABLE = 'department';
const ACTIVE_API_KEY_TABLE = 'active_api_key';
const MASKING_DETAIL_TABLE = 'masking_detail';
const MASKING_REPORT_TABLE = 'masking_report';
const MEMBER_DEPARTMENT_TABLE = 'member_department';
const DEPARTMENT_POLICY_TABLE = 'department_policy';
const PROMPT_LOG_TABLE = 'prompt_log';
const POLICY_TABLE = 'policy';

const DEPARTMENT_CODE_COLUMN = 'department_code';
const LIMIT_COLUMN = 'limit';
const USAGE_COLUMN = 'usage';
const RECENT_USE_PERCENT_COLUMN = 'recent_use_percent';
const MUST_FILTERING_COLUMN = 'must_filtering';
const LEGACY_DEPARTMENT_LIMIT_COLUMN = 'department_limit';
const POLICY_ID_COLUMN = 'policy_id';
const MASKING_CONTENT_COLUMN = 'masking_content';
const MASKING_CLASS_COLUMN = 'masking_class';
const DEPARTMENT_POLICY_ID_COLUMN = 'department_policy_id';
const END_INDEX_COLUMN = 'end_idx';
const PROMPT_LOG_STATUS_COLUMN = 'status';
const MASKING_DETAIL_DEPARTMENT_POLICY_INDEX =
  'IDX_masking_detail_department_policy_id';
const MASKING_DETAIL_DEPARTMENT_POLICY_FOREIGN_KEY =
  'FK_masking_detail_department_policy';

/**
 * API 명세 v3 ERD의 소유 관계에 맞춰 부서 한도와 마스킹 상세 정책 참조를 정렬합니다.
 *
 * 과거 API 키 단위의 사용량은 부서 단위로 집계합니다. 마스킹 상세는 보고서 소유자의
 * 부서 정책이 정확히 하나로 해석되는 경우에만 변환합니다. 여러 부서 소속 등으로
 * 해석이 모호한 행은 삭제하거나 임의로 선택하지 않고, 명시적인 오류로 남겨 운영자가
 * 데이터를 보정하도록 합니다.
 */
export class AlignV3DepartmentQuotaAndMaskingDetail2026073100000
implements MigrationInterface {
  name = 'AlignV3DepartmentQuotaAndMaskingDetail2026073100000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.normalizeApiKeyMaskingClass(queryRunner);
    // MySQL DDL is not transactional. Check and complete the potentially
    // ambiguous masking-policy conversion before removing any quota sources.
    await this.preflightMaskingDetailPolicy(queryRunner);
    await this.alignMaskingDetailPolicy(queryRunner);
    await this.alignPromptLogStatus(queryRunner);
    await this.alignDepartmentQuota(queryRunner);
  }

  /**
   * policy_id는 전역 정책 ID라서 department_policy_id로 기계적으로 되돌릴 수 없습니다.
   * 따라서 down은 의도적으로 no-op입니다. 백업에서의 복구가 데이터 의미를 보존합니다.
   */
  async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }

  /**
   * API_KEY의 v3 분류는 민감 정보(SENSITIVE)입니다. 기존 policy ID를 유지하므로
   * department_policy 등 해당 정책을 참조하는 외래 키에는 영향을 주지 않습니다.
   */
  private async normalizeApiKeyMaskingClass(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (
      !(await queryRunner.hasTable(POLICY_TABLE))
      || !(await queryRunner.hasColumn(POLICY_TABLE, MASKING_CONTENT_COLUMN))
      || !(await queryRunner.hasColumn(POLICY_TABLE, MASKING_CLASS_COLUMN))
    ) {
      return;
    }

    await queryRunner.query(
      'UPDATE `' + POLICY_TABLE + '`'
        + " SET `" + MASKING_CLASS_COLUMN + "` = 'SENSITIVE'"
        + " WHERE `" + MASKING_CONTENT_COLUMN + "` = 'API_KEY'"
        + " AND `" + MASKING_CLASS_COLUMN + "` = 'PRIVATE'",
    );
  }

  /**
   * policy_id가 남아 있는 데이터는 보고서 작성자의 소속 부서를 통해서만
   * department_policy_id를 결정할 수 있습니다. 이 검증은 쓰기/삭제 전에 수행해
   * quota 레거시 컬럼이 먼저 사라지는 부분 성공 상태를 막습니다.
   */
  private async preflightMaskingDetailPolicy(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (!(await queryRunner.hasTable(MASKING_DETAIL_TABLE))) {
      return;
    }

    const hasDepartmentPolicyId = await queryRunner.hasColumn(
      MASKING_DETAIL_TABLE,
      DEPARTMENT_POLICY_ID_COLUMN,
    );
    const hasPolicyId = await queryRunner.hasColumn(
      MASKING_DETAIL_TABLE,
      POLICY_ID_COLUMN,
    );

    if (hasDepartmentPolicyId) {
      const unmappedCount = await this.countUnmappedMaskingDetails(queryRunner);
      if (unmappedCount === 0) {
        return;
      }

      if (!hasPolicyId) {
        this.throwUnmappedMaskingDetails(unmappedCount);
      }
    } else if (!hasPolicyId) {
      const unmappedCount = await this.countMaskingDetails(queryRunner);
      if (unmappedCount > 0) {
        this.throwUnmappedMaskingDetails(unmappedCount);
      }
      return;
    }

    await this.assertLegacyMaskingDetailMappingTables(queryRunner);
    const unmappedCount = await this.countLegacyUnmappedMaskingDetails(
      queryRunner,
      hasDepartmentPolicyId,
    );
    if (unmappedCount > 0) {
      this.throwUnmappedMaskingDetails(unmappedCount);
    }
  }

  private async alignDepartmentQuota(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(DEPARTMENT_TABLE))) {
      return;
    }

    const hasLegacyDepartmentLimit = await queryRunner.hasColumn(
      DEPARTMENT_TABLE,
      LEGACY_DEPARTMENT_LIMIT_COLUMN,
    );
    const hasActiveApiKeyTable = await queryRunner.hasTable(ACTIVE_API_KEY_TABLE);
    const hasLegacyActiveLimit = hasActiveApiKeyTable
      && await queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, LIMIT_COLUMN);
    const hasLegacyActiveDepartmentLimit = hasActiveApiKeyTable
      && await queryRunner.hasColumn(
        ACTIVE_API_KEY_TABLE,
        LEGACY_DEPARTMENT_LIMIT_COLUMN,
      );
    const hasLegacyActiveUsage = hasActiveApiKeyTable
      && await queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, USAGE_COLUMN);
    const hasLegacyActiveRecentUsePercent = hasActiveApiKeyTable
      && await queryRunner.hasColumn(
        ACTIVE_API_KEY_TABLE,
        RECENT_USE_PERCENT_COLUMN,
      );
    const hasLegacyActiveMustFiltering = hasActiveApiKeyTable
      && await queryRunner.hasColumn(ACTIVE_API_KEY_TABLE, MUST_FILTERING_COLUMN);

    await this.addColumnIfMissing(
      queryRunner,
      DEPARTMENT_TABLE,
      DEPARTMENT_CODE_COLUMN,
      new TableColumn({
        name: DEPARTMENT_CODE_COLUMN,
        type: 'varchar',
        length: '10',
        isNullable: false,
        default: "''",
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      DEPARTMENT_TABLE,
      LIMIT_COLUMN,
      this.createBigIntColumn(LIMIT_COLUMN),
    );
    await this.addColumnIfMissing(
      queryRunner,
      DEPARTMENT_TABLE,
      USAGE_COLUMN,
      this.createBigIntColumn(USAGE_COLUMN),
    );
    await this.addColumnIfMissing(
      queryRunner,
      DEPARTMENT_TABLE,
      RECENT_USE_PERCENT_COLUMN,
      this.createBigIntColumn(RECENT_USE_PERCENT_COLUMN),
    );
    await this.addColumnIfMissing(
      queryRunner,
      DEPARTMENT_TABLE,
      MUST_FILTERING_COLUMN,
      this.createBooleanColumn(MUST_FILTERING_COLUMN, '1'),
    );

    // MySQL DDL은 암시적으로 커밋됩니다. 대상 컬럼 추가 후 프로세스가 중단되어도
    // 레거시 컬럼이 남아 있는 한 아래 UPDATE를 다시 수행한 뒤에만 삭제해야 합니다.
    if (hasLegacyDepartmentLimit) {
      await queryRunner.query(
        'UPDATE `' + DEPARTMENT_TABLE + '`'
          + ' SET `' + LIMIT_COLUMN + '` = COALESCE(`'
          + LEGACY_DEPARTMENT_LIMIT_COLUMN + '`, 0)',
      );
    } else if (hasLegacyActiveLimit) {
      await queryRunner.query(this.createLegacyActiveQuotaUpdate({
        limit: true,
        usage: false,
        recentUsePercent: false,
        mustFiltering: false,
      }));
    } else if (hasLegacyActiveDepartmentLimit) {
      await queryRunner.query(this.createLegacyActiveDepartmentLimitUpdate());
    }

    if (hasLegacyActiveUsage) {
      await queryRunner.query(this.createLegacyActiveQuotaUpdate({
        limit: false,
        usage: true,
        recentUsePercent: false,
        mustFiltering: false,
      }));
    }
    if (hasLegacyActiveRecentUsePercent) {
      await queryRunner.query(this.createLegacyActiveQuotaUpdate({
        limit: false,
        usage: false,
        recentUsePercent: true,
        mustFiltering: false,
      }));
    }
    if (hasLegacyActiveMustFiltering) {
      await queryRunner.query(this.createLegacyActiveQuotaUpdate({
        limit: false,
        usage: false,
        recentUsePercent: false,
        mustFiltering: true,
      }));
    }

    if (hasLegacyDepartmentLimit) {
      await queryRunner.dropColumn(DEPARTMENT_TABLE, LEGACY_DEPARTMENT_LIMIT_COLUMN);
    }
    if (hasActiveApiKeyTable) {
      await this.dropColumnIfPresent(
        queryRunner,
        ACTIVE_API_KEY_TABLE,
        LIMIT_COLUMN,
      );
      await this.dropColumnIfPresent(
        queryRunner,
        ACTIVE_API_KEY_TABLE,
        USAGE_COLUMN,
      );
      await this.dropColumnIfPresent(
        queryRunner,
        ACTIVE_API_KEY_TABLE,
        RECENT_USE_PERCENT_COLUMN,
      );
      await this.dropColumnIfPresent(
        queryRunner,
        ACTIVE_API_KEY_TABLE,
        MUST_FILTERING_COLUMN,
      );
      await this.dropColumnIfPresent(
        queryRunner,
        ACTIVE_API_KEY_TABLE,
        LEGACY_DEPARTMENT_LIMIT_COLUMN,
      );
    }
  }

  private async alignMaskingDetailPolicy(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(MASKING_DETAIL_TABLE))) {
      return;
    }

    const hasDepartmentPolicyId = await queryRunner.hasColumn(
      MASKING_DETAIL_TABLE,
      DEPARTMENT_POLICY_ID_COLUMN,
    );
    const hasPolicyId = await queryRunner.hasColumn(
      MASKING_DETAIL_TABLE,
      POLICY_ID_COLUMN,
    );
    if (!hasDepartmentPolicyId) {
      await queryRunner.addColumn(
        MASKING_DETAIL_TABLE,
        new TableColumn({
          name: DEPARTMENT_POLICY_ID_COLUMN,
          type: 'bigint',
          isNullable: true,
        }),
      );
    }

    if (hasPolicyId && (
      !hasDepartmentPolicyId
      || (await this.countUnmappedMaskingDetails(queryRunner)) > 0
    )) {
      await this.resolveLegacyMaskingDetailPolicies(queryRunner);
    }

    const unmappedCount = await this.countUnmappedMaskingDetails(queryRunner);
    if (unmappedCount > 0) {
      this.throwUnmappedMaskingDetails(unmappedCount);
    }

    if (hasPolicyId) {
      await this.dropForeignKeysForColumn(
        queryRunner,
        MASKING_DETAIL_TABLE,
        POLICY_ID_COLUMN,
      );
      await queryRunner.dropColumn(MASKING_DETAIL_TABLE, POLICY_ID_COLUMN);
    }
    await queryRunner.changeColumn(
      MASKING_DETAIL_TABLE,
      DEPARTMENT_POLICY_ID_COLUMN,
      new TableColumn({
        name: DEPARTMENT_POLICY_ID_COLUMN,
        type: 'bigint',
        isNullable: false,
      }),
    );
    await this.ensureMaskingDetailDepartmentPolicyReference(queryRunner);
    await this.dropColumnIfPresent(
      queryRunner,
      MASKING_DETAIL_TABLE,
      END_INDEX_COLUMN,
    );
  }

  private async alignPromptLogStatus(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(PROMPT_LOG_TABLE))) {
      return;
    }

    const statusColumn = this.createPromptLogStatusColumn();
    if (!(await queryRunner.hasColumn(PROMPT_LOG_TABLE, PROMPT_LOG_STATUS_COLUMN))) {
      await queryRunner.addColumn(PROMPT_LOG_TABLE, statusColumn);
      return;
    }

    // 기존 값 중 v3에서 허용하지 않는 값은 안전한 초기 상태(PENDING)로 보정합니다.
    // LOWER/공백 등 표기만 달랐던 MASKING은 진행 중 상태를 보존합니다.
    await queryRunner.query([
      'UPDATE `' + PROMPT_LOG_TABLE + '`',
      'SET `' + PROMPT_LOG_STATUS_COLUMN + '` = CASE',
      "  WHEN UPPER(TRIM(`" + PROMPT_LOG_STATUS_COLUMN + "`)) = 'MASKING' THEN 'MASKING'",
      "  ELSE 'PENDING'",
      'END',
      'WHERE `' + PROMPT_LOG_STATUS_COLUMN + '` IS NULL',
      '  OR BINARY `' + PROMPT_LOG_STATUS_COLUMN + "` NOT IN ('PENDING', 'MASKING')",
    ].join('\n'));
    await queryRunner.changeColumn(
      PROMPT_LOG_TABLE,
      PROMPT_LOG_STATUS_COLUMN,
      statusColumn,
    );
  }

  private async resolveLegacyMaskingDetailPolicies(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await this.assertLegacyMaskingDetailMappingTables(queryRunner);

    await queryRunner.query(`
      UPDATE \`${MASKING_DETAIL_TABLE}\` AS \`detail\`
      INNER JOIN (
        SELECT
          \`detail_source\`.\`masking_detail_id\`,
          MIN(\`department_policy\`.\`department_policy_id\`) AS \`department_policy_id\`
        FROM \`${MASKING_DETAIL_TABLE}\` AS \`detail_source\`
        INNER JOIN \`${MASKING_REPORT_TABLE}\` AS \`report\`
          ON \`report\`.\`masking_report_id\` = \`detail_source\`.\`masking_report_id\`
        INNER JOIN \`${MEMBER_DEPARTMENT_TABLE}\` AS \`membership\`
          ON \`membership\`.\`member_id\` = \`report\`.\`member_id\`
        INNER JOIN \`${DEPARTMENT_POLICY_TABLE}\` AS \`department_policy\`
          ON \`department_policy\`.\`department_id\` = \`membership\`.\`department_id\`
          AND \`department_policy\`.\`policy_id\` = \`detail_source\`.\`policy_id\`
        GROUP BY \`detail_source\`.\`masking_detail_id\`
        HAVING COUNT(DISTINCT \`department_policy\`.\`department_policy_id\`) = 1
      ) AS \`resolved\`
        ON \`resolved\`.\`masking_detail_id\` = \`detail\`.\`masking_detail_id\`
      SET \`detail\`.\`department_policy_id\` = \`resolved\`.\`department_policy_id\`
      WHERE \`detail\`.\`department_policy_id\` IS NULL
    `);
  }

  private async assertLegacyMaskingDetailMappingTables(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const requiredTables = [
      MASKING_REPORT_TABLE,
      MEMBER_DEPARTMENT_TABLE,
      DEPARTMENT_POLICY_TABLE,
    ];
    for (const table of requiredTables) {
      if (!(await queryRunner.hasTable(table))) {
        throw new Error(
          `${MASKING_DETAIL_TABLE}.${POLICY_ID_COLUMN}를 ${DEPARTMENT_POLICY_ID_COLUMN}로 `
            + `변환하려면 ${table} 테이블이 필요합니다.`,
        );
      }
    }
  }

  private async countUnmappedMaskingDetails(
    queryRunner: QueryRunner,
  ): Promise<number> {
    return this.readUnmappedCount(await queryRunner.query(
      'SELECT COUNT(*) AS `unmapped_count` FROM `'
        + MASKING_DETAIL_TABLE + '` WHERE `'
        + DEPARTMENT_POLICY_ID_COLUMN + '` IS NULL',
    ));
  }

  private async countMaskingDetails(queryRunner: QueryRunner): Promise<number> {
    return this.readUnmappedCount(await queryRunner.query(
      'SELECT COUNT(*) AS `unmapped_count` FROM `'
        + MASKING_DETAIL_TABLE + '`',
    ));
  }

  private async countLegacyUnmappedMaskingDetails(
    queryRunner: QueryRunner,
    hasDepartmentPolicyId: boolean,
  ): Promise<number> {
    const conditions = hasDepartmentPolicyId
      ? [
        '`detail`.`' + DEPARTMENT_POLICY_ID_COLUMN + '` IS NULL',
        '`resolved`.`masking_detail_id` IS NULL',
      ]
      : ['`resolved`.`masking_detail_id` IS NULL'];

    return this.readUnmappedCount(await queryRunner.query([
      'SELECT COUNT(*) AS `unmapped_count`',
      'FROM `' + MASKING_DETAIL_TABLE + '` AS `detail`',
      'LEFT JOIN (',
      '  SELECT `detail_source`.`masking_detail_id`',
      '  FROM `' + MASKING_DETAIL_TABLE + '` AS `detail_source`',
      '  INNER JOIN `' + MASKING_REPORT_TABLE + '` AS `report`',
      '    ON `report`.`masking_report_id` = `detail_source`.`masking_report_id`',
      '  INNER JOIN `' + MEMBER_DEPARTMENT_TABLE + '` AS `membership`',
      '    ON `membership`.`member_id` = `report`.`member_id`',
      '  INNER JOIN `' + DEPARTMENT_POLICY_TABLE + '` AS `department_policy`',
      '    ON `department_policy`.`department_id` = `membership`.`department_id`',
      '    AND `department_policy`.`policy_id` = `detail_source`.`policy_id`',
      '  GROUP BY `detail_source`.`masking_detail_id`',
      '  HAVING COUNT(DISTINCT `department_policy`.`department_policy_id`) = 1',
      ') AS `resolved`',
      '  ON `resolved`.`masking_detail_id` = `detail`.`masking_detail_id`',
      'WHERE ' + conditions.join(' AND '),
    ].join('\n')));
  }

  private readUnmappedCount(result: unknown): number {
    if (!Array.isArray(result) || result.length === 0) {
      return 0;
    }

    const row = result[0] as { readonly unmapped_count?: string | number };
    return Number(row.unmapped_count ?? 0);
  }

  private throwUnmappedMaskingDetails(unmappedCount: number): never {
    throw new Error(
      `${MASKING_DETAIL_TABLE}.${DEPARTMENT_POLICY_ID_COLUMN} 변환에 실패한 `
        + `${unmappedCount}건이 있습니다. 보고서 소유자의 부서 정책을 보정한 뒤 `
        + '마이그레이션을 다시 실행하세요.',
    );
  }

  private createLegacyActiveQuotaUpdate(options: {
    readonly limit: boolean;
    readonly usage: boolean;
    readonly recentUsePercent: boolean;
    readonly mustFiltering: boolean;
  }): string {
    const selects = ['`department_id`'];
    const assignments: string[] = [];
    if (options.limit) {
      selects.push(
        'CASE WHEN SUM(CASE WHEN `limit` = 0 THEN 1 ELSE 0 END) > 0'
          + ' THEN 0 ELSE MAX(`limit`) END AS `limit`',
      );
      assignments.push('`department`.`limit` = COALESCE(`legacy`.`limit`, 0)');
    }
    if (options.usage) {
      selects.push('SUM(`usage`) AS `usage`');
      assignments.push('`department`.`usage` = COALESCE(`legacy`.`usage`, 0)');
    }
    if (options.recentUsePercent) {
      selects.push('ROUND(AVG(`recent_use_percent`)) AS `recent_use_percent`');
      assignments.push(
        '`department`.`recent_use_percent`'
          + ' = COALESCE(`legacy`.`recent_use_percent`, 0)',
      );
    }
    if (options.mustFiltering) {
      selects.push(
        'MAX(CASE WHEN `must_filtering` = 1 THEN 1 ELSE 0 END)'
          + ' AS `must_filtering`',
      );
      assignments.push(
        '`department`.`must_filtering`'
          + ' = COALESCE(`legacy`.`must_filtering`, 1)',
      );
    }

    return [
      'UPDATE `' + DEPARTMENT_TABLE + '` AS `department`',
      'LEFT JOIN (',
      '  SELECT ' + selects.join(', '),
      '  FROM `' + ACTIVE_API_KEY_TABLE + '`',
      '  GROUP BY `department_id`',
      ') AS `legacy`',
      '  ON `legacy`.`department_id` = `department`.`department_id`',
      'SET ' + assignments.join(', '),
    ].join('\n');
  }

  private createLegacyActiveDepartmentLimitUpdate(): string {
    return [
      'UPDATE `' + DEPARTMENT_TABLE + '` AS `department`',
      'LEFT JOIN (',
      '  SELECT `department_id`,',
      '    CASE',
      '      WHEN SUM(CASE WHEN `department_limit` = 0 THEN 1 ELSE 0 END) > 0 THEN 0',
      '      ELSE MAX(`department_limit`)',
      '    END AS `limit`',
      '  FROM `' + ACTIVE_API_KEY_TABLE + '`',
      '  GROUP BY `department_id`',
      ') AS `legacy`',
      '  ON `legacy`.`department_id` = `department`.`department_id`',
      'SET `department`.`limit` = COALESCE(`legacy`.`limit`, 0)',
    ].join('\n');
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    definition: TableColumn,
  ): Promise<void> {
    if (!(await queryRunner.hasColumn(table, column))) {
      await queryRunner.addColumn(table, definition);
    }
  }

  private async dropColumnIfPresent(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    if (await queryRunner.hasColumn(table, column)) {
      await queryRunner.dropColumn(table, column);
    }
  }

  private async dropForeignKeysForColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (table === undefined) {
      return;
    }

    for (const foreignKey of table.foreignKeys) {
      if (foreignKey.columnNames.includes(columnName)) {
        await queryRunner.dropForeignKey(table, foreignKey);
      }
    }
  }

  private async ensureMaskingDetailDepartmentPolicyReference(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (!(await queryRunner.hasTable(DEPARTMENT_POLICY_TABLE))) {
      throw new Error(
        `${MASKING_DETAIL_TABLE}.${DEPARTMENT_POLICY_ID_COLUMN}에 대한 외래 키를 `
          + `만들려면 ${DEPARTMENT_POLICY_TABLE} 테이블이 필요합니다.`,
      );
    }

    const table = await queryRunner.getTable(MASKING_DETAIL_TABLE);
    if (table === undefined) {
      throw new Error(`${MASKING_DETAIL_TABLE} 테이블 정보를 읽을 수 없습니다.`);
    }

    const hasIndex = table.indices.some((index) => (
      index.name === MASKING_DETAIL_DEPARTMENT_POLICY_INDEX
      || (index.columnNames.length === 1
        && index.columnNames[0] === DEPARTMENT_POLICY_ID_COLUMN)
    ));
    if (!hasIndex) {
      await queryRunner.createIndex(
        MASKING_DETAIL_TABLE,
        new TableIndex({
          name: MASKING_DETAIL_DEPARTMENT_POLICY_INDEX,
          columnNames: [DEPARTMENT_POLICY_ID_COLUMN],
        }),
      );
    }

    const foreignKeysForColumn = table.foreignKeys.filter((foreignKey) => (
      foreignKey.columnNames.length === 1
      && foreignKey.columnNames[0] === DEPARTMENT_POLICY_ID_COLUMN
    ));
    const hasExpectedForeignKey = foreignKeysForColumn.some((foreignKey) => (
      foreignKey.referencedTableName === DEPARTMENT_POLICY_TABLE
      && foreignKey.referencedColumnNames.length === 1
      && foreignKey.referencedColumnNames[0] === DEPARTMENT_POLICY_ID_COLUMN
    ));
    if (hasExpectedForeignKey) {
      return;
    }

    if (foreignKeysForColumn.length > 0) {
      throw new Error(
        `${MASKING_DETAIL_TABLE}.${DEPARTMENT_POLICY_ID_COLUMN}에 예상하지 못한 `
          + '외래 키가 있어 v3 관계를 적용할 수 없습니다.',
      );
    }

    await queryRunner.createForeignKey(
      MASKING_DETAIL_TABLE,
      new TableForeignKey({
        name: MASKING_DETAIL_DEPARTMENT_POLICY_FOREIGN_KEY,
        columnNames: [DEPARTMENT_POLICY_ID_COLUMN],
        referencedTableName: DEPARTMENT_POLICY_TABLE,
        referencedColumnNames: [DEPARTMENT_POLICY_ID_COLUMN],
      }),
    );
  }

  private createBigIntColumn(name: string): TableColumn {
    return new TableColumn({
      name,
      type: 'bigint',
      isNullable: false,
      default: '0',
    });
  }

  private createBooleanColumn(name: string, defaultValue: '0' | '1'): TableColumn {
    return new TableColumn({
      name,
      type: 'boolean',
      isNullable: false,
      default: defaultValue,
    });
  }

  private createPromptLogStatusColumn(): TableColumn {
    return new TableColumn({
      name: PROMPT_LOG_STATUS_COLUMN,
      type: 'varchar',
      length: '10',
      isNullable: false,
      default: "'PENDING'",
    });
  }
}
