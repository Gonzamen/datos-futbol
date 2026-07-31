import type { SVGProps } from 'react'

/**
 * The mark is a corner: touchline, goal line, the quarter arc between them and
 * the ball sitting inside it. A ball in a circle is what every five-a-side app
 * uses; the corner is just as unmistakably football and nobody's logo, and it
 * survives being shrunk to a favicon because it is three strokes and a dot.
 */

interface LogoMarkProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox'> {
  /** Filled lime tile for the app icon; `bare` inherits currentColor instead. */
  variant?: 'tile' | 'bare'
}

export function LogoMark({ variant = 'tile', ...props }: LogoMarkProps) {
  const ink = variant === 'tile' ? 'var(--logo-ink, #0A0F0C)' : 'currentColor'

  return (
    <svg viewBox="0 0 32 32" aria-hidden focusable="false" {...props}>
      {variant === 'tile' ? (
        <rect width="32" height="32" rx="8.5" fill="var(--logo-tile, #C8FF4D)" />
      ) : null}
      <g
        stroke={ink}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        opacity={variant === 'tile' ? 1 : 0.55}
      >
        <path d="M8 24V7.6" />
        <path d="M8 24h16.4" />
      </g>
      <path
        d="M8 15A9 9 0 0 0 17 24"
        stroke={ink}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="12.9" cy="19.1" r="2.5" fill={ink} />
    </svg>
  )
}

interface LogoProps {
  /** `compact` drops the tagline; the top bar has no room for it. */
  size?: 'compact' | 'full'
}

export function Logo({ size = 'compact' }: LogoProps) {
  return (
    <span className={`logo logo--${size}`}>
      <LogoMark className="logo__mark" />
      <span className="logo__text">
        <span className="logo__word">
          Datos<em>Fútbol</em>
        </span>
        {size === 'full' ? <span className="logo__tagline">Estadísticas del partido</span> : null}
      </span>
    </span>
  )
}
