import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * `base` differs between the ways this project runs, and it is the single
 * most common way a first deployment fails.
 *
 * In development Vite serves the app at the root of localhost:5173 and proxies
 * /api to Apache, so the base is '/'. A build has to be told where it will
 * live, because every asset and API path is prefixed with it — a build made
 * for a subfolder and uploaded to a domain root asks for
 * /pawsandfound/assets/... and gets a blank page and four 404s.
 *
 *   VITE_BASE=/ npm run build              a domain root — how we deploy
 *   npm run build                          htdocs/pawsandfound/ — local Apache
 *
 * Whatever you set here must match `RewriteBase` in public/.htaccess.
 *
 * https://vite.dev/config/
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE ?? '/pawsandfound/') : '/',

  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    // The React dev server and the PHP API are different origins during
    // development, which browsers block. Vite forwards anything starting with
    // /api to Apache, so the app can call '/api/reports' as though it were the
    // same server — which it will be once the built site is served by Apache.
    proxy: {
      '/api': {
        target: 'http://localhost/pawsandfound',
        changeOrigin: false, // keep the Origin header so PHP's CORS check sees it
      },
    },
  },
}))
