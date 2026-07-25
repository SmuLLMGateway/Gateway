import { getMetadataArgsStorage } from 'typeorm';
import type { Repository } from 'typeorm';
import {
  PROMPT_FILE_TABLE,
  PromptFileDAO,
} from '../../src/domain/prompt/dao/prompt-file.dao.js';
import { MaskingReportDAO } from '../../src/domain/prompt/dao/masking-report.dao.js';
import { PromptFileRepository } from '../../src/domain/prompt/repository/prompt-file.repository.js';

describe('PromptFileDAO', () => {
  it('ERD의 prompt_file 테이블과 컬럼을 매핑한다', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      (candidate) => candidate.target === PromptFileDAO,
    );
    const promptFileId = metadata.columns.find(
      (candidate) => candidate.target === PromptFileDAO
        && candidate.propertyName === 'promptFileId',
    );
    const fileUrl = metadata.columns.find(
      (candidate) => candidate.target === PromptFileDAO
        && candidate.propertyName === 'fileUrl',
    );
    const maskingReportId = metadata.columns.find(
      (candidate) => candidate.target === PromptFileDAO
        && candidate.propertyName === 'maskingReportId',
    );

    expect(table?.name).toBe(PROMPT_FILE_TABLE);
    expect(promptFileId?.options).toMatchObject({
      name: 'prompt_file_id',
      type: 'bigint',
    });
    expect(fileUrl?.options).toMatchObject({
      name: 'file_url',
      type: 'varchar',
      length: 1_024,
      nullable: false,
    });
    expect(maskingReportId?.options).toMatchObject({
      name: 'masking_report_id',
      type: 'varchar',
      length: 255,
      nullable: false,
    });
  });

  it('masking_report와 필수 다대일 FK 관계를 매핑한다', () => {
    const metadata = getMetadataArgsStorage();
    const relation = metadata.relations.find(
      (candidate) => candidate.target === PromptFileDAO
        && candidate.propertyName === 'maskingReport',
    );
    const joinColumn = metadata.joinColumns.find(
      (candidate) => candidate.target === PromptFileDAO
        && candidate.propertyName === 'maskingReport',
    );

    expect(relation?.relationType).toBe('many-to-one');
    expect(relation?.options).toMatchObject({ nullable: false });
    expect((relation?.type as () => unknown)()).toBe(MaskingReportDAO);
    expect(joinColumn?.name).toBe('masking_report_id');
  });
});

describe('PromptFileRepository', () => {
  const maskingReportId = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';
  const fileUrl =
    `s3://gateway-test/masking/${maskingReportId}/source`;
  const fileOriginalName = 'source.pdf';
  const typeormRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const repository = new PromptFileRepository(
    typeormRepository as unknown as Repository<PromptFileDAO>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('파일 참조를 생성하고 bigint ID를 문자열로 반환한다', async () => {
    const entity = {
      promptFileId: undefined,
      fileUrl,
      fileOriginalName,
      maskingReportId,
    } as unknown as PromptFileDAO;
    const saved = {
      promptFileId: '52',
      fileUrl,
      fileOriginalName,
      maskingReportId,
    } as PromptFileDAO;
    typeormRepository.create.mockReturnValueOnce(entity);
    typeormRepository.save.mockResolvedValueOnce(saved);

    await expect(
      repository.create(maskingReportId, fileUrl, fileOriginalName),
    ).resolves.toEqual({
      promptFileId: '52',
      fileUrl,
      fileOriginalName,
      maskingReportId,
    });
    expect(typeormRepository.create).toHaveBeenCalledWith({
      fileUrl,
      fileOriginalName,
      maskingReportId,
    });
    expect(typeormRepository.save).toHaveBeenCalledWith(entity);
  });

  it('문자열 bigint ID로 파일 참조를 삭제한다', async () => {
    typeormRepository.delete.mockResolvedValueOnce({ affected: 1 });

    await expect(repository.deleteById('52')).resolves.toBeUndefined();
    expect(typeormRepository.delete).toHaveBeenCalledWith({
      promptFileId: '52',
    });
  });

  it('파일 URL로 파일과 보고서 소유자를 결합한 다운로드 참조를 조회한다', async () => {
    typeormRepository.findOne.mockResolvedValueOnce({
      promptFileId: '52',
      fileUrl,
      fileOriginalName,
      maskingReportId,
      maskingReport: {
        memberId: '17',
      },
    });

    await expect(
      repository.findDownloadReferenceByFileUrl(fileUrl),
    ).resolves.toEqual({
      promptFileId: '52',
      fileUrl,
      fileOriginalName,
      maskingReportId,
      memberId: '17',
    });
    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      select: {
        promptFileId: true,
        fileUrl: true,
        fileOriginalName: true,
        maskingReportId: true,
        maskingReport: {
          memberId: true,
        },
      },
      relations: {
        maskingReport: true,
      },
      where: {
        fileUrl,
      },
    });
  });

  it('다운로드 대상이 없으면 null을 반환한다', async () => {
    typeormRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      repository.findDownloadReferenceByFileUrl('s3://gateway-test/missing'),
    ).resolves.toBeNull();
  });

  it('보고서에 연결된 파일 참조를 ID 오름차순으로 반환한다', async () => {
    typeormRepository.find.mockResolvedValueOnce([
      {
        promptFileId: '7',
        fileUrl,
        fileOriginalName,
        maskingReportId,
      },
      {
        promptFileId: '12',
        fileUrl: `${fileUrl}-2`,
        fileOriginalName: 'source-2.pdf',
        maskingReportId,
      },
    ]);

    await expect(repository.findByReportId(maskingReportId)).resolves.toEqual([
      {
        promptFileId: '7',
        fileUrl,
        fileOriginalName,
        maskingReportId,
      },
      {
        promptFileId: '12',
        fileUrl: `${fileUrl}-2`,
        fileOriginalName: 'source-2.pdf',
        maskingReportId,
      },
    ]);
    expect(typeormRepository.find).toHaveBeenCalledWith({
      select: {
        promptFileId: true,
        fileUrl: true,
        fileOriginalName: true,
        maskingReportId: true,
      },
      where: {
        maskingReportId,
      },
      order: {
        promptFileId: 'ASC',
      },
    });
  });
});
