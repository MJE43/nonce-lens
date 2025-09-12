import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, mockStreamDetail, mockBetRecord } from '@/test/utils'
import LiveStreamDetail from '../LiveStreamDetail'
import * as useEnhancedLiveStreamsModule from '@/hooks/useEnhancedLiveStreams'
import * as apiModule from '@/lib/api'

// Mock the hooks and API
vi.mock('@/hooks/useEnhancedLiveStreams')
vi.mock('@/lib/api')
vi.mock('@/lib/errorHandling', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn()
}))
vi.mock('@/components/OfflineIndicator', () => ({
  default: ({ onRetry }: { onRetry: () => void }) => (
    <div data-testid="offline-indicator">
      <button onClick={onRetry}>Retry</button>
    </div>
  )
}))

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    useNavigate: () => vi.fn(),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    )
  }
})

const mockUseEnhancedStreamDetail = vi.mocked(useEnhancedLiveStreamsModule.useEnhancedStreamDetail)
const mockUseEnhancedStreamBets = vi.mocked(useEnhancedLiveStreamsModule.useEnhancedStreamBets)
const mockUseEnhancedDeleteStream = vi.mocked(useEnhancedLiveStreamsModule.useEnhancedDeleteStream)
const mockUseEnhancedUpdateStream = vi.mocked(useEnhancedLiveStreamsModule.useEnhancedUpdateStream)
const mockLiveStreamsApi = vi.mocked(apiModule.liveStreamsApi)

