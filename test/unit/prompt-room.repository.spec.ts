import type { Repository } from 'typeorm';
import { PromptRoomDAO } from '../../src/domain/prompt/dao/prompt-room.dao.js';
import { PromptRoomRepository } from '../../src/domain/prompt/repository/prompt-room.repository.js';

describe('PromptRoomRepository', () => {
  const typeormRepository = {
    find: jest.fn(),
  };
  const repository = new PromptRoomRepository(
    typeormRepository as unknown as Repository<PromptRoomDAO>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('회원의 최근 채팅방을 활동 시각과 ID 내림차순으로 최대 10개 조회한다', async () => {
    const startedAt = new Date('2026-07-19T17:33:30.000Z');
    typeormRepository.find.mockResolvedValueOnce([
      {
        promptRoomId: '421',
        promptRoomTitle: 'A사와 체결 보고서 작성',
        startedAt,
      } as PromptRoomDAO,
    ]);

    await expect(repository.findRecentByMemberId('42')).resolves.toEqual([
      {
        chatRoomId: '421',
        title: 'A사와 체결 보고서 작성',
        createdAt: startedAt,
      },
    ]);
    expect(typeormRepository.find).toHaveBeenCalledWith({
      select: {
        promptRoomId: true,
        startedAt: true,
        promptRoomTitle: true,
      },
      where: {
        memberId: '42',
      },
      order: {
        lastCommunicatedAt: 'DESC',
        promptRoomId: 'DESC',
      },
      take: 10,
    });
  });

  it('채팅방이 없으면 빈 원본 목록을 반환한다', async () => {
    typeormRepository.find.mockResolvedValueOnce([]);

    await expect(repository.findRecentByMemberId('42')).resolves.toEqual([]);
  });
});
