import type { DataSource, EntityManager } from 'typeorm';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { ActiveApiKeyServiceTypeMigrationService } from '../../src/global/database/service/active-api-key-service-type-migration.service.js';
import { LlmProvider } from '../../src/global/llm/enum/llm-provider.enum.js';

describe('ActiveApiKeyServiceTypeMigrationService', () => {
  const entityManager = {
    getRepository: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };
  const activeApiKeyRepository = {
    find: jest.fn(),
    update: jest.fn(),
  };

  let service: ActiveApiKeyServiceTypeMigrationService;

  beforeEach(() => {
    dataSource.transaction.mockImplementation(async (
      work: (manager: EntityManager) => Promise<unknown>,
    ) => work(entityManager as unknown as EntityManager));
    entityManager.getRepository.mockReturnValue(activeApiKeyRepository);
    activeApiKeyRepository.find.mockResolvedValue([]);
    activeApiKeyRepository.update.mockResolvedValue({ affected: 0 });

    service = new ActiveApiKeyServiceTypeMigrationService(
      dataSource as unknown as DataSource,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('기존 사업자명 저장값을 Gemini, GPT, Claude로 이관한다', async () => {
    activeApiKeyRepository.find.mockResolvedValueOnce([
      {
        activeApiKeyId: '1',
        departmentId: '10',
        serviceType: 'Google',
      },
      {
        activeApiKeyId: '2',
        departmentId: '10',
        serviceType: 'OpenAI',
      },
      {
        activeApiKeyId: '3',
        departmentId: '11',
        serviceType: 'Anthropic',
      },
    ]);

    await service.onApplicationBootstrap();

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(entityManager.getRepository).toHaveBeenCalledWith(ActiveApiKeyDAO);
    expect(activeApiKeyRepository.update).toHaveBeenNthCalledWith(
      1,
      { serviceType: 'Google' },
      { serviceType: LlmProvider.GEMINI },
    );
    expect(activeApiKeyRepository.update).toHaveBeenNthCalledWith(
      2,
      { serviceType: 'OpenAI' },
      { serviceType: LlmProvider.GPT },
    );
    expect(activeApiKeyRepository.update).toHaveBeenNthCalledWith(
      3,
      { serviceType: 'Anthropic' },
      { serviceType: LlmProvider.CLAUDE },
    );
  });

  it('같은 부서에 구값과 새값 키가 함께 있으면 데이터를 잃지 않도록 중단한다', async () => {
    activeApiKeyRepository.find.mockResolvedValueOnce([
      {
        activeApiKeyId: '1',
        departmentId: '10',
        serviceType: 'Google',
      },
      {
        activeApiKeyId: '2',
        departmentId: '10',
        serviceType: 'Gemini',
      },
    ]);

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'active_api_key service_type migration conflict for department 10: Google and Gemini',
    );

    expect(activeApiKeyRepository.update).not.toHaveBeenCalled();
  });
});
