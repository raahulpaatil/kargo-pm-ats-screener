// Halftone-striped retro terminal icon + italic serif wordmark. The stripes echo
// the scanline-shaded avatar on 5aitec's boot screen without copying it.
export function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="currentColor">
      <defs>
        <pattern id="logo-stripes" width="32" height="2" patternUnits="userSpaceOnUse">
          <rect width="32" height="1.2" />
        </pattern>
        <mask id="logo-mask">
          <path d="M6 4h20l2 3v14l-2 3H6l-2-3V7z" fill="#fff" />
          <rect x="8.5" y="8" width="15" height="10" rx="1" fill="#000" />
          <rect x="11" y="26" width="10" height="3" fill="#fff" />
        </mask>
      </defs>
      <rect width="32" height="32" fill="url(#logo-stripes)" mask="url(#logo-mask)" />
      <rect x="10.5" y="10" width="2" height="2" />
      <rect x="10.5" y="13.5" width="7" height="1.4" />
      <rect x="18.5" y="13.5" width="2" height="1.4" className="blink" />
    </svg>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-serif italic font-bold tracking-tight ${className}`}>KARGO</span>
  )
}
