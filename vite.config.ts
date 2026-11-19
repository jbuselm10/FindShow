import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { chatApiPlugin } from './server/chatApiPlugin.ts'
import { tmdbApiPlugin } from './server/tmdbApiPlugin.ts'
import { userListsApiPlugin } from './server/userListsApiPlugin.ts'

export default defineConfig({
  plugins: [react(), tmdbApiPlugin(), chatApiPlugin(), userListsApiPlugin()],
})
