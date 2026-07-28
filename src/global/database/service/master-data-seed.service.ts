import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { LlmDetailModelDAO } from '../../../domain/admin/dao/llm-detail-model.dao.js';
import { MaskingClass, PolicyDAO } from '../../../domain/admin/dao/policy.dao.js';
import {
  DEFAULT_POLICIES,
  type SecurityPolicyClass,
} from '../../../domain/admin/policy/security-policy.catalog.js';
import { DEFAULT_LLM_DETAIL_MODELS } from '../seed/master-data.seed.js';

/**
 * 비어 있거나 일부만 구성된 DB에 필수 마스터 데이터를 보충합니다.
 *
 * 기존 데이터, 특히 정책의 활성 상태는 수정하지 않고 없는 자연 키만
 * 추가합니다. 부서별 정책 연결은 이 단계에서 생성하지 않습니다.
 */
@Injectable()
export class MasterDataSeedService implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.seedLlmDetailModels(manager);
      await this.seedPolicies(manager);
    });
  }

  private async seedLlmDetailModels(manager: EntityManager): Promise<void> {
    const repository = manager.getRepository(LlmDetailModelDAO);
    const existing = await repository.find({
      select: { llmName: true },
    });
    const existingNames = new Set(
      existing.flatMap((model) => model.llmName === null ? [] : [model.llmName]),
    );
    const missingNames = DEFAULT_LLM_DETAIL_MODELS.filter(
      (llmName) => !existingNames.has(llmName),
    );

    if (missingNames.length === 0) {
      return;
    }

    await repository.insert(
      missingNames.map((llmName) => ({ llmName })),
    );
  }

  private async seedPolicies(manager: EntityManager): Promise<void> {
    const repository = manager.getRepository(PolicyDAO);
    const existing = await repository.find({
      select: { maskingContent: true, maskingClass: true },
    });
    const existingPolicyKeys = new Set(
      existing.map((policy) => this.toPolicyKey(
        policy.maskingContent,
        policy.maskingClass,
      )),
    );
    const missingPolicies = DEFAULT_POLICIES.filter((policy) => !existingPolicyKeys.has(
      this.toPolicyKey(policy.maskingContent, policy.maskingClass),
    ));

    if (missingPolicies.length === 0) {
      return;
    }

    await repository.insert(
      missingPolicies.map((policy) => ({
        maskingContent: policy.maskingContent,
        maskingClass: this.toMaskingClass(policy.maskingClass),
      })),
    );
  }

  private toPolicyKey(
    maskingContent: string,
    maskingClass: string,
  ): string {
    return `${maskingContent}\u0000${maskingClass}`;
  }

  private toMaskingClass(value: SecurityPolicyClass): MaskingClass {
    return value === MaskingClass.SENSITIVE
      ? MaskingClass.SENSITIVE
      : MaskingClass.PRIVATE;
  }
}
