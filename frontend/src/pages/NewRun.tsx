import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useCreateRun } from "../lib/hooks";
import { runsApi, getErrorDetails } from "../lib/api";
import {
  addPendingRun,
  removePendingRun,
  findMatchingRunId,
} from "../lib/pending";
import {
  Calculator,
  Zap,
  Target,
  Clock,
  Sparkles,
  Check,
  ChevronsUpDown,
  X,
} from "lucide-react";

// ShadCN Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NewRun = () => {
  const navigate = useNavigate();
  const createRunMutation = useCreateRun();
  const [searchParams] = useSearchParams();
  const pollTimer = useRef<number | null>(null);
  const [processing, setProcessing] = useState<{
    pendingId: string;
    message: string;
  } | null>(null);

  // Difficulty-aware suggested target multipliers (exact table values per PRD)
  const DIFFICULTY_SUGGESTIONS: Record<
    "easy" | "medium" | "hard" | "expert",
    number[]
  > = {
    easy: [
      1.02, 1.11, 1.29, 1.53, 1.75, 2.0, 2.43, 3.05, 3.5, 4.08, 5.0, 6.25, 8.0,
      12.25, 24.5,
    ],
    medium: [
      1.11, 1.46, 1.69, 1.98, 2.33, 2.76, 3.31, 4.03, 4.95, 7.87, 10.25, 13.66,
      18.78, 26.83, 38.76, 64.4, 112.7, 225.4, 563.5, 2254.0,
    ],
    hard: [
      1.23, 1.55, 1.98, 2.56, 3.36, 4.48, 6.08, 8.41, 11.92, 17.0, 26.01, 40.49,
      65.74, 112.7, 206.62, 413.23, 929.77, 2479.4, 8677.9, 52067.4,
    ],
    expert: [
      1.63, 2.8, 4.95, 9.08, 17.34, 34.68, 73.21, 164.72, 400.02, 1066.73,
      3200.18, 11200.65, 48536.13, 291216.8, 3203384.8,
    ],
  };

  const suggestionsFor = (difficulty: string) =>
    DIFFICULTY_SUGGESTIONS[
      (difficulty as "easy" | "medium" | "hard" | "expert") || "medium"
    ];

  const [formData, setFormData] = useState<{
    server_seed: string;
    client_seed: string;
    start: number;
    end: number;
    difficulty: "easy" | "medium" | "hard" | "expert";
    targets: number[];
  }>({
    server_seed: "",
    client_seed: "",
    start: 1,
    end: 1000,
    difficulty: "medium" as "easy" | "medium" | "hard" | "expert",
    targets: [], // Start with no targets selected
  });

  const [targetsTouched, setTargetsTouched] = useState(false);
  const [targetsPopoverOpen, setTargetsPopoverOpen] = useState(false);

  // Pre-fill form from URL parameters (for duplicate functionality)
  useEffect(() => {
    const server_seed = searchParams.get("server_seed");
    const client_seed = searchParams.get("client_seed");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const difficulty = searchParams.get("difficulty");
    const targets = searchParams.get("targets");

    if (server_seed || client_seed || start || end || difficulty || targets) {
      setFormData({
        server_seed: server_seed || "",
        client_seed: client_seed || "",
        start: start ? parseInt(start) : 1,
        end: end ? parseInt(end) : 1000,
        difficulty:
          (difficulty as "easy" | "medium" | "hard" | "expert") || "medium",
        targets: targets
          ? targets
              .split(",")
              .map((t) => parseFloat(t.trim()))
              .filter((t) => !isNaN(t))
          : [],
      });
    }
  }, [searchParams]);

  // Clear targets when difficulty changes if user hasn't manually selected any
  useEffect(() => {
    if (!targetsTouched) {
      setFormData((prev) => ({
        ...prev,
        targets: [],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.difficulty]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.server_seed.trim()) {
      newErrors.server_seed = "Server seed is required";
    }

    if (!formData.client_seed.trim()) {
      newErrors.client_seed = "Client seed is required";
    }

    if (formData.start < 1) {
      newErrors.start = "Start must be at least 1";
    }

    if (formData.end < formData.start) {
      newErrors.end = "End must be greater than or equal to start";
    }

    if (formData.end - formData.start + 1 > 1000000) {
      newErrors.end = "Range cannot exceed 1M nonces";
    }

    // Validate targets array
    if (formData.targets.length === 0) {
      newErrors.targets = "At least one target is required";
    } else if (formData.targets.some((t) => t <= 1)) {
      newErrors.targets = "All targets must be greater than 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Remove duplicates and sort
    const uniqueTargets = [...new Set(formData.targets)].sort((a, b) => a - b);

    try {
      const result = await createRunMutation.mutateAsync({
        server_seed: formData.server_seed.trim(),
        client_seed: formData.client_seed.trim(),
        start: formData.start,
        end: formData.end,
        difficulty: formData.difficulty,
        targets: uniqueTargets,
      });

      toast.success("Analysis run created successfully!");
      navigate(`/runs/${result.id}`);
    } catch (error) {
      const details = getErrorDetails(error);
      if (details?.type === "timeout") {
        // Register a pending run locally and start polling the runs list
        const pending = addPendingRun({
          server_seed: formData.server_seed.trim(),
          client_seed: formData.client_seed.trim(),
          start: formData.start,
          end: formData.end,
          difficulty: formData.difficulty,
          targets: uniqueTargets,
        });

        setProcessing({
          pendingId: pending.id,
          message: "Processing on server…",
        });

        // Poll every 2s for up to 10 minutes
        const started = Date.now();
        const poll = async () => {
          try {
            const res = await runsApi
              .list({
                search: formData.client_seed,
                difficulty: formData.difficulty,
              })
              .then((r) => r.data);
            const id = findMatchingRunId(res.runs || [], {
              client_seed: formData.client_seed.trim(),
              difficulty: formData.difficulty,
              start: formData.start,
              end: formData.end,
            });
            if (id) {
              removePendingRun(pending.id);
              setProcessing(null);
              toast.success("Run completed!");
              navigate(`/runs/${id}`);
              return;
            }
          } catch {
            // ignore transient errors
          }
          if (Date.now() - started < 10 * 60 * 1000) {
            pollTimer.current = window.setTimeout(poll, 2000);
          } else {
            setProcessing(null);
            toast.error("Timed out waiting for run to complete.");
          }
        };
        poll();
        return;
      }

      toast.error(
        error instanceof Error ? error.message : "Failed to create run"
      );
    }
  };

  const handleInputChange = (
    field: string,
    value: string | number | number[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (field === "targets") {
      setTargetsTouched(true);
    }
    if (field === "difficulty") {
      // Reset touched state so suggestions can apply for newly chosen difficulty
      setTargetsTouched(false);
    }
  };

  const isSubmitting = createRunMutation.isPending;
  const rangeSize = formData.end - formData.start + 1;
  const estimatedTime =
    rangeSize > 100000 ? `~${Math.round(rangeSize / 20000)}s` : "< 5s";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-5xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-blue-500/20">
            <Sparkles className="w-4 h-4" />
            Pump Analysis Engine
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Create New
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              {" "}
              Analysis Run
            </span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Analyze Pump outcomes for a range of nonces with specified targets
            using our provably-fair deterministic engine.
          </p>
        </div>

        {/* Processing Overlay */}
        {processing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-8 max-w-md w-full text-center backdrop-blur">
              <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-white text-xl font-semibold mb-2">
                Creating analysis run…
              </h2>
              <p className="text-slate-300 mb-6">
                {processing.message} This page will redirect once complete.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  className="bg-slate-800/50 border-slate-600/50 text-slate-300"
                >
                  <a href="/">Go to Runs</a>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Form Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 px-8 py-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Analysis Configuration
                </h2>
                <p className="text-slate-400 text-sm">
                  Set up your pump analysis parameters
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Server Seed */}
            <div className="space-y-3">
              <Label
                htmlFor="server_seed"
                className="flex items-center gap-2 text-slate-300"
              >
                <div className="w-5 h-5 bg-emerald-500/20 rounded flex items-center justify-center">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                </div>
                Server Seed
              </Label>
              <div className="relative">
                <textarea
                  id="server_seed"
                  rows={3}
                  value={formData.server_seed}
                  onChange={(e) =>
                    handleInputChange("server_seed", e.target.value)
                  }
                  placeholder="Enter the hex server seed (e.g., 564e967b90f03d0153fdcb2d2d1cc5a5057e0df78163611fe3801d6498e681ca)"
                  className={cn(
                    "w-full min-h-[80px] bg-slate-900/50 border rounded-xl px-4 py-3 text-slate-100 font-mono text-sm resize-none transition-all duration-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50",
                    errors.server_seed
                      ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50"
                      : "border-slate-600/50 hover:border-slate-500/50"
                  )}
                />
              </div>
              {errors.server_seed && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                  </div>
                  {errors.server_seed}
                </div>
              )}
            </div>

            {/* Client Seed */}
            <div className="space-y-3">
              <Label
                htmlFor="client_seed"
                className="flex items-center gap-2 text-slate-300"
              >
                <div className="w-5 h-5 bg-purple-500/20 rounded flex items-center justify-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full" />
                </div>
                Client Seed
              </Label>
              <Input
                id="client_seed"
                value={formData.client_seed}
                onChange={(e) =>
                  handleInputChange("client_seed", e.target.value)
                }
                placeholder="Enter the client seed (e.g., zXv1upuFns)"
                className={cn(
                  "bg-slate-900/50 border-slate-600/50 text-slate-100 font-mono placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/50",
                  errors.client_seed &&
                    "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50"
                )}
              />
              {errors.client_seed && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                  </div>
                  {errors.client_seed}
                </div>
              )}
            </div>

            {/* Range Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <div className="w-5 h-5 bg-blue-500/20 rounded flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-400 rounded-full" />
                </div>
                Nonce Range
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="start" className="text-slate-400">
                    Start Nonce
                  </Label>
                  <Input
                    type="number"
                    id="start"
                    min="1"
                    value={formData.start}
                    onChange={(e) =>
                      handleInputChange("start", parseInt(e.target.value) || 1)
                    }
                    className={cn(
                      "bg-slate-900/50 border-slate-600/50 text-slate-100 focus:border-blue-500/50 focus:ring-blue-500/50",
                      errors.start &&
                        "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50"
                    )}
                  />
                  {errors.start && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                      </div>
                      {errors.start}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="end" className="text-slate-400">
                    End Nonce
                  </Label>
                  <Input
                    type="number"
                    id="end"
                    min={formData.start}
                    value={formData.end}
                    onChange={(e) =>
                      handleInputChange(
                        "end",
                        parseInt(e.target.value) || formData.start
                      )
                    }
                    className={cn(
                      "bg-slate-900/50 border-slate-600/50 text-slate-100 focus:border-blue-500/50 focus:ring-blue-500/50",
                      errors.end &&
                        "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50"
                    )}
                  />
                  {errors.end && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                      </div>
                      {errors.end}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Range Info */}
            <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Calculator className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">
                      Range
                    </div>
                    <div className="text-sm font-mono text-blue-300 font-medium">
                      {rangeSize.toLocaleString()} nonces
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">
                      Estimated Time
                    </div>
                    <div className="text-sm font-mono text-emerald-300 font-medium">
                      {estimatedTime}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-slate-300">
                <div className="w-5 h-5 bg-amber-500/20 rounded flex items-center justify-center">
                  <Zap className="w-3 h-3 text-amber-400" />
                </div>
                Difficulty Level
              </Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value) =>
                  handleInputChange("difficulty", value)
                }
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-600/50 text-slate-100 focus:border-blue-500/50 focus:ring-blue-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem
                    value="easy"
                    className="text-slate-100 focus:bg-slate-700"
                  >
                    Easy
                  </SelectItem>
                  <SelectItem
                    value="medium"
                    className="text-slate-100 focus:bg-slate-700"
                  >
                    Medium
                  </SelectItem>
                  <SelectItem
                    value="hard"
                    className="text-slate-100 focus:bg-slate-700"
                  >
                    Hard
                  </SelectItem>
                  <SelectItem
                    value="expert"
                    className="text-slate-100 focus:bg-slate-700"
                  >
                    Expert
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Targets */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2 text-slate-300">
                <div className="w-5 h-5 bg-pink-500/20 rounded flex items-center justify-center">
                  <Target className="w-3 h-3 text-pink-400" />
                </div>
                Target Multipliers
              </Label>

              {/* Multi-select dropdown */}
              <Popover
                open={targetsPopoverOpen}
                onOpenChange={setTargetsPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={targetsPopoverOpen}
                    className={cn(
                      "w-full justify-between bg-slate-900/50 border-slate-600/50 text-slate-100 hover:bg-slate-800/50 focus:border-blue-500/50 focus:ring-blue-500/50 min-h-[60px] h-auto",
                      errors.targets &&
                        "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50"
                    )}
                  >
                    <div className="flex flex-wrap gap-1 max-w-full">
                      {formData.targets.length === 0 ? (
                        <span className="text-slate-500">
                          Select target multipliers...
                        </span>
                      ) : (
                        formData.targets.slice(0, 6).map((target) => (
                          <Badge
                            key={target}
                            variant="secondary"
                            className="bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30"
                          >
                            {target}x
                            <button
                              type="button"
                              className="ml-1 hover:bg-blue-500/40 rounded-full p-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInputChange(
                                  "targets",
                                  formData.targets.filter((t) => t !== target)
                                );
                              }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                      {formData.targets.length > 6 && (
                        <Badge
                          variant="secondary"
                          className="bg-slate-700 text-slate-300"
                        >
                          +{formData.targets.length - 6} more
                        </Badge>
                      )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[400px] p-0 bg-slate-800 border-slate-700"
                  side="bottom"
                  align="start"
                >
                  <Command className="bg-slate-800">
                    <CommandInput
                      placeholder="Search multipliers..."
                      className="bg-slate-800 text-slate-100 placeholder:text-slate-500"
                    />
                    <CommandEmpty className="text-slate-400 py-6 text-center">
                      No multipliers found.
                    </CommandEmpty>
                    <CommandList className="max-h-64">
                      <CommandGroup>
                        {suggestionsFor(formData.difficulty).map(
                          (multiplier) => (
                            <CommandItem
                              key={multiplier}
                              value={multiplier.toString()}
                              onSelect={() => {
                                const isSelected =
                                  formData.targets.includes(multiplier);
                                if (isSelected) {
                                  handleInputChange(
                                    "targets",
                                    formData.targets.filter(
                                      (t) => t !== multiplier
                                    )
                                  );
                                } else {
                                  handleInputChange("targets", [
                                    ...formData.targets,
                                    multiplier,
                                  ]);
                                }
                                setTargetsTouched(true);
                              }}
                              className="text-slate-100 hover:bg-slate-700 data-[selected]:bg-slate-700"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.targets.includes(multiplier)
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <span className="font-mono">{multiplier}x</span>
                              <span className="ml-auto text-xs text-slate-400">
                                multiplier
                              </span>
                            </CommandItem>
                          )
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Select multiplier thresholds for {formData.difficulty}{" "}
                  difficulty
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleInputChange(
                      "targets",
                      suggestionsFor(formData.difficulty)
                    );
                    setTargetsTouched(true);
                  }}
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Use all {formData.difficulty} suggestions
                </Button>
              </div>

              {formData.targets.length > 0 && (
                <div className="bg-slate-900/30 border border-slate-700/50 rounded-xl p-4">
                  <div className="text-xs text-slate-400 mb-2">
                    Selected targets ({formData.targets.length}):
                  </div>
                  <div className="text-xs text-slate-300 font-mono leading-relaxed">
                    {formData.targets.sort((a, b) => a - b).join(", ")}
                  </div>
                </div>
              )}

              {errors.targets && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                  </div>
                  {errors.targets}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-slate-700/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
                className="bg-slate-800/50 border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg min-w-[140px]",
                  isSubmitting
                    ? "opacity-70 cursor-not-allowed"
                    : "hover:from-blue-500 hover:to-purple-500 hover:shadow-xl"
                )}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Run
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewRun;
