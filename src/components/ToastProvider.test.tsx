import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { SettingsProvider, useSettings } from '../context/SettingsContext'
import ToastProvider, { useToast } from './ToastProvider'

afterEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

function ToastTrigger({ severity = 'info' as const, message = 'hello' } = {}) {
  const { addToast, removeAllToasts } = useToast()
  return (
    <>
      <button onClick={() => addToast(severity, message)}>add toast</button>
      <button onClick={() => addToast('danger', 'error message')}>add danger toast</button>
      <button onClick={() => addToast('info', 'info message')}>add info toast</button>
      <button onClick={() => addToast('success', 'success message')}>add success toast</button>
      <button onClick={() => addToast('warning', 'warning message')}>add warning toast</button>
      <button onClick={removeAllToasts}>remove all</button>
    </>
  )
}

function SequentialToastTrigger() {
  const { addToast } = useToast()
  const counter = useRef(0)
  return (
    <button onClick={() => addToast('info', `toast-${++counter.current}`)}>
      add numbered toast
    </button>
  )
}

function SettingsAutoDismissChanger() {
  const { setAutoDismiss } = useSettings()
  const { addToast } = useToast()
  return (
    <>
      <button onClick={() => addToast('info', 'timed toast')}>add timed toast</button>
      <button onClick={() => setAutoDismiss('3s')}>set auto dismiss 3s</button>
    </>
  )
}

function renderWithProviders(
  ui: React.ReactNode = <ToastTrigger />,
  settingsOverrides?: Record<string, unknown>,
) {
  if (settingsOverrides) {
    localStorage.setItem('credence:settings', JSON.stringify(settingsOverrides))
  }
  return render(
    <SettingsProvider>
      <ToastProvider>{ui}</ToastProvider>
    </SettingsProvider>,
  )
}

describe('ToastProvider wiring with SettingsProvider', () => {
  it('adds a toast when toastsEnabled is true', async () => {
    const user = userEvent.setup()
    renderWithProviders()
    await user.click(screen.getByRole('button', { name: 'add toast' }))
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('suppresses toasts when toastsEnabled is false', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ToastTrigger />, { toastsEnabled: false })
    await user.click(screen.getByRole('button', { name: 'add toast' }))
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })

  it('throws when useToast is used outside ToastProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ToastTrigger />)).toThrow('useToast must be used within ToastProvider')
    spy.mockRestore()
  })
})

describe('queue cap (MAX_TOASTS = 3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('keeps only the 3 most recent toasts when a 4th is added', () => {
    renderWithProviders(<SequentialToastTrigger />, { toastsEnabled: true, autoDismiss: 'off' })
    const addBtn = screen.getByRole('button', { name: 'add numbered toast' })

    act(() => {
      fireEvent.click(addBtn)
      fireEvent.click(addBtn)
      fireEvent.click(addBtn)
      fireEvent.click(addBtn)
    })

    expect(screen.queryByText('toast-1')).not.toBeInTheDocument()
    expect(screen.getByText('toast-2')).toBeInTheDocument()
    expect(screen.getByText('toast-3')).toBeInTheDocument()
    expect(screen.getByText('toast-4')).toBeInTheDocument()
  })
})

describe('Dismiss All control', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('does not render Dismiss All when only one toast is present', () => {
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: 'off' })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add toast' }))
    })
    expect(screen.queryByRole('button', { name: 'Dismiss All' })).not.toBeInTheDocument()
  })

  it('renders Dismiss All button when multiple toasts are present', () => {
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: 'off' })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add toast' }))
      fireEvent.click(screen.getByRole('button', { name: 'add toast' }))
    })
    expect(screen.getByRole('button', { name: 'Dismiss All' })).toBeInTheDocument()
  })

  it('removeAllToasts clears every toast', () => {
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: 'off' })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add toast' }))
      fireEvent.click(screen.getByRole('button', { name: 'remove all' }))
    })
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })

  it('Dismiss All clears toasts while a timer is still pending', () => {
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: '5s' })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add toast' }))
      fireEvent.click(screen.getByRole('button', { name: 'add danger toast' }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss All' }))
    })
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
    expect(screen.queryByText('error message')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })
})

describe('SettingsContext autoDismiss override', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('auto-dismisses at 3s when autoDismiss is 3s', () => {
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: '3s' })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add toast' }))
    })
    expect(screen.getByText('hello')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })

  it('auto-dismisses at 5s when autoDismiss is 5s', () => {
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: '5s' })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add toast' }))
    })
    act(() => {
      vi.advanceTimersByTime(4900)
    })
    expect(screen.getByText('hello')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })

  it('auto-dismisses at 8s when autoDismiss is 8s', () => {
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: '8s' })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add warning toast' }))
    })
    act(() => {
      vi.advanceTimersByTime(7900)
    })
    expect(screen.getByText('warning message')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByText('warning message')).not.toBeInTheDocument()
  })

  it('does not auto-dismiss when autoDismiss is off', () => {
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: 'off' })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add toast' }))
    })
    act(() => {
      vi.advanceTimersByTime(30000)
    })
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('uses the autoDismiss value active when each toast was added', () => {
    renderWithProviders(<SettingsAutoDismissChanger />, {
      toastsEnabled: true,
      autoDismiss: '5s',
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add timed toast' }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'set auto dismiss 3s' }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add timed toast' }))
    })

    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(screen.getAllByText('timed toast')).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('timed toast')).not.toBeInTheDocument()
  })
})

