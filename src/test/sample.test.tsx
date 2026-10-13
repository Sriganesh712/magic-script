import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Vitest Setup', () => {
  it('renders a button component', () => {
    render(<Button>Test Button</Button>)
    expect(screen.getByRole('button', { name: /test button/i })).toBeInTheDocument()
  })

  it('applies variant classes correctly', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: /delete/i })
    expect(button).toHaveClass('bg-destructive/10')
  })
})

describe('Basic Math', () => {
  it('adds numbers correctly', () => {
    expect(2 + 2).toBe(4)
  })

  it('multiplies numbers correctly', () => {
    expect(3 * 4).toBe(12)
  })
})