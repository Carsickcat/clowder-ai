import React, { type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from '@/components/MarkdownContent';

type MarkdownContentWithTextScale = ComponentType<{
  content: string;
  textScale?: 'default' | 'chat';
}>;

function render(textScale?: 'default' | 'chat') {
  return renderToStaticMarkup(
    React.createElement(MarkdownContent as MarkdownContentWithTextScale, {
      content: 'Readable copy',
      textScale,
    }),
  );
}

describe('MarkdownContent text scale ownership', () => {
  it('keeps non-chat Markdown at the established 14px scale', () => {
    const html = render();

    expect(html).toContain('markdown-content text-sm break-words');
    expect(html).not.toContain('text-base');
  });

  it('keeps chat copy at 16px until the 768px medium breakpoint', () => {
    const html = render('chat');

    expect(html).toContain('markdown-content text-base md:text-sm break-words');
    expect(html).not.toContain('sm:text-sm');
  });
});
