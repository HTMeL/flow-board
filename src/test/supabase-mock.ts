import { vi } from 'vitest'

// Chainable, always-empty stand-in for a Supabase query builder.
function queryBuilder() {
  const result = { data: [], error: null }
  const builder: Record<string, unknown> = {
    then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'order', 'limit', 'single']) {
    builder[m] = vi.fn(() => builder)
  }
  return builder
}

export const supabaseClient = {
  from: vi.fn(() => queryBuilder()),
  rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(() => Promise.resolve({ data: null, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
  channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
}

// Aliased in for '@supabase/supabase-js' (see vite.config.ts), so even if the real package
// is installed later, tests only ever get this fake.
export const createClient = vi.fn(() => supabaseClient)
