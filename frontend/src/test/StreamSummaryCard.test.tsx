import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, mockStreamSummary } from '@/test/utils'
import StreamSummaryCard from '../components/StreamSummaryCard'

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    )
  }
})

describe('StreamSummaryCard', () => {
  const user = userEvent.setup()

  it('should display stream information correctly', () => {
    render(<StreamSummaryCard stream={mockStreamSummary} />)

    // Check seed information
    expect(screen.getByText('1a2b3c4d5e...')).toBeInTheDocument()
    expect(screen.getByText(mockStreamSummary.clientSeed)).toBeInTheDocument()
    
    // Check statistics
    expect(screen.getByText('42')).toBeInTheDocument() // Total bets
    expect(screen.getByText('1500.50x')).toBeInTheDocument() // Highest multiplier
  })

  it('should display activity indicators', () => {
    render(<StreamSummaryCard stream={mockStreamSummary} />)

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('42 bets')).toBeInTheDocument()
  })

  it('should display formatted timestamp', () => {
    const now = new Date('2025-01-01T12:30:00Z')
    vi.setSystemTime(now)

    const recentStream = {
      ...mockStreamSummary,
      lastSeenAt: '2025-01-01T12:00:00Z' // 30 minutes ago
    }

    render(<StreamSummaryCard stream={recentStream} />)

    expect(screen.getByText('30m ago')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('should have correct link to stream detail', () => {
    render(<StreamSummaryCard stream={mockStreamSummary} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `/live/${mockStreamSummary.id}`)
  })

  it('should display notes when available', () => {
    const streamWithNotes = {
      ...mockStreamSummary,
      notes: 'Important stream notes'
    }

    render(<StreamSummaryCard stream={streamWithNotes} />)

    expect(screen.getByText('Important stream notes')).toBeInTheDocument()
  })

  it('should handle missing notes gracefully', () => {
    const streamWithoutNotes = {
      ...mockStreamSummary,
      notes: undefined
    }

    render(<StreamSummaryCard stream={streamWithoutNotes} />)

    expect(screen.queryByText('Important stream notes')).not.toBeInTheDocument()
  })

  it('should display loading state when stream is undefined', () => {
    render(<StreamSummaryCard stream={undefined} />)

    // Should show skeleton or loading state
    expect(screen.getByTestId(/skeleton|loading/i)).toBeInTheDocument()
  })

  it('should be interactive and respond to hover', async () => {
    render(<StreamSummaryCard stream={mockStreamSummary} />)

    const card = screen.getByRole('link')
    
    // Test hover interaction
    await user.hover(card)
    
    // Card should have hover styles applied
    expect(card).toHaveClass(/hover/)
  })
})