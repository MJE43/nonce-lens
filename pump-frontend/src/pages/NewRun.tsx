import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useCreateRun } from "../lib/hooks";

const NewRun = () => {
  const navigate = useNavigate();
  const createRunMutation = useCreateRun();

  const [formData, setFormData] = useState({
    server_seed: "",
    client_seed: "",
    start: 1,
    end: 1000,
    difficulty: "medium" as const,
    targets: "2,5,10,25,50,100",
  });

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

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const isSubmitting = createRunMutation.isPending;
  const rangeSize = formData.end - formData.start + 1;
  const estimatedTime =
    rangeSize > 100000 ? `~${Math.round(rangeSize / 20000)}s` : "< 5s";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">
            Create New Analysis Run
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Analyze Pump outcomes for a range of nonces with specified targets.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Server Seed */}
          <div>
            <label
              htmlFor="server_seed"
              className="block text-sm font-medium text-gray-700"
            >
              Server Seed
            </label>
            <textarea
              id="server_seed"
              rows={3}
              value={formData.server_seed}
              onChange={(e) => handleInputChange("server_seed", e.target.value)}
              placeholder="Enter the hex server seed..."
              className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm font-mono ${
                errors.server_seed
                  ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
            />
            {errors.server_seed && (
              <p className="mt-1 text-sm text-red-600">{errors.server_seed}</p>
            )}
          </div>

          {/* Client Seed */}
          <div>
            <label
              htmlFor="client_seed"
              className="block text-sm font-medium text-gray-700"
            >
              Client Seed
            </label>
            <input
              type="text"
              id="client_seed"
              value={formData.client_seed}
              onChange={(e) => handleInputChange("client_seed", e.target.value)}
              placeholder="Enter the client seed..."
              className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm font-mono ${
                errors.client_seed
                  ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
            />
            {errors.client_seed && (
              <p className="mt-1 text-sm text-red-600">{errors.client_seed}</p>
            )}
          </div>

          {/* Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="start"
                className="block text-sm font-medium text-gray-700"
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
                className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm ${
                  errors.start
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                }`}
              />
              {errors.start && (
                <p className="mt-1 text-sm text-red-600">{errors.start}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="end"
                className="block text-sm font-medium text-gray-700"
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
                className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm ${
                  errors.end
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                }`}
              />
              {errors.end && (
                <p className="mt-1 text-sm text-red-600">{errors.end}</p>
              )}
            </div>
          </div>

          {/* Range Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="text-sm text-blue-700">
              <strong>Range:</strong> {rangeSize.toLocaleString()} nonces
              <span className="ml-2">
                <strong>Estimated time:</strong> {estimatedTime}
              </span>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label
              htmlFor="difficulty"
              className="block text-sm font-medium text-gray-700"
            >
              Difficulty
            </label>
            <select
              id="difficulty"
              value={formData.difficulty}
              onChange={(e) => handleInputChange("difficulty", e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          {/* Targets */}
          <div>
            <label
              htmlFor="targets"
              className="block text-sm font-medium text-gray-700"
            >
              Target Multipliers
            </label>
            <input
              type="text"
              id="targets"
              value={formData.targets}
              onChange={(e) => handleInputChange("targets", e.target.value)}
              placeholder="2,5,10,25,50,100"
              className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm ${
                errors.targets
                  ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
            />
            <p className="mt-1 text-sm text-gray-500">
              Comma-separated list of multiplier thresholds (e.g.,
              2,5,10,25,50,100)
            </p>
            {errors.targets && (
              <p className="mt-1 text-sm text-red-600">{errors.targets}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Run"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewRun;
