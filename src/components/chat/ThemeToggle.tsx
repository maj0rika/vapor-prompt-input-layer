import { IconButton, useTheme } from '@vapor-ui/core';
import { DarkOutlineIcon, LightOutlineIcon } from '@vapor-ui/icons';

/** 라이트/다크 모드 전환 버튼. Vapor 의 useTheme 으로 테마를 제어한다. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <IconButton
      size="sm"
      variant="ghost"
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <LightOutlineIcon size={16} /> : <DarkOutlineIcon size={16} />}
    </IconButton>
  );
}
