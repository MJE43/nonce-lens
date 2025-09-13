import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, mockBetRecord } from '@/test/utils'
import LiveBetTable from '../components/LiveBetTable'

describe('LiveBetTable', () => {
  const user = userEvent.setup()

  const mockBets = [
    {
      ...mockBetRecord,
      id: 1,
      nonce: 1001,
      payoutMultiplier: 50.5,
      difficulty: 'easy' as const
    },
    {
      ...mockBetRecord,
      id: 2,
      nonce: 1002,
      payoutMultiplier: 150.75,
      difficulty: 'medium' as const
    },
    {
      ...mockBetRecord,
      id: 3,
      nonce: 1003,
      payoutMultiplier: 1000.0,
      difficulty: 'expert' as const
    }
  ]

  it('should display table headers correctly', () => {
    render(<LiveBetTable bets={mockBets} />)

    const headers = ['Nonce', 'Date/Time', 'Amount', 'Multiplier', 'Payout', 'Difficulty', 'Target', 'Result']
    headers.forEach(header => {
      expect(screen.getByText(header)).toBeInTheDocument()
    })
  })

  it('should display bet data correctly', () => {
    render(<LiveBetTable bets={mockBets} />)

    // Check first bet data
    expect(screen.getByText('1,001')).toBeInTheDocument()
    expect(screen.getByText('50.50x')).toBeInTheDocument()
    expect(screen.getByText('easy')).toBeInTheDocument()

    // Check second bet data
    expect(screen.getByText('1,002')).toBeInTheDocument()
    expect(screen.getByText('150.75x')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()

    // Check third bet data
    expect(screen.getByText('1,003')).toBeInTheDocument()
    expect(screen.getByText('1000.00x')).toBeInTheDocument()
    expect(screen.getByText('expert')).toBeInTheDocument()
  })

  it('should format amounts and payouts correctly', () => {
    render(<LiveBetTable bets={mockBets} />)

    // Should display amounts with 8 decimal places
    expect(screen.getAllByText('0.10000000')).toHaveLength(3) // Amount for all bets
    
    // Should display payouts with 8 decimal places
    expect(screen.getByText('150.05000000')).toBeInTheDocument() // Payout for first bet
  })

  it('should apply correct multiplier badge colors', () => {
    render(<LiveBetTable bets={mockBets} />)

    const lowMultiplier = screen.getByText('50.50x')
    const mediumMultiplier = screen.getByText('150.75x')
    const highMultiplier = screen.getByText('1000.00x')

    // Check that different multiplier ranges have different styling
    expect(lowMultiplier.closest('.badge')).toHaveClass(/slate/)
    expect(mediumMultiplier.closest('.badge')).toHaveClass(/blue/)
    expect(highMultiplier.closest('.badge')).toHaveClass(/yellow/)
  })

  it('should apply correct difficulty badge colors', () => {
    render(<LiveBetTable bets={mockBets} />)

    const easyBadge = screen.getByText('easy')
    const mediumBadge = screen.getByText('medium')
    const expertBadge = screen.getByText('expert')

    expect(easyBadge.closest('.badge')).toHaveClass(/green/)
    expect(mediumBadge.closest('.badge')).toHaveClass(/yellow/)
    expect(expertBadge.closest('.badge')).toHaveClass(/red/)
  })

  it('should handle null round target and result values', () => {
    const betsWithNulls = [
      {
        ...mockBetRecord,
        id: 1,
        nonce: 1001,
        roundTarget: null,
        roundResult: null
      }
    ]

    render(<LiveBetTable bets={betsWithNulls} />)

    // Should display em dash for null values
    const cells = screen.getAllByText('—')
    expect(cells).toHaveLength(2) // One for target, one for result
  })

  it('should format timestamps correctly', () => {
    const betWithDateTime = {
      ...mockBetRecord,
      id: 1,
      nonce: 1001,
      dateTime: '2025-01-01T12:00:00Z'
    }

    render(<LiveBetTable bets={[betWithDateTime]} />)

    // Should display formatted timestamp
    expect(screen.getByText(/1\/1\/2025/)).toBeInTheDocument()
  })

  it('should fallback to receivedAt when dateTime is null', () => {
    const betWithoutDateTime = {
      ...mockBetRecord,
      id: 1,
      nonce: 1001,
      dateTime: null,
      receivedAt: '2025-01-01T12:00:00Z'
    }

    render(<LiveBetTable bets={[betWithoutDateTime]} />)

    // Should display formatted receivedAt timestamp
    expect(screen.getByText(/1\/1\/2025/)).toBeInTheDocument()
  })

  it('should display empty state when no bets provided', () => {
    render(<LiveBetTable bets={[]} />)

    expect(screen.getByText('No bets to display')).toBeInTheDocument()
  })

  it('should be sortable by different columns', async () => {
    render(<LiveBetTable bets={mockBets} sortable />)

    // Click on nonce header to sort
    const nonceHeader = screen.getByText('Nonce')
    await user.click(nonceHeader)

    // Should show sort indicator
    expect(screen.getByTestId('sort-indicator')).toBeInTheDocument()
  })

  it('should support row selection when selectable prop is true', async () => {
    const onSelectionChange = vi.fn()
    render(
      <LiveBetTable 
        bets={mockBets} 
        selectable 
        onSelectionChange={onSelectionChange}
      />
    )

    // Should show checkboxes
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)

    // Click first checkbox
    await user.click(checkboxes[0])
    expect(onSelectionChange).toHaveBeenCalled()
  })

  it('should highlight new rows when they are added', () => {
    const { rerender } = render(<LiveBetTable bets={mockBets.slice(0, 2)} />)

    // Add a new bet
    const newBets = [...mockBets]
    rerender(<LiveBetTable bets={newBets} />)

    // New row should have highlight class
    const newRow = screen.getByText('1,003').closest('tr')
    expect(newRow).toHaveClass(/highlight|new/)
  })

  it('should handle loading state', () => {
    render(<LiveBetTable bets={[]} loading />)

    // Should show loading skeletons
    expect(screen.getAllByTestId(/skeleton/)).toHaveLength(5) // Default skeleton rows
  })

  it('should support virtual scrolling for large datasets', () => {
    const largeBetSet = Array.from({ length: 1000 }, (_, i) => ({
      ...mockBetRecord,
      id: i + 1,
      nonce: 1000 + i
    }))

    render(<LiveBetTable bets={largeBetSet} virtualScrolling />)

    // Should only render visible rows
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeLessThan(100) // Should not render all 1000 rows
  })
})