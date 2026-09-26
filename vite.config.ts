import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The demo, not the package: `dist/` belongs to the library build in
  // vite.lib.config.ts, and the two would overwrite each other.
  build: { outDir: 'dist-demo' },
  optimizeDeps: {
    // The PDF stack is reachable only through the dynamic import in App. The dev
    // server's cold scan does find it, but naming it here keeps it out of the
    // discovered-late path, where Vite re-optimises mid-session and reloads the page
    // with a second copy of React — which surfaces as "Invalid hook call" in usePDF.
    // Not needed for the production build, which bundles everything up front.
    // The QR packages sit behind the same dynamic import, so they are named for the
    // same reason. `qrcode-generator` also ships CJS, which has to be pre-bundled.
    include: ['@react-pdf/renderer', 'react-pdf', 'bysquare/pay', 'qrcode-generator'],
  },
  test: {
    // parseUbl builds on DOMParser, which only exists in a DOM environment.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
