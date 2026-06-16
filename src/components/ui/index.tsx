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
          'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 shadow-[0_1px_3px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_12px_rgba(37,99,235,0.35)] hover:-translate-y-px': variant === 'primary',
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
    <div className={cn('bg-white dark:bg-[#1e1e24] rounded-2xl shadow-card border border-gray-100/80 dark:border-white/[0.08] transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(15,23,42,0.07)]', className)} {...props}>
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
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-dropdown z-50 animate-modal-in',
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

