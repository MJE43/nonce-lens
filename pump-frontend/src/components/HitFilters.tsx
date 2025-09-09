import React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Using a button toggle for targets to sync with API min filter for parity

interface HitFiltersProps {
  minMultiplier: number | undefined;
  selectedTargets: number[];
  availableTargets: number[];
  onMinMultiplierChange: (value: number | undefined) => void;
  onResetFilters: () => void;
}

export const HitFilters: React.FC<HitFiltersProps> = ({
  minMultiplier,
  selectedTargets,
  availableTargets,
  onMinMultiplierChange,
  onResetFilters,
}) => {
  const handleMinMultiplierChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    const numValue = value ? parseFloat(value) : undefined;
    onMinMultiplierChange(numValue);
  };

  const hasActiveFilters =
    minMultiplier !== undefined || selectedTargets.length > 0;

  return (
    <div className="bg-background border-b border-border px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left side - Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Min Multiplier Filter */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="hitsMinMultiplier"
              className="text-sm font-medium text-muted-foreground"
            >
              Min Multiplier:
            </label>
            <Input
              id="hitsMinMultiplier"
              type="number"
              step="0.1"
              min="1"
              value={minMultiplier || ""}
              onChange={handleMinMultiplierChange}
              placeholder="All"
              className="w-24 h-8"
            />
          </div>

          {/* Target Checkboxes */}
          {availableTargets.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                Targets:
              </span>
              <div className="flex flex-wrap gap-2">
                {availableTargets.map((target) => (
                  <div key={target} className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Treat target checkbox as a shortcut to set min multiplier = target
                        // so results match server-side filtering (API parity).
                        onMinMultiplierChange(target);
                      }}
                      className={`h-9 inline-flex items-center rounded-md border px-2.5 text-sm transition-colors ${
                        selectedTargets.includes(target)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-input hover:bg-accent/40"
                      }`}
                    >
                      ≥{target}x
                    </button>
                    <label
                      htmlFor={`target-${target}`}
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      {/* Accessible name for the previous button */}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right side - Reset */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <XMarkIcon className="h-4 w-4" />
            Reset filters
          </Button>
        )}
      </div>
    </div>
  );
};
