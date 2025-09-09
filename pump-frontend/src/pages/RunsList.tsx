import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRuns } from "../lib/hooks";
import {
  getPendingRuns,
  clearStalePending,
  removePendingRun,
  findMatchingRunId,
} from "../lib/pending";
import { Plus, Calendar, TrendingUp } from "lucide-react";

// ShadCN Components - importing one by one
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RunsList = () => {
  const [search] = useState("");
  const [difficulty] = useState("");
  const [page] = useState(0);
  const limit = 50;

  const { data, isLoading, error, refetch } = useRuns({
    search: search || undefined,
    difficulty: difficulty || undefined,
    limit,
    offset: page * limit,
  });

  const [pending, setPending] = useState(getPendingRuns());

  // Keep pending store tidy
  useEffect(() => {
    clearStalePending();
    setPending(getPendingRuns());
  }, []);

  // While there are pending runs, poll the runs list to discover completion
  useEffect(() => {
    if (pending.length === 0) return;
    const id = setInterval(async () => {
      const res = await refetch();
      const runs = res.data?.runs || [];
      let changed = false;
      pending.forEach((p) => {
        const matchId = findMatchingRunId(runs, {
          client_seed: p.client_seed,
          difficulty: p.difficulty,
          start: p.start,
          end: p.end,
        });
        if (matchId) {
          removePendingRun(p.id);
          changed = true;
        }
      });
      if (changed) setPending(getPendingRuns());
    }, 2000);
    return () => clearInterval(id);
  }, [pending, refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
        <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 text-lg">Loading analysis runs...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
        <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
          <Card className="bg-red-900/20 border-red-500/50 max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-red-400">Error Loading Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-300">{error.message}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const runs = data?.runs || [];
  const total = data?.total || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Analysis Runs
            </h1>
            <div className="flex items-center gap-4 text-slate-400">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>{total} total runs</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Pump Analysis Engine</span>
              </div>
            </div>
          </div>
          <Button
            asChild
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg"
          >
            <Link to="/new">
              <Plus className="w-4 h-4 mr-2" />
              New Analysis Run
            </Link>
          </Button>
        </div>

        {/* Processing jobs */}
        {pending.length > 0 && (
          <Card className="bg-amber-900/20 border-amber-500/40">
            <CardHeader>
              <CardTitle className="text-amber-300">Processing Jobs</CardTitle>
              <CardDescription className="text-amber-200/80">
                These runs are processing on the server. This list will update
                automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pending.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 bg-amber-900/20 rounded-lg border border-amber-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-amber-100 font-mono text-sm">
                          {p.client_seed}
                        </p>
                        <p className="text-amber-200/80 text-xs capitalize">
                          {p.difficulty} · {p.start.toLocaleString()} -{" "}
                          {p.end.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-amber-200">
                        <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
                        Processing…
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Simple results for now */}
        <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Runs ({runs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400 mb-4">No runs found</p>
                <Button asChild>
                  <Link to="/new">Create Your First Run</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="p-4 bg-slate-900/50 rounded-lg border border-slate-600/50"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-mono text-sm">
                          {run.client_seed}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {run.difficulty}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/runs/${run.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RunsList;
