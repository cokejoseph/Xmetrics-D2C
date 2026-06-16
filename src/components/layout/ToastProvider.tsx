import { Toaster } from 'react-hot-toast'

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      toastOptions={{
        duration: 3000,
        style: {
          background: '#1e1e24',
          color: '#f1f5f9',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        },
        success: {
          icon: '✅',
          style: {
            borderLeft: '4px solid #10b981',
          },
        },
        error: {
          icon: '❌',
          style: {
            borderLeft: '4px solid #ef4444',
          },
        },
        loading: {
          icon: '⏳',
        },
      }}
    />
  )
}
