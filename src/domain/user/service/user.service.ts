import { Injectable } from '@nestjs/common';
import { UserReqDTO } from '../dto/user.request.dto.js';
import { UserResDTO } from '../dto/user.response.dto.js';
import { UserMapper } from '../mapper/user.mapper.js';

@Injectable()
export class UserService {
  async getMessageSummary(): Promise<UserResDTO.MessageSummary> {
    return UserMapper.toMessageSummary('', 0, 0, 0, 0, 0);
  }

  async getMessages(dto: UserReqDTO.MessageList): Promise<UserResDTO.MessageList> {
    void dto;
    return UserMapper.toMessageList(null);
  }
}
