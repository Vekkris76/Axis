type Props = { className?: string }

export function AxisMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Axis"
    >
      <defs>
        <radialGradient id="axis-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="60%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* outer diamond */}
      <path
        d="M 60 18 L 102 60 L 60 102 L 18 60 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        opacity="0.55"
      />

      {/* inner diamond, smaller, rotated visually opposite via offset */}
      <path
        d="M 60 38 L 82 60 L 60 82 L 38 60 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
        opacity="0.35"
      />

      {/* core glow */}
      <circle cx="60" cy="60" r="14" fill="url(#axis-core)" opacity="0.7" />

      {/* core dot */}
      <circle cx="60" cy="60" r="3.5" fill="currentColor" />

      {/* cardinal markers */}
      <circle cx="60" cy="10" r="1.2" fill="currentColor" opacity="0.5" />
      <circle cx="110" cy="60" r="1.2" fill="currentColor" opacity="0.5" />
      <circle cx="60" cy="110" r="1.2" fill="currentColor" opacity="0.5" />
      <circle cx="10" cy="60" r="1.2" fill="currentColor" opacity="0.5" />
    </svg>
  )
}
