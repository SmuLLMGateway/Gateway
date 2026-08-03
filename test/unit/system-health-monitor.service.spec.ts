import { SystemHealthMonitorService } from '../../src/domain/admin/service/system-health-monitor.service.js';

describe('SystemHealthMonitorService', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('시작 직후와 이후 매 1시간마다 비동기로 상태 점검을 실행한다', async () => {
    jest.useFakeTimers();
    const adminService = {
      checkAndRecordSystemHealth: jest.fn().mockResolvedValue(undefined),
      deleteExpiredHealthHistories: jest.fn().mockResolvedValue(undefined),
    };
    const monitor = new SystemHealthMonitorService(adminService as never);

    monitor.onApplicationBootstrap();
    await Promise.resolve();
    expect(adminService.checkAndRecordSystemHealth).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60 * 60 * 1_000);
    expect(adminService.checkAndRecordSystemHealth).toHaveBeenCalledTimes(2);

    monitor.onApplicationShutdown();
  });

  it('KST 자정부터 매일 3일 이상 지난 상태 이력을 정리한다', async () => {
    jest.useFakeTimers({ now: new Date('2026-08-02T14:59:59.000Z') });
    const adminService = {
      checkAndRecordSystemHealth: jest.fn().mockResolvedValue(undefined),
      deleteExpiredHealthHistories: jest.fn().mockResolvedValue(undefined),
    };
    const monitor = new SystemHealthMonitorService(adminService as never);

    monitor.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(999);
    expect(adminService.deleteExpiredHealthHistories).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(adminService.deleteExpiredHealthHistories).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000);
    expect(adminService.deleteExpiredHealthHistories).toHaveBeenCalledTimes(2);

    monitor.onApplicationShutdown();
  });
});
