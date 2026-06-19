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
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed',
        {
          'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700': variant === 'primary',
          'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50': variant === 'secondary',
          'bg-white text-red-600 border border-red-100 hover:bg-red-50': variant === 'danger',
          'text-gray-600 hover:bg-gray-100': variant === 'ghost',
          'text-xs px-3 py-1.5': size === 'sm',
          'text-sm px-4 py-2': size === 'md',
          'text-sm px-5 py-2.5': size === 'lg',
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

export type BadgeVariant =
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
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium',
        {
          'bg-gray-100 text-gray-500': variant === 'default' || variant === 'gray',
          'bg-green-50 text-green-600': variant === 'success',
          'bg-amber-50 text-amber-600': variant === 'warning',
          'bg-red-50 text-red-500': variant === 'danger',
          'bg-blue-50 text-blue-600': variant === 'info',
          'bg-orange-50 text-orange-600': variant === 'cod',
          'bg-purple-50 text-purple-600': variant === 'upi',
          'bg-cyan-50 text-cyan-600': variant === 'card',
          'bg-emerald-50 text-emerald-600': variant === 'prepaid',
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
    <div className={cn('bg-white dark:bg-[#1e1e24] rounded-lg border border-gray-100 dark:border-white/[0.07]', className)} {...props}>
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
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl border border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-50 animate-modal-in',
            {
              'w-full max-w-sm': size === 'sm',
              'w-full max-w-md': size === 'md',
              'w-full max-w-lg': size === 'lg',
              'w-full max-w-2xl': size === 'xl',
            }
          )}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <DialogPrimitive.Title className="text-sm font-medium text-gray-900">
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

