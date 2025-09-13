import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, mockStreamDetail, mockBetRecord } from '@/test/utils'
import LiveStreamDetail from '../pages/LiveStreamDetail'
import * as useEnhancedLiveStreamsModule from '@/hooks/useEnhancedLiveStreams'
import * as useStreamBetsQueryModule from '@/hooks/useStreamBetsQuery'
import * as apiModule from '@/lib/api'

// Mock the hooks and API
vi.mock('@/hooks/useEnhancedLiveStreams')
vi.mock('@/hooks/useStreamBetsQuery')
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
const mockUseStreamBetsQuery = vi.mocked(useStreamBetsQueryModule.useStreamBetsQuery)
const mockUseEnhancedDeleteStream = vi.mocked(useEnhancedLiveStreamsModule.useEnhancedDeleteStream)
const mockUseEnhancedUpdateStream = vi.mocked(useEnhancedLiveStreamsModule.useEnhancedUpdateStream)
const mockLiveStreamsApi = vi.mocked(apiModule.liveStreamsApi)

describe('LiveStreamDetail', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    mockUseEnhancedDeleteStream.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as any)
    
    mockUseEnhancedUpdateStream.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as any)

    mockLiveStreamsApi.getExportCsvUrl = vi.fn().mockReturnValue('/export/test-stream-id.csv')
  })

  describe('Loading State', () => {
    it('should display loading skeletons when stream data is loading', () => {
      mockUseEnhancedStreamDetail.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      })
      
      mockUseStreamBetsQuery.mockReturnValue({
        bets: [],
        isLoading: true,
        refetch: vi.fn()
      } as any)

      const { container } = render(<LiveStreamDetail />)

      // Check for skeleton loading elements
      const skeletons = container.querySelectorAll('.animate-pulse')
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
      
      mockUseStreamBetsQuery.mockReturnValue({
        bets: [],
        isLoading: false,
        refetch: vi.fn()
      } as any)

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
      
      mockUseStreamBetsQuery.mockReturnValue({
        bets: mockBets,
        isLoading: false,
        refetch: vi.fn()
      } as any)
    })

    it('should display stream metadata correctly', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByText('Live Stream Detail')).toBeInTheDocument()

      const infoCard = screen.getByText('Stream Information').closest('div.shadow-md') as HTMLElement
      
      // Check seed information
      expect(within(infoCard).getByText('Server Seed Hash')).toBeInTheDocument()
      expect(within(infoCard).getByText('Client Seed')).toBeInTheDocument()
      expect(within(infoCard).getByText(mockStreamDetail.client_seed)).toBeInTheDocument()
      
      // Check statistics
      expect(within(infoCard).getByText('42')).toBeInTheDocument() // Total bets
      expect(within(infoCard).getByText('1500.50x')).toBeInTheDocument() // Highest multiplier
    })

    it('should display live indicator and polling controls', () => {
      render(<LiveStreamDetail />)
      const infoCard = screen.getByText('Stream Information').closest('div.shadow-md') as HTMLElement
      expect(within(infoCard).getByText('Live')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    })

    it('should toggle polling when pause/resume button is clicked', async () => {
      render(<LiveStreamDetail />)

      const pauseButton = screen.getByRole('button', { name: /pause/i })
      await user.click(pauseButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
      })
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
      
      mockUseStreamBetsQuery.mockReturnValue({
        bets: [],
        isLoading: false,
        refetch: vi.fn()
      } as any)
    })

    it('should display existing notes', () => {
      render(<LiveStreamDetail />)
      const infoCard = screen.getByText('Stream Information').closest('div.shadow-md') as HTMLElement
      expect(within(infoCard).getByText('Test notes')).toBeInTheDocument()
      expect(within(infoCard).getAllByRole('button', { name: /edit/i })[0]).toBeInTheDocument()
    })

    it('should enter edit mode when edit button is clicked', async () => {
      render(<LiveStreamDetail />)
      const infoCard = screen.getByText('Stream Information').closest('div.shadow-md') as HTMLElement

      const editButton = within(infoCard).getAllByRole('button', { name: /edit/i })[0]
      await user.click(editButton)

      expect(within(infoCard).getByRole('textbox')).toBeInTheDocument()
      expect(within(infoCard).getAllByRole('button', { name: /save/i })[0]).toBeInTheDocument()
      expect(within(infoCard).getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should save notes when save button is clicked', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue({})
      mockUseEnhancedUpdateStream.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false
      } as any)

      render(<LiveStreamDetail />)
      const infoCard = screen.getByText('Stream Information').closest('div.shadow-md') as HTMLElement

      const editButton = within(infoCard).getAllByRole('button', { name: /edit/i })[0]
      await user.click(editButton)

      const textarea = within(infoCard).getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Updated notes')

      const saveButton = within(infoCard).getAllByRole('button', { name: /save/i })[0]
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          id: '550e8400-e29b-41d4-a716-446655440000',
          data: { notes: 'Updated notes' }
        })
      })
    })

    it('should cancel editing when cancel button is clicked', async () => {
      render(<LiveStreamDetail />)
      const infoCard = screen.getByText('Stream Information').closest('div.shadow-md') as HTMLElement

      const editButton = within(infoCard).getAllByRole('button', { name: /edit/i })[0]
      await user.click(editButton)

      const textarea = within(infoCard).getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Changed text')

      const cancelButton = within(infoCard).getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(within(infoCard).getByText('Test notes')).toBeInTheDocument()
        expect(within(infoCard).queryByRole('textbox')).not.toBeInTheDocument()
      })
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
      
      mockUseStreamBetsQuery.mockReturnValue({
        bets: mockBets,
        isLoading: false,
        refetch: vi.fn(),
        total: mockBets.length,
      } as any)
    })

    it('should display bet table with correct headers', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByText('Betting Activity')).toBeInTheDocument()
      expect(screen.getByText(/updates every/i)).toBeInTheDocument()

      const table = screen.getByRole('table')
      // Check table headers
      const headers = ['Nonce', 'Date/Time', 'Amount', 'Multiplier', 'Payout', 'Difficulty']
      headers.forEach(header => {
        expect(within(table).getByText(header)).toBeInTheDocument()
      })
    })

    it('should display bet data correctly', () => {
      render(<LiveStreamDetail />)
      const table = screen.getByRole('table')

      expect(within(table).getByText('1,001')).toBeInTheDocument() // Nonce
      expect(within(table).getByText('0.10000000')).toBeInTheDocument() // Amount
      expect(within(table).getByText('1500.50x')).toBeInTheDocument() // Multiplier
      expect(within(table).getByText('150.05000000')).toBeInTheDocument() // Payout
      expect(within(table).getByText('expert')).toBeInTheDocument() // Difficulty
    })

    it('should display empty state when no bets match filters', () => {
      mockUseStreamBetsQuery.mockReturnValue({
        bets: [],
        isLoading: false,
        refetch: vi.fn()
      } as any)

      render(<LiveStreamDetail />)

      expect(screen.getByText('No bets found')).toBeInTheDocument()
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
      
      mockUseStreamBetsQuery.mockReturnValue({
        bets: [],
        isLoading: false,
        refetch: vi.fn()
      } as any)
    })

    it('should display action buttons', () => {
      render(<LiveStreamDetail />)
      const infoCard = screen.getByText('Stream Information').closest('div.shadow-md') as HTMLElement
      expect(within(infoCard).getAllByRole('button', { name: /export csv/i })[0]).toBeInTheDocument()
      expect(within(infoCard).getByRole('button', { name: /delete stream/i })).toBeInTheDocument()
    })

    it('should handle CSV export', async () => {
      const mockOpen = vi.fn()
      Object.defineProperty(window, 'open', { value: mockOpen })

      render(<LiveStreamDetail />)
      const infoCard = screen.getByText('Stream Information').closest('div.shadow-md') as HTMLElement
      const exportButton = within(infoCard).getAllByRole('button', { name: /export csv/i })[0]
      await user.click(exportButton)

      expect(mockLiveStreamsApi.getExportCsvUrl).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')
      expect(mockOpen).toHaveBeenCalledWith('/export/test-stream-id.csv', '_blank')
    })

    it('should show delete confirmation dialog', async () => {
      render(<LiveStreamDetail />)
      const infoCard = screen.getByText('Stream Information').closest('div.shadow-md') as HTMLElement
      const deleteButton = within(infoCard).getByRole('button', { name: /delete stream/i })
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getAllByText('Delete Stream')[1]).toBeInTheDocument()
        expect(screen.getByText(/This will permanently delete the stream/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
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
      
      mockUseStreamBetsQuery.mockReturnValue({
        bets: [],
        isLoading: false,
        refetch: vi.fn()
      } as any)
    })

    it('should display breadcrumb navigation', () => {
      render(<LiveStreamDetail />)

      expect(screen.getByRole('link', { name: /back to streams/i })).toHaveAttribute('href', '/streams')
    })
  })
})