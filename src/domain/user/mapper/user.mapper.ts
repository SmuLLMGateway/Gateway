import { UserResDTO } from '../dto/user.response.dto.js';

export class UserMapper {
  static toMessageSummary(
    updatedAt: string,
    totalChatCnt: number,
    filter: number,
    masking: number,
    local: number,
    localPercent: number,
  ): UserResDTO.MessageSummary {
    return {
      updatedAt,
      totalChatCnt,
      filter,
      masking,
      local,
      localPercent,
    };
  }

  static toMessageList<T>(result: T): T {
    return result;
  }
}
