import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // parseUbl builds on DOMParser, which only exists in a DOM environment.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
