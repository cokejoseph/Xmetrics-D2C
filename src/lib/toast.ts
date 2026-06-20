import toast from 'react-hot-toast'

export const showToast = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  loading: (message: string) => toast.loading(message),

  // Common actions
  actionSuccess: (action: string) => toast.success(`${action} successful`),
  orderApproved: () => toast.success('Order approved and ready to ship'),
  orderHeld: () => toast.success('Order held for review'),
  exceptionResolved: (onUndo?: () => void) => {
    if (!onUndo) { toast.success('Exception resolved'); return }
    toast(
      (t) => {
        const el = document.createElement('div')
        el.className = 'flex items-center gap-3'
        const msg = document.createElement('span')
        msg.textContent = 'Exception resolved'
        const btn = document.createElement('button')
        btn.textContent = 'Undo'
        btn.className = 'text-xs font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-500'
        btn.onclick = () => { onUndo(); toast.dismiss(t.id) }
        el.appendChild(msg); el.appendChild(btn)
        return el
      },
      { duration: 5000 }
    )
  },
  exceptionDismissed: (onUndo?: () => void) => {
    if (!onUndo) { toast.success('Exception dismissed'); return }
    toast(
      (t) => {
        const el = document.createElement('div')
        el.className = 'flex items-center gap-3'
        const msg = document.createElement('span')
        msg.textContent = 'Exception dismissed'
        const btn = document.createElement('button')
        btn.textContent = 'Undo'
        btn.className = 'text-xs font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-500'
        btn.onclick = () => { onUndo(); toast.dismiss(t.id) }
        el.appendChild(msg); el.appendChild(btn)
        return el
      },
      { duration: 5000 }
    )
  },
  saved: () => toast.success('Changes saved'),
  settingsUpdated: () => toast.success('Settings updated'),
  orderGenerated: () => toast.success('Label generated'),
}
