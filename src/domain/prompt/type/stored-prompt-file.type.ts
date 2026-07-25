import type {} from 'multer';

export const MAX_PROMPT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type StoredPromptFileExtension = '.pdf' | '.jpg' | '.png';

export interface StoredPromptFileInfo {
  readonly storage: 'minio';
  readonly bucket: string;
  readonly objectKey: string;
  readonly etag: string;
  readonly versionId: string | null;
  readonly sha256: string;
  readonly size: number;
  readonly contentType: string;
  readonly extension: StoredPromptFileExtension;
}

/** memoryStorage의 buffer/path 필드를 포함하지 않는 업로드 완료 파일입니다. */
export type StoredPromptFile = Pick<
  Express.Multer.File,
  'fieldname' | 'originalname' | 'encoding' | 'mimetype'
> & StoredPromptFileInfo;
