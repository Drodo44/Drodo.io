import drodoPng from '../../assets/drodo-logo.png'

interface LogoProps {
  size?: number
  showText?: boolean
}

export function Logo({ size = 32, showText = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={drodoPng}
        width={size}
        height={size}
        alt="Drodo"
        style={{ flexShrink: 0, objectFit: 'contain' }}
      />
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
