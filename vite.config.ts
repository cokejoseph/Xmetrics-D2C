import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  plugins: [react()],
  // Dedicated, strict port so the Xmetrics dev server is never confused with
  // another project (e.g. Sentinel on Vite's default 5173). strictPort makes
  // Vite FAIL loudly if 5273 is taken instead of silently drifting to another
  // port or sharing — so Preview always opens Xmetrics, never a stray app.
  server: {
    port: 5273,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['@radix-ui/react-dropdown-menu', '@radix-ui/react-popover'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'recharts'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase'
          }
        },
      },
    },
  },
})
