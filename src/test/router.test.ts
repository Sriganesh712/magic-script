import { describe, it, expect } from 'vitest'
import { matchPath } from '@/lib/router'

describe('Router path matching logic', () => {
  it('matches exact root path', () => {
    const result = matchPath('/', '/')
    expect(result.matches).toBe(true)
    expect(result.params).toEqual({})
  })

  it('matches exact nested routes', () => {
    const result = matchPath('/dashboard', '/dashboard')
    expect(result.matches).toBe(true)
    expect(result.params).toEqual({})
  })

  it('matches parameterized routes like /project/:projectId', () => {
    const result = matchPath('/project/:projectId', '/project/proj_123')
    expect(result.matches).toBe(true)
    expect(result.params).toEqual({ projectId: 'proj_123' })
  })

  it('does not match mismatched routes', () => {
    const result = matchPath('/dashboard', '/settings')
    expect(result.matches).toBe(false)
  })

  it('matches wildcard routes', () => {
    const result = matchPath('*', '/unknown/path/here')
    expect(result.matches).toBe(true)
    expect(result.params['*']).toBe('/unknown/path/here')
  })

  it('handles trailing slashes gracefully', () => {
    const result = matchPath('/settings', '/settings/')
    expect(result.matches).toBe(true)
  })
})
