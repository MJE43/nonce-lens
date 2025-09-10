import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveBetTable } from "../LiveBetTable";
import type { BetRecord } from "@/lib/api";

const mockBets: BetRecord[] = [
  {
    id: 1,
    antebot_bet_id: "bet1",
    received_at: "2024-01-01T10:00:00Z",
    nonce: 1000,
    amount: 0.1,
    payout_multiplier: 2.5,
    round_result: 2.5,
    payout: 0.25,
    difficulty: "medium",
    distance_prev_opt: null, // First occurrence
  },
  {
    id: 2,
    antebot_bet_id: "bet2",
    received_at: "2024-01-01T10:01:00Z",
    nonce: 1100,
    amount: 0.1,
    payout_multiplier: 3.0,
    round_result: 3.0,
    payout: 0.3,
    difficulty: "medium",
    distance_prev_opt: null, // First occurrence
  },
  {
    id: 3,
    antebot_bet_id: "bet3",
    received_at: "2024-01-01T10:02:00Z",
    nonce: 1200,
    amount: 0.1,
    payout_multiplier: 2.5,
    round_result: 2.5,
    payout: 0.25,
    difficulty: "medium",
    distance_prev_opt: 200, // 1200 - 1000 = 200
  },
];

const mockBookmarkedBets: BetRecord[] = [
  {
    ...mockBets[0],
    isBookmarked: true,
  },
  ...mockBets.slice(1),
];

