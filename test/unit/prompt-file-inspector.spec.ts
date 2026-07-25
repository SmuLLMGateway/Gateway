import { createHash } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import { PromptException } from '../../src/domain/prompt/exception/prompt.exception.js';
import { PromptFileInspectorTransform } from '../../src/domain/prompt/storage/prompt-file-inspector.transform.js';
import { MAX_PROMPT_FILE_SIZE_BYTES } from '../../src/domain/prompt/type/stored-prompt-file.type.js';

describe('PromptFileInspectorTransform', () => {
  const supportedFiles = [
    {
      filename: 'report.pdf',
      mimeType: 'application/pdf',
      magic: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
      expectedExtension: '.pdf',
    },
    {
      filename: 'photo.jpeg',
      mimeType: 'image/jpeg',
      magic: Buffer.from([0xff, 0xd8, 0xff]),
      expectedExtension: '.jpg',
    },
    {
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      magic: Buffer.from([0xff, 0xd8, 0xff]),
      expectedExtension: '.jpg',
    },
    {
      filename: 'capture.png',
      mimeType: 'image/png',
      magic: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      expectedExtension: '.png',
    },
  ] as const;

  it.each(supportedFiles)(
    '$filename의 magic byte가 여러 chunk로 나뉘어도 원본 그대로 통과시킨다',
    async ({ filename, mimeType, magic, expectedExtension }) => {
      const body = Buffer.from('streamed-body');
      const source = Buffer.concat([magic, body]);
      const chunks = [
        source.subarray(0, 1),
        source.subarray(1, Math.min(3, source.length)),
        source.subarray(Math.min(3, source.length)),
      ];
      const inspector = new PromptFileInspectorTransform(filename, mimeType);
      const output = await collect(inspector, chunks);

      expect(output).toEqual(source);
      expect(inspector.extension).toBe(expectedExtension);
      expect(inspector.contentType).toBe(mimeType);
    },
  );

  it('실제 byte 수와 SHA-256을 stream 전체에 대해 계산한다', async () => {
    const source = Buffer.from('%PDF-1.7\nclassified document');
    const inspector = new PromptFileInspectorTransform(
      'report.pdf',
      'application/pdf',
    );

    await collect(inspector, [
      source.subarray(0, 2),
      source.subarray(2, 9),
      source.subarray(9),
    ]);

    expect(inspector.size).toBe(source.length);
    expect(inspector.sha256).toBe(
      createHash('sha256').update(source).digest('hex'),
    );
  });

  it('지원하지 않는 확장자를 거부한다', () => {
    expect(() => new PromptFileInspectorTransform(
      'payload.exe',
      'application/octet-stream',
    )).toThrow(PromptException);
  });

  it('내용이 있는 파일의 확장자와 MIME type이 일치하지 않으면 거부한다', async () => {
    const inspector = new PromptFileInspectorTransform(
      'report.pdf',
      'image/png',
    );

    await expect(drain(
      inspector,
      [Buffer.from('%PDF-content')],
    )).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.INVALID_FILE_FORM,
    });
  });

  it('확장자와 MIME type을 위조해도 magic byte가 다르면 거부한다', async () => {
    const inspector = new PromptFileInspectorTransform(
      'report.pdf',
      'application/octet-stream',
    );

    await expect(drain(
      inspector,
      [Buffer.from('not-a-real-pdf')],
    )).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.INVALID_FILE_FORM,
    });
  });

  it('파일 내용이 비어 있어도 지원 확장자와 MIME type이면 허용한다', async () => {
    const inspector = new PromptFileInspectorTransform(
      'report.pdf',
      'application/pdf',
    );

    const output = await collect(inspector, []);

    expect(output).toEqual(Buffer.alloc(0));
    expect(inspector.size).toBe(0);
    expect(inspector.sha256).toBe(
      createHash('sha256').update(Buffer.alloc(0)).digest('hex'),
    );
  });

  it('10MB를 초과하면 전체 파일을 한 번에 할당하지 않고 거부한다', async () => {
    const inspector = new PromptFileInspectorTransform(
      'large.pdf',
      'application/pdf',
    );

    await expect(drain(
      inspector,
      oversizedPdfChunks(),
    )).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.INVALID_FILE_FORM,
    });

    expect(inspector.size).toBeLessThanOrEqual(MAX_PROMPT_FILE_SIZE_BYTES);
  });
});

async function collect(
  inspector: PromptFileInspectorTransform,
  chunks: Iterable<Buffer> | AsyncIterable<Buffer>,
): Promise<Buffer> {
  const output: Buffer[] = [];

  await pipeline(
    Readable.from(chunks),
    inspector,
    new Writable({
      write(chunk, _encoding, callback) {
        output.push(Buffer.from(chunk));
        callback();
      },
    }),
  );

  return Buffer.concat(output);
}

async function drain(
  inspector: PromptFileInspectorTransform,
  chunks: Iterable<Buffer> | AsyncIterable<Buffer>,
): Promise<void> {
  await pipeline(
    Readable.from(chunks),
    inspector,
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }),
  );
}

async function* oversizedPdfChunks(): AsyncGenerator<Buffer> {
  const magic = Buffer.from('%PDF-');
  const reusableChunk = Buffer.alloc(64 * 1024, 0x61);
  let remaining = MAX_PROMPT_FILE_SIZE_BYTES - magic.length + 1;

  yield magic;

  while (remaining > 0) {
    const chunkSize = Math.min(remaining, reusableChunk.length);
    yield reusableChunk.subarray(0, chunkSize);
    remaining -= chunkSize;
  }
}
