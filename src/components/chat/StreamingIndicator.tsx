/** 어시스턴트 응답 생성 중 표시하는 타이핑 인디케이터. */
export function StreamingIndicator() {
  return (
    <span
      role="status"
      aria-label="응답 생성 중"
      className="inline-flex items-center gap-v-50 py-v-50"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-v-hint-200"
          style={{ animationDelay: `${index * 0.15}s` }}
        />
      ))}
    </span>
  );
}
