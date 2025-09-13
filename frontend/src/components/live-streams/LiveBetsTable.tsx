import {
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_SortingState,
  type MRT_Virtualizer,
} from 'mantine-react-table';
import { Text, Badge, Group, Stack } from '@mantine/core';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { liveStreamsApi, type BetRecord, type StreamBetsFilters } from '@/lib/api';

interface LiveBetsTableProps {
  streamId: string;
  isPolling?: boolean;
  pollingInterval?: number;
}

const fetchSize = 100;

const LiveBetsTable = ({ 
  streamId, 
  isPolling = true, 
  pollingInterval = 2000 
}: LiveBetsTableProps) => {
  const queryClient = useQueryClient();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizerInstanceRef = useRef<MRT_Virtualizer<HTMLDivElement, HTMLTableRowElement>>(null);
  
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>();
  const [sorting, setSorting] = useState<MRT_SortingState>([]);

  // Define columns
  const columns = useMemo<MRT_ColumnDef<BetRecord>[]>(
    () => [
      {
        accessorKey: 'nonce',
        header: 'Nonce',
        size: 100,
        Cell: ({ cell }) => (
          <Text size="sm" ff="monospace" style={{ color: 'hsl(210 40% 98%)' }}>
            {cell.getValue<number>().toLocaleString()}
          </Text>
        ),
      },
      {
        accessorKey: 'round_result',
        header: 'Multiplier',
        size: 120,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          const color = value >= 1000 ? 'red' : value >= 100 ? 'orange' : value >= 10 ? 'yellow' : 'green';
          return (
            <Badge color={color} variant="light" size="sm">
              {value?.toFixed(2)}×
            </Badge>
          );
        },
      },
      {
        accessorKey: 'distance_prev_opt',
        header: 'Distance',
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue<number | null>();
          if (value === null || value === undefined) {
            return <Text size="sm" style={{ color: 'hsl(215.4 16.3% 46.9%)' }}>-</Text>;
          }
          return (
            <Text size="sm" ff="monospace" style={{ color: 'hsl(210 40% 98%)' }}>
              {value.toLocaleString()}
            </Text>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        size: 100,
        Cell: ({ cell }) => (
          <Text size="sm" style={{ color: 'hsl(210 40% 98%)' }}>
            ${cell.getValue<number>().toFixed(2)}
          </Text>
        ),
      },
      {
        accessorKey: 'payout',
        header: 'Payout',
        size: 100,
        Cell: ({ cell }) => (
          <Text size="sm" style={{ color: 'hsl(210 40% 98%)' }}>
            ${cell.getValue<number>().toFixed(2)}
          </Text>
        ),
      },
      {
        accessorKey: 'difficulty',
        header: 'Difficulty',
        size: 100,
        Cell: ({ cell }) => {
          const difficulty = cell.getValue<string>();
          const color = {
            easy: 'green',
            medium: 'yellow',
            hard: 'orange',
            expert: 'red'
          }[difficulty] || 'gray';
          
          return (
            <Badge color={color} variant="outline" size="sm">
              {difficulty}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'date_time',
        header: 'Time',
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          if (!value) return <Text size="sm" style={{ color: 'hsl(215.4 16.3% 46.9%)' }}>-</Text>;
          
          const date = new Date(value);
          return (
            <Text size="sm" style={{ color: 'hsl(210 40% 98%)' }}>
              {date.toLocaleTimeString()}
            </Text>
          );
        },
      },
    ],
    []
  );

  // Infinite query for bets data
  const { data, fetchNextPage, isError, isFetching, isLoading } = useInfiniteQuery({
    queryKey: ['live-bets-table', streamId, columnFilters, globalFilter, sorting],
    queryFn: async ({ pageParam = 0 }) => {
      const filters: StreamBetsFilters = {
        offset: pageParam * fetchSize,
        limit: fetchSize,
        order: sorting.length > 0 && sorting[0].id === 'nonce'
          ? 'nonce_asc' // Backend only supports nonce_asc for nonce sorting
          : 'id_desc', // Default to id_desc for most recent first
      };

      // Apply column filters
      if (columnFilters.length > 0) {
        columnFilters.forEach(filter => {
          if (filter.id === 'round_result' && typeof filter.value === 'number') {
            filters.min_multiplier = filter.value;
          }
        });
      }

      const response = await liveStreamsApi.getBets(streamId, filters);
      return response.data;
    },
    getNextPageParam: (lastPage, pages) => {
      const totalFetched = pages.reduce((sum, page) => sum + page.bets.length, 0);
      return totalFetched < lastPage.total ? pages.length : undefined;
    },
    initialPageParam: 0,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    enabled: !!streamId,
  });

  const flatData = useMemo(
    () => data?.pages.flatMap((page) => page.bets) ?? [],
    [data]
  );

  const totalDBRowCount = data?.pages?.[0]?.total ?? 0;
  const totalFetched = flatData.length;

  // Fetch more data when scrolling near bottom
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        if (
          scrollHeight - scrollTop - clientHeight < 400 &&
          !isFetching &&
          totalFetched < totalDBRowCount
        ) {
          fetchNextPage();
        }
      }
    },
    [fetchNextPage, isFetching, totalFetched, totalDBRowCount]
  );

  // Scroll to top when sorting or filters change
  useEffect(() => {
    if (rowVirtualizerInstanceRef.current) {
      try {
        rowVirtualizerInstanceRef.current.scrollToIndex(0);
      } catch (e) {
        console.error(e);
      }
    }
  }, [sorting, columnFilters, globalFilter]);

  // Check if we need to fetch more data on mount
  useEffect(() => {
    fetchMoreOnBottomReached(tableContainerRef.current);
  }, [fetchMoreOnBottomReached]);

  // Real-time polling for new data
  useEffect(() => {
    if (!isPolling || !flatData.length) return;

    const interval = setInterval(async () => {
      try {
        const lastId = Math.max(...flatData.map(bet => bet.id));
        const response = await liveStreamsApi.tail(streamId, lastId, true);
        
        if (response.data.bets.length > 0) {
          // Invalidate the query to trigger a fresh fetch
          queryClient.invalidateQueries({
            queryKey: ['live-bets-table', streamId]
          });
        }
      } catch (error) {
        console.error('Error polling for new bets:', error);
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [isPolling, pollingInterval, streamId, flatData, queryClient]);

  const table = useMantineReactTable({
    columns,
    data: flatData,
    enablePagination: false,
    enableRowNumbers: true,
    enableRowVirtualization: true,
    manualFiltering: true,
    manualSorting: true,
    mantineTableContainerProps: {
      ref: tableContainerRef,
      style: { 
        maxHeight: '600px',
        backgroundColor: 'hsl(222.2 84% 4.9%)', // Match card background
      },
      onScroll: (event: UIEvent<HTMLDivElement>) =>
        fetchMoreOnBottomReached(event.target as HTMLDivElement),
    },
    mantineTableProps: {
      style: {
        backgroundColor: 'hsl(222.2 84% 4.9%)',
        border: '1px solid hsl(217.2 32.6% 17.5%)',
        borderRadius: '0.5rem',
      },
    },
    mantineTableHeadProps: {
      style: {
        backgroundColor: 'hsl(210 40% 8%)',
      },
    },
    mantineTableBodyProps: {
      style: {
        backgroundColor: 'hsl(222.2 84% 4.9%)',
      },
    },
    mantineToolbarAlertBannerProps: isError
      ? {
          color: 'red',
          children: 'Error loading data',
        }
      : undefined,
    mantineTopToolbarProps: {
      style: {
        backgroundColor: 'hsl(222.2 84% 4.9%)',
        borderBottom: '1px solid hsl(217.2 32.6% 17.5%)',
      },
    },
    mantineBottomToolbarProps: {
      style: {
        backgroundColor: 'hsl(222.2 84% 4.9%)',
        borderTop: '1px solid hsl(217.2 32.6% 17.5%)',
      },
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    renderBottomToolbarCustomActions: () => (
      <Group>
        <Text size="sm" style={{ color: 'hsl(215.4 16.3% 46.9%)' }}>
          Fetched {totalFetched.toLocaleString()} of {totalDBRowCount.toLocaleString()} total bets
        </Text>
        {isPolling && (
          <Badge color="green" variant="dot" size="sm">
            Live
          </Badge>
        )}
      </Group>
    ),
    state: {
      columnFilters,
      globalFilter,
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isFetching,
      sorting,
    },
    rowVirtualizerInstanceRef,
    rowVirtualizerProps: { overscan: 10 },
  });

  return (
    <Stack>
      <MantineReactTable table={table} />
    </Stack>
  );
};

export default LiveBetsTable;