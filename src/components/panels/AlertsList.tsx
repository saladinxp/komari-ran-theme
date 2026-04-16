import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { StatusBadge } from '@/components/atoms/StatusBadge'
import { Icon } from '@/components/atoms/icons'

export interface AlertItem {
  code: string
  level: 'good' | 'warn' | 'bad' | 'info'
  levelLabel: string
  message: string
  target: string
  time: string
}

interface Props {
  alerts: AlertItem[]
}

const COLOR_FOR_LEVEL: Record<string, string> = {
  good: 'var(--signal-good)',
  warn: 'var(--signal-warn)',
  bad: 'var(--signal-bad)',
  info: 'var(--signal-info)',
}

export function AlertsList({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--fg-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        NO ACTIVE ALERTS
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {alerts.map((a, i) => (
        <AlertRow key={a.code + i} alert={a} last={i === alerts.length - 1} />
      ))}
    </div>
  )
}

function AlertRow({ alert, last }: { alert: AlertItem; last: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 60px 1fr 80px 90px',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: last ? 'none' : '1px solid var(--edge-engrave)',
        gap: 10,
        fontSize: 11,
        minWidth: 0,
      }}
    >
      <span style={{ color: COLOR_FOR_LEVEL[alert.level] }}>{Icon.alert}</span>
      <SerialPlate>{alert.code}</SerialPlate>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
        <span
          style={{
            color: 'var(--fg-0)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={alert.message}
        >
          {alert.message}
        </span>
        <Etch>{alert.target}</Etch>
      </div>
      <span
        className="mono tnum"
        style={{
          fontSize: 10,
          color: 'var(--fg-2)',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
      >
        {alert.time}
      </span>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <StatusBadge status={alert.level} label={alert.levelLabel} dense />
      </div>
    </div>
  )
}
