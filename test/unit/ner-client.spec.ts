import { NerClient } from '../../src/global/ner/client/ner.client.js';
import { NerConfig } from '../../src/global/ner/config/ner.config.js';
import { NerRequestException } from '../../src/global/ner/exception/ner-request.exception.js';
import type { NerAnalyzeRequest } from '../../src/global/ner/type/ner-analyze-request.type.js';

describe('NerConfig', () => {
  const originalServerIp = process.env.NER_SERVER_IP;

  afterEach(() => {
    if (originalServerIp === undefined) {
      delete process.env.NER_SERVER_IP;
    } else {
      process.env.NER_SERVER_IP = originalServerIp;
    }
  });

  it('IP와 포트만 입력하면 HTTP 분석 URL을 만든다', () => {
    process.env.NER_SERVER_IP = ' 127.0.0.1:8000 ';

    expect(new NerConfig().analyzeUrl).toBe('http://127.0.0.1:8000/');
  });

  it('HTTPS 서버 주소도 사용할 수 있다', () => {
    process.env.NER_SERVER_IP = 'https://ner.internal';

    expect(new NerConfig().analyzeUrl).toBe('https://ner.internal/');
  });

  it('서버 주소가 없으면 설정 오류를 발생시킨다', () => {
    delete process.env.NER_SERVER_IP;

    expect(() => new NerConfig()).toThrow(
      'NER_SERVER_IP 환경 변수가 필요합니다.',
    );
  });

  it('서버 주소에 임의의 API 경로가 포함되면 거부한다', () => {
    process.env.NER_SERVER_IP = 'http://127.0.0.1:8000/private/analyze';

    expect(() => new NerConfig()).toThrow(
      'NER_SERVER_IP에는 인증 정보, 경로, 쿼리 또는 fragment를 입력할 수 없습니다.',
    );
  });
});

describe('NerClient', () => {
  const request: NerAnalyzeRequest = {
    ticket: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
    text: '민감정보가 포함된 원문',
    file: {
      url: 'https://minio.internal/masking/ticket/source',
      contentType: 'application/pdf',
      size: 128,
      sha256: 'a'.repeat(64),
    },
  };
  const config = {
    analyzeUrl: 'http://127.0.0.1:8000/',
    requestTimeoutMs: 5_000,
  } as NerConfig;

  let client: NerClient;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    client = new NerClient(config);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('NER 서버에 분석 요청을 JSON POST한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 202 }));

    await expect(client.requestAnalyze(request)).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith(config.analyzeUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: expect.any(AbortSignal),
    });
  });

  it('NER 서버가 비-2xx로 응답하면 연동 오류를 발생시킨다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(client.requestAnalyze(request)).rejects.toBeInstanceOf(
      NerRequestException,
    );
  });

  it('네트워크 요청이 실패하면 연동 오류로 변환한다', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(client.requestAnalyze(request)).rejects.toBeInstanceOf(
      NerRequestException,
    );
  });
});
