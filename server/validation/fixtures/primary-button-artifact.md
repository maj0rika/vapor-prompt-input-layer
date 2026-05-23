<artifact-meta>
{
  "componentName": "PrimaryActionButton",
  "primaryExport": "PrimaryActionButton",
  "defaultProps": { "children": "Deploy component" },
  "variants": [
    { "name": "Default", "props": { "children": "Deploy component" } },
    { "name": "Disabled", "props": { "children": "Deploy component", "disabled": true } }
  ]
}
</artifact-meta>

<artifact type="component" filename="PrimaryActionButton.tsx">
```tsx
import type React from 'react';
import { Button } from '@vapor-ui/core';

export type PrimaryActionButtonProps = {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
};

export function PrimaryActionButton({
  children,
  disabled = false,
  onClick,
}: PrimaryActionButtonProps) {
  return (
    <Button
      type="button"
      colorPalette="primary"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
```
</artifact>

<artifact type="story" filename="PrimaryActionButton.stories.tsx">
```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { PrimaryActionButton } from './PrimaryActionButton';

const meta = {
  title: 'Vapor Automation/PrimaryActionButton',
  component: PrimaryActionButton,
  args: { children: 'Deploy component' },
} satisfies Meta<typeof PrimaryActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
```
</artifact>

<artifact type="test" filename="PrimaryActionButton.test.tsx">
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PrimaryActionButton } from './PrimaryActionButton';

describe('PrimaryActionButton', () => {
  it('calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<PrimaryActionButton onClick={onClick}>Deploy</PrimaryActionButton>);

    await userEvent.click(screen.getByRole('button', { name: 'Deploy' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```
</artifact>

<notes type="a11y">
Accessible name comes from children. Disabled state is delegated to Vapor Button.
</notes>

<notes type="token">
Uses @vapor-ui/core Button and colorPalette instead of raw color values.
</notes>
