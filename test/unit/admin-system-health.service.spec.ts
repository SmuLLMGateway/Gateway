import { LessThanOrEqual, type DataSource, type Repository } from 'typeorm';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import {
  HealthHistoryDAO,
  HealthServiceName,
  HealthStatus,
} from '../../src/domain/admin/dao/health-history.dao.js';
import { PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import type { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import type { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import type { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import type { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import type { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';
import type { NerConfig } from '../../src/global/ner/config/ner.config.js';
import type { ProviderConfig } from '../../src/global/llm/config/provider.config.js';

describe('AdminService 시스템 상태 요약 조회', () => {
  const dataSource = { query: jest.fn() };
  const healthHistoryRepository = {
    create: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const objectStorage = { isHealthy: jest.fn() };
  const service = new AdminService(
    dataSource as unknown as DataSource,
    {} as PasswordEncoderService,
    {} as UserMapper,
    {} as AdminMapper,
    {} as Repository<MemberDAO>,
    {} as Repository<DepartmentDAO>,
    {} as Repository<MemberDepartmentDAO>,
    {} as Repository<MemberLimitDAO>,
    {} as Repository<ActiveApiKeyDAO>,
    {} as Repository<DepartmentPolicyDAO>,
    {} as Repository<PolicyDAO>,
    {} as Repository<AdminLogDAO>,
    healthHistoryRepository as unknown as Repository<HealthHistoryDAO>,
    {} as LlmApiKeyValidationClient,
    {} as ApiKeyEncryptionService,
    objectStorage as unknown as MinioObjectStorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockResolvedValue([{ '1': 1 }]);
    objectStorage.isHealthy.mockResolvedValue(true);
    healthHistoryRepository.create.mockImplementation((value) => value);
    healthHistoryRepository.save.mockResolvedValue([]);
  });

  it('비동기 점검 결과와 서비스별 최신 이력을 가장 심각한 상태로 통합한다', async () => {
    objectStorage.isHealthy.mockResolvedValue(false);
    healthHistoryRepository.find.mockResolvedValue([
      { healthHistoryId: '15', serviceName: HealthServiceName.STORAGE, status: HealthStatus.ERROR },
      { healthHistoryId: '14', serviceName: HealthServiceName.DATABASE, status: HealthStatus.OK },
      { healthHistoryId: '13', serviceName: HealthServiceName.MONITORING, status: HealthStatus.OK },
      { healthHistoryId: '12', serviceName: HealthServiceName.SECURITY_FILTERING, status: HealthStatus.OK },
      { healthHistoryId: '11', serviceName: HealthServiceName.LOCAL_LLM, status: HealthStatus.OK },
      { healthHistoryId: '10', serviceName: HealthServiceName.GPT, status: HealthStatus.DELAY },
      { healthHistoryId: '9', serviceName: HealthServiceName.GEMINI, status: HealthStatus.OK },
      { healthHistoryId: '8', serviceName: HealthServiceName.CLAUDE, status: HealthStatus.OK },
      { healthHistoryId: '1', serviceName: HealthServiceName.GPT, status: HealthStatus.OK },
    ]);

    await service.checkAndRecordSystemHealth();
    await expect(service.getSystemHealth()).resolves.toEqual({
      totalSystemHealth: '오류',
      outboundLLM: '지연',
      inboundLLM: '정상',
      securityFiltering: '정상',
      database: '정상',
      storage: '오류',
      monitoring: '정상',
    });
    expect(healthHistoryRepository.save).toHaveBeenCalledWith([
      { serviceName: HealthServiceName.SECURITY_FILTERING, status: HealthStatus.OK, latency: 0 },
      { serviceName: HealthServiceName.LOCAL_LLM, status: HealthStatus.CHECK, latency: 0 },
      { serviceName: HealthServiceName.GPT, status: HealthStatus.CHECK, latency: 0 },
      { serviceName: HealthServiceName.GEMINI, status: HealthStatus.CHECK, latency: 0 },
      { serviceName: HealthServiceName.CLAUDE, status: HealthStatus.CHECK, latency: 0 },
      expect.objectContaining({
        serviceName: HealthServiceName.DATABASE,
        status: HealthStatus.OK,
        latency: expect.any(Number),
      }),
      expect.objectContaining({
        serviceName: HealthServiceName.STORAGE,
        status: HealthStatus.ERROR,
        latency: expect.any(Number),
      }),
      { serviceName: HealthServiceName.MONITORING, status: HealthStatus.OK, latency: 0 },
    ]);
  });

  it('정상 응답이 1초 이상 걸리면 지연 상태로 기록한다', async () => {
    const now = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(500);

    await service.checkAndRecordSystemHealth();

    expect(healthHistoryRepository.save).toHaveBeenCalledWith([
      { serviceName: HealthServiceName.SECURITY_FILTERING, status: HealthStatus.OK, latency: 0 },
      { serviceName: HealthServiceName.LOCAL_LLM, status: HealthStatus.CHECK, latency: 0 },
      { serviceName: HealthServiceName.GPT, status: HealthStatus.CHECK, latency: 0 },
      { serviceName: HealthServiceName.GEMINI, status: HealthStatus.CHECK, latency: 0 },
      { serviceName: HealthServiceName.CLAUDE, status: HealthStatus.CHECK, latency: 0 },
      { serviceName: HealthServiceName.DATABASE, status: HealthStatus.DELAY, latency: 1_000 },
      { serviceName: HealthServiceName.STORAGE, status: HealthStatus.OK, latency: 500 },
      { serviceName: HealthServiceName.MONITORING, status: HealthStatus.OK, latency: 0 },
    ]);
    now.mockRestore();
  });

  it('점검 요청 실패는 응답 지연시간과 관계없이 오류 상태로 기록한다', async () => {
    dataSource.query.mockRejectedValueOnce(new Error('database unavailable'));
    objectStorage.isHealthy.mockResolvedValueOnce(false);

    await service.checkAndRecordSystemHealth();

    expect(healthHistoryRepository.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        serviceName: HealthServiceName.DATABASE,
        status: HealthStatus.ERROR,
      }),
      expect.objectContaining({
        serviceName: HealthServiceName.STORAGE,
        status: HealthStatus.ERROR,
      }),
    ]));
  });

  it('3일 이상 지난 상태 점검 이력만 삭제한다', async () => {
    const now = new Date('2026-08-02T15:00:00.000Z');

    await service.deleteExpiredHealthHistories(now);

    expect(healthHistoryRepository.delete).toHaveBeenCalledWith({
      createdAt: LessThanOrEqual(new Date('2026-07-30T15:00:00.000Z')),
    });
  });

  it('NER와 Provider의 health URI를 호출해 내·외부 LLM 상태로 기록한다', async () => {
    const nerConfig = {
      healthUrl: 'http://ner.example.test/health',
      requestTimeoutMs: 500,
    } as unknown as NerConfig;
    const providerConfig = {
      healthUrl: 'http://provider.example.test/health',
      requestTimeoutMs: 500,
    } as unknown as ProviderConfig;
    const configuredService = new AdminService(
      dataSource as unknown as DataSource,
      {} as PasswordEncoderService,
      {} as UserMapper,
      {} as AdminMapper,
      {} as Repository<MemberDAO>,
      {} as Repository<DepartmentDAO>,
      {} as Repository<MemberDepartmentDAO>,
      {} as Repository<MemberLimitDAO>,
      {} as Repository<ActiveApiKeyDAO>,
      {} as Repository<DepartmentPolicyDAO>,
      {} as Repository<PolicyDAO>,
      {} as Repository<AdminLogDAO>,
      healthHistoryRepository as unknown as Repository<HealthHistoryDAO>,
      {} as LlmApiKeyValidationClient,
      {} as ApiKeyEncryptionService,
      objectStorage as unknown as MinioObjectStorageService,
      nerConfig,
      providerConfig,
    );
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    await configuredService.checkAndRecordSystemHealth();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      nerConfig.healthUrl,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      providerConfig.healthUrl,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(healthHistoryRepository.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        serviceName: HealthServiceName.LOCAL_LLM,
        status: HealthStatus.OK,
      }),
      expect.objectContaining({ serviceName: HealthServiceName.GPT, status: HealthStatus.ERROR }),
      expect.objectContaining({ serviceName: HealthServiceName.GEMINI, status: HealthStatus.ERROR }),
      expect.objectContaining({ serviceName: HealthServiceName.CLAUDE, status: HealthStatus.ERROR }),
    ]));
    fetchMock.mockRestore();
  });

  it('LLM 상태 이력이 없으면 점검으로 반환한다', async () => {
    healthHistoryRepository.find.mockResolvedValue([
      { healthHistoryId: '4', serviceName: HealthServiceName.STORAGE, status: HealthStatus.OK },
      { healthHistoryId: '3', serviceName: HealthServiceName.DATABASE, status: HealthStatus.OK },
      { healthHistoryId: '2', serviceName: HealthServiceName.MONITORING, status: HealthStatus.OK },
      { healthHistoryId: '1', serviceName: HealthServiceName.SECURITY_FILTERING, status: HealthStatus.OK },
    ]);

    await expect(service.getSystemHealth()).resolves.toMatchObject({
      totalSystemHealth: '점검',
      outboundLLM: '점검',
      inboundLLM: '점검',
    });
  });

  it('서비스별 최근 25개 이력으로 가용률, P95 지연시간과 차트 상태를 반환한다', async () => {
    healthHistoryRepository.find.mockResolvedValue([
      { healthHistoryId: '10', serviceName: HealthServiceName.GPT, status: HealthStatus.OK, latency: 900 },
      { healthHistoryId: '9', serviceName: HealthServiceName.GPT, status: HealthStatus.OK, latency: 1100 },
      { healthHistoryId: '8', serviceName: HealthServiceName.GPT, status: HealthStatus.DELAY, latency: 750 },
      { healthHistoryId: '7', serviceName: HealthServiceName.GPT, status: HealthStatus.ERROR, latency: 200 },
      { healthHistoryId: '6', serviceName: HealthServiceName.GEMINI, status: HealthStatus.OK, latency: 100 },
    ]);

    await expect(service.getLlmHealth()).resolves.toEqual([
      expect.objectContaining({
        service: HealthServiceName.GPT,
        currentStatus: HealthStatus.DELAY,
        availability: 50,
        averageResponse: 1100,
        history: expect.arrayContaining([]),
      }),
      expect.objectContaining({
        service: HealthServiceName.GEMINI,
        currentStatus: HealthStatus.OK,
        availability: 100,
        averageResponse: 100,
      }),
      expect.objectContaining({
        service: HealthServiceName.CLAUDE,
        currentStatus: HealthStatus.CHECK,
        availability: 0,
        averageResponse: 0,
      }),
      expect.objectContaining({
        service: HealthServiceName.LOCAL_LLM,
        currentStatus: HealthStatus.CHECK,
        availability: 0,
        averageResponse: 0,
      }),
    ]);

    const [gpt] = await service.getLlmHealth();
    expect(gpt!.history).toHaveLength(25);
    expect(gpt!.history.slice(-4)).toEqual([2, 1, 0, 0]);
    expect(gpt!.history.slice(0, 21)).toEqual(Array(21).fill(3));
    expect(healthHistoryRepository.find).toHaveBeenCalledWith({
      select: {
        healthHistoryId: true,
        serviceName: true,
        status: true,
        latency: true,
      },
      where: {
        serviceName: expect.anything(),
      },
      order: { healthHistoryId: 'DESC' },
    });
  });
});
