import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCard } from '@/components/StatsCard'
import { PenTool } from 'lucide-react'

describe('StatsCard Component', () => {
  it('renders label and formatted value', () => {
    render(<StatsCard label="Words Written" value={12500} icon={PenTool} />)
    expect(screen.getByText('Words Written')).toBeInTheDocument()
    expect(screen.getByText('12,500')).toBeInTheDocument()
  })

  it('renders positive trend indicator', () => {
    render(
      <StatsCard
        label="Daily Sprint"
        value={450}
        icon={PenTool}
        trend={{ value: 15, label: 'vs yesterday', isPositive: true, direction: 'up' }}
      />
    )
    expect(screen.getByText('+15')).toBeInTheDocument()
    expect(screen.getByText('vs yesterday')).toBeInTheDocument()
  })
})
