import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useStreamDetail, useStreamBets, useStreamDetailPage } from '../useStreamDetail'
import * as apiModule from '@/lib/api'

// Mock the API
vi.mock('@/lib/api')
const mockLiveStreamsApi = vi.mocked(apiModule.liveStreamsApi)

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useStreamDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should fetch stream detail successfully', async () => {
    const mockStream = {
      id: 'stream-1',
      serverSeedHashed: '1a2b3c4d5e6f7890',
      clientSeed: 'client-1',
      createdAt: '2025-01-01T00:00:00Z',
      lastSeenAt: '2025-01-01T12:00:00Z',
      totalBets: 100,
      highestMultiplier: 1500.5,
      notes: 'Test stream',
      recentActivity: []
    }

    mockLiveStreamsApi.get.mockResolvedValue({
      data: mockStream
    })

    const { result } = renderHook(() => useStreamDetail({ streamId: 'stream-1' }), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.stream).toBeNull()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stream).toEqual(mockStream)
    expect(result.current.isError).toBe(false)
    expect(mockLiveStreamsApi.get).toHaveBeenCalledWith('stream-1')
  })

  it('should handle API errors correctly', async () => {
    const mockError = new Error('Stream not found')
    mockLiveStreamsApi.get.mockRejectedValue(mockError)

    const { result } = renderHook(() => useStreamDetail({ streamId: 'invalid-id' }), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(mockError)
    expect(result.current.stream).toBeNull()
  })

  it('should not fetch when streamId is empty', async () => {
    mockLiveStreamsApi.get.mockResolvedValue({
      data: {} as any
    })

    const { result } = renderHook(() => useStreamDetail({ streamId: '' }), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(false)
    expect(mockLiveStreamsApi.get).not.toHaveBeenCalled()
  })

  it('should not fetch when enabled is false', async () => {
    mockLiveStreamsApi.get.mockResolvedValue({
      data: {} as any
    })

    const { result } = renderHook(() => useStreamDetail({ 
      streamId: 'stream-1', 
      enabled: false 
    }), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(false)
    expect(mockLiveStreamsApi.get).not.toHaveBeenCalled()
  })

  it('should support refetch interval', async () => {
    vi.useFakeTimers()
    
    mockLiveStreamsApi.get.mockResolvedValue({
      data: {} as any
    })

    renderHook(() => useStreamDetail({ 
      streamId: 'stream-1', 
      refetchInterval: 1000 
    }), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(mockLiveStreamsApi.get).toHaveBeenCalledTimes(1)
    })

    // Fast forward time
    vi.advanceTimersByTime(1000)

    await waitFor(() => {
      expect(mockLiveStreamsApi.get).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  })

  it('should implement retry logic for server errors', async () => {
    const serverError = { apiError: { status: 500 } }
    mockLiveStreamsApi.get
      .mockRejectedValueOnce(serverError)
      .mockResolvedValue({ data: {} as any })

    const { result } = renderHook(() => useStreamDetail({ streamId: 'stream-1' }), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockLiveStreamsApi.get).toHaveBeenCalledTimes(2)
    expect(result.current.isError).toBe(false)
  })

  it('should not retry 4xx errors', async () => {
    const clientError = { apiError: { status: 404 } }
    mockLiveStreamsApi.get.mockRejectedValue(clientError)

    const { result } = renderHook(() => useStreamDetail({ streamId: 'stream-1' }), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockLiveStreamsApi.get).toHaveBeenCalledTimes(1)
  })
})

describe('useStreamBets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch stream bets successfully', async () => {
    const mockBets = [
      {
        id: 1,
        nonce: 1001,
        dateTime: '2025-01-01T12:00:00Z',
        amount: 0.1,
        payoutMultiplier: 1500.5,
        payout: 150.05,
        difficulty: 'expert' as const,
        roundTarget: 400.0,
        roundResult: 1500.5,
        receivedAt: '2025-01-01T12:00:00Z'
      }
    ]

    mockLiveStreamsApi.getBets.mockResolvedValue({
      data: {
        bets: mockBets,
        total: 1
      }
    })

    const { result } = renderHook(() => useStreamBets({ streamId: 'stream-1' }), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.bets).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.bets).toEqual(mockBets)
    expect(result.current.total).toBe(1)
    expect(result.current.isError).toBe(false)
    expect(mockLiveStreamsApi.getBets).toHaveBeenCalledWith('stream-1', undefined)
  })

  it('should pass filters to API call', async () => {
    const filters = { minMultiplier: 100, limit: 500, offset: 0 }
    mockLiveStreamsApi.getBets.mockResolvedValue({
      data: { bets: [], total: 0 }
    })

    renderHook(() => useStreamBets({ 
      streamId: 'stream-1', 
      filters 
    }), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(mockLiveStreamsApi.getBets).toHaveBeenCalledWith('stream-1', filters)
    })
  })

  it('should handle API errors correctly', async () => {
    const mockError = new Error('Failed to fetch bets')
    mockLiveStreamsApi.getBets.mockRejectedValue(mockError)

    const { result } = renderHook(() => useStreamBets({ streamId: 'stream-1' }), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(mockError)
    expect(result.current.bets).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it('should support refetch interval for real-time updates', async () => {
    vi.useFakeTimers()
    
    mockLiveStreamsApi.getBets.mockResolvedValue({
      data: { bets: [], total: 0 }
    })

    renderHook(() => useStreamBets({ 
      streamId: 'stream-1', 
      refetchInterval: 5000 
    }), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(mockLiveStreamsApi.getBets).toHaveBeenCalledTimes(1)
    })

    // Fast forward time
    vi.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(mockLiveStreamsApi.getBets).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  })
})

