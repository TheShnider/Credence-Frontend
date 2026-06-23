import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import RouteAnnouncer from './RouteAnnouncer';

// Helper component to trigger dynamic route transitions in tests
function TestNavigator({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [to, navigate]);
  return null;
}

describe('RouteAnnouncer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is visually hidden but correctly structured in the DOM tree on mount', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    const announcerRegion = container.querySelector('.sr-only');
    expect(announcerRegion).toBeInTheDocument();
    expect(announcerRegion).toHaveAttribute('aria-live', 'polite');
    expect(announcerRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('defers the announcement text setup until after layout paint', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    const announcer = container.querySelector('.sr-only');
    expect(announcer).toBeInTheDocument();
    expect(announcer?.textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(announcer?.textContent).toBe('Bond page loaded');
  });

  it('updates text dynamically on active route modifications', () => {
    const { container, rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteAnnouncer />
        <TestNavigator to="/dashboard" />
      </MemoryRouter>
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(container.querySelector('.sr-only')?.textContent).toBe('Dashboard page loaded');

    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteAnnouncer />
        <TestNavigator to="/trust" />
      </MemoryRouter>
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(container.querySelector('.sr-only')?.textContent).toBe('Trust Score page loaded');
  });

  it('falls back gracefully to structural 404 descriptions given unknown routes', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/some/unknown/route']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(container.querySelector('.sr-only')?.textContent).toBe('Page Not Found loaded');
  });
});