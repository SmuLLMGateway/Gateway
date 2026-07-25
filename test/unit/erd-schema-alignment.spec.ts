import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { LlmDetailModelDAO } from '../../src/domain/admin/dao/llm-detail-model.dao.js';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MaskingDetailDAO } from '../../src/domain/prompt/dao/masking-detail.dao.js';
import { MaskingReportDAO } from '../../src/domain/prompt/dao/masking-report.dao.js';
import { PromptFileDAO } from '../../src/domain/prompt/dao/prompt-file.dao.js';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import { PromptRoomDAO } from '../../src/domain/prompt/dao/prompt-room.dao.js';
import { MASKING_CONTENT } from '../../src/domain/prompt/type/masking-content.type.js';

describe('ERD schema alignment', () => {
  const metadata = getMetadataArgsStorage();

  it('llm_detail_model 엔티티와 active_api_key 외래 키를 등록한다', () => {
    const table = metadata.tables.find(
      (candidate) => candidate.target === LlmDetailModelDAO,
    );
    const nameColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === LlmDetailModelDAO &&
        candidate.propertyName === 'llmName',
    );
    const activeApiKeyColumn = metadata.columns.find(
      (candidate) =>
        candidate.target === LlmDetailModelDAO &&
        candidate.propertyName === 'activeApiKeyId',
    );
    const relation = metadata.relations.find(
      (candidate) =>
        candidate.target === LlmDetailModelDAO &&
        candidate.propertyName === 'activeApiKey',
    );
    const joinColumn = metadata.joinColumns.find(
      (candidate) =>
        candidate.target === LlmDetailModelDAO &&
        candidate.propertyName === 'activeApiKey',
    );

    expect(table?.name).toBe('llm_detail_model');
    expect(nameColumn?.options).toMatchObject({
      name: 'llm_name',
      type: 'varchar',
      length: 50,
      nullable: true,
    });
    expect(activeApiKeyColumn?.options).toMatchObject({
      name: 'active_api_key_id',
      type: 'bigint',
    });
    expect(relation?.relationType).toBe('many-to-one');
    expect(relation?.options.nullable).toBe(false);
    expect(joinColumn?.name).toBe('active_api_key_id');
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
  });

  it('ERD에서 추가된 컬럼과 UUID 채팅방 PK를 등록한다', () => {
    const cases = [
      [ActiveApiKeyDAO, 'mustFiltering', {
        name: 'must_filtering',
        type: 'boolean',
        default: true,
      }],
      [MemberDepartmentDAO, 'role', {
        name: 'role',
        type: 'varchar',
        length: 10,
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
      [LlmDetailModelDAO, 'UQ_llm_detail_model_active_key_name'],
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
      Object.values(MASKING_CONTENT),
    );
  });
});
