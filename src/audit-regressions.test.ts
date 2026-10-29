import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd() // vitest runs from the project root
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const html = read('index.html')
const css = read('src/index.css')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('SEO / GEO audit', () => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content') ?? ''

  it('has a descriptive, correctly sized title and meta description', () => {
    expect(doc.title.length).toBeGreaterThan(20)
    expect(doc.title.length).toBeLessThanOrEqual(60)
    const d = meta('meta[name=description]')
    expect(d.length).toBeGreaterThanOrEqual(120)
    expect(d.length).toBeLessThanOrEqual(160)
  })

  it('declares language, viewport and theme colour', () => {
    expect(doc.documentElement.lang).toBe('en')
    expect(meta('meta[name=viewport]')).toContain('width=device-width')
    expect(meta('meta[name=theme-color]')).not.toBe('')
  })

  it('has Open Graph and Twitter tags, with image alt text', () => {
    for (const p of ['og:title', 'og:description', 'og:type', 'og:site_name', 'og:image:alt']) {
      expect(meta(`meta[property="${p}"]`), p).not.toBe('')
    }
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image')
    expect(meta('meta[name="twitter:title"]')).not.toBe('')
  })

  it('ships static, crawlable content with a single H1 inside #root', () => {
    const root = doc.getElementById('root')!
    expect(root.querySelectorAll('h1')).toHaveLength(1)
    expect(root.querySelector('h2')).not.toBeNull()
    expect(root.textContent).toMatch(/kanban/i)
    expect(root.querySelector('noscript')).not.toBeNull()
  })

  it('has valid JSON-LD structured data', () => {
    const data = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(data['@context']).toBe('https://schema.org')
    expect(data['@type']).toBe('WebApplication')
    expect(data.featureList.length).toBeGreaterThan(3)
  })

  it('references icons and a manifest that exist and are valid', () => {
    for (const href of ['/favicon.svg', '/apple-touch-icon.png', '/manifest.webmanifest', '/og-image.png', '/llms.txt']) {
      expect(statSync(join(root, 'public', href)).size, href).toBeGreaterThan(0)
    }
    const manifest = JSON.parse(read('public/manifest.webmanifest'))
    expect(manifest.name).toBe('Flow Board')
    expect(manifest.icons.length).toBeGreaterThan(1)
    for (const icon of manifest.icons) expect(statSync(join(root, 'public', icon.src)).size).toBeGreaterThan(0)
  })

  it('build config emits robots.txt always and the sitemap only with a site URL', () => {
    const cfg = read('vite.config.ts')
    expect(cfg).toContain("fileName: 'robots.txt'")
    expect(cfg).toContain("fileName: 'sitemap.xml'")
    expect(cfg).toContain('VITE_SITE_URL')
    expect(cfg).toMatch(/rel: 'canonical'/)
  })

  it('does not inline styles that the production CSP would block', () => {
    expect(html).not.toMatch(/<[^>]+\sstyle=/)
  })
})

describe('security audit', () => {
  it('sets a strict production Content-Security-Policy', () => {
    const cfg = read('vite.config.ts')
    expect(cfg).toContain("script-src 'self'")
    expect(cfg).toContain("object-src 'none'")
    expect(cfg).toContain("base-uri 'self'")
    expect(cfg).not.toContain('unsafe-inline')
    expect(cfg).not.toContain('unsafe-eval')
  })

  it('keeps env files out of git', () => {
    const ignore = read('.gitignore')
    expect(ignore).toMatch(/^\.env$/m)
    expect(ignore).toMatch(/^\.env\.\*$/m)
  })

  it('never renders raw HTML or evaluates strings', () => {
    const files = walk(join(root, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !f.includes('/test/'))
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/dangerouslySetInnerHTML|innerHTML\s*=|\beval\(|new Function\(/)
    }
  })
})

describe('no real database access', () => {
  it('app source does not import Supabase (so tests cannot reach a real DB); if it does, the global mock applies', async () => {
    const files = walk(join(root, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !f.includes('/test/'))
    const users = files.filter((f) => /supabase/i.test(readFileSync(f, 'utf8')))
    expect(users).toEqual([]) // add the file here deliberately if Supabase is introduced
  })

  it('the global Supabase mock is in place and network primitives are blocked', async () => {
    // @ts-ignore the package is intentionally not a dependency; vitest aliases it to the fake
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient('https://real-project.supabase.co', 'key')
    await expect(client.from('cards').select('*')).resolves.toEqual({ data: [], error: null })
    expect(() => fetch('https://example.com')).toThrow(/blocked in tests/)
    expect(() => new WebSocket('wss://example.com')).toThrow(/blocked in tests/)
  })
})

describe('accessibility CSS audit', () => {
  it('keeps visually-hidden text contained so it cannot widen the page (WCAG 1.4.10)', () => {
    expect(css).toMatch(/\.sr-only\s*\{[^}]*position:\s*absolute/)
    expect(css).toMatch(/\.column\s*\{[^}]*position:\s*relative/)
  })

  it('enlarges touch targets and removes no focus outlines', () => {
    expect(css).toMatch(/pointer:\s*coarse[\s\S]*min-height:\s*44px/)
    expect(css).not.toMatch(/outline:\s*(none|0)\b/)
    expect(css).toContain(':focus-visible')
  })

  it('respects reduced motion, forced colours and colour scheme', () => {
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('forced-colors: active')
    expect(css).toContain('color-scheme: light dark')
  })

  it('has a mobile layout and a skip link', () => {
    expect(css).toMatch(/max-width:\s*700px/)
    expect(css).toContain('.skip-link')
  })
})
