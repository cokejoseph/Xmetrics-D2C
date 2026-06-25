import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'

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
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed',
        {
          'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700': variant === 'primary',
          'bg-white dark:bg-white/[0.06] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/[0.1] hover:bg-gray-50 dark:hover:bg-white/[0.1]': variant === 'secondary',
          'bg-white dark:bg-transparent text-red-600 dark:text-red-400 border border-red-100 dark:border-red-400/30 hover:bg-red-50 dark:hover:bg-red-400/10': variant === 'danger',
          'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.07]': variant === 'ghost',
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
          'bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-gray-400': variant === 'default' || variant === 'gray',
          'bg-green-50 dark:bg-green-400/10 text-green-700 dark:text-green-400': variant === 'success',
          'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400': variant === 'warning',
          'bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400': variant === 'danger',
          'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-400': variant === 'info',
          'bg-orange-50 dark:bg-orange-400/10 text-orange-700 dark:text-orange-400': variant === 'cod',
          'bg-purple-50 dark:bg-purple-400/10 text-purple-700 dark:text-purple-400': variant === 'upi',
          'bg-cyan-50 dark:bg-cyan-400/10 text-cyan-700 dark:text-cyan-400': variant === 'card',
          'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-400': variant === 'prepaid',
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
    <div
      className={cn(
        'bg-white dark:bg-card-surface rounded-lg',
        'border border-gray-100 dark:border-white/[0.07]',
        'shadow-card dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_1px_3px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]',
        className
      )}
      {...props}
    >
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
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-modal-in',
            'bg-white dark:bg-card-surface rounded-xl',
            'border border-gray-100 dark:border-white/[0.08]',
            'shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_48px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.07)]',
            {
              'w-full max-w-sm': size === 'sm',
              'w-full max-w-md': size === 'md',
              'w-full max-w-lg': size === 'lg',
              'w-full max-w-2xl': size === 'xl',
            }
          )}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/[0.07]">
            <DialogPrimitive.Title className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {title}
            </DialogPrimitive.Title>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.07] text-gray-500 dark:text-gray-400 transition-colors"
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

// ─── Pagination ─────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <span className="text-xs text-gray-500">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs text-gray-500 px-2 tabular-nums">{page} / {totalPages}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

