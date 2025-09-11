import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, mockStreamSummary } from '@/test/utils'
import LiveStreamsList from '../LiveStreamsList'
import * as useEnhancedLiveStreamsModule from '@/hooks/useEnhancedLiveStreams'

// Mock the hooks
vi.mock('@/hooks/useEnhancedLiveStreams')
vi.mock('@/components/OfflineIndicator', () => ({
  default: ({ onRetry }: { onRetry: () => void }) => (
    <div data-testid="offline-indicator">
      <button onClick={onRetry}>Retry</button>
    </div>
  )
}))

const mockUseEnhancedLiveStreams = vi.mocked(useEnhancedLiveStreamsModule.useEnhancedLiveStreams)

describe('LiveStreamsList', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    })
  })

  describe('Loading State', () => {
    it('should display loading spinner when data is loading', () => {
      mockUseEnhancedLiveStreams.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      })

      render(<LiveStreamsList />)

      expect(screen.getByText('Loading live streams...')).toBeInTheDocument()
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument() // spinner
    })
  })

  describe('Error State', () => {
    it('should display error message when there is an error', () => {
      const mockError = new Error('Network error')
      mockUseEnhancedLiveStreams.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: vi.fn()
      })

      render(<LiveStreamsList />)

      expect(screen.getByText('Error Loading Streams')).toBeInTheDocument()
      expect(screen.getByText('Network error')).toBeInTheDocument()
      expect(screen.getByText('Possible solutions:')).toBeInTheDocument()
    })

    it('should call refetch when retry button is clicked', async () => {
      const mockRefetch = vi.fn()
      const mockError = new Error('Network error')
      mockUseEnhancedLiveStreams.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch
      })

      render(<LiveStreamsList />)

      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it('should reload page when reload button is clicked', async () => {
      const mockReload = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true
      })

      const mockError = new Error('Network error')
      mockUseEnhancedLiveStreams.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: vi.fn()
      })

      render(<LiveStreamsList />)

      const reloadButton = screen.getByRole('button', { name: /reload page/i })
      await user.click(reloadButton)

      expect(mockReload).toHaveBeenCalledTimes(1)
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no streams are available', () => {
      mockUseEnhancedLiveStreams.mockReturnValue({
        data: { streams: [], total: 0 },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })

      render(<LiveStreamsList />)

      expect(screen.getByText('No active streams')).toBeInTheDocument()
      expect(screen.getByText('Streams will appear here when betting data is received')).toBeInTheDocument()
    })
  })

  describe('Streams Display', () => {
    const mockStreams = [
      {
        ...mockStreamSummary,
        id: 'stream-1',
        serverSeedHashed: '1a2b3c4d5e6f7890abcdef1234567890',
        clientSeed: 'client-seed-1',
        totalBets: 100,
        highestMultiplier: 1500.5
      },
      {
        ...mockStreamSummary,
        id: 'stream-2',
        serverSeedHashed: '9876543210fedcba0987654321fedcba',
        clientSeed: 'client-seed-2',
        totalBets: 50,
        highestMultiplier: 750.25
      }
    ]

    beforeEach(() => {
      mockUseEnhancedLiveStreams.mockReturnValue({
        data: { streams: mockStreams, total: 2 },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })
    })

    it('should display streams table with correct data', () => {
      render(<LiveStreamsList />)

      expect(screen.getByText('Active Streams (2)')).toBeInTheDocument()
      expect(screen.getByText('2 active streams')).toBeInTheDocument()

      // Check table headers
      expect(screen.getByText('Seed Hash')).toBeInTheDocument()
      expect(screen.getByText('Client Seed')).toBeInTheDocument()
      expect(screen.getByText('Last Seen')).toBeInTheDocument()
      expect(screen.getByText('Total Bets')).toBeInTheDocument()
      expect(screen.getByText('Highest Multiplier')).toBeInTheDocument()

      // Check stream data
      expect(screen.getByText('1a2b3c4d5e...')).toBeInTheDocument()
      expect(screen.getByText('client-seed-1')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('1500.50x')).toBeInTheDocument()

      expect(screen.getByText('9876543210...')).toBeInTheDocument()
      expect(screen.getByText('client-seed-2')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('750.25x')).toBeInTheDocument()
    })

    it('should display view stream buttons with correct links', () => {
      render(<LiveStreamsList />)

      const viewButtons = screen.getAllByText('View Stream')
      expect(viewButtons).toHaveLength(2)

      const links = screen.getAllByRole('link', { name: /view stream/i })
      expect(links[0]).toHaveAttribute('href', '/live/stream-1')
      expect(links[1]).toHaveAttribute('href', '/live/stream-2')
    })
  })

  describe('Auto-follow Feature', () => {
    const mockStreams = [
      {
        ...mockStreamSummary,
        id: 'stream-1',
        lastSeenAt: '2025-01-01T10:00:00Z'
      },
      {
        ...mockStreamSummary,
        id: 'stream-2',
        lastSeenAt: '2025-01-01T12:00:00Z' // More recent
      }
    ]

    beforeEach(() => {
      mockUseEnhancedLiveStreams.mockReturnValue({
        data: { streams: mockStreams, total: 2 },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })
    })

    it('should display auto-follow toggle', () => {
      render(<LiveStreamsList />)

      expect(screen.getByText('Auto-follow latest')).toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('should show auto-follow status when enabled', async () => {
      render(<LiveStreamsList />)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      expect(screen.getByText(/Auto-following enabled/)).toBeInTheDocument()
      expect(screen.getByText(/will automatically open the most recently active stream/)).toBeInTheDocument()
    })

    it('should navigate to most recent stream when auto-follow is enabled and data changes', async () => {
      const { rerender } = render(<LiveStreamsList />)

      // Enable auto-follow
      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      // Update data with new most recent stream
      const updatedStreams = [
        ...mockStreams,
        {
          ...mockStreamSummary,
          id: 'stream-3',
          lastSeenAt: '2025-01-01T14:00:00Z' // Most recent
        }
      ]

      mockUseEnhancedLiveStreams.mockReturnValue({
        data: { streams: updatedStreams, total: 3 },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })

      rerender(<LiveStreamsList />)

      await waitFor(() => {
        expect(window.location.href).toBe('/live/stream-3')
      })
    })
  })

  describe('Timestamp Formatting', () => {
    it('should format timestamps correctly', () => {
      const now = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const mockStreams = [
        {
          ...mockStreamSummary,
          id: 'stream-1',
          lastSeenAt: '2025-01-01T11:59:30Z' // 30 seconds ago
        },
        {
          ...mockStreamSummary,
          id: 'stream-2',
          lastSeenAt: '2025-01-01T11:30:00Z' // 30 minutes ago
        },
        {
          ...mockStreamSummary,
          id: 'stream-3',
          lastSeenAt: '2025-01-01T10:00:00Z' // 2 hours ago
        }
      ]

      mockUseEnhancedLiveStreams.mockReturnValue({
        data: { streams: mockStreams, total: 3 },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })

      render(<LiveStreamsList />)

      expect(screen.getByText('Just now')).toBeInTheDocument()
      expect(screen.getByText('30m ago')).toBeInTheDocument()
      expect(screen.getByText('2h ago')).toBeInTheDocument()

      vi.useRealTimers()
    })
  })

  describe('Navigation', () => {
    it('should display breadcrumb navigation', () => {
      mockUseEnhancedLiveStreams.mockReturnValue({
        data: { streams: [], total: 0 },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })

      render(<LiveStreamsList />)

      expect(screen.getByText('Live')).toBeInTheDocument()
    })

    it('should display page title and description', () => {
      mockUseEnhancedLiveStreams.mockReturnValue({
        data: { streams: [], total: 0 },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })

      render(<LiveStreamsList />)

      expect(screen.getByRole('heading', { name: 'Live Streams' })).toBeInTheDocument()
      expect(screen.getByText('Real-time betting data')).toBeInTheDocument()
    })
  })
})