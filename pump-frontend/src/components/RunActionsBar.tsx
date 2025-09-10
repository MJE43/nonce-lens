import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { runsApi } from "@/lib/api";

interface Run {
  id: string;
  server_seed: string;
  client_seed: string;
  nonce_start: number;
  nonce_end: number;
  difficulty: string;
  targets: number[];
}

interface RunActionsBarProps {
  run: Run;
  minMultiplier: number | undefined;
  onMinMultiplierChange: (value: number | undefined) => void;
  onJumpToNonce?: (nonce: number) => void;
}

export const RunActionsBar: React.FC<RunActionsBarProps> = ({
  run,
  minMultiplier,
  onMinMultiplierChange,
  onJumpToNonce,
}) => {
  const navigate = useNavigate();
  const [jumpToNonceValue, setJumpToNonceValue] = useState<string>("");

  const handleDuplicate = () => {
    const params = new URLSearchParams({
      server_seed: run.server_seed,
      client_seed: run.client_seed,
      start: run.nonce_start.toString(),
      end: run.nonce_end.toString(),
      difficulty: run.difficulty,
      targets: run.targets.join(","),
    });
    navigate(`/new?${params.toString()}`);
  };

  const handleDownload = (type: "hits" | "full") => {
    const url =
      type === "hits"
        ? runsApi.getHitsCsvUrl(run.id)
        : runsApi.getFullCsvUrl(run.id);
    window.open(url, "_blank");
  };

  const handleJumpToNonce = () => {
    const nonce = parseInt(jumpToNonceValue);
    if (isNaN(nonce) || nonce < run.nonce_start || nonce > run.nonce_end) {
      toast.error(
        `Nonce must be between ${run.nonce_start} and ${run.nonce_end}`
      );
      return;
    }

    if (onJumpToNonce) {
      onJumpToNonce(nonce);
      toast.success(`Jumping to nonce ${nonce.toLocaleString()}`);
    } else {
      toast.error("Jump to nonce functionality not yet implemented");
    }
  };

  const handleMinMultiplierChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    const numValue = value ? parseFloat(value) : undefined;
    onMinMultiplierChange(numValue);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${label} copied to clipboard`);
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4">
        {/* Left section - Primary Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            className="gap-2"
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
            Duplicate
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(run.server_seed, "Server seed")}
              className="gap-2"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              Copy Server
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(run.client_seed, "Client seed")}
              className="gap-2"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              Copy Client
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload("hits")}
              className="gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Hits CSV
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => handleDownload("full")}
              className="gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Full CSV
            </Button>
          </div>
        </div>

        {/* Right section - Filters and Navigation */}
        <div className="flex items-center gap-4">
          {/* Min Multiplier Filter */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="minMultiplier"
              className="text-sm font-medium text-muted-foreground whitespace-nowrap"
            >
              Min Multiplier:
            </label>
            <Input
              id="minMultiplier"
              type="number"
              step="0.1"
              min="1"
              value={minMultiplier || ""}
              onChange={handleMinMultiplierChange}
              placeholder="All"
              className="w-20 h-8"
            />
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Jump to Nonce */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="jumpToNonce"
              className="text-sm font-medium text-muted-foreground whitespace-nowrap"
            >
              Jump to Nonce:
            </label>
            <div className="flex gap-1">
              <Input
                id="jumpToNonce"
                type="number"
                min={run.nonce_start}
                max={run.nonce_end}
                value={jumpToNonceValue}
                onChange={(e) => setJumpToNonceValue(e.target.value)}
                placeholder={`${run.nonce_start}-${run.nonce_end}`}
                className="w-28 h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleJumpToNonce();
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleJumpToNonce}
                className="gap-1 h-8 px-2"
              >
                <MagnifyingGlassIcon className="h-3 w-3" />
                Go
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
