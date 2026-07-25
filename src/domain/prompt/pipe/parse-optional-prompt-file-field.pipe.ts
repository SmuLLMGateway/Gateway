import { Injectable, type PipeTransform } from '@nestjs/common';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { PromptException } from '../exception/prompt.exception.js';

/** multipart의 `file=` 빈 일반 필드를 파일 미첨부로 정규화합니다. */
@Injectable()
export class ParseOptionalPromptFileFieldPipe
  implements PipeTransform<unknown, undefined>
{
  transform(value: unknown): undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    throw new PromptException(PromptErrorStatus.INVALID_ANALYZE_REQUEST);
  }
}
