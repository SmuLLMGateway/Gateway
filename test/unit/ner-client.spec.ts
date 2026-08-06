import { Logger } from '@nestjs/common';
import { NerClient } from '../../src/global/ner/client/ner.client.js';
import { NerConfig } from '../../src/global/ner/config/ner.config.js';
import { NerRequestException } from '../../src/global/ner/exception/ner-request.exception.js';
import type { NerAnalyzeRequest } from '../../src/global/ner/type/ner-analyze-request.type.js';

describe('NerConfig', () => {
  const originalServerIp = process.env.NER_SERVER_IP;
  const originalServerPort = process.env.NER_SERVER_PORT;

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
  });

  it('IP와 포트만 입력하면 HTTP 분석 URL을 만든다', () => {
    process.env.NER_SERVER_IP = ' 127.0.0.1 ';
    process.env.NER_SERVER_PORT = '8000';

    const config = new NerConfig();
    expect(config.analyzeUrl).toBe('http://127.0.0.1:8000/detect');
    expect(config.requestTimeoutMs).toBe(90_000);
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
  const nerDeployment = {
    deploymentId: 'ner-gliner-multi',
    adapterType: 'gliner_http' as const,
    baseUrl: 'http://ner-server:8008/ner',
    timeoutMs: 30_000,
    enabled: true,
  };
  const llmDeployment = {
    deploymentId: 'ollama-qwen3-8b',
    adapterType: 'openai_compatible' as const,
    baseUrl: 'http://ollama:11434/v1',
    modelName: 'qwen3:8b',
    timeoutMs: 300_000,
    enabled: true,
  };
  const mockNerDeployment = {
    deploymentId: 'ner-mock',
    adapterType: 'mock' as const,
    enabled: true,
  };
  const mockLlmDeployment = {
    deploymentId: 'llm-mock',
    adapterType: 'mock' as const,
    enabled: true,
  };
  const config = {
    analyzeUrl: 'http://127.0.0.1:8000/detect',
    nerDeploymentsUrl: 'http://127.0.0.1:8000/deployments/ner',
    llmDeploymentsUrl: 'http://127.0.0.1:8000/deployments/llm',
    requestTimeoutMs: 90_000,
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

  it('LPL에 NER·로컬 LLM Deployment 등록 요청을 각각 201 계약으로 전송한다', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...nerDeployment,
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...llmDeployment,
      }), { status: 201 }));

    await expect(client.createNerDeployment(nerDeployment)).resolves.toEqual({
      deploymentId: nerDeployment.deploymentId,
    });
    await expect(client.createLlmDeployment(llmDeployment)).resolves.toEqual({
      deploymentId: llmDeployment.deploymentId,
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(1, config.nerDeploymentsUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(nerDeployment),
      signal: expect.any(AbortSignal),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, config.llmDeploymentsUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(llmDeployment),
      signal: expect.any(AbortSignal),
    });
  });

  it('mock Deployment에는 연결 설정 필드 없이 등록 요청을 전송한다', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(mockNerDeployment), {
        status: 201,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockLlmDeployment), {
        status: 201,
      }));

    await expect(client.createNerDeployment(mockNerDeployment)).resolves
      .toEqual({ deploymentId: mockNerDeployment.deploymentId });
    await expect(client.createLlmDeployment(mockLlmDeployment)).resolves
      .toEqual({ deploymentId: mockLlmDeployment.deploymentId });

    expect(fetchSpy).toHaveBeenNthCalledWith(1, config.nerDeploymentsUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(mockNerDeployment),
      signal: expect.any(AbortSignal),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, config.llmDeploymentsUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(mockLlmDeployment),
      signal: expect.any(AbortSignal),
    });
  });

  it.each([409, 422])('등록 요청의 LPL %i 오류 상태를 보존한다', async (status) => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status }));

    await expect(client.createLlmDeployment(llmDeployment)).rejects
      .toMatchObject({ status });
  });

  it('등록 응답이 201이 아니거나 deploymentId가 없으면 연동 오류를 반환한다', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deploymentId: nerDeployment.deploymentId,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 201 }));

    await expect(client.createNerDeployment(nerDeployment)).rejects
      .toMatchObject({ status: 200 });
    await expect(client.createNerDeployment(nerDeployment)).rejects
      .toBeInstanceOf(NerRequestException);
  });

  it('LPL에 LLM·NER Deployment 활성 상태 변경 PATCH를 전송하고 200 상세 응답을 반환한다', async () => {
    const updatedLlmDeployment = {
      ...llmDeployment,
      enabled: false,
    };
    const updatedNerDeployment = {
      ...nerDeployment,
      enabled: true,
    };
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(updatedLlmDeployment), {
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(updatedNerDeployment), {
        status: 200,
      }));

    await expect(
      client.updateLlmDeploymentEnabled(llmDeployment.deploymentId, false),
    ).resolves.toEqual(updatedLlmDeployment);
    await expect(
      client.updateNerDeploymentEnabled(nerDeployment.deploymentId, true),
    ).resolves.toEqual(updatedNerDeployment);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      `${config.llmDeploymentsUrl}/${llmDeployment.deploymentId}/enabled`,
      {
        method: 'PATCH',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ enabled: false }),
        signal: expect.any(AbortSignal),
      },
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      `${config.nerDeploymentsUrl}/${nerDeployment.deploymentId}/enabled`,
      {
        method: 'PATCH',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ enabled: true }),
        signal: expect.any(AbortSignal),
      },
    );
  });

  it.each([404, 422, 503])(
    'LLM·NER 활성 상태 변경의 LPL %i 오류 상태를 보존한다',
    async (status) => {
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(new Response(null, { status }));

      await expect(
        client.updateLlmDeploymentEnabled(llmDeployment.deploymentId, false),
      ).rejects.toMatchObject({ status });
      await expect(
        client.updateNerDeploymentEnabled(nerDeployment.deploymentId, false),
      ).rejects.toMatchObject({ status });
    },
  );

  it('활성 상태 변경 Deployment ID를 LPL 경로 세그먼트로 URL 인코딩한다', async () => {
    const llmDeploymentId = 'llm/qwen 3:8b';
    const nerDeploymentId = 'ner/gliner multi';
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...llmDeployment,
        deploymentId: llmDeploymentId,
        enabled: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...nerDeployment,
        deploymentId: nerDeploymentId,
        enabled: false,
      }), { status: 200 }));

    await client.updateLlmDeploymentEnabled(llmDeploymentId, true);
    await client.updateNerDeploymentEnabled(nerDeploymentId, false);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      `${config.llmDeploymentsUrl}/${encodeURIComponent(llmDeploymentId)}/enabled`,
      expect.any(Object),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      `${config.nerDeploymentsUrl}/${encodeURIComponent(nerDeploymentId)}/enabled`,
      expect.any(Object),
    );
  });

  it('NER 서버가 비-2xx로 응답하면 요청·응답 본문을 로그에 남기고 연동 오류를 발생시킨다', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')
      .mockImplementation();
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      detail: 'GLiNER adapter timed out',
    }), { status: 502 }));

    try {
      await expect(client.requestAnalyze(request)).rejects.toMatchObject({
        status: 502,
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'event=ner_analyze_request_failed method=POST endpoint=/detect status=502',
      ));
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'request_body={"nerDeploymentId":"ner-gliner-multi","llmDeploymentId":"llm-qwen3-14b","existingDetections":[{"start":0,"end":4,"text":"민감정보","type":"PHONE_NUMBER","source":"regex","score":1}],"text":"민감정보가 포함된 원문"}',
      ));
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'response_body={"detail":"GLiNER adapter timed out"}',
      ));
    } finally {
      loggerErrorSpy.mockRestore();
    }
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

  it('성공 상태라도 잘못된 응답 본문이면 요청·응답 본문을 로그에 남긴다', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')
      .mockImplementation();
    fetchSpy.mockResolvedValueOnce(new Response('not-json-response', {
      status: 200,
    }));

    try {
      await expect(client.requestAnalyze(request)).rejects.toBeInstanceOf(
        NerRequestException,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'event=ner_analyze_request_failed method=POST endpoint=/detect status=200',
      ));
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'request_body={"nerDeploymentId":"ner-gliner-multi","llmDeploymentId":"llm-qwen3-14b"',
      ));
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'response_body=not-json-response reason=SyntaxError:',
      ));
    } finally {
      loggerErrorSpy.mockRestore();
    }
  });

  it('NER·LLM 목록에서 활성화된 첫 Deployment ID를 탐지 요청용으로 반환한다', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deployments: [
          { deploymentId: 'ner-first', enabled: false },
          { deploymentId: 'ner-second', enabled: true },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deployments: [{ deploymentId: 'llm-first', enabled: true }],
      }), { status: 200 }));

    await expect(client.getFirstNerDeploymentId()).resolves.toBe('ner-second');
    await expect(client.getFirstLlmDeploymentId()).resolves.toBe('llm-first');
    expect(fetchSpy).toHaveBeenNthCalledWith(1, config.nerDeploymentsUrl, {
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, config.llmDeploymentsUrl, {
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
  });

  it('Deployment 목록이 비어 있으면 연동 오류를 반환한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ deployments: [] }), {
      status: 200,
    }));

    await expect(client.getFirstNerDeploymentId()).rejects
      .toBeInstanceOf(NerRequestException);
  });

  it('Deployment 목록이 null이면 연동 오류를 반환한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('null', { status: 200 }));

    await expect(client.getFirstLlmDeploymentId()).rejects
      .toBeInstanceOf(NerRequestException);
  });

  it('LPL에서 로컬 LLM 배포 요약 목록을 조회한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      deployments: [{
        deploymentId: 'local-qwen',
        enabled: true,
      }],
    }), { status: 200 }));

    await expect(client.getLlmDeployments()).resolves.toEqual([{
      deploymentId: 'local-qwen',
      enabled: true,
    }]);
    expect(fetchSpy).toHaveBeenCalledWith(config.llmDeploymentsUrl, {
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
  });

  it('local-* 모델명과 같은 활성 Deployment ID를 상세 조회 없이 우선 사용한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      deployments: [
        { deploymentId: 'local-qwen3:8b', enabled: true },
        { deploymentId: 'ollama-qwen3-legacy', enabled: true },
      ],
    }), { status: 200 }));

    await expect(
      client.getEnabledLlmDeploymentIdByModelName('local-qwen3:8b'),
    ).resolves.toBe('local-qwen3:8b');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(config.llmDeploymentsUrl, {
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
  });

  it('활성 로컬 모델명에 일치하는 첫 LLM Deployment ID를 상세 설정에서 찾는다', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deployments: [
          { deploymentId: 'disabled-qwen', enabled: false },
          { deploymentId: 'ollama-non-matching', enabled: true },
          { deploymentId: 'ollama-qwen-first', enabled: true },
          { deploymentId: 'ollama-qwen-second', enabled: true },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deploymentId: 'ollama-non-matching',
        enabled: true,
        adapterType: 'openai_compatible',
        baseUrl: 'http://ollama:11434/v1',
        modelName: 'qwen2.5:7b',
        timeoutMs: 300_000,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deploymentId: 'ollama-qwen-first',
        enabled: true,
        adapterType: 'openai_compatible',
        baseUrl: 'http://ollama:11434/v1',
        modelName: 'qwen3:8b',
        timeoutMs: 300_000,
      }), { status: 200 }));

    await expect(
      client.getEnabledLlmDeploymentIdByModelName('local-qwen3:8b'),
    ).resolves.toBe('ollama-qwen-first');

    expect(fetchSpy).toHaveBeenNthCalledWith(1, config.llmDeploymentsUrl, {
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8000/deployments/llm/ollama-non-matching',
      {
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:8000/deployments/llm/ollama-qwen-first',
      {
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('활성 LLM Deployment 상세에 일치하는 로컬 모델명이 없으면 null을 반환한다', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deployments: [
          { deploymentId: 'ollama-qwen', enabled: true },
          { deploymentId: 'ollama-llama', enabled: true },
          { deploymentId: 'disabled-matching', enabled: false },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deploymentId: 'ollama-qwen',
        enabled: true,
        adapterType: 'openai_compatible',
        baseUrl: 'http://ollama:11434/v1',
        modelName: 'qwen3:8b',
        timeoutMs: 300_000,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deploymentId: 'ollama-llama',
        enabled: true,
        adapterType: 'openai_compatible',
        baseUrl: 'http://ollama:11434/v1',
        modelName: 'llama3.2:3b',
        timeoutMs: 300_000,
      }), { status: 200 }));

    await expect(
      client.getEnabledLlmDeploymentIdByModelName('local-mistral:7b'),
    ).resolves.toBeNull();

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).not.toHaveBeenCalledWith(
      'http://127.0.0.1:8000/deployments/llm/disabled-matching',
      expect.anything(),
    );
  });

  it('LPL에서 NER 배포 요약 목록을 비활성 항목까지 그대로 조회한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      deployments: [
        { deploymentId: 'ner-gliner', enabled: true },
        { deploymentId: 'ner-disabled', enabled: false },
      ],
    }), { status: 200 }));

    await expect(client.getNerDeployments()).resolves.toEqual([
      { deploymentId: 'ner-gliner', enabled: true },
      { deploymentId: 'ner-disabled', enabled: false },
    ]);
    expect(fetchSpy).toHaveBeenCalledWith(config.nerDeploymentsUrl, {
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
  });

  it('활성 LLM 목록의 상세 API에서 modelName만 수집한다', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deployments: [
          { deploymentId: 'ollama-qwen', enabled: true },
          { deploymentId: 'mock', enabled: true },
          { deploymentId: 'disabled', enabled: false },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deploymentId: 'ollama-qwen',
        enabled: true,
        adapterType: 'openai_compatible',
        baseUrl: 'http://ollama:11434/v1',
        modelName: 'qwen3:8b',
        timeoutMs: 300_000,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deploymentId: 'mock',
        enabled: true,
        adapterType: 'mock',
      }), { status: 200 }));

    await expect(client.getEnabledLlmModelNames()).resolves.toEqual([
      'qwen3:8b',
    ]);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, config.llmDeploymentsUrl, {
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8000/deployments/llm/ollama-qwen',
      {
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:8000/deployments/llm/mock',
      {
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('LPL의 잘못된 LLM 배포 응답은 연동 오류로 처리한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ deployments: [{}] }), {
      status: 200,
    }));

    await expect(client.getLlmDeployments()).rejects.toBeInstanceOf(
      NerRequestException,
    );
  });

  it('네트워크 요청 실패 시 보낸 본문과 응답 미수신 원인을 로그에 남긴다', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')
      .mockImplementation();
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed', {
      cause: new Error('connect ECONNREFUSED 172.17.0.2:8000'),
    }));

    try {
      await expect(client.requestAnalyze(request)).rejects.toBeInstanceOf(
        NerRequestException,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'event=ner_analyze_request_failed method=POST endpoint=/detect status=NETWORK_ERROR',
      ));
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'request_body={"nerDeploymentId":"ner-gliner-multi","llmDeploymentId":"llm-qwen3-14b"',
      ));
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'response_body=<not_received> reason=TypeError: fetch failed cause=Error: connect ECONNREFUSED 172.17.0.2:8000',
      ));
    } finally {
      loggerErrorSpy.mockRestore();
    }
  });
});
