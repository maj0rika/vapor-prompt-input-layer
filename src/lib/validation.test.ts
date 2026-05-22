import { describe, it, expect } from 'vitest';
import { matchesAccept, checkFile, validateFiles } from './validation';

const makeFile = (name: string, type = '', sizeInBytes = 1): File =>
  new File(['x'.repeat(sizeInBytes)], name, { type });

describe('matchesAccept', () => {
  it('accept 가 없으면 모든 파일을 허용한다', () => {
    expect(matchesAccept(makeFile('a.txt'), undefined)).toBe(true);
    expect(matchesAccept(makeFile('a.txt'), [])).toBe(true);
  });

  it('확장자 규칙으로 매칭한다', () => {
    expect(matchesAccept(makeFile('photo.PNG'), ['.png'])).toBe(true);
    expect(matchesAccept(makeFile('doc.txt'), ['.png'])).toBe(false);
  });

  it('와일드카드 MIME 규칙으로 매칭한다', () => {
    expect(matchesAccept(makeFile('a.png', 'image/png'), ['image/*'])).toBe(true);
    expect(matchesAccept(makeFile('a.pdf', 'application/pdf'), ['image/*'])).toBe(
      false,
    );
  });
});

describe('checkFile', () => {
  it('허용 확장자 파일은 통과한다', () => {
    expect(checkFile(makeFile('a.png'), { accept: ['.png'] })).toEqual({
      ok: true,
    });
  });

  it('허용되지 않은 확장자는 unaccepted-type 으로 거부한다', () => {
    expect(checkFile(makeFile('a.exe'), { accept: ['.png'] })).toEqual({
      ok: false,
      reason: 'unaccepted-type',
    });
  });

  it('maxSize 를 초과하면 exceeds-max-size 로 거부한다', () => {
    expect(checkFile(makeFile('big.png', '', 100), { maxSize: 10 })).toEqual({
      ok: false,
      reason: 'exceeds-max-size',
    });
  });
});

describe('validateFiles', () => {
  it('통과/거부 파일을 분류한다', () => {
    const files = [
      makeFile('ok.png'),
      makeFile('bad.exe'),
      makeFile('ok2.png'),
    ];
    const result = validateFiles(files, { accept: ['.png'], multiple: true });
    expect(result.accepted.map((f) => f.name)).toEqual(['ok.png', 'ok2.png']);
    expect(result.rejections).toEqual([
      { fileName: 'bad.exe', reason: 'unaccepted-type' },
    ]);
  });

  it('multiple 이 아니면 두 번째 파일부터 too-many-files 로 거부한다', () => {
    const files = [makeFile('a.png'), makeFile('b.png')];
    const result = validateFiles(files, { accept: ['.png'], multiple: false });
    expect(result.accepted.map((f) => f.name)).toEqual(['a.png']);
    expect(result.rejections).toEqual([
      { fileName: 'b.png', reason: 'too-many-files' },
    ]);
  });

  it('maxSize 초과 파일을 거부한다', () => {
    const result = validateFiles([makeFile('big.png', '', 100)], {
      maxSize: 10,
      multiple: true,
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.rejections[0].reason).toBe('exceeds-max-size');
  });

  it('maxFiles 를 넘는 파일을 too-many-files 로 거부한다', () => {
    const result = validateFiles(
      [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')],
      { accept: ['.png'], multiple: true, maxFiles: 2 },
    );

    expect(result.accepted.map((f) => f.name)).toEqual(['a.png', 'b.png']);
    expect(result.rejections).toEqual([
      { fileName: 'c.png', reason: 'too-many-files' },
    ]);
  });
});
