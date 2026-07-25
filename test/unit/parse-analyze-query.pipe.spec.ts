import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import { PromptException } from '../../src/domain/prompt/exception/prompt.exception.js';
import { ParseAnalyzeQueryPipe } from '../../src/domain/prompt/pipe/parse-analyze-query.pipe.js';

describe('ParseAnalyzeQueryPipe', () => {
  const pipe = new ParseAnalyzeQueryPipe();
  const ticket = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';

  it('UUID ticket을 정규화한다', () => {
    expect(pipe.transform({ ticket: ` ${ticket.toUpperCase()} ` })).toEqual({
      ticket,
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['배열', []],
    ['빈 객체', {}],
    ['추가 필드', { ticket, unexpected: 'field' }],
    ['배열 ticket', { ticket: [ticket] }],
    ['빈 ticket', { ticket: '' }],
    ['UUID가 아닌 ticket', { ticket: 'not-a-uuid' }],
  ])('%s 입력은 저장소 조회 전에 거부한다', (_description, input) => {
    let thrown: unknown;

    try {
      pipe.transform(input);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PromptException);
    expect(thrown).toMatchObject({
      baseStatus: PromptErrorStatus.INVALID_ANALYZE_REQUEST,
    });
  });
});
