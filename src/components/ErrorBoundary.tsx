import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Where the error happened — appears in the fallback UI. */
  scope?: string
  /** When this value changes, the boundary resets and re-renders children.
   *  Pass e.g. the current uuid so navigating to a different node clears
   *  a stale error from the previous one. */
  resetKey?: string | number
  children: ReactNode
}

interface State {
  err: Error | null
}

/**
 * ErrorBoundary — catches render-time exceptions in the subtree and shows
 * a styled fallback panel instead of leaving the user with a blank page.
 *
 * The fallback uses the same theme tokens as the rest of the app so even
 * a hard error stays visually on-brand. We expose the error message and a
 * trimmed stack so failures filed to issues are actionable.
 *
 * Reset behaviour: when `resetKey` changes (e.g. user navigates to a new
 * node uuid) we drop the error so the new subtree gets a fresh attempt.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null }

  static getDerivedStateFromError(err: Error): State {
    return { err }
  }

  override componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.err) {
      this.setState({ err: null })
    }
  }

  override componentDidCatch(err: Error, info: ErrorInfo) {
    // Log to console — devtools / sentry / whatever picks it up later.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.scope ?? 'unknown', err, info)
  }

  override render() {
    if (!this.state.err) return this.props.children

    return (
      <div
        style={{
          padding: 24,
          fontFamily: 'var(--font-sans)',
          color: 'var(--fg-0)',
          background: 'var(--bg-0)',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '40px auto',
            border: '1px solid var(--signal-bad)',
            background: 'var(--bg-1)',
            boxShadow: 'inset 0 1px 0 var(--edge-bright)',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--edge-mid)',
              background: 'var(--bg-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--signal-bad)',
                boxShadow: '0 0 6px var(--signal-bad)',
              }}
            />
            <span style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>
              页面渲染出错
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--fg-3)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              {this.props.scope ?? 'render'} · err
            </span>
          </div>
          <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <div style={{ color: 'var(--signal-bad)', marginBottom: 8 }}>
              {this.state.err.message || String(this.state.err)}
            </div>
            {this.state.err.stack && (
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 240,
                  overflow: 'auto',
                  margin: 0,
                  padding: 8,
                  background: 'var(--bg-0)',
                  border: '1px solid var(--edge-engrave)',
                  fontSize: 10,
                  color: 'var(--fg-2)',
                }}
              >
                {this.state.err.stack.split('\n').slice(0, 8).join('\n')}
              </pre>
            )}
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                gap: 8,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <button
                type="button"
                onClick={() => this.setState({ err: null })}
                style={{
                  padding: '6px 12px',
                  background: 'var(--bg-2)',
                  color: 'var(--fg-0)',
                  border: '1px solid var(--edge-mid)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                重试
              </button>
              <a
                href="#/overview"
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  color: 'var(--fg-1)',
                  border: '1px solid var(--edge-engrave)',
                  textDecoration: 'none',
                  fontSize: 12,
                }}
              >
                返回首页
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
