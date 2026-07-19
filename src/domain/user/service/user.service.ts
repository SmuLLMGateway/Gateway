import { Injectable } from '@nestjs/common';
import { UserReqDTO } from '../dto/user.request.dto.js';
import { UserResDTO } from '../dto/user.response.dto.js';

@Injectable()
export class UserService {
  async getMessageSummary(): Promise<UserResDTO.MessageSummary> {
    return {
      updatedAt: '',
      totalChatCnt: 0,
      filter: 0,
      masking: 0,
      local: 0,
      localPercent: 0,
    };
  }

  async getMessages(dto: UserReqDTO.MessageList): Promise<UserResDTO.MessageList> {
    void dto;
    return null;
  }
}
