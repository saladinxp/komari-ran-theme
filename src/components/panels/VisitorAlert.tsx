import { useEffect, useMemo, useRef, useState } from 'react'
import { useVisitorInfo } from '@/hooks/useVisitorInfo'
import { contentFs } from '@/utils/fontScale'

const SESSION_KEY = 'ran.visitor_alert_shown'
const AUTO_DISMISS_MS = 10_000 // 10s — 用户已经多次明确要求

interface Props {
  /** false 直接不渲染 — 由 Overview 透传后台 theme_settings.visitor_alert 开关 */
  enabled: boolean
}

/**
 * VisitorAlert — 首页右下角访客信息浮卡。
 *
 * 设计移植自参考模板(Visitor Card · DEFAULT 变体),核心工艺:
 *  - 多层 inset shadow:内描边 + 顶部高光(--edge-bright) + 底部蚀刻
 *    凹陷(--edge-engrave),配合双层投影(8px/24px),呈现"机加工金属
 *    厚度"质感
 *  - Banner 用 --bg-inset(凹陷读数窗色),不用 --bg-1,层次更清晰
 *  - HERO IP 区右侧独立 STATE 小框,像贴在仪表盘上的指示灯
 *  - 底部三栏 mono 数字嵌在 --bg-inset 凹槽里(TIER/RISK/SESSION)
 *  - 嵌入式进度槽:--bg-inset 凹陷 + --edge-engrave 描边 + accent fill 带 glow
 *  - 4 角小 crosshair 单元素(borderTop+borderLeft 一个 div 搞定)
 *  - hover 暂停自动关闭(参考模板的人性化设计)
 *
 * 触发:Overview 挂载 + sessionStorage 没标记 + theme_settings 没关
 * 关闭:✕ / Esc / 30s 倒计时 / Overview 卸载,任何一种都标记 session
 *
 * 立即出现 — 卡片 mount 后立刻 fade-in,字段先显占位字符,数据回来再填。
 */
export function VisitorAlert({ enabled }: Props) {
  const [active, setActive] = useState<boolean>(() => {
    if (!enabled) return false
    if (typeof window === 'undefined') return false
    try {
      return !sessionStorage.getItem(SESSION_KEY)
    } catch {
      return true
    }
  })

  const markShown = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!active) return
    return () => markShown()
  }, [active])

  if (!active) return null
  return (
    <VisitorAlertInner
      onDismiss={() => {
        markShown()
        setActive(false)
      }}
    />
  )
}

