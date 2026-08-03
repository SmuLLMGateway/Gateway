const MAX_TCP_PORT = 65_535;

/**
 * `.env`의 서버 IP(또는 Docker 호스트명)와 포트를 안전한 HTTP base URL로 만듭니다.
 * URL 경로는 각 서버 클라이언트가 고정하므로 환경 변수에는 주소 정보만 둡니다.
 */
export function readHttpServerBaseUrl(serviceName: string): string {
  const hostKey = `${serviceName}_SERVER_IP`;
  const portKey = `${serviceName}_SERVER_PORT`;
  const host = process.env[hostKey]?.trim();
  const rawPort = process.env[portKey]?.trim();

  if (host === undefined || host.length === 0) {
    throw new Error(`${hostKey} 환경 변수가 필요합니다.`);
  }
  if (rawPort === undefined || rawPort.length === 0) {
    throw new Error(`${portKey} 환경 변수가 필요합니다.`);
  }
  if (
    host.includes('://')
    || /[\s/?#@]/.test(host)
    || (host.includes(':') && !(host.startsWith('[') && host.endsWith(']')))
  ) {
    throw new Error(`${hostKey}에는 IP 또는 호스트명만 입력할 수 있습니다.`);
  }
  if (!/^\d+$/.test(rawPort)) {
    throw new Error(`${portKey}는 1부터 65535 사이의 정수여야 합니다.`);
  }

  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > MAX_TCP_PORT) {
    throw new Error(`${portKey}는 1부터 65535 사이의 정수여야 합니다.`);
  }

  try {
    return new URL(`http://${host}:${port}/`).toString();
  } catch {
    throw new Error(`${hostKey} 형식이 올바르지 않습니다.`);
  }
}
