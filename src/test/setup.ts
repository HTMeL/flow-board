import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Hard stop for any other network path (REST, realtime, XHR) during tests.
function blockNetwork() {
  // a regular function so `new WebSocket(...)` and `new XMLHttpRequest()` hit it too
  const fail = function () {
    throw new Error('Network access is blocked in tests (no real database or API calls).')
  }
  vi.stubGlobal('fetch', vi.fn(fail))
  vi.stubGlobal('XMLHttpRequest', fail)
  vi.stubGlobal('WebSocket', fail)
}

beforeEach(() => {
  blockNetwork()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.style.overflow = ''
})
