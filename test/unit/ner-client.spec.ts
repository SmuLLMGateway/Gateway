import { NerClient } from '../../src/global/ner/client/ner.client.js';
import { NerConfig } from '../../src/global/ner/config/ner.config.js';
import { NerRequestException } from '../../src/global/ner/exception/ner-request.exception.js';
import type { NerAnalyzeRequest } from '../../src/global/ner/type/ner-analyze-request.type.js';

describe('NerConfig', () => {
  const originalServerIp = process.env.NER_SERVER_IP;
  const originalServerPort = process.env.NER_SERVER_PORT;
  const originalNerDeploymentId = process.env.NER_DEPLOYMENT_ID;
  const originalLlmDeploymentId = process.env.NER_LLM_DEPLOYMENT_ID;

  afterEach(() => {
    if (originalServerIp === undefined) {
      delete process.env.NER_SERVER_IP;
    } else {
      process.env.NER_SERVER_IP = originalServerIp;
    }
    if (originalServerPort === undefined) {
      delete process.env.NER_SERVER_PORT;
    } else {
      process.env.NER_SERVER_PORT = originalServerPort;
    }
    if (originalNerDeploymentId === undefined) {
      delete process.env.NER_DEPLOYMENT_ID;
    } else {
      process.env.NER_DEPLOYMENT_ID = originalNerDeploymentId;
    }
    if (originalLlmDeploymentId === undefined) {
      delete process.env.NER_LLM_DEPLOYMENT_ID;
    } else {
      process.env.NER_LLM_DEPLOYMENT_ID = originalLlmDeploymentId;
    }
  });

  it('IP와 포트만 입력하면 HTTP 분석 URL을 만든다', () => {
    process.env.NER_SERVER_IP = ' 127.0.0.1 ';
    process.env.NER_SERVER_PORT = '8000';

    expect(new NerConfig().analyzeUrl).toBe('http://127.0.0.1:8000/detect');
  });

  it('Docker 호스트명과 포트도 사용할 수 있다', () => {
    process.env.NER_SERVER_IP = 'host.docker.internal';
    process.env.NER_SERVER_PORT = '8000';

    expect(new NerConfig().analyzeUrl).toBe('http://host.docker.internal:8000/detect');
  });

  it('서버 주소가 없으면 설정 오류를 발생시킨다', () => {
    delete process.env.NER_SERVER_IP;
    process.env.NER_SERVER_PORT = '8000';

    expect(() => new NerConfig()).toThrow(
      'NER_SERVER_IP 환경 변수가 필요합니다.',
    );
  });

  it('서버 IP에 포트나 경로가 포함되면 거부한다', () => {
    process.env.NER_SERVER_IP = 'http://127.0.0.1:8000/private/analyze';
    process.env.NER_SERVER_PORT = '8000';

    expect(() => new NerConfig()).toThrow(
      'NER_SERVER_IP에는 IP 또는 호스트명만 입력할 수 있습니다.',
    );
  });

  it('포트가 없거나 범위를 벗어나면 설정 오류를 발생시킨다', () => {
    process.env.NER_SERVER_IP = '127.0.0.1';
    delete process.env.NER_SERVER_PORT;

    expect(() => new NerConfig()).toThrow(
      'NER_SERVER_PORT 환경 변수가 필요합니다.',
    );

    process.env.NER_SERVER_PORT = '65536';
    expect(() => new NerConfig()).toThrow(
      'NER_SERVER_PORT는 1부터 65535 사이의 정수여야 합니다.',
    );
  });
});

describe('NerClient', () => {
  const request: NerAnalyzeRequest = {
    text: '민감정보가 포함된 원문',
    nerDeploymentId: 'ner-gliner-multi',
    llmDeploymentId: 'llm-qwen3-14b',
    existingDetections: [{
      start: 0,
      end: 4,
      text: '민감정보',
      type: 'PHONE_NUMBER',
      source: 'regex',
      score: 1,
    }],
  };
  const config = {
    analyzeUrl: 'http://127.0.0.1:8000/detect',
    llmDeploymentsUrl: 'http://127.0.0.1:8000/deployments/llm',
    requestTimeoutMs: 5_000,
    nerDeploymentId: 'ner-gliner-multi',
    llmDeploymentId: 'llm-qwen3-14b',
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

  it('LPL에 정규식 기존 탐지 결과를 포함한 JSON POST를 하고 탐지 결과를 반환한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      detections: [{
        start: 8,
        end: 11,
        text: '홍길동',
        type: 'PERSON',
        source: 'ner',
        score: 0.95,
        maskingText: '[ 이름 ]',
      }],
    }), { status: 200 }));

    await expect(client.requestAnalyze(request)).resolves.toEqual({
      detections: [{
        start: 8,
        end: 11,
        text: '홍길동',
        type: 'PERSON',
        source: 'ner',
        score: 0.95,
        maskingText: '[ 이름 ]',
      }],
    });

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

  it('마스킹 문자열 없이 반환된 탐지 결과도 Provider 기본 응답으로 파싱한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      detections: [{
        start: 0,
        end: 3,
        text: '홍길동',
        type: 'PERSON',
        source: 'ner',
        score: 0.95,
      }],
    }), { status: 200 }));

    await expect(client.requestAnalyze(request)).resolves.toEqual({
      detections: [{
        start: 0,
        end: 3,
        text: '홍길동',
        type: 'PERSON',
        source: 'ner',
        score: 0.95,
      }],
    });
  });

  it('NER·LLM 배포 ID가 없으면 요청 직전에 설정 오류를 반환한다', () => {
    const disabledConfig = {
      ...config,
      nerDeploymentId: null,
      llmDeploymentId: null,
    } as NerConfig;
    const disabledClient = new NerClient(disabledConfig);

    expect(() => disabledClient.getDetectionConfiguration())
      .toThrow(NerRequestException);
  });

  it('NER 서버에서 로컬 LLM 배포 목록을 조회한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      deployments: [{
        deploymentId: 'local-qwen',
        displayName: 'Qwen 배포',
        modelId: 'Qwen2.5-7B-Instruct',
        enabled: true,
      }],
    }), { status: 200 }));

    await expect(client.getLlmDeployments()).resolves.toEqual([{
      deploymentId: 'local-qwen',
      displayName: 'Qwen 배포',
      modelId: 'Qwen2.5-7B-Instruct',
      enabled: true,
    }]);
    expect(fetchSpy).toHaveBeenCalledWith(config.llmDeploymentsUrl, {
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
  });

  it('NER 서버의 잘못된 LLM 배포 응답은 연동 오류로 처리한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ deployments: [{}] }), {
      status: 200,
    }));

    await expect(client.getLlmDeployments()).rejects.toBeInstanceOf(
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
