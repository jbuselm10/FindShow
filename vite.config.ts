import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tmdbApiPlugin } from './server/tmdbApiPlugin.ts'

export default defineConfig({
  plugins: [react(), tmdbApiPlugin()],
})
