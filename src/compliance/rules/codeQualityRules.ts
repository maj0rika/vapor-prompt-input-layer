import type { Gate, Evidence, FixGuide } from '../types.ts';

export type CodeQualityInput = {
  /** tsconfig.app.json (또는 strict 옵션을 담은 컴파일러 옵션) 의 raw text */
  tsconfigText?: string;
  /** package.json 의 scripts 객체 키 배열 */
  scriptNames?: string[];
  /** README.md 본문 길이 (글자수) */
  readmeLength?: number;
};

const REQUIRED_SCRIPTS = ['typecheck', 'lint', 'test', 'build', 'verify:compliance'];
const README_MIN_CHARS = 500;

/**
 * Code Quality 게이트: 프로젝트 단위 거버넌스 시그널을 검사한다.
 * - TypeScript strict 모드 활성화
 * - 필수 npm scripts 존재
 * - README 가 의미 있는 분량 (>= 500 chars)
 *
 * 모든 항목 PASS 면 게이트 PASS, 누락 있으면 FAIL.
 * 입력이 하나라도 undefined 면 부분 평가 후 WARN.
 */
export function checkCodeQuality(input: CodeQualityInput = {}): Gate {
  const gateId = 'code-quality';
  const name = 'Code Quality';
  const evidence: Evidence[] = [];
  const fixGuide: FixGuide[] = [];

  const checks: Array<{ ok: boolean; pass: string; fail: string; fix?: FixGuide; location?: string }> = [];

  // 1) TypeScript strict 모드
  if (input.tsconfigText !== undefined) {
    const strictOn = /"strict"\s*:\s*true/.test(input.tsconfigText);
    checks.push({
      ok: strictOn,
      pass: 'TypeScript strict 모드 활성화됨.',
      fail: 'TypeScript strict 모드가 비활성화 상태입니다.',
      fix: {
        title: 'tsconfig 에 strict: true 추가',
        detail: 'tsconfig.app.json 의 compilerOptions 에 "strict": true 를 명시하세요.',
      },
      location: 'tsconfig.json',
    });
  }

  // 2) 필수 scripts
  if (input.scriptNames !== undefined) {
    const missing = REQUIRED_SCRIPTS.filter((s) => !input.scriptNames!.includes(s));
    checks.push({
      ok: missing.length === 0,
      pass: `필수 npm scripts 모두 정의됨: ${REQUIRED_SCRIPTS.join(', ')}.`,
      fail: `필수 npm scripts 누락: ${missing.join(', ')}.`,
      fix: {
        title: 'package.json scripts 보강',
        detail: `다음 항목을 package.json scripts 에 추가하세요: ${missing.join(', ')}.`,
      },
      location: 'package.json',
    });
  }

  // 3) README 최소 분량
  if (input.readmeLength !== undefined) {
    const meetsMin = input.readmeLength >= README_MIN_CHARS;
    checks.push({
      ok: meetsMin,
      pass: `README.md 가 ${input.readmeLength} 글자로 충분한 분량입니다 (≥ ${README_MIN_CHARS}).`,
      fail: `README.md 가 ${input.readmeLength} 글자로 너무 짧습니다 (< ${README_MIN_CHARS}).`,
      fix: {
        title: 'README 확장',
        detail: '제품 정체성, 실행, 검증, 한계, 데모 스크립트를 추가하세요.',
      },
      location: 'README.md',
    });
  }

  // 입력이 전혀 없으면 WARN/skip
  if (checks.length === 0) {
    return {
      gateId,
      name,
      status: 'WARN',
      evidence: [{ message: 'Code quality scan skipped: no inputs provided.' }],
      fixGuide: [
        {
          title: 'Wire code quality inputs',
          detail: 'Pass tsconfigText / scriptNames / readmeLength to enable this gate.',
        },
      ],
    };
  }

  for (const c of checks) {
    if (c.ok) {
      evidence.push({ message: c.pass, location: c.location });
    } else {
      evidence.push({ message: c.fail, location: c.location });
      if (c.fix) fixGuide.push(c.fix);
    }
  }

  const allOk = checks.every((c) => c.ok);

  return {
    gateId,
    name,
    status: allOk ? 'PASS' : 'FAIL',
    evidence,
    fixGuide,
  };
}
