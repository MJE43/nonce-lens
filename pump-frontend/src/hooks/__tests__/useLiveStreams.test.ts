import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useLiveStreams, useAutoFollowLatest } from '../useLiveStreams'
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

describe('useLiveStreams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should fetch streams successfully', async () => {
    const mockStreams = [
      {
        id: 'stream-1',
        serverSeedHashed: '1a2b3c4d5e6f7890',
        clientSeed: 'client-1',
        createdAt: '2025-01-01T00:00:00Z',
        lastSeenAt: '2025-01-01T12:00:00Z',
        totalBets: 100,
        highestMultiplier: 1500.5,
        notes: 'Test stream'
      }
    ]

    mockLiveStreamsApi.list.mockResolvedValue({
      data: {
        streams: mockStreams,
        total: 1
      }
    })

    const { result } = renderHook(() => useLiveStreams(), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.streams).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.streams).toEqual(mockStreams)
    expect(result.current.total).toBe(1)
    expect(result.current.isError).toBe(false)
    expect(mockLiveStreamsApi.list).toHaveBeenCalledWith(undefined)
  })

  it('should handle API errors correctly', async () => {
    const mockError = new Error('Network error')
    mockLiveStreamsApi.list.mockRejectedValue(mockError)

    const { result } = renderHook(() => useLiveStreams(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(mockError)
    expect(result.current.streams).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it('should pass filters to API call', async () => {
    const filters = { limit: 50, offset: 10 }
    mockLiveStreamsApi.list.mockResolvedValue({
      data: { streams: [], total: 0 }
    })

    renderHook(() => useLiveStreams({ filters }), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(mockLiveStreamsApi.list).toHaveBeenCalledWith(filters)
    })
  })

  it('should not fetch when enabled is false', async () => {
    mockLiveStreamsApi.list.mockResolvedValue({
      data: { streams: [], total: 0 }
    })

    const { result } = renderHook(() => useLiveStreams({ enabled: false }), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(false)
    expect(mockLiveStreamsApi.list).not.toHaveBeenCalled()
  })

  it('should support refetch functionality', async () => {
    mockLiveStreamsApi.list.mockResolvedValue({
      data: { streams: [], total: 0 }
    })

    const { result } = renderHook(() => useLiveStreams(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockLiveStreamsApi.list).toHaveBeenCalledTimes(1)

    // Trigger refetch
    result.current.refetch()

    await waitFor(() => {
      expect(mockLiveStreamsApi.list).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle refetch interval', async () => {
    vi.useFakeTimers()
    
    mockLiveStreamsApi.list.mockResolvedValue({
      data: { streams: [], total: 0 }
    })

    renderHook(() => useLiveStreams({ refetchInterval: 1000 }), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(mockLiveStreamsApi.list).toHaveBeenCalledTimes(1)
    })

    // Fast forward time
    vi.advanceTimersByTime(1000)

    await waitFor(() => {
      expect(mockLiveStreamsApi.list).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  })

  it('should implement retry logic correctly', async () => {
    // Mock 500 error (should retry)
    const serverError = { apiError: { status: 500 } }
    mockLiveStreamsApi.list
      .mockRejectedValueOnce(serverError)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValue({ data: { streams: [], total: 0 } })

    const { result } = renderHook(() => useLiveStreams(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should have retried and eventually succeeded
    expect(mockLiveStreamsApi.list).toHaveBeenCalledTimes(3)
    expect(result.current.isError).toBe(false)
  })

  it('should not retry 4xx errors', async () => {
    // Mock 404 error (should not retry)
    const clientError = { apiError: { status: 404 } }
    mockLiveStreamsApi.list.mockRejectedValue(clientError)

    const { result } = renderHook(() => useLiveStreams(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    // Should not have retried
    expect(mockLiveStreamsApi.list).toHaveBeenCalledTimes(1)
  })
})

describe('useAutoFollowLatest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return the most recently active stream', async () => {
    const mockStreams = [
      {
        id: 'stream-1',
        serverSeedHashed: '1a2b3c4d5e6f7890',
        clientSeed: 'client-1',
        createdAt: '2025-01-01T00:00:00Z',
        lastSeenAt: '2025-01-01T10:00:00Z',
        totalBets: 100,
        highestMultiplier: 1500.5,
        notes: null
      },
      {
        id: 'stream-2',
        serverSeedHashed: '9876543210fedcba',
        clientSeed: 'client-2',
        createdAt: '2025-01-01T00:00:00Z',
        lastSeenAt: '2025-01-01T12:00:00Z', // More recent
        totalBets: 50,
        highestMultiplier: 750.25,
        notes: null
      }
    ]

    mockLiveStreamsApi.list.mockResolvedValue({
      data: {
        streams: mockStreams,
        total: 2
      }
    })

    const { result } = renderHook(() => useAutoFollowLatest(true), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.latestStream).toEqual(mockStreams[1]) // stream-2 is more recent
  })

  it('should return null when no streams available', async () => {
    mockLiveStreamsApi.list.mockResolvedValue({
      data: { streams: [], total: 0 }
    })

    const { result } = renderHook(() => useAutoFollowLatest(true), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.latestStream).toBeNull()
  })

  it('should not fetch when disabled', async () => {
    mockLiveStreamsApi.list.mockResolvedValue({
      data: { streams: [], total: 0 }
    })

    const { result } = renderHook(() => useAutoFollowLatest(false), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(false)
    expect(mockLiveStreamsApi.list).not.toHaveBeenCalled()
  })

  it('should poll when enabled', async () => {
    vi.useFakeTimers()
    
    mockLiveStreamsApi.list.mockResolvedValue({
      data: { streams: [], total: 0 }
    })

    renderHook(() => useAutoFollowLatest(true), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(mockLiveStreamsApi.list).toHaveBeenCalledTimes(1)
    })

    // Fast forward time to trigger polling
    vi.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(mockLiveStreamsApi.list).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  })

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Network error')
    mockLiveStreamsApi.list.mockRejectedValue(mockError)

    const { result } = renderHook(() => useAutoFollowLatest(true), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.error).toBe(mockError)
    })

    expect(result.current.latestStream).toBeNull()
  })
})