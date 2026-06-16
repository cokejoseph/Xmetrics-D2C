import toast from 'react-hot-toast'

export const showToast = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  loading: (message: string) => toast.loading(message),

  // Common actions
  actionSuccess: (action: string) => toast.success(`✨ ${action} successful`),
  orderApproved: () => toast.success('✅ Order approved and ready to ship'),
  orderHeld: () => toast.success('⏸️ Order held for review'),
  exceptionResolved: () => toast.success('✨ Exception resolved'),
  exceptionDismissed: () => toast.success('👀 Exception dismissed'),
  saved: () => toast.success('💾 Changes saved'),
  settingsUpdated: () => toast.success('⚙️ Settings updated'),
  orderGenerated: () => toast.success('📦 Label generated'),
}
