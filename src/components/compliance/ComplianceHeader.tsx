import { Button, Text } from '@vapor-ui/core';

export interface ComplianceHeaderProps {
  onRun: () => void;
  onReset: () => void;
  isRunning?: boolean;
}

/**
 * Compliance Workbench 상단 헤더.
 * 제목·부제목·액션 버튼(검사 실행 / 리포트 초기화)을 포함한다.
 */
export function ComplianceHeader({ onRun, onReset, isRunning = false }: ComplianceHeaderProps) {
  return (
    <header className="flex flex-col gap-v-100 border-b border-v-normal px-v-400 py-v-300 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-v-50">
        <h1>
          <Text typography="heading3">Vapor UI Compliance Workbench</Text>
        </h1>
        <Text typography="body3" foreground="hint-200">
          Vapor UI 적용 품질, 레이아웃, 접근성, 토큰 사용을 검사합니다.
        </Text>
      </div>
      <div className="flex items-center gap-v-100">
        <Button variant="fill" size="md" disabled={isRunning} onClick={onRun}>
          {isRunning ? '검사 중…' : '검사 실행'}
        </Button>
        <Button variant="ghost" size="md" onClick={onReset}>
          리포트 초기화
        </Button>
      </div>
    </header>
  );
}
