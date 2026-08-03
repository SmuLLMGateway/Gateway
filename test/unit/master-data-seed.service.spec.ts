import 'reflect-metadata';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { LlmDetailModelDAO } from '../../src/domain/admin/dao/llm-detail-model.dao.js';
import { MaskingClass, PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { DEFAULT_POLICIES } from '../../src/domain/admin/policy/security-policy.catalog.js';
import { MasterDataSeedModule } from '../../src/global/database/module/master-data-seed.module.js';
import { DEFAULT_LLM_DETAIL_MODELS } from '../../src/global/database/seed/master-data.seed.js';
import { MasterDataSeedService } from '../../src/global/database/service/master-data-seed.service.js';
import { NerClient } from '../../src/global/ner/client/ner.client.js';

type StoredLlmDetailModel = {
  llmName: string | null;
  marker?: string;
};

type StoredPolicy = {
  maskingContent: string;
  maskingClass: MaskingClass;
  marker?: string;
};

const EXPECTED_LLM_DETAIL_MODELS = [
  'gpt-5.4-nano',
  'gpt-5.5',
  'gpt-5.6-luna',
  'gpt-5.6-terra',
  'gpt-5.6-sol',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'claude-haiku-4-5',
  'claude-sonnet-5',
  'claude-opus-4-8',
] as const;

const EXPECTED_POLICIES = [
  { maskingContent: 'SECURITY_INFRA', maskingClass: MaskingClass.SENSITIVE },
  { maskingContent: 'OPERATION', maskingClass: MaskingClass.SENSITIVE },
  { maskingContent: 'STATE_SECRET', maskingClass: MaskingClass.SENSITIVE },
  { maskingContent: 'CONTRACT', maskingClass: MaskingClass.SENSITIVE },
  { maskingContent: 'PERSONAL', maskingClass: MaskingClass.SENSITIVE },
  { maskingContent: 'CITIZEN', maskingClass: MaskingClass.SENSITIVE },
  { maskingContent: 'AUDIT', maskingClass: MaskingClass.SENSITIVE },
  {
    maskingContent: 'INFO_SYSTEM_ACCESS_LOG',
    maskingClass: MaskingClass.SENSITIVE,
  },
  { maskingContent: 'R&D', maskingClass: MaskingClass.SENSITIVE },
  { maskingContent: 'RESIDENT', maskingClass: MaskingClass.PRIVATE },
  { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
  { maskingContent: 'EMAIL', maskingClass: MaskingClass.PRIVATE },
  { maskingContent: 'ACCOUNT', maskingClass: MaskingClass.PRIVATE },
  { maskingContent: 'CARD', maskingClass: MaskingClass.PRIVATE },
  { maskingContent: 'ADDRESS', maskingClass: MaskingClass.PRIVATE },
  { maskingContent: 'API_KEY', maskingClass: MaskingClass.PRIVATE },
] as const;

describe('MasterDataSeedService', () => {
  const entityManager = {
    getRepository: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };
  const llmDetailModelRepository = {
    find: jest.fn(),
    insert: jest.fn(),
  };
  const policyRepository = {
    find: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
  const nerClient = {
    getLlmDeployments: jest.fn(),
  };

  let llmDetailModels: StoredLlmDetailModel[];
  let policies: StoredPolicy[];
  let service: MasterDataSeedService;

  beforeEach(() => {
    llmDetailModels = [];
    policies = [];
    nerClient.getLlmDeployments.mockResolvedValue([]);

    dataSource.transaction.mockImplementation(async (
      work: (manager: EntityManager) => Promise<unknown>,
    ) => work(entityManager as unknown as EntityManager));
    entityManager.getRepository.mockImplementation((target: unknown) => {
      if (target === LlmDetailModelDAO) {
        return llmDetailModelRepository;
      }
      if (target === PolicyDAO) {
        return policyRepository;
      }
      throw new Error('예상하지 못한 마스터 데이터 Repository입니다.');
    });
    llmDetailModelRepository.find.mockImplementation(async () => (
      llmDetailModels.map((model) => ({ ...model }))
    ));
    llmDetailModelRepository.insert.mockImplementation(async (
      value: { llmName: string } | Array<{ llmName: string }>,
    ) => {
      const rows = Array.isArray(value) ? value : [value];
      llmDetailModels.push(...rows.map((row) => ({ llmName: row.llmName })));
      return {};
    });
    policyRepository.find.mockImplementation(async () => (
      policies.map((policy) => ({ ...policy }))
    ));
    policyRepository.insert.mockImplementation(async (
      value: {
        maskingContent: string;
        maskingClass: MaskingClass;
      } | Array<{
        maskingContent: string;
        maskingClass: MaskingClass;
      }>,
    ) => {
      const rows = Array.isArray(value) ? value : [value];
      policies.push(...rows.map((row) => ({
        maskingContent: row.maskingContent,
        maskingClass: row.maskingClass,
      })));
      return {};
    });
    policyRepository.update.mockImplementation(async (
      where: { maskingContent: string },
      values: { maskingClass: MaskingClass },
    ) => {
      for (const policy of policies) {
        if (policy.maskingContent === where.maskingContent) {
          policy.maskingClass = values.maskingClass;
        }
      }
      return {};
    });

    service = new MasterDataSeedService(
      dataSource as unknown as DataSource,
      nerClient as unknown as NerClient,
    );
  });

  it('요청된 LLM 모델 10개와 보안 정책 16개를 정확히 카탈로그로 정의한다', () => {
    expect(DEFAULT_LLM_DETAIL_MODELS).toEqual(EXPECTED_LLM_DETAIL_MODELS);
    expect(DEFAULT_POLICIES).toEqual(EXPECTED_POLICIES);
  });

  it('시작 시 비어 있는 DB에 모든 마스터 데이터를 생성한다', async () => {
    await service.onApplicationBootstrap();

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(entityManager.getRepository).toHaveBeenCalledWith(LlmDetailModelDAO);
    expect(entityManager.getRepository).toHaveBeenCalledWith(PolicyDAO);
    expect(llmDetailModels).toEqual(
      EXPECTED_LLM_DETAIL_MODELS.map((llmName) => ({ llmName })),
    );
    expect(policies).toEqual(EXPECTED_POLICIES);
  });

  it('재시작해도 이미 생성된 이름·정책을 다시 삽입하지 않고 API_KEY 분류만 보정한다', async () => {
    const existingModel: StoredLlmDetailModel = {
      llmName: 'gpt-5.4-nano',
      marker: 'preserve-model',
    };
    const existingApiKeyPolicy: StoredPolicy = {
      maskingContent: 'API_KEY',
      maskingClass: MaskingClass.SENSITIVE,
      marker: 'preserve-policy',
    };
    llmDetailModels.push(existingModel);
    policies.push(existingApiKeyPolicy);

    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    expect(llmDetailModels.filter(
      (model) => model.llmName === existingModel.llmName,
    )).toEqual([existingModel]);
    expect(policies.filter((policy) => (
      policy.maskingContent === existingApiKeyPolicy.maskingContent
      && policy.maskingClass === MaskingClass.PRIVATE
    ))).toEqual([{
      ...existingApiKeyPolicy,
      maskingClass: MaskingClass.PRIVATE,
    }]);
    expect(llmDetailModelRepository.insert).toHaveBeenCalledTimes(1);
    expect(policyRepository.insert).toHaveBeenCalledTimes(1);
    expect(llmDetailModels).toHaveLength(EXPECTED_LLM_DETAIL_MODELS.length);
    expect(policies).toHaveLength(EXPECTED_POLICIES.length);
  });

  it('기존 PRIVATE API_KEY 정책은 중복 생성하지 않는다', async () => {
    const legacyApiKeyPolicy: StoredPolicy = {
      maskingContent: 'API_KEY',
      maskingClass: MaskingClass.PRIVATE,
      marker: 'legacy-policy',
    };
    policies.push(legacyApiKeyPolicy);

    await service.onApplicationBootstrap();

    expect(policies).toContainEqual(legacyApiKeyPolicy);
    expect(policies.filter((policy) => policy.maskingContent === 'API_KEY'))
      .toEqual([legacyApiKeyPolicy]);
  });

  it('NER 서버의 로컬 LLM 모델을 중복 없이 함께 시드한다', async () => {
    nerClient.getLlmDeployments.mockResolvedValue([
      {
        deploymentId: 'local-qwen',
        displayName: 'Qwen 배포',
        modelId: 'Qwen2.5-7B-Instruct',
        enabled: true,
      },
      {
        deploymentId: 'local-qwen-copy',
        displayName: 'Qwen 복제 배포',
        modelId: 'Qwen2.5-7B-Instruct',
        enabled: false,
      },
      {
        deploymentId: 'local-custom',
        displayName: 'Custom Local Model',
        modelId: null,
        enabled: true,
      },
    ]);

    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    expect(llmDetailModels.filter((model) => model.llmName === 'local-Qwen2.5-7B-Instruct'))
      .toHaveLength(1);
    expect(llmDetailModels.filter((model) => model.llmName === 'local-Custom Local Model'))
      .toHaveLength(1);
  });

  it('NER 조회에 실패해도 기존 마스터 데이터 시드는 계속한다', async () => {
    nerClient.getLlmDeployments.mockRejectedValue(new Error('connection refused'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(llmDetailModels).toEqual(
      EXPECTED_LLM_DETAIL_MODELS.map((llmName) => ({ llmName })),
    );
  });
});

describe('MasterDataSeedModule 시작 등록', () => {
  it('AppModule이 프로젝트 시작 시 마스터 데이터 초기화 모듈을 가져온다', () => {
    const imports = Reflect.getMetadata(
      'imports',
      AppModule,
    ) as unknown[];

    expect(imports).toContain(MasterDataSeedModule);
  });
});
