/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

// https://vite.dev/config/
// Strict CSP for production builds only; the dev server needs inline scripts for hot reload.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// Set VITE_SITE_URL (e.g. https://flowboard.example.com) at build time to emit canonical,
// og:url, an absolute og:image, a sitemap and the robots.txt sitemap line.
function seo(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/+$/, '')
  return {
    name: 'seo',
    transformIndexHtml: () =>
      base
        ? [
            { tag: 'link', attrs: { rel: 'canonical', href: `${base}/` }, injectTo: 'head' },
            { tag: 'meta', attrs: { property: 'og:url', content: `${base}/` }, injectTo: 'head' },
            { tag: 'meta', attrs: { property: 'og:image', content: `${base}/og-image.png` }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:image', content: `${base}/og-image.png` }, injectTo: 'head' },
          ]
        : [],
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', base && `Sitemap: ${base}/sitemap.xml`]
        .filter(Boolean)
        .join('\n')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots + '\n' })
      if (base) {
        const lastmod = new Date().toISOString().slice(0, 10)
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${lastmod}</lastmod></url>\n</urlset>\n`,
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // Flow Board doesn't use Supabase today. If it ever does, tests get a fake client, never
      // the real database.
      alias: { '@supabase/supabase-js': fileURLToPath(new URL('./src/test/supabase-mock.ts', import.meta.url)) },
      restoreMocks: true,
    },
    plugins: [
      react(),
      seo(env.VITE_SITE_URL ?? ''),
      {
        name: 'inject-csp',
        apply: 'build',
        transformIndexHtml: (html) =>
          html.replace(
            '<head>',
            `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
          ),
      },
    ],
  }
})
