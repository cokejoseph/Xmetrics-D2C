import React from 'react'
import toast from 'react-hot-toast'

export const showToast = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message, { duration: 8000 }),
  loading: (message: string) => toast.loading(message),

  // Common actions
  actionSuccess: (action: string) => toast.success(`${action} successful`),
  orderApproved: () => toast.success('Order approved and ready to ship'),
  orderHeld: () => toast.success('Order held for review'),
  exceptionResolved: (onUndo?: () => void) => {
    if (!onUndo) { toast.success('Exception resolved'); return }
    toast(
      (t) => React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement('span', null, 'Exception resolved'),
        React.createElement('button', {
          className: 'text-xs font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-500',
          onClick: () => { onUndo(); toast.dismiss(t.id) },
        }, 'Undo')
      ),
      { duration: 5000 }
    )
  },
  exceptionDismissed: (onUndo?: () => void) => {
    if (!onUndo) { toast.success('Exception dismissed'); return }
    toast(
      (t) => React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement('span', null, 'Exception dismissed'),
        React.createElement('button', {
          className: 'text-xs font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-500',
          onClick: () => { onUndo(); toast.dismiss(t.id) },
        }, 'Undo')
      ),
      { duration: 5000 }
    )
  },
  saved: () => toast.success('Changes saved'),
  settingsUpdated: () => toast.success('Settings updated'),
  orderGenerated: () => toast.success('Label generated'),
}
