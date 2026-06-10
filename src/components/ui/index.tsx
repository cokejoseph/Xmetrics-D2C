import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(...inputs))
}

// ─── Button ────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  variant = 'primary', size = 'md', className, children, ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 shadow-[0_1px_3px_rgba(79,70,229,0.3)]': variant === 'primary',
          'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300': variant === 'secondary',
          'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100': variant === 'danger',
          'text-gray-600 hover:bg-gray-100': variant === 'ghost',
          'text-xs px-3 py-1.5 rounded-lg': size === 'sm',
          'text-sm px-4 py-2 rounded-xl': size === 'md',
          'text-sm px-5 py-2.5 rounded-xl': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Badge ─────────────────────────────────────────────────────────────────

type BadgeVariant =
  | 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray'
  | 'cod' | 'upi' | 'card' | 'prepaid'

export function Badge({
  variant = 'default', className, children,
}: {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold',
        {
          'bg-gray-100 text-gray-600': variant === 'default' || variant === 'gray',
          'bg-green-100 text-green-700': variant === 'success',
          'bg-amber-100 text-amber-700': variant === 'warning',
          'bg-red-100 text-red-700': variant === 'danger',
          'bg-blue-100 text-blue-700': variant === 'info',
          'bg-orange-100 text-orange-700': variant === 'cod',
          'bg-purple-100 text-purple-700': variant === 'upi',
          'bg-cyan-100 text-cyan-700': variant === 'card',
          'bg-emerald-100 text-emerald-700': variant === 'prepaid',
        },
        className
      )}
    >
      {children}
    </span>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────

export function Card({
  className, children, ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('bg-white rounded-2xl shadow-card border border-gray-100/80 transition-shadow duration-200', className)} {...props}>
      {children}
    </div>
  )
}

// ─── Input ─────────────────────────────────────────────────────────────────

export function Input({
  className, ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn('input-field', className)}
      {...props}
    />
  )
}

// ─── Select ────────────────────────────────────────────────────────────────

export function Select({
  className, children, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'input-field bg-white appearance-none cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={v => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 animate-in fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-dropdown z-50 animate-in fade-in zoom-in-95',
            {
              'w-full max-w-sm': size === 'sm',
              'w-full max-w-md': size === 'md',
              'w-full max-w-lg': size === 'lg',
              'w-full max-w-2xl': size === 'xl',
            }
          )}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <DialogPrimitive.Title className="text-base font-semibold text-gray-900">
              {title}
            </DialogPrimitive.Title>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-6 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ─── Textarea ──────────────────────────────────────────────────────────────

export function Textarea({
  className, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn('input-field resize-none', className)}
      {...props}
    />
  )
}

// ─── Spinner ───────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin text-brand-600"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────

export function EmptyState({
  icon, title, description, action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-gray-300">{icon}</div>}
      <p className="text-gray-600 font-medium">{title}</p>
      {description && <p className="text-gray-400 text-sm mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
