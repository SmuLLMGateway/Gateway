import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import { PromptException } from '../../src/domain/prompt/exception/prompt.exception.js';
import { ParsePromptListQueryPipe } from '../../src/domain/prompt/pipe/parse-prompt-list-query.pipe.js';

describe('ParsePromptListQueryPipe', () => {
  const pipe = new ParsePromptListQueryPipe();

  it('필수 pageSize와 선택 cursor를 정규화한다', () => {
    expect(pipe.transform({
      cursor: ' 1784957118000 ',
      pageSize: ' 10 ',
    })).toEqual({
      cursor: '1784957118000',
      pageSize: 10,
    });
  });

  it.each([
    ['cursor 없음', { pageSize: '1' }],
    ['null 값', { pageSize: '1', cursor: null }],
    ['"null" 문자열', { pageSize: '1', cursor: ' null ' }],
  ])('%s은 첫 페이지 요청으로 정규화한다', (_description, input) => {
    expect(pipe.transform(input)).toEqual({ pageSize: 1 });
  });

  it.each([
    ['undefined', undefined],
    ['배열', []],
    ['pageSize 누락', {}],
    ['알 수 없는 필드', { pageSize: '10', unexpected: 'field' }],
    ['배열 pageSize', { pageSize: ['10'] }],
    ['0 pageSize', { pageSize: '0' }],
    ['100 초과 pageSize', { pageSize: '101' }],
    ['소수 pageSize', { pageSize: '1.5' }],
    ['음수 pageSize', { pageSize: '-1' }],
    ['배열 cursor', { pageSize: '10', cursor: ['1784957118000'] }],
    ['음수 cursor', { pageSize: '10', cursor: '-1' }],
    ['날짜 범위를 벗어난 cursor', { pageSize: '10', cursor: '9007199254740991' }],
  ])('%s 입력은 저장소 조회 전에 거부한다', (_description, input) => {
    let thrown: unknown;

    try {
      pipe.transform(input);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PromptException);
    expect(thrown).toMatchObject({
      baseStatus: PromptErrorStatus.INVALID_PROMPT_LIST_REQUEST,
    });
  });
});
