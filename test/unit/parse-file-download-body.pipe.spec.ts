import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import { PromptException } from '../../src/domain/prompt/exception/prompt.exception.js';
import { ParseFileDownloadBodyPipe } from '../../src/domain/prompt/pipe/parse-file-download-body.pipe.js';

describe('ParseFileDownloadBodyPipe', () => {
  const pipe = new ParseFileDownloadBodyPipe();

  it.each([
    {
      description: 'canonical 파일 URL',
      input: { fileUrl: 's3://gateway-test/masking/ticket/source' },
      expected: 's3://gateway-test/masking/ticket/source',
    },
    {
      description: '양끝 공백이 포함된 파일 URL',
      input: { fileUrl: ' s3://gateway-test/masking/ticket/source ' },
      expected: 's3://gateway-test/masking/ticket/source',
    },
  ])('$description 입력을 정규화한다', ({ input, expected }) => {
    expect(pipe.transform(input)).toEqual({ fileUrl: expected });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['배열', []],
    ['빈 객체', {}],
    ['추가 필드', {
      fileUrl: 's3://gateway-test/masking/ticket/source',
      unexpected: 'field',
    }],
    ['배열 URL', {
      fileUrl: [
        's3://gateway-test/masking/ticket/source',
        's3://gateway-test/masking/ticket/source',
      ],
    }],
    ['빈 문자열', { fileUrl: '' }],
    ['공백 문자열', { fileUrl: '   ' }],
    ['숫자', { fileUrl: 52 }],
    ['최대 길이 초과', { fileUrl: 'a'.repeat(1_025) }],
  ])('%s 입력은 다운로드 저장소 조회 전에 거부한다', (_description, input) => {
    let thrown: unknown;

    try {
      pipe.transform(input);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PromptException);
    expect(thrown).toMatchObject({
      baseStatus: PromptErrorStatus.INVALID_FILE_DOWNLOAD_REQUEST,
    });
  });
});
