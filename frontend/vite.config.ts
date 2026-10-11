import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read VITE_* vars from the shared .env at the repo root.
  envDir: '..',
  server: {
    host: true,
    port: 5173,
  },
})
