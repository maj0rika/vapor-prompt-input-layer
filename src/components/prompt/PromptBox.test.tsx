import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptBox } from './PromptBox';
import type { PromptBoxProps } from './types';

type HarnessProps = Partial<PromptBoxProps> & { initialValue?: string };

/** value 를 자체 보관하는 controlled 테스트 하니스. */
function Harness({ initialValue = '', onSubmit = () => {}, ...rest }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <PromptBox
      value={value}
      onValueChange={setValue}
      onSubmit={onSubmit}
      {...rest}
    />
  );
}

const getTextarea = () => screen.getByLabelText('프롬프트 입력');
const getSubmit = () => screen.getByRole('button', { name: '보내기' });

describe('PromptBox', () => {
  it('빈 값이면 제출 버튼이 비활성화된다', () => {
    render(<Harness initialValue="" />);
    expect(getSubmit()).toBeDisabled();
  });

  it('공백만 입력된 경우에도 제출이 비활성화된다', () => {
    render(<Harness initialValue="   " />);
    expect(getSubmit()).toBeDisabled();
  });

  it('값이 있으면 제출 버튼이 활성화된다', () => {
    render(<Harness initialValue="안녕하세요" />);
    expect(getSubmit()).toBeEnabled();
  });

  it('maxLength 를 초과하면 제출이 비활성화된다', () => {
    render(
      <PromptBox
        value="12345"
        onValueChange={() => {}}
        onSubmit={() => {}}
        maxLength={3}
      />,
    );
    expect(getSubmit()).toBeDisabled();
  });

  it('Enter 입력 시 onSubmit 이 호출된다', () => {
    const onSubmit = vi.fn();
    render(<Harness initialValue="질문입니다" onSubmit={onSubmit} />);
    fireEvent.keyDown(getTextarea(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Shift+Enter 입력 시에는 제출하지 않는다 (줄바꿈)', () => {
    const onSubmit = vi.fn();
    render(<Harness initialValue="질문입니다" onSubmit={onSubmit} />);
    fireEvent.keyDown(getTextarea(), { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('IME 조합 중 Enter 는 제출하지 않는다', () => {
    const onSubmit = vi.fn();
    render(<Harness initialValue="질문" onSubmit={onSubmit} />);
    fireEvent.keyDown(getTextarea(), { key: 'Enter', isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('빈 값에서 Enter 를 눌러도 제출하지 않는다', () => {
    const onSubmit = vi.fn();
    render(<Harness initialValue="" onSubmit={onSubmit} />);
    fireEvent.keyDown(getTextarea(), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disabled 상태에서는 제출할 수 없다', () => {
    const onSubmit = vi.fn();
    render(<Harness initialValue="질문입니다" onSubmit={onSubmit} disabled />);
    expect(getSubmit()).toBeDisabled();
    fireEvent.keyDown(getTextarea(), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