describe("LiveBetTable - Enhanced Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Distance Column", () => {
    it("displays distance column header", () => {
      render(<LiveBetTable bets={mockBets} showDistanceColumn={true} />);

      expect(screen.getByText("Distance")).toBeInTheDocument();
    });

    it("shows distance values correctly", () => {
      render(<LiveBetTable bets={mockBets} showDistanceColumn={true} />);

      // First occurrence should show "—"
      const firstDistanceCell = screen.getAllByText("—")[0];
      expect(firstDistanceCell).toBeInTheDocument();

      // Third bet should show distance of 200
      expect(screen.getByText("200")).toBeInTheDocument();
    });

    it("hides distance column when showDistanceColumn is false", () => {
      render(<LiveBetTable bets={mockBets} showDistanceColumn={false} />);

      expect(screen.queryByText("Distance")).not.toBeInTheDocument();
    });

    it("calculates client-side distance when server distance not provided", () => {
      const betsWithoutDistance = mockBets.map((bet) => ({
        ...bet,
        distance_prev_opt: undefined,
      }));

      render(
        <LiveBetTable bets={betsWithoutDistance} showDistanceColumn={true} />
      );

      // Should calculate distance client-side
      expect(screen.getByText("200")).toBeInTheDocument();
    });
  });

  describe("Enhanced Filters", () => {
    it("shows pinned multipliers filter toggle", () => {
      render(<LiveBetTable bets={mockBets} pinnedMultipliers={[2.5, 3.0]} />);

      expect(screen.getByText("Show Only Pinned")).toBeInTheDocument();
    });

    it("filters by pinned multipliers when enabled", async () => {
      const mockOnFilter = vi.fn();

      render(
        <LiveBetTable
          bets={mockBets}
          pinnedMultipliers={[2.5]}
          onFilter={mockOnFilter}
        />
      );

      // Find the switch element instead of the label
      const showPinnedSwitch = screen.getByRole("switch");
      fireEvent.click(showPinnedSwitch);

      await waitFor(() => {
        expect(mockOnFilter).toHaveBeenCalledWith(
          expect.objectContaining({
            showOnlyPinned: true,
            pinnedMultipliers: [2.5],
          })
        );
      });
    });

    it("shows sort order selector", () => {
      render(<LiveBetTable bets={mockBets} />);

      expect(screen.getByText("Sort by:")).toBeInTheDocument();
      // Should have multiple comboboxes (difficulty + sort)
      expect(screen.getAllByRole("combobox")).toHaveLength(2);
    });

    it("supports nonce ascending sort", async () => {
      const mockOnSort = vi.fn();

      render(
        <LiveBetTable
          bets={mockBets}
          onSort={mockOnSort}
          sortField="round_result"
          sortDirection="desc"
        />
      );

      // Get the sort select (second combobox)
      const allSelects = screen.getAllByRole("combobox");
      const sortSelect = allSelects[1]; // Sort selector

      fireEvent.click(sortSelect);

      // Wait for dropdown to open and find the option
      await waitFor(() => {
        const nonceAscOption = screen.getByRole("option", {
          name: "Nonce (Asc)",
        });
        fireEvent.click(nonceAscOption);
      });

      await waitFor(() => {
        expect(mockOnSort).toHaveBeenCalledWith("nonce", "asc");
      });
    });

    it("supports id descending sort (latest first)", async () => {
      const mockOnSort = vi.fn();

      render(<LiveBetTable bets={mockBets} onSort={mockOnSort} />);

      // Get the sort select (second combobox)
      const allSelects = screen.getAllByRole("combobox");
      const sortSelect = allSelects[1]; // Sort selector

      fireEvent.click(sortSelect);
      // For Radix UI, we need to find the option and click it
      const latestFirstOption = screen.getByText("Latest First");
      fireEvent.click(latestFirstOption);

      await waitFor(() => {
        expect(mockOnSort).toHaveBeenCalledWith("id", "desc");
      });
    });

    it("shows filtered count indicator", () => {
      render(<LiveBetTable bets={mockBets} filters={{ minMultiplier: 3.0 }} />);

      // Should show "1 of 3 bets" since only one bet has multiplier >= 3.0
      expect(screen.getByText(/1 of 3 bets/)).toBeInTheDocument();
    });
  });

  describe("Bookmark Functionality", () => {
    it("shows bookmark stars for each row", () => {
      render(<LiveBetTable bets={mockBets} showBookmarks={true} />);

      // Should have star icon for each bet row
      const starIcons = screen.getAllByRole("button", { name: /bookmark/i });
      expect(starIcons).toHaveLength(mockBets.length);
    });

    it("calls onBookmark when star is clicked", async () => {
      const mockOnBookmark = vi.fn();

      render(
        <LiveBetTable
          bets={mockBets}
          showBookmarks={true}
          onBookmark={mockOnBookmark}
        />
      );

      const firstBookmarkButton = screen.getAllByRole("button", {
        name: /bookmark/i,
      })[0];
      fireEvent.click(firstBookmarkButton);

      await waitFor(() => {
        expect(mockOnBookmark).toHaveBeenCalledWith(mockBets[0]);
      });
    });

    it("shows bookmarked state visually", () => {
      render(<LiveBetTable bets={mockBookmarkedBets} showBookmarks={true} />);

      // First bet should show as bookmarked (filled star)
      const bookmarkedStar = screen.getAllByRole("button", {
        name: /bookmark/i,
      })[0];
      expect(bookmarkedStar).toHaveClass("bookmarked"); // Assuming this class is added
    });

    it("hides bookmark column when showBookmarks is false", () => {
      render(<LiveBetTable bets={mockBets} showBookmarks={false} />);

      expect(
        screen.queryByRole("button", { name: /bookmark/i })
      ).not.toBeInTheDocument();
    });

    it("calls onBookmark when star is clicked with ctrl key", async () => {
      const mockOnBookmark = vi.fn();

      render(
        <LiveBetTable
          bets={mockBets}
          showBookmarks={true}
          onBookmark={mockOnBookmark}
        />
      );

      const firstBookmarkButton = screen.getAllByRole("button", {
        name: /bookmark/i,
      })[0];

      // Ctrl+click for future note functionality
      fireEvent.click(firstBookmarkButton, { ctrlKey: true });

      await waitFor(() => {
        expect(mockOnBookmark).toHaveBeenCalledWith(mockBets[0]);
      });
    });
  });

  describe("Enhanced Table Props", () => {
    it("accepts highlightMultiplier prop", () => {
      render(<LiveBetTable bets={mockBets} highlightMultiplier={2.5} />);

      // Rows with multiplier 2.5 should be highlighted
      const highlightedRows = screen.getAllByTestId("highlighted-row");
      expect(highlightedRows).toHaveLength(2); // Two bets have 2.5 multiplier
    });

    it("supports distanceColumn prop", () => {
      render(<LiveBetTable bets={mockBets} distanceColumn={true} />);

      expect(screen.getByText("Distance")).toBeInTheDocument();
    });

    it("handles empty pinnedMultipliers array", () => {
      render(<LiveBetTable bets={mockBets} pinnedMultipliers={[]} />);

      // Should not show pinned filter when no multipliers are pinned
      expect(screen.queryByText("Show Only Pinned")).not.toBeInTheDocument();
    });
  });
});
