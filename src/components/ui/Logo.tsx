interface LogoProps {
  size?: number
  showText?: boolean
}

export function Logo({ size = 32, showText = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Outer D shape */}
        <path
          d="M6 4 L6 28 L16 28 C23.732 28 30 21.732 30 16 C30 10.268 23.732 4 16 4 Z"
          fill="none"
          stroke="#7f77dd"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Inner curved fill */}
        <path
          d="M10 8 L10 24 L15.5 24 C21.299 24 26 20.418 26 16 C26 11.582 21.299 8 15.5 8 Z"
          fill="url(#drodo-gradient)"
          opacity="0.9"
        />
        {/* Highlight arc — top inner */}
        <path
          d="M10 10 C13 10 19 11 22 14"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Velocity slash — motion indicator */}
        <line
          x1="27"
          y1="11"
          x2="30"
          y2="8"
          stroke="#a09ae8"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <line
          x1="28.5"
          y1="14"
          x2="31.5"
          y2="12"
          stroke="#a09ae8"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.4"
        />
        <defs>
          <linearGradient id="drodo-gradient" x1="10" y1="8" x2="26" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7f77dd" />
            <stop offset="100%" stopColor="#5a52b0" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span
          style={{ fontSize: size * 0.65, fontWeight: 700, color: '#7f77dd', letterSpacing: '-0.02em' }}
        >
          Drodo
        </span>
      )}
    </div>
  )
}
