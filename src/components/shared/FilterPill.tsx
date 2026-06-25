import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface FilterOption<T extends string> {
  value: T
  label: string
}

interface FilterPillProps<T extends string> {
  value: T | ''
  onChange: (v: T | '') => void
  options: FilterOption<T>[]
  placeholder: string
}

export function FilterPill<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: FilterPillProps<T>) {
  const [open, setOpen] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  // All selectable entries: "clear" (index 0) + options
  const allEntries = [{ value: '' as T | '', label: placeholder }, ...options]

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setFocusedIdx(-1)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // Focus the active item in the list whenever focusedIdx changes
  useEffect(() => {
    if (!open || focusedIdx < 0 || !listRef.current) return
    const btn = listRef.current.querySelectorAll('button')[focusedIdx] as HTMLButtonElement | null
    btn?.focus()
  }, [focusedIdx, open])

  const openAndFocus = useCallback((idx = 0) => {
    setOpen(true)
    setFocusedIdx(idx)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setFocusedIdx(-1)
    triggerRef.current?.focus()
  }, [])

  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openAndFocus(0)
    } else if (e.key === 'Escape') {
      close()
    }
  }, [openAndFocus, close])

  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx(i => Math.min(i + 1, allEntries.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (focusedIdx <= 0) {
        // Move focus back to trigger
        close()
      } else {
        setFocusedIdx(i => i - 1)
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      close()
    }
  }, [allEntries.length, focusedIdx, close])

  const handleSelect = useCallback((v: T | '') => {
    onChange(v)
    close()
  }, [onChange, close])

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        onClick={() => { setOpen(o => !o); setFocusedIdx(-1) }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm font-medium transition-all duration-150',
          value
            ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700/50 dark:bg-brand-900/20 dark:text-brand-400'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/[0.08]'
        )}
      >
        {selected?.label ?? placeholder}
        <ChevronDown
          size={13}
          className={`text-current opacity-60 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          onKeyDown={handleListKeyDown}
          className="absolute top-full left-0 mt-1.5 z-30 bg-white dark:bg-[#1E2840] border border-gray-100 dark:border-white/[0.05] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),_0_8px_32px_rgba(0,0,0,0.6)] rounded-xl shadow-lg shadow-black/8 py-1 min-w-[148px] animate-dropdown-in"
        >
          <button
            role="option"
            aria-selected={!value}
            onClick={() => handleSelect('' as T | '')}
            className={cn(
              'w-full text-left px-3 py-2 text-[13px] flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:bg-gray-50 dark:focus:bg-white/5',
              !value ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {placeholder}
            {!value && <Check size={12} className="text-brand-600" />}
          </button>
          <div className="my-1 border-t border-gray-100 dark:border-white/[0.06]" />
          {options.map(opt => (
            <button
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => handleSelect(opt.value)}
              className={cn(
                'w-full text-left px-3 py-2 text-[13px] flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:bg-gray-50 dark:focus:bg-white/5',
                value === opt.value
                  ? 'font-medium text-brand-600 dark:text-brand-400'
                  : 'text-gray-600 dark:text-gray-300'
              )}
            >
              {opt.label}
              {value === opt.value && <Check size={12} className="text-brand-600 dark:text-brand-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
