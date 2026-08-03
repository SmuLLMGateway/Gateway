import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { LlmDetailModelDAO } from '../../../domain/admin/dao/llm-detail-model.dao.js';
import { MaskingClass, PolicyDAO } from '../../../domain/admin/dao/policy.dao.js';
import {
  DEFAULT_POLICIES,
  type SecurityPolicyClass,
} from '../../../domain/admin/policy/security-policy.catalog.js';
import { DEFAULT_LLM_DETAIL_MODELS } from '../seed/master-data.seed.js';
import { NerClient } from '../../ner/client/ner.client.js';
import { toLocalLlmModelName } from '../../llm/llm-service.mapping.js';

/**
 * 비어 있거나 일부만 구성된 DB에 필수 마스터 데이터를 보충합니다.
 *
 * 기존 데이터의 활성 상태는 수정하지 않고 없는 정책 코드만 추가합니다.
 * 단, API_KEY의 분류는 PRIVATE가 정본이므로 잘못된 기존 분류를 보정합니다.
 * 부서별 정책 연결은 이 단계에서 생성하지 않습니다.
 */
@Injectable()
export class MasterDataSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MasterDataSeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly nerClient: NerClient,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const localLlmModelNames = await this.getLocalLlmModelNames();

    await this.dataSource.transaction(async (manager) => {
      await this.seedLlmDetailModels(manager, localLlmModelNames);
      await this.seedPolicies(manager);
    });
  }

  private async seedLlmDetailModels(
    manager: EntityManager,
    localLlmModelNames: readonly string[],
  ): Promise<void> {
    const repository = manager.getRepository(LlmDetailModelDAO);
    const existing = await repository.find({
      select: { llmName: true },
    });
    const existingNames = new Set(
      existing.flatMap((model) => model.llmName === null ? [] : [model.llmName]),
    );
    const modelNames = [...new Set([
      ...DEFAULT_LLM_DETAIL_MODELS,
      ...localLlmModelNames,
    ])];
    const missingNames = modelNames.filter(
      (llmName) => !existingNames.has(llmName),
    );

    if (missingNames.length === 0) {
      return;
    }

    await repository.insert(
      missingNames.map((llmName) => ({ llmName })),
    );
  }

  private async getLocalLlmModelNames(): Promise<readonly string[]> {
    let modelNames: readonly string[];

    try {
      modelNames = await this.nerClient.getEnabledLlmModelNames();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      this.logger.warn(`LPL 로컬 LLM 모델 조회에 실패했습니다: ${message}`);
      return [];
    }

    return [...new Set(modelNames.flatMap((modelName) => {
      const localModelName = toLocalLlmModelName(modelName);
      return localModelName === null ? [] : [localModelName];
    }))];
  }

  private async seedPolicies(manager: EntityManager): Promise<void> {
    const repository = manager.getRepository(PolicyDAO);
    let existing = await repository.find({
      select: { maskingContent: true, maskingClass: true },
    });
    if (existing.some((policy) =>
      policy.maskingContent === 'API_KEY'
      && policy.maskingClass !== MaskingClass.PRIVATE,
    )) {
      await repository.update(
        { maskingContent: 'API_KEY' },
        { maskingClass: MaskingClass.PRIVATE },
      );
      existing = existing.map((policy) =>
        policy.maskingContent === 'API_KEY'
          ? { ...policy, maskingClass: MaskingClass.PRIVATE }
          : policy,
      );
    }
    // maskingClass는 정책 코드의 부가 분류일 뿐, 정책 자체를 식별하지 않습니다.
    // 예를 들어 API_KEY의 과거 SENSITIVE 데이터가 있어도 PRIVATE 행을 새로
    // 만들지 않고 위의 보정 로직으로 기존 행을 바로잡습니다.
    const existingPolicyContents = new Set(
      existing.map((policy) => policy.maskingContent),
    );
    const missingPolicies = DEFAULT_POLICIES.filter(
      (policy) => !existingPolicyContents.has(policy.maskingContent),
    );

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

  private toMaskingClass(value: SecurityPolicyClass): MaskingClass {
    return value === MaskingClass.SENSITIVE
      ? MaskingClass.SENSITIVE
      : MaskingClass.PRIVATE;
  }
}