function VisitorAlertInner({ onDismiss }: { onDismiss: () => void }) {
  const { data, loading } = useVisitorInfo(true)
  const [visible, setVisible] = useState(false)
  /** 入场扫描线动画是否已完成 — 完成后倒计时才开始走、字段才算"激活" */
  const [entered, setEntered] = useState(false)
  const [closing, setClosing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hovered, setHovered] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const accumulatedRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const sessionStartRef = useRef<string>(formatTime(new Date()))

  // mount 后等 2.5 秒才开始入场:
  //   2500ms       visible=true → 容器滑入 (1200ms) + 扫描线启动 (180ms 后)
  //                同时倒计时启动 — 入场动画期间也算在 10s 里(用户从看到
  //                卡片那一刻就开始计时)
  //   2500+1350ms  entered=true → 入场完成,扫描线消失,字段固定亮
  useEffect(() => {
    const enterT = setTimeout(() => setVisible(true), 2500)
    const enteredT = setTimeout(() => setEntered(true), 2500 + 1350)
    return () => {
      clearTimeout(enterT)
      clearTimeout(enteredT)
    }
  }, [])

  // 倒计时 — visible=true 立刻启动(入场动画期间也跑);
  // hover 暂停;closing 关闭
  useEffect(() => {
    if (closing || hovered || !visible) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (startTimeRef.current !== null) {
        accumulatedRef.current += performance.now() - startTimeRef.current
        startTimeRef.current = null
      }
      return
    }
    startTimeRef.current = performance.now()
    const tick = (now: number) => {
      const elapsed = accumulatedRef.current + (now - (startTimeRef.current ?? now))
      const pct = Math.min(100, (elapsed / AUTO_DISMISS_MS) * 100)
      setProgress(pct)
      if (pct >= 100) {
        handleClose()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, closing, visible])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = () => {
    if (closing) return
    setClosing(true)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setTimeout(onDismiss, 680) // 等离场动画 (640ms) 走完再 unmount
  }

  const tier = useMemo(() => {
    if (!data) return 'unknown' as const
    if (data.risk > 50) return 'bad' as const
    if (data.risk > 20 || data.proxy === 'yes') return 'warn' as const
    return 'good' as const
  }, [data])

  const tierLabel = {
    good: 'TIER I · CLEAN',
    warn: 'TIER II · OBSERVE',
    bad: 'TIER III · BLOCK',
    unknown: 'PROBING …',
  }[tier]

  const stateLabel = {
    good: 'VERIFIED',
    warn: data?.proxy === 'yes' ? 'RELAYED' : 'FLAGGED',
    bad: 'ELEVATED',
    unknown: '— — —',
  }[tier]

  const accent =
    tier === 'good'
      ? 'var(--signal-good)'
      : tier === 'warn'
        ? 'var(--signal-warn)'
        : tier === 'bad'
          ? 'var(--signal-bad)'
          : 'var(--accent)'

  const remainSec = Math.max(
    0,
    Math.ceil((AUTO_DISMISS_MS - (AUTO_DISMISS_MS * progress) / 100) / 1000),
  )

  const ipText = data?.ip || (loading ? '— · — · — · —' : 'UNKNOWN')
  const location = data ? [data.city, data.country].filter(Boolean).join(', ') || '—' : 'resolving …'
  const coords =
    data?.lat !== undefined && data?.lon !== undefined
      ? `${data.lat.toFixed(3)} / ${data.lon.toFixed(3)}`
      : loading
        ? '— / —'
        : '—'
  const isp = data?.isp || (loading ? 'querying …' : '—')
  const linkType = !data ? '—' : data.proxy === 'yes' ? 'RELAYED' : 'DIRECT'
  const routeZh = !data ? '—' : tier === 'good' ? '直连验证' : data.proxy === 'yes' ? '链路异常' : '已标记'
  const ipv4Tag = data?.ip && data.ip.includes(':') ? 'IPv6' : data?.ip ? 'IPv4' : '—'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9000,
        opacity: visible && !closing ? 1 : 0,
        transform: visible && !closing ? 'translateY(0)' : 'translateY(60px)',
        // 入场:1200ms 柔顺曲线("沉降"感更明显)
        // 离场:640ms 慢出(跟入场呼应,不要"啪"地消失)
        transition: closing
          ? 'opacity 0.64s cubic-bezier(0.4, 0, 0.2, 1), transform 0.64s cubic-bezier(0.4, 0, 0.2, 1)'
          : 'opacity 1.2s cubic-bezier(0.22, 1, 0.36, 1), transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: visible && !closing ? 'auto' : 'none',
        maxWidth: 'calc(100vw - 28px)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: 360,
          maxWidth: '100%',
          background: 'var(--bg-2)',
          color: 'var(--fg-0)',
          fontFamily: 'var(--font-sans)',
          position: 'relative',
          overflow: 'hidden', // 兜住扫描线和未激活遮罩
          // 多层 inset shadow — 参考模板的"机加工金属厚度"效果
          boxShadow: `
            inset 0 0 0 1px var(--edge-mid),
            inset 0 1px 0 var(--edge-bright),
            inset 0 -1px 0 var(--edge-engrave),
            0 1px 0 rgba(255,255,255,0.04),
            0 8px 24px rgba(0,0,0,0.32),
            0 24px 48px rgba(0,0,0,0.22)
          `,
        }}
      >
        {/* 入场扫描线 — 水平 1px 亮线从顶向底扫过,~1170ms 走完全程。
            entered 之前可见,之后消失。 */}
        {visible && !entered && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              boxShadow: `0 0 8px ${accent}, 0 0 16px ${accent}`,
              opacity: 0.85,
              animation: 'ranVaScan 1.17s cubic-bezier(0.45, 0, 0.55, 1) forwards',
              animationDelay: '0.18s',
              pointerEvents: 'none',
              zIndex: 50,
            }}
          />
        )}

        {/* 未激活遮罩 — 扫描线下方的内容呈"未点亮"状态(降低对比度),
            扫描线扫过后随之揭开。用 clip-path 从顶到底 reveal,
            动画 timing 跟扫描线同步。 */}
        {visible && !entered && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--bg-2)',
              opacity: 0.55,
              pointerEvents: 'none',
              zIndex: 49,
              animation: 'ranVaCloak 1.17s cubic-bezier(0.45, 0, 0.55, 1) forwards',
              animationDelay: '0.18s',
            }}
          />
        )}
        {/* 4 角小 crosshair — borderTop+borderLeft 单元素工艺 */}
        {(
          [
            { top: 4, left: 4, br: 'topLeft' },
            { top: 4, right: 4, br: 'topRight' },
            { bottom: 4, left: 4, br: 'bottomLeft' },
            { bottom: 4, right: 4, br: 'bottomRight' },
          ] as const
        ).map((p, i) => {
          const top = (p as { top?: number }).top !== undefined
          const left = (p as { left?: number }).left !== undefined
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: (p as { top?: number }).top,
                bottom: (p as { bottom?: number }).bottom,
                left: (p as { left?: number }).left,
                right: (p as { right?: number }).right,
                width: 5,
                height: 5,
                borderTop: top ? `1px solid ${accent}` : 'none',
                borderBottom: !top ? `1px solid ${accent}` : 'none',
                borderLeft: left ? `1px solid ${accent}` : 'none',
                borderRight: !left ? `1px solid ${accent}` : 'none',
                opacity: 0.7,
                pointerEvents: 'none',
                transition: 'border-color 0.4s ease',
              }}
            />
          )
        })}

        {/* ─── Title bar ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'var(--bg-1)',
            borderBottom: '1px solid var(--edge-engrave)',
            boxShadow: 'inset 0 1px 0 var(--edge-bright)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                background: 'var(--accent)',
                boxShadow: '0 0 4px var(--accent)',
              }}
            />
            <span
              style={{
                fontSize: contentFs(9),
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-3)',
                letterSpacing: '0.18em',
              }}
            >
              EXTERNAL CONNECTION · OBSERVED
            </span>
          </div>
          <button
            aria-label="Close"
            onClick={handleClose}
            style={{
              width: 16,
              height: 16,
              background: 'transparent',
              border: '1px solid var(--edge-mid)',
              color: 'var(--fg-2)',
              fontSize: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fg-0)'
              e.currentTarget.style.borderColor = 'var(--edge-bright)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-2)'
              e.currentTarget.style.borderColor = 'var(--edge-mid)'
            }}
          >
            ×
          </button>
        </div>

        {/* ─── Tier banner — 凹陷读数窗工艺 ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'var(--bg-inset)',
            borderBottom: '1px solid var(--edge-engrave)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: accent,
                boxShadow: `0 0 6px ${accent}`,
                animation: 'ranVaPulse 1.6s ease-in-out infinite',
                transition: 'background 0.4s ease',
              }}
            />
            <span
              style={{
                fontSize: contentFs(11),
                fontFamily: 'var(--font-mono)',
                color: accent,
                fontWeight: 600,
                letterSpacing: '0.12em',
                transition: 'color 0.4s ease',
              }}
            >
              {tierLabel}
            </span>
          </div>
          <span
            style={{
              fontSize: contentFs(9),
              fontFamily: 'var(--font-mono)',
              color: 'var(--fg-3)',
              letterSpacing: '0.15em',
            }}
          >
            RISK · <span style={{ color: 'var(--fg-1)' }}>{data?.risk ?? '—'}</span>/100
          </span>
        </div>

        {/* ─── 焦点地图(只在有坐标时挂载) ───
            iframe 嵌入 ./map.html?embed=visitor&lat=&lon= — 复用 map.html 已有的
            地图代码,index.html 体积零增量。地图本身静态、不交互、不监听数据,
            只有"访客位置"一个超大发光焦点。 */}
        {data?.lat !== undefined && data?.lon !== undefined && (
          <div
            style={{
              padding: 8,
              background: 'var(--bg-1)',
              borderBottom: '1px solid var(--edge-engrave)',
            }}
          >
            <div className="precision-inset" style={{ overflow: 'hidden' }}>
              <iframe
                src={`./map.html?embed=visitor&lat=${data.lat}&lon=${data.lon}`}
                title="Visitor Location"
                loading="lazy"
                style={{
                  display: 'block',
                  width: '100%',
                  // natural-earth aspect 是 2:1,但卡片小所以稍压扁
                  // 让焦点占视觉重心
                  aspectRatio: '2.6 / 1',
                  border: 'none',
                  background: 'var(--bg-1)',
                }}
              />
            </div>
          </div>
        )}

        {/* ─── HERO: SOURCE ADDRESS + STATE 独立框 ─── */}
        <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--edge-engrave)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: contentFs(9),
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg-3)',
                  letterSpacing: '0.18em',
                  marginBottom: 4,
                }}
              >
                SOURCE ADDRESS
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(22),
                  fontWeight: 600,
                  color: 'var(--fg-0)',
                  letterSpacing: '0.02em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {ipText}
              </div>
              <div
                style={{
                  fontSize: contentFs(9),
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg-3)',
                  letterSpacing: '0.12em',
                  marginTop: 4,
                }}
              >
                {ipv4Tag}
                {data?.country && ` · ${data.country.toUpperCase()}`}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 4,
                padding: '6px 8px',
                border: '1px solid var(--edge-engrave)',
                background: 'var(--bg-1)',
                minWidth: 78,
                marginLeft: 8,
              }}
            >
              <span
                style={{
                  fontSize: contentFs(8),
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg-3)',
                  letterSpacing: '0.18em',
                }}
              >
                STATE
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(11),
                  color: accent,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  transition: 'color 0.4s ease',
                }}
              >
                {stateLabel}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Detail rows ─── */}
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            borderBottom: '1px solid var(--edge-engrave)',
          }}
        >
          {/* LOCATION + COORDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="LOCATION" value={location} />
            <Field label="COORDS" value={coords} mono />
          </div>

          {/* CARRIER */}
          <Field label="CARRIER" value={isp} title={data?.isp} />

          {/* ROUTE + LINK TYPE */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="ROUTE" value={routeZh} />
            <Field
              label="LINK TYPE"
              value={linkType}
              mono
              valueColor={data?.proxy === 'yes' ? 'var(--signal-warn)' : 'var(--accent-bright)'}
              bold
            />
          </div>

          {/* TIER · RISK · SESSION 三栏凹陷读数窗 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
              padding: '6px 8px',
              background: 'var(--bg-inset)',
              border: '1px solid var(--edge-engrave)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.16)',
              marginTop: 2,
            }}
          >
            <ReadCell label="TIER" value={tier === 'unknown' ? '—' : tier === 'good' ? 'I' : tier === 'warn' ? 'II' : 'III'} valueColor={accent} />
            <ReadCell
              label="RISK"
              value={data ? `${data.risk}` : '—'}
              border
              valueColor={accent}
            />
            <ReadCell label="SESSION" value={sessionStartRef.current} border />
          </div>
        </div>

        {/* ─── Auto dismiss ─── */}
        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            background: 'var(--bg-1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <span
              style={{
                fontSize: contentFs(9),
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-3)',
                letterSpacing: '0.15em',
              }}
            >
              {hovered ? 'PAUSED' : 'AUTO DISMISS'}
            </span>
            <div
              style={{
                flex: 1,
                height: 3,
                background: 'var(--bg-inset)',
                border: '1px solid var(--edge-engrave)',
                position: 'relative',
                boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.18)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${100 - progress}%`,
                  background: accent,
                  boxShadow: `0 0 4px ${accent}`,
                  transition: 'background 0.4s ease',
                }}
              />
            </div>
            <span
              style={{
                fontSize: contentFs(10),
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-1)',
                minWidth: 18,
                textAlign: 'right',
              }}
            >
              {remainSec}s
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ranVaPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes ranVaScan {
          /* 扫描线从顶部 0% 走到底部 100%,扫到底再 fade-out */
          0%   { top: 0;        opacity: 0; }
          8%   { opacity: 0.85; }
          90%  { opacity: 0.85; }
          100% { top: 100%;     opacity: 0; }
        }
        @keyframes ranVaCloak {
          /* 未激活遮罩用 clip-path 从顶向底 reveal,跟扫描线同步 */
          0%   { clip-path: inset(0 0 0 0); }
          100% { clip-path: inset(100% 0 0 0); }
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  value,
  title,
  mono,
  valueColor,
  bold,
}: {
  label: string
  value: string
  title?: string
  mono?: boolean
  valueColor?: string
  bold?: boolean
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: contentFs(9),
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-3)',
          letterSpacing: '0.15em',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        title={title}
        style={{
          fontSize: contentFs(11),
          color: valueColor ?? 'var(--fg-1)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          fontWeight: bold ? 600 : 500,
          letterSpacing: bold && mono ? '0.08em' : 'normal',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function ReadCell({
  label,
  value,
  valueColor,
  border,
}: {
  label: string
  value: string
  valueColor?: string
  border?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        borderLeft: border ? '1px solid var(--edge-engrave)' : 'none',
        paddingLeft: border ? 8 : 0,
      }}
    >
      <span
        style={{
          fontSize: contentFs(8),
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-3)',
          letterSpacing: '0.15em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: contentFs(13),
          fontFamily: 'var(--font-mono)',
          color: valueColor ?? 'var(--fg-0)',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          transition: 'color 0.4s ease',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
