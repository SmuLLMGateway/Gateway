import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';
import { ActiveApiKeyDAO } from '../../../domain/admin/dao/active-api-key.dao.js';
import { LlmProvider } from '../../llm/enum/llm-provider.enum.js';

const LEGACY_SERVICE_TYPE_MAPPINGS = [
  { legacy: 'Google', current: LlmProvider.GEMINI },
  { legacy: 'OpenAI', current: LlmProvider.GPT },
  { legacy: 'Anthropic', current: LlmProvider.CLAUDE },
] as const;

const MANAGED_SERVICE_TYPES = [
  ...LEGACY_SERVICE_TYPE_MAPPINGS.map(({ legacy }) => legacy),
  ...LEGACY_SERVICE_TYPE_MAPPINGS.map(({ current }) => current),
];

/**
 * active_api_key.service_type의 이전 사업자명 값을 모델 계열명으로 한 번
 * 이관합니다. active_llm은 API 키 ID를 참조하므로 별도 변경이 필요 없습니다.
 */
@Injectable()
export class ActiveApiKeyServiceTypeMigrationService
implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.migrateLegacyServiceTypes(manager);
    });
  }

  private async migrateLegacyServiceTypes(manager: EntityManager): Promise<void> {
    const repository = manager.getRepository(ActiveApiKeyDAO);
    const apiKeys = await repository.find({
      select: {
        activeApiKeyId: true,
        departmentId: true,
        serviceType: true,
      },
      where: {
        serviceType: In(MANAGED_SERVICE_TYPES),
      },
    });
    const serviceTypesByDepartment = new Set(
      apiKeys.map((apiKey) => this.toDepartmentServiceKey(
        apiKey.departmentId,
        apiKey.serviceType,
      )),
    );

    for (const { legacy, current } of LEGACY_SERVICE_TYPE_MAPPINGS) {
      const collision = apiKeys.find((apiKey) => (
        apiKey.serviceType === legacy
        && serviceTypesByDepartment.has(
          this.toDepartmentServiceKey(apiKey.departmentId, current),
        )
      ));
      if (collision !== undefined) {
        throw new Error(
          `active_api_key service_type migration conflict for department ${collision.departmentId}: ${legacy} and ${current}`,
        );
      }
    }

    for (const { legacy, current } of LEGACY_SERVICE_TYPE_MAPPINGS) {
      await repository.update(
        { serviceType: legacy },
        { serviceType: current },
      );
    }
  }

  private toDepartmentServiceKey(
    departmentId: string,
    serviceType: string,
  ): string {
    return `${departmentId}\u0000${serviceType}`;
  }
}
