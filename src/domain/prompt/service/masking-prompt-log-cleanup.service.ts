import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { PromptLogRepository } from '../repository/prompt-log.repository.js';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;

/** MASKING 상태로 24시간이 지난 임시 프롬프트 로그를 정리합니다. */
@Injectable()
export class MaskingPromptLogCleanupService
implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MaskingPromptLogCleanupService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly promptLogRepository: PromptLogRepository) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.cleanup();
    this.timer = setInterval(() => {
      void this.cleanup();
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.promptLogRepository.deleteExpiredMasking();
    } catch (error: unknown) {
      this.logger.error('만료된 MASKING 프롬프트 로그 정리에 실패했습니다.', error);
    }
  }
}
