import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import BoardMessage from './BoardMessage';

// Mock the service so tests don't need a real STOMP server
vi.mock('../services/liveBoardService', () => ({
  FADE_DURATION_MS: 90_000,
}));

const FRESH_POSTED_AT = new Date().toISOString(); // just now

describe('BoardMessage', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders the author username', () => {
    render(
      <BoardMessage
        id="msg-1"
        username="alice"
        xRatio={0.5}
        yRatio={0.5}
        content="hello"
        postedAt={FRESH_POSTED_AT}
        onExpire={vi.fn()}
      />
    );
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  test('renders plain text content', () => {
    render(
      <BoardMessage
        id="msg-2"
        username="bob"
        xRatio={0.3}
        yRatio={0.3}
        content="plain text message"
        postedAt={FRESH_POSTED_AT}
        onExpire={vi.fn()}
      />
    );
    expect(screen.getByText('plain text message')).toBeInTheDocument();
  });

  test('renders markdown bold text', () => {
    render(
      <BoardMessage
        id="msg-3"
        username="alice"
        xRatio={0.1}
        yRatio={0.1}
        content="**bold text**"
        postedAt={FRESH_POSTED_AT}
        onExpire={vi.fn()}
      />
    );
    const bold = screen.getByText('bold text');
    expect(bold.tagName).toBe('STRONG');
  });

  test('renders markdown links with safe attributes', () => {
    render(
      <BoardMessage
        id="msg-4"
        username="alice"
        xRatio={0.2}
        yRatio={0.2}
        content="[fitznet](https://fitznet.org)"
        postedAt={FRESH_POSTED_AT}
        onExpire={vi.fn()}
      />
    );
    const link = screen.getByRole('link', { name: 'fitznet' });
    expect(link).toHaveAttribute('href', 'https://fitznet.org');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('does NOT render raw HTML as HTML elements (XSS prevention)', () => {
    render(
      <BoardMessage
        id="msg-5"
        username="attacker"
        xRatio={0.5}
        yRatio={0.5}
        content="<script>alert('xss')</script>"
        postedAt={FRESH_POSTED_AT}
        onExpire={vi.fn()}
      />
    );
    expect(document.querySelector('script')).not.toBeInTheDocument();
  });

  test('returns null immediately when message has already expired', () => {
    const oldPostedAt = new Date(Date.now() - 95_000).toISOString(); // older than FADE_DURATION_MS
    const { container } = render(
      <BoardMessage
        id="msg-6"
        username="alice"
        xRatio={0.5}
        yRatio={0.5}
        content="expired message"
        postedAt={oldPostedAt}
        onExpire={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  test('calls onExpire after the remaining fade duration', async () => {
    const onExpire = vi.fn();
    const halfwayPostedAt = new Date(Date.now() - 45_000).toISOString(); // 45s ago, 45s remaining

    render(
      <BoardMessage
        id="msg-7"
        username="alice"
        xRatio={0.5}
        yRatio={0.5}
        content="halfway message"
        postedAt={halfwayPostedAt}
        onExpire={onExpire}
      />
    );

    expect(onExpire).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(46_000); }); // advance past remaining 45s
    expect(onExpire).toHaveBeenCalledWith('msg-7');
  });

  test('positions message using xRatio and yRatio as percentages', () => {
    render(
      <BoardMessage
        id="msg-8"
        username="alice"
        xRatio={0.25}
        yRatio={0.75}
        content="positioned"
        postedAt={FRESH_POSTED_AT}
        onExpire={vi.fn()}
      />
    );
    const el = screen.getByTestId('board-message');
    expect(el.style.left).toBe('25%');
    expect(el.style.top).toBe('75%');
  });
});

