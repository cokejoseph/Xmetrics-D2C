/**
 * AuthShell — shared backdrop for Login / Signup / Onboarding.
 * Same aurora-gradient treatment as the landing hero so the whole
 * entry flow feels like one product.
 */
export default function AuthShell({
  children,
  width = 'max-w-sm',
}: {
  children: React.ReactNode
  width?: string
}) {
  return (
    <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* aurora glow orbs */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] bg-brand-500/30 rounded-full blur-3xl animate-aurora" />
      <div className="absolute -bottom-40 -right-32 w-[460px] h-[460px] bg-sky-500/25 rounded-full blur-3xl animate-aurora-2" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      <div className={`relative w-full ${width}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8 animate-fade-in-up">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-[0_2px_8px_rgba(37,99,235,0.4)]">
            <span className="text-white font-bold text-lg">x</span>
          </div>
          <span className="text-white font-semibold text-2xl">xMetrics</span>
        </div>

        {/* Card with soft glow */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="absolute -inset-3 bg-brand-500/20 blur-2xl rounded-3xl" />
          <div className="relative bg-white rounded-2xl p-8 shadow-2xl border border-white/20">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
