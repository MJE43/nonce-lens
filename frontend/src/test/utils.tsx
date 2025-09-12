import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Mock data for tests
export const mockStreamSummary = {
  id: 'test-stream-1',
  server_seed_hashed: '1a2b3c4d5e6f7890abcdef1234567890',
  client_seed: 'test-client-seed',
  created_at: '2025-01-01T00:00:00Z',
  last_seen_at: '2025-01-01T12:00:00Z',
  total_bets: 42,
  highest_multiplier: 1500.5,
  notes: 'Test stream notes'
}

export const mockStreamDetail = {
  ...mockStreamSummary,
  server_seed_hashed: '1a2b3c4d5e6f7890abcdef1234567890',
  recentActivity: [
    {
      id: 1,
      nonce: 1001,
      dateTime: '2025-01-01T12:00:00Z',
      amount: 0.1,
      payoutMultiplier: 1500.5,
      payout: 150.05,
      difficulty: 'expert' as const,
      roundTarget: 400.0,
      roundResult: 1500.5
    }
  ]
}

export const mockBetRecord = {
  id: 1,
  nonce: 1001,
  dateTime: '2025-01-01T12:00:00Z',
  amount: 0.1,
  payoutMultiplier: 1500.5,
  payout: 150.05,
  difficulty: 'expert' as const,
  roundTarget: 400.0,
  roundResult: 1500.5
}