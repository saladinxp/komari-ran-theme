/**
 * Footer — shared across all pages. Keeps the version number in one place.
 */
export function Footer({ version = 'v0.6.0' }: { version?: string }) {
  return (
    <footer
      style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--edge-engrave)',
        background: 'var(--bg-1)',
        color: 'var(--fg-3)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 'auto',
      }}
    >
      <span>岚 · KOMARI PROBE THEME · {version}</span>
      <span>POWERED BY KOMARI</span>
    </footer>
  )
}