describe('useStreamDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch both stream detail and bets', async () => {
    const mockStream = {
      id: 'stream-1',
      serverSeedHashed: '1a2b3c4d5e6f7890',
      clientSeed: 'client-1',
      createdAt: '2025-01-01T00:00:00Z',
      lastSeenAt: '2025-01-01T12:00:00Z',
      totalBets: 100,
      highestMultiplier: 1500.5,
      notes: 'Test stream',
      recentActivity: []
    }

    const mockBets = [
      {
        id: 1,
        nonce: 1001,
        dateTime: '2025-01-01T12:00:00Z',
        amount: 0.1,
        payoutMultiplier: 1500.5,
        payout: 150.05,
        difficulty: 'expert' as const,
        roundTarget: 400.0,
        roundResult: 1500.5,
        receivedAt: '2025-01-01T12:00:00Z'
      }
    ]

    mockLiveStreamsApi.get.mockResolvedValue({ data: mockStream })
    mockLiveStreamsApi.getBets.mockResolvedValue({ 
      data: { bets: mockBets, total: 1 } 
    })

    const { result } = renderHook(() => useStreamDetailPage('stream-1'), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stream).toEqual(mockStream)
    expect(result.current.bets).toEqual(mockBets)
    expect(result.current.totalBets).toBe(1)
    expect(result.current.isError).toBe(false)
  })

  it('should handle errors from either query', async () => {
    const mockError = new Error('Stream not found')
    mockLiveStreamsApi.get.mockRejectedValue(mockError)
    mockLiveStreamsApi.getBets.mockResolvedValue({ 
      data: { bets: [], total: 0 } 
    })

    const { result } = renderHook(() => useStreamDetailPage('stream-1'), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(mockError)
  })

  it('should provide refetch functions', async () => {
    mockLiveStreamsApi.get.mockResolvedValue({ data: {} as any })
    mockLiveStreamsApi.getBets.mockResolvedValue({ 
      data: { bets: [], total: 0 } 
    })

    const { result } = renderHook(() => useStreamDetailPage('stream-1'), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(typeof result.current.refetchStream).toBe('function')
    expect(typeof result.current.refetchBets).toBe('function')
    expect(typeof result.current.refetchAll).toBe('function')

    // Test refetchAll calls both refetch functions
    result.current.refetchAll()

    await waitFor(() => {
      expect(mockLiveStreamsApi.get).toHaveBeenCalledTimes(2)
      expect(mockLiveStreamsApi.getBets).toHaveBeenCalledTimes(2)
    })
  })

  it('should pass bet filters correctly', async () => {
    const betsFilters = { minMultiplier: 100, order: 'nonce_asc' as const }
    
    mockLiveStreamsApi.get.mockResolvedValue({ data: {} as any })
    mockLiveStreamsApi.getBets.mockResolvedValue({ 
      data: { bets: [], total: 0 } 
    })

    renderHook(() => useStreamDetailPage('stream-1', betsFilters), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(mockLiveStreamsApi.getBets).toHaveBeenCalledWith('stream-1', betsFilters)
    })
  })

  it('should set up appropriate refetch intervals', async () => {
    vi.useFakeTimers()
    
    mockLiveStreamsApi.get.mockResolvedValue({ data: {} as any })
    mockLiveStreamsApi.getBets.mockResolvedValue({ 
      data: { bets: [], total: 0 } 
    })

    renderHook(() => useStreamDetailPage('stream-1'), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(mockLiveStreamsApi.get).toHaveBeenCalledTimes(1)
      expect(mockLiveStreamsApi.getBets).toHaveBeenCalledTimes(1)
    })

    // Fast forward 10 seconds (bets refetch interval)
    vi.advanceTimersByTime(10000)

    await waitFor(() => {
      expect(mockLiveStreamsApi.getBets).toHaveBeenCalledTimes(2)
    })

    // Fast forward 30 seconds total (stream refetch interval)
    vi.advanceTimersByTime(20000)

    await waitFor(() => {
      expect(mockLiveStreamsApi.get).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  })
})