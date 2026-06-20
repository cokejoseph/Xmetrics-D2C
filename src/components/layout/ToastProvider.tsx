import { Toaster } from 'react-hot-toast'

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      toastOptions={{
        duration: 3500,
        style: {
          background: '#182032',
          color: '#e2e8f0',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 8px 30px rgba(0,0,0,0.45)',
          fontSize: '13px',
          fontWeight: 500,
          padding: '10px 14px',
          gap: '8px',
        },
        success: {
          iconTheme: { primary: '#10b981', secondary: '#182032' },
          style: {
            borderTop: '2px solid #10b981',
          },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#182032' },
          style: {
            borderTop: '2px solid #ef4444',
          },
        },
        loading: {
          iconTheme: { primary: '#4DA6FF', secondary: '#182032' },
        },
      }}
    />
  )
}
