import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PromptData } from '../data/prompt.data.js';
import { PromptRoomDAO } from '../dao/prompt-room.dao.js';

const RECENT_PROMPT_ROOM_LIMIT = 10;

@Injectable()
export class PromptRoomRepository {
  constructor(
    @InjectRepository(PromptRoomDAO)
    private readonly repository: Repository<PromptRoomDAO>,
  ) {}

  async existsByIdAndMemberId(
    chatRoomId: string,
    memberId: string,
  ): Promise<boolean> {
    return this.repository.exists({
      where: {
        promptRoomId: chatRoomId,
        memberId,
      },
    });
  }

  async findRecentByMemberId(
    memberId: string,
  ): Promise<readonly PromptData.RecentPrompt[]> {
    const promptRooms = await this.repository.find({
      select: {
        promptRoomId: true,
        startedAt: true,
        promptRoomTitle: true,
      },
      where: {
        memberId,
      },
      order: {
        lastCommunicatedAt: 'DESC',
        promptRoomId: 'DESC',
      },
      take: RECENT_PROMPT_ROOM_LIMIT,
    });

    return promptRooms.map((promptRoom) => ({
      chatRoomId: promptRoom.promptRoomId,
      title: promptRoom.promptRoomTitle,
      createdAt: promptRoom.startedAt,
    }));
  }
}
