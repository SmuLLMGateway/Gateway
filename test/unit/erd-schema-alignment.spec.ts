import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { ActiveLlmDAO } from '../../src/domain/admin/dao/active-llm.dao.js';
import { LlmDetailModelDAO } from '../../src/domain/admin/dao/llm-detail-model.dao.js';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { PresetDAO } from '../../src/domain/admin/dao/preset.dao.js';
import { PresetPolicyDAO } from '../../src/domain/admin/dao/preset-policy.dao.js';
import {
  HealthHistoryDAO,
  HealthStatus,
} from '../../src/domain/admin/dao/health-history.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MaskingDetailDAO } from '../../src/domain/prompt/dao/masking-detail.dao.js';
import { MaskingReportDAO } from '../../src/domain/prompt/dao/masking-report.dao.js';
import { PromptFileDAO } from '../../src/domain/prompt/dao/prompt-file.dao.js';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import { PromptRoomDAO } from '../../src/domain/prompt/dao/prompt-room.dao.js';
import { PromptLogStatus } from '../../src/domain/prompt/type/prompt-log-status.enum.js';
import { SECURITY_POLICY_CONTENTS } from '../../src/domain/admin/policy/security-policy.catalog.js';

describe('ERD schema alignment', () => {
  const metadata = getMetadataArgsStorage();

  it('active_llm 연결 엔티티가 active_api_key와 llm_detail_model을 필수로 참조한다', () => {
    const table = metadata.tables.find(
      (candidate) => candidate.target === ActiveLlmDAO,
    );
    const expectedColumns = [
      ['activeLlmId', { name: 'active_llm_id', type: 'bigint' }],
      ['activeApiKeyId', { name: 'active_api_key_id', type: 'bigint' }],
      ['llmDetailModelId', { name: 'llm_detail_model_id', type: 'bigint' }],
    ] as const;

    expect(table?.name).toBe('active_llm');
    for (const [propertyName, expected] of expectedColumns) {
      const column = metadata.columns.find(
        (candidate) =>
          candidate.target === ActiveLlmDAO
          && candidate.propertyName === propertyName,
      );
      expect(column?.options).toMatchObject(expected);
    }

    const relations = [
      ['activeApiKey', 'active_api_key_id'],
      ['llmDetailModel', 'llm_detail_model_id'],
    ] as const;
    for (const [propertyName, columnName] of relations) {
      const relation = metadata.relations.find(
        (candidate) =>
          candidate.target === ActiveLlmDAO
          && candidate.propertyName === propertyName,
      );
      const joinColumn = metadata.joinColumns.find(
        (candidate) =>
          candidate.target === ActiveLlmDAO
          && candidate.propertyName === propertyName,
      );
      expect(relation?.relationType).toBe('many-to-one');
      expect(relation?.options.nullable).toBe(false);
      expect(joinColumn?.name).toBe(columnName);
    }

    const activeLlmUniqueIndex = metadata.indices.find(
      (candidate) =>
        candidate.target === ActiveLlmDAO
        && candidate.name === 'UQ_active_llm_active_key_detail_model',
    );
    expect(activeLlmUniqueIndex?.unique).toBe(true);
    expect(activeLlmUniqueIndex?.columns).toEqual([
      'activeApiKeyId',
      'llmDetailModelId',
    ]);
  });

  it('llm_detail_model은 active_api_key 직접 외래 키 없이 공통 모델을 보관한다', () => {
    const table = metadata.tables.find(
      (candidate) => candidate.target === LlmDetailModelDAO,
    );
    const nameColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === LlmDetailModelDAO
        && candidate.propertyName === 'llmName',
    );
    const activeApiKeyColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === LlmDetailModelDAO
        && candidate.propertyName === 'activeApiKeyId',
    );
    const activeApiKeyRelation = metadata.relations.find(
      (candidate) =>
        candidate.target === LlmDetailModelDAO
        && candidate.propertyName === 'activeApiKey',
    );

    expect(table?.name).toBe('llm_detail_model');
    expect(nameColumn?.options).toMatchObject({
      name: 'llm_name',
      type: 'varchar',
      length: 50,
      nullable: true,
    });
    expect(activeApiKeyColumn).toBeUndefined();
    expect(activeApiKeyRelation).toBeUndefined();
  });

  it('부서가 공통 한도·사용량을 소유하고 active_api_key는 연결 정보만 둔다', () => {
    const expectedDepartmentColumns = [
      ['departmentCode', {
        name: 'department_code',
        type: 'varchar',
        length: 10,
      }],
      ['limit', { name: 'limit', type: 'bigint', default: 0 }],
      ['usage', { name: 'usage', type: 'decimal', precision: 20, scale: 6, default: 0 }],
      ['recentUsePercent', {
        name: 'recent_use_percent',
        type: 'bigint',
        default: 0,
      }],
    ] as const;
    for (const [propertyName, expected] of expectedDepartmentColumns) {
      const column = metadata.columns.find(
        (candidate) => candidate.target === DepartmentDAO
          && candidate.propertyName === propertyName,
      );
      expect(column?.options).toMatchObject(expected);
      expect(column?.options.nullable).not.toBe(true);
    }

    for (const propertyName of ['limit', 'usage', 'recentUsePercent'] as const) {
      const column = metadata.columns.find(
        (candidate) => candidate.target === ActiveApiKeyDAO
          && candidate.propertyName === propertyName,
      );
      expect(column).toBeUndefined();
    }
  });

  it('Local LLM 권한 연결을 위해 active_api_key.api_key는 NULL을 허용한다', () => {
    const apiKeyColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === ActiveApiKeyDAO
        && candidate.propertyName === 'apiKey',
    );

    expect(apiKeyColumn?.options).toMatchObject({
      name: 'api_key',
      type: 'varchar',
      length: 1_024,
      nullable: true,
    });
  });

  it('member_limit에 API 키별 한도와 사용량 컬럼을 둔다', () => {
    const limitColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === MemberLimitDAO
        && candidate.propertyName === 'limit',
    );
    const usageColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === MemberLimitDAO
        && candidate.propertyName === 'usage',
    );

    expect(limitColumn?.options).toMatchObject({
      name: 'limit',
      type: 'bigint',
    });
    expect(usageColumn?.options).toMatchObject({
      name: 'usage',
      type: 'decimal',
      precision: 20,
      scale: 6,
      default: 0,
    });
  });

  it('prompt_log가 masking_report를 필수 일대일 관계로 참조한다', () => {
    const reportIdColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === PromptLogDAO &&
        candidate.propertyName === 'maskingReportId',
    );
    const relation = metadata.relations.find(
      (candidate) =>
        candidate.target === PromptLogDAO &&
        candidate.propertyName === 'maskingReport',
    );
    const joinColumn = metadata.joinColumns.find(
      (candidate) =>
        candidate.target === PromptLogDAO &&
        candidate.propertyName === 'maskingReport',
    );

    expect(reportIdColumn?.options).toMatchObject({
      name: 'masking_report_id',
      type: 'varchar',
      length: 255,
    });
    expect(reportIdColumn?.options.nullable).not.toBe(true);
    expect(relation?.relationType).toBe('one-to-one');
    expect(relation?.options.nullable).toBe(false);
    expect(joinColumn?.name).toBe('masking_report_id');
  });

  it('마스킹 요청용 prompt_log는 채팅 시각과 모델 종류를 null로 저장할 수 있다', () => {
    const statusColumn = metadata.columns.find(
      (candidate) => candidate.target === PromptLogDAO
        && candidate.propertyName === 'status',
    );
    const communicatedAtColumn = metadata.columns.find(
      (candidate) => candidate.target === PromptLogDAO
        && candidate.propertyName === 'communicatedAt',
    );
    const modelTypeColumn = metadata.columns.find(
      (candidate) => candidate.target === PromptLogDAO
        && candidate.propertyName === 'modelType',
    );
    const usageColumn = metadata.columns.find(
      (candidate) => candidate.target === PromptLogDAO
        && candidate.propertyName === 'usage',
    );

    expect(statusColumn?.options).toMatchObject({
      name: 'status',
      type: 'varchar',
      default: PromptLogStatus.PENDING,
    });
    expect(statusColumn?.options.nullable).not.toBe(true);
    expect(communicatedAtColumn?.options).toMatchObject({
      name: 'communicated_at',
      type: 'timestamp',
      nullable: true,
    });
    expect(modelTypeColumn?.options).toMatchObject({
      name: 'model_type',
      type: 'varchar',
      length: 50,
      nullable: true,
    });
    expect(usageColumn?.options).toMatchObject({
      name: 'usage',
      type: 'decimal',
      precision: 20,
      scale: 6,
      nullable: true,
    });
  });

  it('masking_detail에 nullable 파일 URL 컬럼을 등록한다', () => {
    const fileUrlColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === MaskingDetailDAO &&
        candidate.propertyName === 'fileUrl',
    );

    expect(fileUrlColumn?.options).toMatchObject({
      name: 'file_url',
      type: 'varchar',
      length: 255,
      nullable: true,
    });
    const maskingTextColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === MaskingDetailDAO &&
        candidate.propertyName === 'maskingText',
    );
    expect(maskingTextColumn?.options).toMatchObject({
      name: 'masking_text',
      type: 'varchar',
      length: 255,
      nullable: true,
    });

    const departmentPolicyIdColumn = metadata.columns.find(
      (candidate) => candidate.target === MaskingDetailDAO
        && candidate.propertyName === 'departmentPolicyId',
    );
    const legacyPolicyIdColumn = metadata.columns.find(
      (candidate) => candidate.target === MaskingDetailDAO
        && candidate.propertyName === 'policyId',
    );
    const legacyEndIdxColumn = metadata.columns.find(
      (candidate) => candidate.target === MaskingDetailDAO
        && candidate.propertyName === 'endIdx',
    );
    const departmentPolicyRelation = metadata.relations.find(
      (candidate) => candidate.target === MaskingDetailDAO
        && candidate.propertyName === 'departmentPolicy',
    );
    const departmentPolicyJoin = metadata.joinColumns.find(
      (candidate) => candidate.target === MaskingDetailDAO
        && candidate.propertyName === 'departmentPolicy',
    );

    expect(departmentPolicyIdColumn?.options).toMatchObject({
      name: 'department_policy_id',
      type: 'bigint',
    });
    expect(departmentPolicyIdColumn?.options.nullable).not.toBe(true);
    expect(legacyPolicyIdColumn).toBeUndefined();
    expect(legacyEndIdxColumn).toBeUndefined();
    expect(departmentPolicyRelation?.relationType).toBe('many-to-one');
    expect(departmentPolicyRelation?.options.nullable).toBe(false);
    expect(departmentPolicyJoin?.name).toBe('department_policy_id');
  });

  it('ERD에서 추가된 컬럼과 UUID 채팅방 PK를 등록한다', () => {
    const cases = [
      [DepartmentDAO, 'mustFiltering', {
        name: 'must_filtering',
        type: 'boolean',
        default: true,
      }],
      [MaskingReportDAO, 'createdAt', {
        name: 'created_at',
        type: 'timestamp',
      }],
      [MaskingReportDAO, 'recentMaskingReportId', {
        name: 'recent_masking_report_id',
        type: 'varchar',
        length: 255,
        nullable: true,
      }],
      [PromptFileDAO, 'fileOriginalName', {
        name: 'file_original_name',
        type: 'varchar',
        length: 1_024,
      }],
      [PromptLogDAO, 'promptSummary', {
        name: 'prompt_summary',
        type: 'varchar',
        length: 50,
      }],
    ] as const;

    for (const [target, propertyName, expected] of cases) {
      const column = metadata.columns.find(
        (candidate) =>
          candidate.target === target &&
          candidate.propertyName === propertyName,
      );
      expect(column?.options).toMatchObject(expected);
    }

    const activeApiKeyMustFiltering = metadata.columns.find(
      (candidate) =>
        candidate.target === ActiveApiKeyDAO
        && candidate.propertyName === 'mustFiltering',
    );
    expect(activeApiKeyMustFiltering).toBeUndefined();

    const memberDepartmentRole = metadata.columns.find(
      (candidate) =>
        candidate.target === MemberDepartmentDAO
        && candidate.propertyName === 'role',
    );
    expect(memberDepartmentRole).toBeUndefined();

    const promptRoomId = metadata.columns.find(
      (candidate) =>
        candidate.target === PromptRoomDAO &&
        candidate.propertyName === 'promptRoomId',
    );
    expect(promptRoomId?.mode).toBe('regular');
    expect(promptRoomId?.options).toMatchObject({
      name: 'prompt_room_id',
      type: 'varchar',
      length: 255,
      primary: true,
    });

    const promptFileUrl = metadata.columns.find(
      (candidate) =>
        candidate.target === PromptFileDAO &&
        candidate.propertyName === 'fileUrl',
    );
    expect(promptFileUrl?.options).toMatchObject({
      name: 'file_url',
      type: 'varchar',
      length: 1_024,
      charset: 'ascii',
      collation: 'ascii_bin',
    });
  });

  it('업무상 중복이 허용되지 않는 복합 키에 unique index를 등록한다', () => {
    const expected = [
      [ActiveApiKeyDAO, 'UQ_active_api_key_department_service'],
      [ActiveLlmDAO, 'UQ_active_llm_active_key_detail_model'],
      [MemberDepartmentDAO, 'UQ_member_department_member_department'],
      [MemberLimitDAO, 'UQ_member_limit_member_active_key'],
      [PromptFileDAO, 'UQ_prompt_file_file_url'],
      [MemberDAO, 'UQ_member_email'],
    ] as const;

    for (const [target, name] of expected) {
      const index = metadata.indices.find(
        (candidate) => candidate.target === target && candidate.name === name,
      );
      expect(index?.unique).toBe(true);
    }
  });

  it('기존 정책 데이터와 충돌하는 policy 복합 unique index를 만들지 않는다', () => {
    const policyUniqueIndex = metadata.indices.find(
      (candidate) =>
        candidate.target === PolicyDAO
        && candidate.name === 'UQ_policy_department_content_class',
    );

    expect(policyUniqueIndex).toBeUndefined();
  });

  it('member refresh_token 길이를 255자로 제한한다', () => {
    const refreshTokenColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === MemberDAO &&
        candidate.propertyName === 'refreshToken',
    );

    expect(refreshTokenColumn?.options).toMatchObject({
      name: 'refresh_token',
      type: 'varchar',
      length: 255,
      nullable: true,
      select: false,
    });
  });

  it('member_department에서 한 회원의 여러 부서 연결을 허용한다', () => {
    const memberRelation = metadata.relations.find(
      (candidate) =>
        candidate.target === MemberDepartmentDAO &&
        candidate.propertyName === 'member',
    );
    const memberIndex = metadata.indices.find(
      (candidate) =>
        candidate.target === MemberDepartmentDAO &&
        candidate.name === 'IDX_member_department_member_id',
    );

    expect(memberRelation?.relationType).toBe('many-to-one');
    expect(memberRelation?.options.nullable).toBe(false);
    expect(memberIndex?.columns).toEqual(['memberId']);
    expect(memberIndex?.unique).toBe(false);
  });

  it('policy masking_content를 지원 값으로 제한한 enum으로 등록한다', () => {
    const maskingContentColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === PolicyDAO &&
        candidate.propertyName === 'maskingContent',
    );

    expect(maskingContentColumn?.options.type).toBe('enum');
    expect(maskingContentColumn?.options.enum).toEqual(
      SECURITY_POLICY_CONTENTS,
    );
  });

  it('정책 활성 상태는 프리셋에만 두고 부서별 연결에는 활성 상태 기본값을 둔다', () => {
    const policyIsActiveColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === PolicyDAO
        && candidate.propertyName === 'isActive',
    );
    const departmentPolicyIsActiveColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === DepartmentPolicyDAO
        && candidate.propertyName === 'isActive',
    );

    expect(policyIsActiveColumn).toBeUndefined();
    expect(departmentPolicyIsActiveColumn?.options).toMatchObject({
      name: 'is_active',
      type: 'boolean',
      default: true,
    });
  });

  it('부서와 정책의 N:N 관계를 department_policy 연결 엔티티로 등록한다', () => {
    const table = metadata.tables.find(
      (candidate) => candidate.target === DepartmentPolicyDAO,
    );
    const expectedColumns = [
      ['departmentPolicyId', {
        name: 'department_policy_id',
        type: 'bigint',
      }],
      ['isActive', {
        name: 'is_active',
        type: 'boolean',
        default: true,
      }],
      ['departmentId', {
        name: 'department_id',
        type: 'bigint',
      }],
      ['policyId', {
        name: 'policy_id',
        type: 'bigint',
      }],
    ] as const;

    expect(table?.name).toBe('department_policy');
    for (const [propertyName, expected] of expectedColumns) {
      const column = metadata.columns.find(
        (candidate) =>
          candidate.target === DepartmentPolicyDAO
          && candidate.propertyName === propertyName,
      );
      expect(column?.options).toMatchObject(expected);
    }

    const relations = [
      ['department', 'department_id'],
      ['policy', 'policy_id'],
    ] as const;
    for (const [propertyName, columnName] of relations) {
      const relation = metadata.relations.find(
        (candidate) =>
          candidate.target === DepartmentPolicyDAO
          && candidate.propertyName === propertyName,
      );
      const joinColumn = metadata.joinColumns.find(
        (candidate) =>
          candidate.target === DepartmentPolicyDAO
          && candidate.propertyName === propertyName,
      );
      expect(relation?.relationType).toBe('many-to-one');
      expect(relation?.options.nullable).toBe(false);
      expect(joinColumn?.name).toBe(columnName);
    }

    for (const target of [DepartmentDAO, PolicyDAO]) {
      const inverseRelation = metadata.relations.find(
        (candidate) =>
          candidate.target === target
          && candidate.propertyName === 'departmentPolicies',
      );
      expect(inverseRelation?.relationType).toBe('one-to-many');
    }
  });

  it('policy에서 기존 department_id 직접 외래 키를 제거한다', () => {
    const departmentIdColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === PolicyDAO
        && candidate.propertyName === 'departmentId',
    );
    const departmentRelation = metadata.relations.find(
      (candidate) =>
        candidate.target === PolicyDAO
        && candidate.propertyName === 'department',
    );

    expect(departmentIdColumn).toBeUndefined();
    expect(departmentRelation).toBeUndefined();
  });

  it('보안 정책 프리셋과 프리셋별 정책 연결을 등록한다', () => {
    const presetTable = metadata.tables.find(
      (candidate) => candidate.target === PresetDAO,
    );
    const presetPolicyTable = metadata.tables.find(
      (candidate) => candidate.target === PresetPolicyDAO,
    );
    const expectedPresetColumns = [
      ['policyPresetId', { name: 'policy_preset_id', type: 'bigint' }],
      ['name', { name: 'name', type: 'varchar', length: 255, nullable: true }],
      ['isActive', { name: 'is_active', type: 'boolean', default: true }],
    ] as const;
    const expectedPresetPolicyColumns = [
      ['presetPolicyId', { name: 'preset_policy_id', type: 'bigint' }],
      ['policyPresetId', { name: 'policy_preset_id', type: 'bigint' }],
      ['policyId', { name: 'policy_id', type: 'bigint' }],
    ] as const;

    expect(presetTable?.name).toBe('preset');
    expect(presetPolicyTable?.name).toBe('preset_policy');
    for (const [propertyName, expected] of expectedPresetColumns) {
      const column = metadata.columns.find(
        (candidate) => candidate.target === PresetDAO
          && candidate.propertyName === propertyName,
      );
      expect(column?.options).toMatchObject(expected);
    }
    for (const [propertyName, expected] of expectedPresetPolicyColumns) {
      const column = metadata.columns.find(
        (candidate) => candidate.target === PresetPolicyDAO
          && candidate.propertyName === propertyName,
      );
      expect(column?.options).toMatchObject(expected);
    }

    const relations = [
      ['preset', 'policy_preset_id'],
      ['policy', 'policy_id'],
    ] as const;
    for (const [propertyName, columnName] of relations) {
      const relation = metadata.relations.find(
        (candidate) => candidate.target === PresetPolicyDAO
          && candidate.propertyName === propertyName,
      );
      const joinColumn = metadata.joinColumns.find(
        (candidate) => candidate.target === PresetPolicyDAO
          && candidate.propertyName === propertyName,
      );
      expect(relation?.relationType).toBe('many-to-one');
      expect(relation?.options.nullable).toBe(false);
      expect(joinColumn?.name).toBe(columnName);
    }
  });

  it('서비스 헬스 체크 이력을 health_history에 저장한다', () => {
    const table = metadata.tables.find(
      (candidate) => candidate.target === HealthHistoryDAO,
    );
    const expectedColumns = [
      ['healthHistoryId', { name: 'health_history_id', type: 'bigint' }],
      ['serviceName', { name: 'service_name', type: 'varchar', length: 50 }],
      ['status', {
        name: 'status',
        type: 'varchar',
        length: 10,
        default: HealthStatus.OK,
      }],
      ['latency', { name: 'latency', type: 'int' }],
      ['createdAt', {
        name: 'created_at',
        type: 'timestamp',
        precision: 0,
      }],
    ] as const;

    expect(table?.name).toBe('health_history');
    for (const [propertyName, expected] of expectedColumns) {
      const column = metadata.columns.find(
        (candidate) => candidate.target === HealthHistoryDAO
          && candidate.propertyName === propertyName,
      );
      expect(column?.options).toMatchObject(expected);
      expect(column?.options.nullable).not.toBe(true);
    }
  });
});
