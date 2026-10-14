// Fixed, non-interactive CRT glass over every page: scanlines, film grain,
// vignette, and a rounded bezel. Purely decorative, so hidden from AT.
export function CrtOverlay() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden crt-flicker">
      <div className="absolute inset-0 crt-scanlines" />
      <div className="absolute crt-grain" />
      <div className="absolute inset-0 crt-vignette" />
      <div className="absolute inset-[6px] sm:inset-[10px] crt-bezel" />
    </div>
  )
}
