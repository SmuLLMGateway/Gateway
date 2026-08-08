import type { DataSource, Repository } from 'typeorm';
import { AdminErrorStatus } from '../../src/domain/admin/code/admin.status.js';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { ActiveLlmDAO } from '../../src/domain/admin/dao/active-llm.dao.js';
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { HealthHistoryDAO } from '../../src/domain/admin/dao/health-history.dao.js';
import { LlmDetailModelDAO } from '../../src/domain/admin/dao/llm-detail-model.dao.js';
import { PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import type { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import { NerClient } from '../../src/global/ner/client/ner.client.js';
import { NerRequestException } from '../../src/global/ner/exception/ner-request.exception.js';
import type { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import type { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import type { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';
import { LOCAL_LLM_MODEL } from '../../src/global/llm/llm-service.mapping.js';
import type { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';

describe('AdminService 전역 로컬 Deployment 등록·목록·상태 변경', () => {
  const departmentRepository = { findOneBy: jest.fn() };
  const memberDepartmentRepository = { findOne: jest.fn() };
  const memberRepository = { findOneBy: jest.fn() };
  const adminLogRepository = { save: jest.fn() };
  const llmDetailModelRepository = {
    find: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  };
  const activeApiKeyRepository = { find: jest.fn() };
  const activeLlmRepository = { upsert: jest.fn(), delete: jest.fn() };
  const entityManager = { getRepository: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const nerClient = {
    createLlmDeployment: jest.fn(),
    createNerDeployment: jest.fn(),
    updateLlmDeploymentEnabled: jest.fn(),
    updateNerDeploymentEnabled: jest.fn(),
    getLlmDeployments: jest.fn(),
    getEnabledLocalLlmDeploymentIds: jest.fn(),
  };

  const service = new AdminService(
    dataSource as unknown as DataSource,
    {} as PasswordEncoderService,
    {} as UserMapper,
    {} as AdminMapper,
    memberRepository as unknown as Repository<MemberDAO>,
    departmentRepository as unknown as Repository<DepartmentDAO>,
    memberDepartmentRepository as unknown as Repository<MemberDepartmentDAO>,
    {} as Repository<MemberLimitDAO>,
    activeApiKeyRepository as unknown as Repository<ActiveApiKeyDAO>,
    {} as Repository<DepartmentPolicyDAO>,
    {} as Repository<PolicyDAO>,
    adminLogRepository as unknown as Repository<AdminLogDAO>,
    {} as Repository<HealthHistoryDAO>,
    {} as LlmApiKeyValidationClient,
    {} as ApiKeyEncryptionService,
    {} as MinioObjectStorageService,
    undefined,
    undefined,
    nerClient as unknown as NerClient,
  );

  const totalAdmin = {
    userId: 1,
    expiredAt: '',
    accessToken: true,
    role: UserRole.TOTAL_ADMIN,
  } as const;
  const departmentAdmin = {
    userId: 2,
    expiredAt: '',
    accessToken: true,
    role: UserRole.DEPART_ADMIN,
  } as const;
  const llmRequest = {
    deploymentId: 'local-qwen3:8b',
    adapterType: 'openai_compatible' as const,
    baseUrl: 'http://ollama:11434/v1',
    modelName: 'qwen3:8b',
    timeoutMs: 300_000,
  };
  const nerRequest = {
    deploymentId: 'local-ner-gliner-multi',
    adapterType: 'gliner_http' as const,
    baseUrl: 'http://ner-server:8008/ner',
    timeoutMs: 30_000,
  };
  const mockLlmRequest = {
    deploymentId: 'local-mock',
    adapterType: 'mock' as const,
  };
  const mockNerRequest = {
    deploymentId: 'local-ner-mock',
    adapterType: 'mock' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    memberRepository.findOneBy.mockResolvedValue({ memberName: '총관리자' });
    adminLogRepository.save.mockResolvedValue(undefined);
    nerClient.getEnabledLocalLlmDeploymentIds.mockResolvedValue([]);
    nerClient.getLlmDeployments.mockResolvedValue([]);
    llmDetailModelRepository.find.mockResolvedValue([]);
    llmDetailModelRepository.insert.mockResolvedValue(undefined);
    llmDetailModelRepository.delete.mockResolvedValue(undefined);
    activeApiKeyRepository.find.mockResolvedValue([]);
    activeLlmRepository.upsert.mockResolvedValue(undefined);
    activeLlmRepository.delete.mockResolvedValue(undefined);
    entityManager.getRepository.mockImplementation((entity) => {
      if (entity === LlmDetailModelDAO) return llmDetailModelRepository;
      if (entity === ActiveApiKeyDAO) return activeApiKeyRepository;
      if (entity === ActiveLlmDAO) return activeLlmRepository;
      throw new Error('예상하지 못한 동기화 Repository입니다.');
    });
    dataSource.transaction.mockImplementation(async (work) => (
      work(entityManager)
    ));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('총 관리자는 전역 OpenAI 호환 로컬 LLM을 등록한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T01:02:03.000Z'));
    nerClient.createLlmDeployment.mockResolvedValue({
      deploymentId: llmRequest.deploymentId,
    });

    await expect(service.registerLocalLlm(llmRequest, totalAdmin)).resolves
      .toEqual({
        deploymentId: 'local-qwen3:8b',
        createdAt: '2026-08-03T10:02:03.000+09:00',
      });
    expect(nerClient.createLlmDeployment).toHaveBeenCalledWith({
      ...llmRequest,
      enabled: true,
    });
    expect(departmentRepository.findOneBy).not.toHaveBeenCalled();
    expect(adminLogRepository.save).toHaveBeenCalledWith({
      logContent: '로컬 LLM Deployment local-qwen3:8b를 등록하고 모든 부서의 사용 가능 모델을 동기화했습니다.',
      actionAt: expect.any(Date),
      actionMemberName: '총관리자',
    });
  });

  it('총 관리자는 LPL의 로컬 LLM 목록을 필터링 없이 그대로 조회한다', async () => {
    const llmDeployments = [
      { deploymentId: 'ollama-qwen3-8b', enabled: true },
      { deploymentId: 'ollama-disabled', enabled: false },
    ];
    nerClient.getLlmDeployments.mockResolvedValue(llmDeployments);

    await expect(service.getLocalLlmList(totalAdmin)).resolves.toEqual({
      deployments: llmDeployments,
    });
    expect(nerClient.getLlmDeployments).toHaveBeenCalledTimes(1);
    expect(adminLogRepository.save).not.toHaveBeenCalled();
  });

  it('부서 관리자는 자신의 부서를 포함해 로컬 Deployment를 등록·상태 변경하거나 로컬 LLM 목록을 조회할 수 없다', async () => {
    await expect(service.registerLocalLlm(llmRequest, departmentAdmin))
      .rejects.toMatchObject({ baseStatus: { code: 'AUTH403_1' } });
    await expect(service.registerLocalNer(nerRequest, departmentAdmin))
      .rejects.toMatchObject({ baseStatus: { code: 'AUTH403_1' } });
    await expect(service.getLocalLlmList(departmentAdmin))
      .rejects.toMatchObject({ baseStatus: { code: 'AUTH403_1' } });
    await expect(service.updateLocalLlmStatus(
      'ollama-qwen3-8b',
      { enabled: false },
      departmentAdmin,
    )).rejects.toMatchObject({ baseStatus: { code: 'AUTH403_1' } });
    await expect(service.updateLocalNerStatus(
      'ner-gliner-multi',
      { enabled: false },
      departmentAdmin,
    )).rejects.toMatchObject({ baseStatus: { code: 'AUTH403_1' } });
    expect(nerClient.createLlmDeployment).not.toHaveBeenCalled();
    expect(nerClient.createNerDeployment).not.toHaveBeenCalled();
    expect(nerClient.getLlmDeployments).not.toHaveBeenCalled();
    expect(nerClient.updateLlmDeploymentEnabled).not.toHaveBeenCalled();
    expect(nerClient.updateNerDeploymentEnabled).not.toHaveBeenCalled();
    expect(departmentRepository.findOneBy).not.toHaveBeenCalled();
    expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
  });

  it('mock 어댑터는 연결 설정 없이 LPL에 전달한다', async () => {
    nerClient.createLlmDeployment.mockResolvedValue({
      deploymentId: mockLlmRequest.deploymentId,
    });
    nerClient.createNerDeployment.mockResolvedValue({
      deploymentId: mockNerRequest.deploymentId,
    });

    await expect(service.registerLocalLlm(mockLlmRequest, totalAdmin))
      .resolves.toMatchObject({ deploymentId: 'local-mock' });
    await expect(service.registerLocalNer(mockNerRequest, totalAdmin))
      .resolves.toMatchObject({ deploymentId: 'local-ner-mock' });
    expect(nerClient.createLlmDeployment).toHaveBeenCalledWith({
      ...mockLlmRequest,
      enabled: true,
    });
    expect(nerClient.createNerDeployment).toHaveBeenCalledWith({
      ...mockNerRequest,
      enabled: true,
    });
  });

  it('등록 요청에 enabled가 있어도 LPL에는 항상 활성 상태로 전송한다', async () => {
    nerClient.createLlmDeployment.mockResolvedValue({
      deploymentId: llmRequest.deploymentId,
    });
    nerClient.createNerDeployment.mockResolvedValue({
      deploymentId: nerRequest.deploymentId,
    });

    await service.registerLocalLlm({
      ...llmRequest,
      enabled: false,
    } as never, totalAdmin);
    await service.registerLocalNer({
      ...nerRequest,
      enabled: false,
    } as never, totalAdmin);

    expect(nerClient.createLlmDeployment).toHaveBeenCalledWith({
      ...llmRequest,
      enabled: true,
    });
    expect(nerClient.createNerDeployment).toHaveBeenCalledWith({
      ...nerRequest,
      enabled: true,
    });
  });

  it('등록 시 OpenAI 호환 LLM은 local-* 모델명과 같은 Deployment ID만, NER은 local-* ID만 허용한다', async () => {
    await expect(service.registerLocalLlm({
      ...llmRequest,
      deploymentId: 'local-another-model',
    }, totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
    });
    await expect(service.registerLocalNer({
      ...nerRequest,
      deploymentId: 'ner-gliner-multi',
    }, totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
    });
    await expect(service.registerLocalLlm({
      ...llmRequest,
      deploymentId: `local-${'a'.repeat(45)}`,
      modelName: 'a'.repeat(45),
    }, totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
    });

    expect(nerClient.createLlmDeployment).not.toHaveBeenCalled();
    expect(nerClient.createNerDeployment).not.toHaveBeenCalled();
  });

  it('활성 로컬 LLM 모델만 중복 없이 저장하고 모든 부서의 Local LLM 키에 매핑한다', async () => {
    nerClient.createLlmDeployment.mockResolvedValue({
      deploymentId: llmRequest.deploymentId,
    });
    nerClient.getEnabledLocalLlmDeploymentIds.mockResolvedValue([
      'local-qwen3:8b',
      'local-mistral:7b',
      'local-qwen3:8b',
    ]);
    llmDetailModelRepository.find
      .mockResolvedValueOnce([{ llmName: 'local-qwen3:8b' }])
      .mockResolvedValueOnce([
        { llmDetailModelId: '301' },
        { llmDetailModelId: '302' },
      ]);
    activeApiKeyRepository.find.mockResolvedValue([
      { activeApiKeyId: '71' },
      { activeApiKeyId: '72' },
    ]);

    await expect(service.registerLocalLlm(llmRequest, totalAdmin))
      .resolves.toMatchObject({ deploymentId: llmRequest.deploymentId });

    expect(llmDetailModelRepository.insert).toHaveBeenCalledWith([
      { llmName: 'local-mistral:7b' },
    ]);
    expect(activeLlmRepository.upsert).toHaveBeenCalledWith([
      { activeApiKeyId: '71', llmDetailModelId: '301' },
      { activeApiKeyId: '71', llmDetailModelId: '302' },
      { activeApiKeyId: '72', llmDetailModelId: '301' },
      { activeApiKeyId: '72', llmDetailModelId: '302' },
    ], ['activeApiKeyId', 'llmDetailModelId']);
    expect(activeApiKeyRepository.find).toHaveBeenCalledWith({
      select: { activeApiKeyId: true },
      where: { serviceType: LOCAL_LLM_MODEL },
    });
  });

  it('총 관리자가 로컬 LLM을 활성화하면 LPL 응답을 반환하고 Local LLM 키에 동기화한다', async () => {
    const deployment = {
      deploymentId: 'local-qwen3:8b',
      enabled: true,
      adapterType: 'openai_compatible',
      baseUrl: 'http://ollama:11434/v1',
      modelName: 'qwen3:8b',
      timeoutMs: 300_000,
    };
    nerClient.updateLlmDeploymentEnabled.mockResolvedValue(deployment);
    nerClient.getEnabledLocalLlmDeploymentIds.mockResolvedValue([
      'local-qwen3:8b',
      'local-mistral:7b',
    ]);
    llmDetailModelRepository.find
      .mockResolvedValueOnce([{ llmName: 'local-qwen3:8b' }])
      .mockResolvedValueOnce([
        { llmDetailModelId: '301' },
        { llmDetailModelId: '302' },
      ]);
    activeApiKeyRepository.find.mockResolvedValue([
      { activeApiKeyId: '71' },
      { activeApiKeyId: '72' },
    ]);

    await expect(service.updateLocalLlmStatus(
      '  local-qwen3:8b  ',
      { enabled: true },
      totalAdmin,
    )).resolves.toEqual(deployment);

    expect(nerClient.updateLlmDeploymentEnabled).toHaveBeenCalledWith(
      'local-qwen3:8b',
      true,
    );
    expect(llmDetailModelRepository.insert).toHaveBeenCalledWith([
      { llmName: 'local-mistral:7b' },
    ]);
    expect(activeLlmRepository.upsert).toHaveBeenCalledWith([
      { activeApiKeyId: '71', llmDetailModelId: '301' },
      { activeApiKeyId: '71', llmDetailModelId: '302' },
      { activeApiKeyId: '72', llmDetailModelId: '301' },
      { activeApiKeyId: '72', llmDetailModelId: '302' },
    ], ['activeApiKeyId', 'llmDetailModelId']);
    expect(activeApiKeyRepository.find).toHaveBeenCalledWith({
      select: { activeApiKeyId: true },
      where: { serviceType: LOCAL_LLM_MODEL },
    });
    expect(activeLlmRepository.delete).not.toHaveBeenCalled();
  });

  it('로컬 LLM을 비활성화하면 llm_detail_model은 보존하고 active_llm 연결만 삭제한다', async () => {
    nerClient.updateLlmDeploymentEnabled.mockResolvedValue({
      deploymentId: 'local-qwen3:8b',
      enabled: false,
      adapterType: 'openai_compatible',
      baseUrl: 'http://ollama:11434/v1',
      modelName: 'qwen3:8b',
      timeoutMs: 300_000,
    });
    nerClient.getEnabledLocalLlmDeploymentIds.mockResolvedValue([]);
    llmDetailModelRepository.find.mockResolvedValue([
      { llmDetailModelId: '301' },
    ]);
    activeApiKeyRepository.find.mockResolvedValue([
      { activeApiKeyId: '71' },
    ]);

    await expect(service.updateLocalLlmStatus(
      'local-qwen3:8b',
      { enabled: false },
      totalAdmin,
    )).resolves.toMatchObject({ enabled: false });

    expect(activeLlmRepository.delete).toHaveBeenCalledTimes(1);
    const deleteCriteria = activeLlmRepository.delete.mock.calls[0]?.[0] as {
      activeApiKeyId: { value: unknown };
      llmDetailModelId: { value: unknown };
    };
    expect(deleteCriteria.activeApiKeyId.value).toEqual(['71']);
    expect(deleteCriteria.llmDetailModelId.value).toEqual(['301']);
    expect(activeApiKeyRepository.find).toHaveBeenCalledWith({
      select: { activeApiKeyId: true },
      where: { serviceType: LOCAL_LLM_MODEL },
    });
    expect(activeLlmRepository.upsert).not.toHaveBeenCalled();
    expect(llmDetailModelRepository.delete).not.toHaveBeenCalled();
    expect(llmDetailModelRepository.insert).not.toHaveBeenCalled();
  });

  it('레거시 non-local Deployment 상태 변경은 DB active_llm을 변경하지 않는다', async () => {
    nerClient.updateLlmDeploymentEnabled.mockResolvedValue({
      deploymentId: 'ollama-qwen3-8b',
      enabled: false,
      adapterType: 'openai_compatible',
      baseUrl: 'http://ollama:11434/v1',
      modelName: 'qwen3:8b',
      timeoutMs: 300_000,
    });
    await expect(service.updateLocalLlmStatus(
      'ollama-qwen3-8b',
      { enabled: false },
      totalAdmin,
    )).resolves.toMatchObject({ enabled: false });

    expect(activeLlmRepository.delete).not.toHaveBeenCalled();
    expect(llmDetailModelRepository.delete).not.toHaveBeenCalled();
  });

  it('modelName이 없는 mock LLM 상태 변경은 DB를 변경하지 않는다', async () => {
    nerClient.updateLlmDeploymentEnabled.mockResolvedValue({
      deploymentId: 'llm-mock',
      enabled: false,
      adapterType: 'mock',
    });

    await expect(service.updateLocalLlmStatus(
      'llm-mock',
      { enabled: false },
      totalAdmin,
    )).resolves.toEqual({
      deploymentId: 'llm-mock',
      enabled: false,
      adapterType: 'mock',
    });

    expect(nerClient.getEnabledLocalLlmDeploymentIds).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(llmDetailModelRepository.find).not.toHaveBeenCalled();
    expect(activeLlmRepository.upsert).not.toHaveBeenCalled();
    expect(activeLlmRepository.delete).not.toHaveBeenCalled();
  });

  it('로컬 NER 상태 변경은 LPL 응답을 반환하고 LLM DB를 변경하지 않는다', async () => {
    const deployment = {
      deploymentId: 'ner-gliner-multi',
      enabled: false,
      adapterType: 'gliner_http',
      baseUrl: 'http://ner-server:8008/ner',
      timeoutMs: 30_000,
    };
    nerClient.updateNerDeploymentEnabled.mockResolvedValue(deployment);

    await expect(service.updateLocalNerStatus(
      'ner-gliner-multi',
      { enabled: false },
      totalAdmin,
    )).resolves.toEqual(deployment);

    expect(nerClient.updateNerDeploymentEnabled).toHaveBeenCalledWith(
      'ner-gliner-multi',
      false,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(llmDetailModelRepository.find).not.toHaveBeenCalled();
    expect(activeLlmRepository.upsert).not.toHaveBeenCalled();
    expect(activeLlmRepository.delete).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    {},
    { enabled: 'true' },
    { enabled: true, unexpected: true },
    [],
  ])('로컬 Deployment 상태 요청 본문 %p를 LPL 호출 전에 거부한다', async (dto) => {
    await expect(service.updateLocalLlmStatus(
      'ollama-qwen3-8b',
      dto as never,
      totalAdmin,
    )).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_STATE,
    });

    expect(nerClient.updateLlmDeploymentEnabled).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it.each([
    [404, AdminErrorStatus.LOCAL_DEPLOYMENT_NOT_FOUND],
    [422, AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION],
    [503, AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE],
  ])('LPL 상태 변경 %i 오류를 LLM·NER Gateway 상태로 변환한다', async (status, expectedStatus) => {
    nerClient.updateLlmDeploymentEnabled.mockRejectedValue(
      new NerRequestException({ status }),
    );
    nerClient.updateNerDeploymentEnabled.mockRejectedValue(
      new NerRequestException({ status }),
    );

    await expect(service.updateLocalLlmStatus(
      'ollama-qwen3-8b',
      { enabled: false },
      totalAdmin,
    )).rejects.toMatchObject({ baseStatus: expectedStatus });
    await expect(service.updateLocalNerStatus(
      'ner-gliner-multi',
      { enabled: false },
      totalAdmin,
    )).rejects.toMatchObject({ baseStatus: expectedStatus });

    expect(adminLogRepository.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it.each([
    'gliner_http',
    'hf_inference_token_classification',
    'http_ner',
  ])('지원하는 NER 어댑터 %s를 LPL에 전달한다', async (adapterType) => {
    nerClient.createNerDeployment.mockResolvedValue({
      deploymentId: nerRequest.deploymentId,
    });

    const request = { ...nerRequest, adapterType };
    await expect(service.registerLocalNer(request as never, totalAdmin))
      .resolves.toMatchObject({ deploymentId: 'local-ner-gliner-multi' });
    expect(nerClient.createNerDeployment).toHaveBeenCalledWith({
      ...request,
      enabled: true,
    });
  });

  it('지원하지 않는 어댑터, 누락된 설정, mock의 연결 설정을 거부한다', async () => {
    await expect(service.registerLocalLlm({
      ...llmRequest,
      adapterType: 'unsupported',
    } as never, totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
    });
    await expect(service.registerLocalNer({
      ...nerRequest,
      adapterType: 'unsupported',
    } as never, totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
    });
    await expect(service.registerLocalLlm({
      deploymentId: 'local-openai-compatible-without-model',
      adapterType: 'openai_compatible',
    }, totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
    });
    await expect(service.registerLocalLlm({
      ...mockLlmRequest,
      baseUrl: 'http://ollama:11434/v1',
    }, totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
    });
    await expect(service.registerLocalNer({
      deploymentId: 'local-http-ner-without-url',
      adapterType: 'http_ner',
    }, totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
    });
    await expect(service.registerLocalNer({
      ...mockNerRequest,
      timeoutMs: 30_000,
    }, totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
    });
    expect(nerClient.createLlmDeployment).not.toHaveBeenCalled();
    expect(nerClient.createNerDeployment).not.toHaveBeenCalled();
  });

  it.each([
    [409, AdminErrorStatus.DUPLICATE_LOCAL_DEPLOYMENT],
    [422, AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION],
    [500, AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE],
  ])('LPL %i 오류를 Gateway 도메인 상태로 변환한다', async (status, expectedStatus) => {
    nerClient.createLlmDeployment.mockRejectedValue(
      new NerRequestException({ status }),
    );

    await expect(service.registerLocalLlm(llmRequest, totalAdmin))
      .rejects.toMatchObject({ baseStatus: expectedStatus });
    expect(adminLogRepository.save).not.toHaveBeenCalled();
  });

  it('LPL 로컬 LLM 목록 조회 오류는 Provider 오류로 변환한다', async () => {
    nerClient.getLlmDeployments.mockRejectedValue(
      new NerRequestException({ status: 500 }),
    );
    await expect(service.getLocalLlmList(totalAdmin)).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
    });
  });
});
