import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useCreateRun } from "../lib/hooks";

const NewRun = () => {
  const navigate = useNavigate();
  const createRunMutation = useCreateRun();
  const [searchParams] = useSearchParams();

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

  const [formData, setFormData] = useState({
    server_seed: "",
    client_seed: "",
    start: 1,
    end: 1000,
    difficulty: "medium" as const,
    targets: suggestionsFor("medium").join(","),
  });

  const [targetsTouched, setTargetsTouched] = useState(false);

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
        difficulty: (difficulty as any) || "medium",
        targets: targets || suggestionsFor(difficulty || "medium").join(","),
      });
    }
  }, [searchParams]);

  // Auto-apply suggested targets on difficulty change if user hasn't edited the field
  useEffect(() => {
    if (!targetsTouched) {
      setFormData((prev) => ({
        ...prev,
        targets: suggestionsFor(prev.difficulty).join(","),
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

    // Parse and validate targets
    const targetNumbers = formData.targets
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t)
      .map((t) => parseFloat(t))
      .filter((t) => !isNaN(t));

    if (targetNumbers.length === 0) {
      newErrors.targets = "At least one target is required";
    } else if (targetNumbers.some((t) => t <= 1)) {
      newErrors.targets = "All targets must be greater than 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Parse targets
    const targets = formData.targets
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t)
      .map((t) => parseFloat(t))
      .filter((t) => !isNaN(t));

    // Remove duplicates and sort
    const uniqueTargets = [...new Set(targets)].sort((a, b) => a - b);

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
      toast.error(
        error instanceof Error ? error.message : "Failed to create run"
      );
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
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
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div
          className="rounded-xl border shadow-lg overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div
            className="px-8 py-6 border-b"
            style={{
              backgroundColor: "var(--color-surface-secondary)",
              borderColor: "var(--color-border)",
            }}
          >
            <h1
              className="text-3xl font-semibold mb-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              Create New Analysis Run
            </h1>
            <p
              className="text-base leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Analyze Pump outcomes for a range of nonces with specified
              targets.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Server Seed */}
            <div className="form-group">
              <label
                htmlFor="server_seed"
                className="block font-medium mb-2"
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Server Seed
              </label>
              <textarea
                id="server_seed"
                rows={3}
                value={formData.server_seed}
                onChange={(e) =>
                  handleInputChange("server_seed", e.target.value)
                }
                placeholder="Enter the hex server seed..."
                className="block w-full font-mono resize-none"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: errors.server_seed
                    ? "var(--color-border-error)"
                    : "var(--color-border)",
                  borderRadius: "var(--border-radius-lg)",
                  padding: "var(--spacing-md)",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-primary)",
                  border: "1px solid",
                  transition: "all var(--transition-fast)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = errors.server_seed
                    ? "var(--color-border-error)"
                    : "var(--color-border-focus)";
                  e.target.style.boxShadow = errors.server_seed
                    ? "0 0 0 3px rgb(239 68 68 / 0.1)"
                    : "var(--shadow-focus)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.server_seed
                    ? "var(--color-border-error)"
                    : "var(--color-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
              {errors.server_seed && (
                <p
                  className="error-message mt-2"
                  style={{
                    color: "var(--color-error-600)",
                    fontSize: "var(--font-size-sm)",
                  }}
                >
                  {errors.server_seed}
                </p>
              )}
            </div>

            {/* Client Seed */}
            <div className="form-group">
              <label
                htmlFor="client_seed"
                className="block font-medium mb-2"
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Client Seed
              </label>
              <input
                type="text"
                id="client_seed"
                value={formData.client_seed}
                onChange={(e) =>
                  handleInputChange("client_seed", e.target.value)
                }
                placeholder="Enter the client seed..."
                className="block w-full font-mono"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: errors.client_seed
                    ? "var(--color-border-error)"
                    : "var(--color-border)",
                  borderRadius: "var(--border-radius-lg)",
                  padding: "var(--spacing-md)",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-primary)",
                  border: "1px solid",
                  transition: "all var(--transition-fast)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = errors.client_seed
                    ? "var(--color-border-error)"
                    : "var(--color-border-focus)";
                  e.target.style.boxShadow = errors.client_seed
                    ? "0 0 0 3px rgb(239 68 68 / 0.1)"
                    : "var(--shadow-focus)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.client_seed
                    ? "var(--color-border-error)"
                    : "var(--color-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
              {errors.client_seed && (
                <p
                  className="error-message mt-2"
                  style={{
                    color: "var(--color-error-600)",
                    fontSize: "var(--font-size-sm)",
                  }}
                >
                  {errors.client_seed}
                </p>
              )}
            </div>

            {/* Range */}
            <div className="form-group">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="start"
                    className="block font-medium mb-2"
                    style={{
                      color: "var(--color-text-primary)",
                      fontSize: "var(--font-size-sm)",
                    }}
                  >
                    Start Nonce
                  </label>
                  <input
                    type="number"
                    id="start"
                    min="1"
                    value={formData.start}
                    onChange={(e) =>
                      handleInputChange("start", parseInt(e.target.value) || 1)
                    }
                    className="block w-full"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      borderColor: errors.start
                        ? "var(--color-border-error)"
                        : "var(--color-border)",
                      borderRadius: "var(--border-radius-lg)",
                      padding: "var(--spacing-md)",
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-primary)",
                      border: "1px solid",
                      transition: "all var(--transition-fast)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = errors.start
                        ? "var(--color-border-error)"
                        : "var(--color-border-focus)";
                      e.target.style.boxShadow = errors.start
                        ? "0 0 0 3px rgb(239 68 68 / 0.1)"
                        : "var(--shadow-focus)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.start
                        ? "var(--color-border-error)"
                        : "var(--color-border)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  {errors.start && (
                    <p
                      className="error-message mt-2"
                      style={{
                        color: "var(--color-error-600)",
                        fontSize: "var(--font-size-sm)",
                      }}
                    >
                      {errors.start}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="end"
                    className="block font-medium mb-2"
                    style={{
                      color: "var(--color-text-primary)",
                      fontSize: "var(--font-size-sm)",
                    }}
                  >
                    End Nonce
                  </label>
                  <input
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
                    className="block w-full"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      borderColor: errors.end
                        ? "var(--color-border-error)"
                        : "var(--color-border)",
                      borderRadius: "var(--border-radius-lg)",
                      padding: "var(--spacing-md)",
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-primary)",
                      border: "1px solid",
                      transition: "all var(--transition-fast)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = errors.end
                        ? "var(--color-border-error)"
                        : "var(--color-border-focus)";
                      e.target.style.boxShadow = errors.end
                        ? "0 0 0 3px rgb(239 68 68 / 0.1)"
                        : "var(--shadow-focus)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.end
                        ? "var(--color-border-error)"
                        : "var(--color-border)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  {errors.end && (
                    <p
                      className="error-message mt-2"
                      style={{
                        color: "var(--color-error-600)",
                        fontSize: "var(--font-size-sm)",
                      }}
                    >
                      {errors.end}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Range Info */}
            <div
              className="rounded-lg p-4 border"
              style={{
                backgroundColor: "var(--color-primary-50)",
                borderColor: "var(--color-primary-200)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6"
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-primary-700)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Range:</span>
                  <span className="font-mono">
                    {rangeSize.toLocaleString()} nonces
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Estimated time:</span>
                  <span className="font-mono">{estimatedTime}</span>
                </div>
              </div>
            </div>

            {/* Difficulty */}
            <div className="form-group">
              <label
                htmlFor="difficulty"
                className="block font-medium mb-2"
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Difficulty
              </label>
              <select
                id="difficulty"
                value={formData.difficulty}
                onChange={(e) =>
                  handleInputChange("difficulty", e.target.value)
                }
                className="block w-full"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--border-radius-lg)",
                  padding: "var(--spacing-md)",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-primary)",
                  border: "1px solid",
                  transition: "all var(--transition-fast)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-border-focus)";
                  e.target.style.boxShadow = "var(--shadow-focus)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)";
                  e.target.style.boxShadow = "none";
                }}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            {/* Targets */}
            <div className="form-group">
              <label
                htmlFor="targets"
                className="block font-medium mb-2"
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Target Multipliers
              </label>
              <input
                type="text"
                id="targets"
                value={formData.targets}
                onChange={(e) => handleInputChange("targets", e.target.value)}
                placeholder="2,5,10,25,50,100"
                className="block w-full"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: errors.targets
                    ? "var(--color-border-error)"
                    : "var(--color-border)",
                  borderRadius: "var(--border-radius-lg)",
                  padding: "var(--spacing-md)",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-primary)",
                  border: "1px solid",
                  transition: "all var(--transition-fast)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = errors.targets
                    ? "var(--color-border-error)"
                    : "var(--color-border-focus)";
                  e.target.style.boxShadow = errors.targets
                    ? "0 0 0 3px rgb(239 68 68 / 0.1)"
                    : "var(--shadow-focus)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.targets
                    ? "var(--color-border-error)"
                    : "var(--color-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <p
                className="mt-2"
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                Comma-separated list of multiplier thresholds (e.g.,
                2,5,10,25,50,100)
              </p>
              {/* Suggestions helper */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const suggestion = suggestionsFor(formData.difficulty).join(
                      ","
                    );
                    setFormData((prev) => ({ ...prev, targets: suggestion }));
                    setTargetsTouched(true);
                  }}
                  className="px-3 py-1 rounded-md text-sm"
                  style={{
                    backgroundColor: "var(--color-primary-50)",
                    color: "var(--color-primary-700)",
                    border: "1px solid var(--color-primary-200)",
                  }}
                >
                  Use {formData.difficulty} suggestions
                </button>
                <span
                  className="text-xs"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {suggestionsFor(formData.difficulty).slice(0, 8).join(", ")}
                  {suggestionsFor(formData.difficulty).length > 8 ? ", …" : ""}
                </span>
              </div>
              {errors.targets && (
                <p
                  className="error-message mt-2"
                  style={{
                    color: "var(--color-error-600)",
                    fontSize: "var(--font-size-sm)",
                  }}
                >
                  {errors.targets}
                </p>
              )}
            </div>

            {/* Actions */}
            <div
              className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t"
              style={{ borderColor: "var(--color-border)" }}
            >
              <button
                type="button"
                onClick={() => navigate("/")}
                className="px-6 py-3 border rounded-lg font-medium transition-all duration-200 min-h-[44px]"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                  fontSize: "var(--font-size-sm)",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor =
                    "var(--color-surface-secondary)";
                  e.target.style.borderColor = "var(--color-border-secondary)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "var(--color-surface)";
                  e.target.style.borderColor = "var(--color-border)";
                }}
                onFocus={(e) => {
                  e.target.style.outline = "none";
                  e.target.style.boxShadow = "var(--shadow-focus)";
                  e.target.style.borderColor = "var(--color-border-focus)";
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = "none";
                  e.target.style.borderColor = "var(--color-border)";
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 border border-transparent rounded-lg font-medium transition-all duration-200 min-h-[44px]"
                style={{
                  backgroundColor: "var(--color-primary-600)",
                  color: "var(--color-text-inverse)",
                  fontSize: "var(--font-size-sm)",
                  opacity: isSubmitting ? "0.6" : "1",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.target.style.backgroundColor = "var(--color-primary-700)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    e.target.style.backgroundColor = "var(--color-primary-600)";
                  }
                }}
                onFocus={(e) => {
                  e.target.style.outline = "none";
                  e.target.style.boxShadow = "var(--shadow-focus)";
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = "none";
                }}
              >
                {isSubmitting ? "Creating..." : "Create Run"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewRun;
