import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '../ui'
import { setConfirmCallback } from '../../hooks/useConfirm'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
}

export default function ConfirmDialog() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)

  useEffect(() => {
    setConfirmCallback(
      (opts: ConfirmOptions) =>
        new Promise((resolve) => {
          setOptions(opts)
          setResolver(() => resolve)
          setOpen(true)
        })
    )
  }, [])

  const handleConfirm = () => {
    resolver?.(true)
    setOpen(false)
  }

  const handleCancel = () => {
    resolver?.(false)
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 animate-fade-in z-40" />
        <Dialog.Content className={[
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 rounded-2xl animate-modal-in z-50',
          'bg-white dark:bg-card-surface',
          'border border-gray-100 dark:border-white/[0.08]',
          'shadow-2xl dark:shadow-[0_8px_48px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.07)]',
        ].join(' ')}>
          <Dialog.Title className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {options?.title}
          </Dialog.Title>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{options?.message}</p>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleCancel}
            >
              {options?.cancelText || 'Cancel'}
            </Button>
            <Button
              variant={options?.isDangerous ? 'danger' : 'primary'}
              className="flex-1"
              onClick={handleConfirm}
            >
              {options?.confirmText || 'Confirm'}
            </Button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
