import { Link } from 'react-router-dom'
import { BeamsBackground } from '@/components/ui/beams-background'

export default function AuthShell({
  children,
  width = 'max-w-sm',
}: {
  children: React.ReactNode
  width?: string
}) {
  return (
    <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-4 relative overflow-hidden">
      <BeamsBackground intensity="subtle" />
      {/* aurora glow orbs */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] bg-brand-500/30 rounded-full blur-3xl animate-aurora" />
      <div className="absolute -bottom-40 -right-32 w-[460px] h-[460px] bg-sky-500/25 rounded-full blur-3xl animate-aurora-2" />

      <div className={`relative z-10 w-full ${width}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8 animate-fade-in-up">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm overflow-hidden p-0.5">
            <img src="/logo.svg" alt="Xmetrics" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-semibold text-2xl">Xmetrics</span>
        </div>

        {/* Card with soft glow */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="absolute -inset-3 bg-brand-500/20 blur-2xl rounded-3xl" />
          <div className="relative bg-white rounded-2xl p-8 shadow-2xl border border-white/20">
            {children}
          </div>
        </div>

        {/* Back to website */}
        <div className="mt-6 text-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Link to="/" className="text-white/60 hover:text-white text-sm transition-colors">
            ← Back to website
          </Link>
        </div>
      </div>
    </div>
  )
}