describe('per-severity default timeouts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  /** autoDismiss without trailing "s" falls through to TIMEOUTS[severity]. */
  const severityDefaults = { toastsEnabled: true, autoDismiss: 'default' }

  it('auto-dismisses info at 5s', () => {
    renderWithProviders(undefined, severityDefaults)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add info toast' }))
    })
    act(() => {
      vi.advanceTimersByTime(5100)
    })
    expect(screen.queryByText('info message')).not.toBeInTheDocument()
  })

  it('auto-dismisses success at 5s', () => {
    renderWithProviders(undefined, severityDefaults)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add success toast' }))
    })
    act(() => {
      vi.advanceTimersByTime(5100)
    })
    expect(screen.queryByText('success message')).not.toBeInTheDocument()
  })

  it('auto-dismisses warning at 8s', () => {
    renderWithProviders(undefined, severityDefaults)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add warning toast' }))
    })
    act(() => {
      vi.advanceTimersByTime(7900)
    })
    expect(screen.getByText('warning message')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByText('warning message')).not.toBeInTheDocument()
  })

  it('keeps danger toasts until manually dismissed', () => {
    renderWithProviders(undefined, severityDefaults)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add danger toast' }))
    })
    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(screen.getByText('error message')).toBeInTheDocument()
  })

  it('allows multiple sticky danger toasts simultaneously', () => {
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: 'off' })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'add danger toast' }))
      fireEvent.click(screen.getByRole('button', { name: 'add danger toast' }))
    })
    expect(screen.getAllByText('error message')).toHaveLength(2)
    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(screen.getAllByText('error message')).toHaveLength(2)
  })
})

describe('aria-live region split', () => {
  it('polite region has aria-live="polite"', () => {
    renderWithProviders()
    const politeRegion = screen.getByRole('region', { name: 'Notifications' })
    expect(politeRegion).toHaveAttribute('aria-live', 'polite')
  })

  it('assertive region has aria-live="assertive"', () => {
    renderWithProviders()
    const assertiveRegion = screen.getByRole('region', { name: 'Error notifications' })
    expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive')
  })

  it('renders danger toast inside the assertive region', async () => {
    const user = userEvent.setup()
    renderWithProviders()
    await user.click(screen.getByRole('button', { name: 'add danger toast' }))
    const assertiveRegion = screen.getByRole('region', { name: 'Error notifications' })
    expect(assertiveRegion).toContainElement(screen.getByText('error message'))
  })

  it('danger toast uses role="alert"', async () => {
    const user = userEvent.setup()
    renderWithProviders()
    await user.click(screen.getByRole('button', { name: 'add danger toast' }))
    expect(screen.getByRole('alert')).toHaveTextContent('error message')
  })

  it('renders info toast inside the polite region', async () => {
    const user = userEvent.setup()
    renderWithProviders()
    await user.click(screen.getByRole('button', { name: 'add info toast' }))
    const politeRegion = screen.getByRole('region', { name: 'Notifications' })
    expect(politeRegion).toContainElement(screen.getByText('info message'))
  })

  it('info toast uses role="status"', async () => {
    const user = userEvent.setup()
    renderWithProviders()
    await user.click(screen.getByRole('button', { name: 'add info toast' }))
    expect(screen.getByRole('status')).toHaveTextContent('info message')
  })

  it('mixed stack: danger goes to assertive, info stays polite', async () => {
    const user = userEvent.setup()
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: 'off' })
    await user.click(screen.getByRole('button', { name: 'add danger toast' }))
    await user.click(screen.getByRole('button', { name: 'add info toast' }))
    const assertiveRegion = screen.getByRole('region', { name: 'Error notifications' })
    const politeRegion = screen.getByRole('region', { name: 'Notifications' })
    expect(assertiveRegion).toContainElement(screen.getByText('error message'))
    expect(politeRegion).toContainElement(screen.getByText('info message'))
  })

  it('danger toast is NOT inside the polite region', async () => {
    const user = userEvent.setup()
    renderWithProviders()
    await user.click(screen.getByRole('button', { name: 'add danger toast' }))
    const politeRegion = screen.getByRole('region', { name: 'Notifications' })
    expect(politeRegion).not.toContainElement(screen.getByText('error message'))
  })

  it('dismiss-all clears toasts from both regions', async () => {
    const user = userEvent.setup()
    renderWithProviders(undefined, { toastsEnabled: true, autoDismiss: 'off' })
    await user.click(screen.getByRole('button', { name: 'add danger toast' }))
    await user.click(screen.getByRole('button', { name: 'add info toast' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss All' }))
    expect(screen.queryByText('error message')).not.toBeInTheDocument()
    expect(screen.queryByText('info message')).not.toBeInTheDocument()
  })
})