describe('LiveStreamDetail', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Default mock implementations
    mockUseEnhancedDeleteStream.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as any)
    
    mockUseEnhancedUpdateStream.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as any)

    mockLiveStreamsApi.tail = vi.fn()
    mockLiveStreamsApi.getExportCsvUrl = vi.fn().mockReturnValue('/export/test-stream-id.csv')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Loading State', () => {
    it('should display loading skeletons when stream data is loading', () => {
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      })
      
      mockUseEnhancedStreamBets.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: vi.fn()
      })

      render(<LiveStreamDetail />)

      // Check for skeleton loading elements
      const skeletons = screen.getAllByTestId(/skeleton/i)
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Error States', () => {
    it('should display error when stream is not found', () => {
      const mockError = new Error('Stream not found')
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError,
        refetch: vi.fn()
      })
      
      mockUseEnhancedStreamBets.mockReturnValue({
        data: undefined,
        isLoading: false,
        refetch: vi.fn()
      })

      render(<LiveStreamDetail />)

      expect(screen.getByText('Stream Not Found')).toBeInTheDocument()
      expect(screen.getByText('Stream not found')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /back to streams/i })).toBeInTheDocument()
    })
  })

  describe('Stream Information Display', () => {
    const mockBets = [mockBetRecord]

    beforeEach(() => {
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: mockStreamDetail,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })
      
      mockUseEnhancedStreamBets.mockReturnValue({
        data: { bets: mockBets },
        isLoading: false,
        refetch: vi.fn()
      })
    })

    it('should display stream metadata correctly', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByText('Live Stream Detail')).toBeInTheDocument()
      expect(screen.getByText('Stream Information')).toBeInTheDocument()
      
      // Check seed information
      expect(screen.getByText('Server Seed Hash')).toBeInTheDocument()
      expect(screen.getByText('Client Seed')).toBeInTheDocument()
      expect(screen.getByText(mockStreamDetail.clientSeed)).toBeInTheDocument()
      
      // Check statistics
      expect(screen.getByText('42')).toBeInTheDocument() // Total bets
      expect(screen.getByText('1500.50x')).toBeInTheDocument() // Highest multiplier
    })

    it('should display live indicator and polling controls', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByText('Live')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    })

    it('should toggle polling when pause/resume button is clicked', async () => {
      render(<LiveStreamDetail />)

      const pauseButton = screen.getByRole('button', { name: /pause/i })
      await user.click(pauseButton)

      expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    })
  })

  describe('Notes Management', () => {
    beforeEach(() => {
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: { ...mockStreamDetail, notes: 'Test notes' },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })
      
      mockUseEnhancedStreamBets.mockReturnValue({
        data: { bets: [] },
        isLoading: false,
        refetch: vi.fn()
      })
    })

    it('should display existing notes', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByText('Test notes')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('should enter edit mode when edit button is clicked', async () => {
      render(<LiveStreamDetail />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should save notes when save button is clicked', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue({})
      mockUseEnhancedUpdateStream.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false
      } as any)

      render(<LiveStreamDetail />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Updated notes')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'test-stream-id',
        data: { notes: 'Updated notes' }
      })
    })

    it('should cancel editing when cancel button is clicked', async () => {
      render(<LiveStreamDetail />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Changed text')

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(screen.getByText('Test notes')).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  describe('Bet Filtering', () => {
    const mockBets = [
      { ...mockBetRecord, id: 1, nonce: 1001, payoutMultiplier: 50.5 },
      { ...mockBetRecord, id: 2, nonce: 1002, payoutMultiplier: 150.75 },
      { ...mockBetRecord, id: 3, nonce: 1003, payoutMultiplier: 1000.0 }
    ]

    beforeEach(() => {
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: mockStreamDetail,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })
      
      mockUseEnhancedStreamBets.mockReturnValue({
        data: { bets: mockBets },
        isLoading: false,
        refetch: vi.fn()
      })
    })

    it('should display bet filters', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByText('Bet Filters')).toBeInTheDocument()
      expect(screen.getByLabelText('Minimum Multiplier')).toBeInTheDocument()
      expect(screen.getByLabelText('Order By')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
    })

    it('should filter bets by minimum multiplier', async () => {
      render(<LiveStreamDetail />)

      const multiplierInput = screen.getByLabelText('Minimum Multiplier')
      await user.type(multiplierInput, '100')

      await waitFor(() => {
        expect(screen.getByText('Showing 2 of 3 bets')).toBeInTheDocument()
        expect(screen.getByText('(≥100x multiplier)')).toBeInTheDocument()
      })

      // Should show only bets with multiplier >= 100
      expect(screen.getByText('150.75x')).toBeInTheDocument()
      expect(screen.getByText('1000.00x')).toBeInTheDocument()
      expect(screen.queryByText('50.50x')).not.toBeInTheDocument()
    })

    it('should clear filters when clear button is clicked', async () => {
      render(<LiveStreamDetail />)

      const multiplierInput = screen.getByLabelText('Minimum Multiplier')
      await user.type(multiplierInput, '100')

      const clearButton = screen.getByRole('button', { name: /clear filters/i })
      await user.click(clearButton)

      expect(multiplierInput).toHaveValue('')
      expect(screen.getByText('Showing 3 of 3 bets')).toBeInTheDocument()
    })
  })

  describe('Bet Table Display', () => {
    const mockBets = [mockBetRecord]

    beforeEach(() => {
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: mockStreamDetail,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })
      
      mockUseEnhancedStreamBets.mockReturnValue({
        data: { bets: mockBets },
        isLoading: false,
        refetch: vi.fn()
      })
    })

    it('should display bet table with correct headers', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByText('Betting Activity')).toBeInTheDocument()
      expect(screen.getByText('Updates every 2 seconds')).toBeInTheDocument()

      // Check table headers
      const headers = ['Nonce', 'Date/Time', 'Amount', 'Multiplier', 'Payout', 'Difficulty', 'Target', 'Result']
      headers.forEach(header => {
        expect(screen.getByText(header)).toBeInTheDocument()
      })
    })

    it('should display bet data correctly', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByText('1,001')).toBeInTheDocument() // Nonce
      expect(screen.getByText('0.10000000')).toBeInTheDocument() // Amount
      expect(screen.getByText('1500.50x')).toBeInTheDocument() // Multiplier
      expect(screen.getByText('150.05000000')).toBeInTheDocument() // Payout
      expect(screen.getByText('expert')).toBeInTheDocument() // Difficulty
    })

    it('should display empty state when no bets match filters', () => {
      mockUseEnhancedStreamBets.mockReturnValue({
        data: { bets: [] },
        isLoading: false,
        refetch: vi.fn()
      })

      render(<LiveStreamDetail />)

      expect(screen.getByText('No bets found')).toBeInTheDocument()
      expect(screen.getByText('Bets will appear here as they are received')).toBeInTheDocument()
    })
  })

  describe('Stream Actions', () => {
    beforeEach(() => {
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: mockStreamDetail,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })
      
      mockUseEnhancedStreamBets.mockReturnValue({
        data: { bets: [] },
        isLoading: false,
        refetch: vi.fn()
      })
    })

    it('should display action buttons', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete stream/i })).toBeInTheDocument()
    })

    it('should handle CSV export', async () => {
      const mockOpen = vi.fn()
      Object.defineProperty(window, 'open', { value: mockOpen })

      render(<LiveStreamDetail />)

      const exportButton = screen.getByRole('button', { name: /export csv/i })
      await user.click(exportButton)

      expect(mockLiveStreamsApi.getExportCsvUrl).toHaveBeenCalledWith('test-stream-id')
      expect(mockOpen).toHaveBeenCalledWith('/export/test-stream-id.csv', '_blank')
    })

    it('should show delete confirmation dialog', async () => {
      render(<LiveStreamDetail />)

      const deleteButton = screen.getByRole('button', { name: /delete stream/i })
      await user.click(deleteButton)

      expect(screen.getByText('Delete Stream')).toBeInTheDocument()
      expect(screen.getByText(/This will permanently delete the stream/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })
  })

  describe('Real-time Updates', () => {
    beforeEach(() => {
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: mockStreamDetail,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })
      
      mockUseEnhancedStreamBets.mockReturnValue({
        data: { bets: [mockBetRecord] },
        isLoading: false,
        refetch: vi.fn()
      })
    })

    it('should set up polling for real-time updates', async () => {
      mockLiveStreamsApi.tail.mockResolvedValue({
        data: {
          bets: [{ ...mockBetRecord, id: 2, nonce: 1002 }],
          lastId: 2
        }
      })

      render(<LiveStreamDetail />)

      // Fast-forward time to trigger polling
      vi.advanceTimersByTime(2000)

      await waitFor(() => {
        expect(mockLiveStreamsApi.tail).toHaveBeenCalledWith('test-stream-id', 1)
      })
    })
  })

  describe('Breadcrumb Navigation', () => {
    beforeEach(() => {
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: mockStreamDetail,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      })
      
      mockUseEnhancedStreamBets.mockReturnValue({
        data: { bets: [] },
        isLoading: false,
        refetch: vi.fn()
      })
    })

    it('should display breadcrumb navigation', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByRole('link', { name: 'Live' })).toHaveAttribute('href', '/live')
      expect(screen.getByText('1a2b3c4d5e...')).toBeInTheDocument()
    })
  })
})