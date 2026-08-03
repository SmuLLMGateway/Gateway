import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';

export const SYSTEM_HEALTH_CHECK_INTERVAL_MS = 60 * 60 * 1_000;
export const HEALTH_HISTORY_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const KOREA_STANDARD_TIME_OFFSET_MS = 9 * 60 * 60 * 1_000;

/**
 * HTTP 요청과 분리해 상태 점검 결과를 health_history에 주기적으로 적재합니다.
 * 애플리케이션 시작 직후에도 한 번 실행해 첫 조회 전 공백을 줄입니다.
 */
@Injectable()
export class SystemHealthMonitorService
implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SystemHealthMonitorService.name);
  private timer: NodeJS.Timeout | undefined;
  private cleanupStartTimer: NodeJS.Timeout | undefined;
  private cleanupTimer: NodeJS.Timeout | undefined;
  private isRunning = false;
  private isCleaning = false;

  constructor(private readonly adminService: AdminService) {}

  onApplicationBootstrap(): void {
    this.logger.log(
      `시스템 상태 점검 스케줄을 시작합니다: ${SYSTEM_HEALTH_CHECK_INTERVAL_MS / 60_000}분 간격`,
    );
    void this.runCheck();
    this.timer = setInterval(() => {
      void this.runCheck();
    }, SYSTEM_HEALTH_CHECK_INTERVAL_MS);
    this.timer.unref();
    this.scheduleHealthHistoryCleanup();
  }

  onApplicationShutdown(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.cleanupStartTimer !== undefined) {
      clearTimeout(this.cleanupStartTimer);
      this.cleanupStartTimer = undefined;
    }
    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private async runCheck(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      await this.adminService.checkAndRecordSystemHealth();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      this.logger.error(`시스템 상태 점검에 실패했습니다: ${message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /** KST 자정에 첫 정리를 수행한 뒤 매일 한 번씩 오래된 이력을 삭제합니다. */
  private scheduleHealthHistoryCleanup(): void {
    this.cleanupStartTimer = setTimeout(() => {
      void this.runHealthHistoryCleanup();
      this.cleanupTimer = setInterval(() => {
        void this.runHealthHistoryCleanup();
      }, HEALTH_HISTORY_CLEANUP_INTERVAL_MS);
      this.cleanupTimer.unref();
    }, this.getMillisecondsUntilNextKoreanMidnight());
    this.cleanupStartTimer.unref();
  }

  private getMillisecondsUntilNextKoreanMidnight(now = Date.now()): number {
    const kstNow = now + KOREA_STANDARD_TIME_OFFSET_MS;
    const nextKoreanMidnight =
      (Math.floor(kstNow / HEALTH_HISTORY_CLEANUP_INTERVAL_MS) + 1)
      * HEALTH_HISTORY_CLEANUP_INTERVAL_MS
      - KOREA_STANDARD_TIME_OFFSET_MS;
    return Math.max(1, nextKoreanMidnight - now);
  }

  private async runHealthHistoryCleanup(): Promise<void> {
    if (this.isCleaning) {
      return;
    }

    this.isCleaning = true;
    try {
      await this.adminService.deleteExpiredHealthHistories();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      this.logger.error(`상태 점검 이력 정리에 실패했습니다: ${message}`);
    } finally {
      this.isCleaning = false;
    }
  }
}
