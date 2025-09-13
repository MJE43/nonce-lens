import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Hash, Key, Download, Edit3, Save, Trash2 } from "lucide-react";

// A specific type for the stream detail to avoid dependency on the full API type
interface StreamDetail {
  server_seed_hashed: string;
  client_seed: string;
  total_bets: number;
  highest_multiplier?: number | null;
  created_at: string;
  last_seen_at: string;
  notes?: string | null;
}

interface StreamInfoCardProps {
  streamDetail: StreamDetail;
  highFrequencyMode: boolean;
  isEditingNotes: boolean;
  notesValue: string;
  onNotesValueChange: (value: string) => void;
  onEditNotes: () => void;
  onSaveNotes: () => void;
  onCancelEditNotes: () => void;
  onExportCsv: () => void;
  onDeleteStream: () => void;
  isSavingNotes: boolean;
  isDeletingStream: boolean;
  hasBets: boolean;
}

const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
};

const formatSeedPrefix = (hash: string) => {
    return hash.substring(0, 16) + "...";
};

export const StreamInfoCard = ({
  streamDetail,
  highFrequencyMode,
  isEditingNotes,
  notesValue,
  onNotesValueChange,
  onEditNotes,
  onSaveNotes,
  onCancelEditNotes,
  onExportCsv,
  onDeleteStream,
  isSavingNotes,
  isDeletingStream,
  hasBets,
}: StreamInfoCardProps) => {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-primary" />
            Stream Information
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-green-600">
              <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></div>
              <span className="text-sm font-medium">Live</span>
              {highFrequencyMode && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                  HF
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              disabled={!hasBets}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            {!isEditingNotes ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onEditNotes}
                className="gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit Notes
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={onSaveNotes}
                disabled={isSavingNotes}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {isSavingNotes ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seed Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Hash className="w-4 h-4" />
              Server Seed Hash
            </Label>
            <div className="font-mono text-sm bg-muted p-3 rounded-md border">
              <span>
                {formatSeedPrefix(streamDetail.server_seed_hashed)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Key className="w-4 h-4" />
              Client Seed
            </Label>
            <div className="font-mono text-sm bg-muted p-3 rounded-md border">
              <span>{streamDetail.client_seed}</span>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg border">
            <div className="text-2xl font-bold">
              {streamDetail.total_bets.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              Total Bets
            </div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg border">
            <div className="text-2xl font-bold text-orange-600">
              {streamDetail.highest_multiplier?.toFixed(2) || "0.00"}x
            </div>
            <div className="text-sm text-muted-foreground">
              Highest Multiplier
            </div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg border">
            <div className="text-2xl font-bold text-blue-400">
              {formatTimestamp(streamDetail.created_at).split(",")[0]}
            </div>
            <div className="text-sm text-muted-foreground">Created</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg border">
            <div className="text-2xl font-bold text-green-400">
              {formatTimestamp(streamDetail.last_seen_at).split(",")[1]}
            </div>
            <div className="text-sm text-muted-foreground">Last Seen</div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300">Notes</Label>
            {!isEditingNotes ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditNotes}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSaveNotes}
                  disabled={isSavingNotes}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancelEditNotes}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          {isEditingNotes ? (
            <Textarea
              value={notesValue}
              onChange={(e) => onNotesValueChange(e.target.value)}
              placeholder="Add notes about this stream..."
              className="bg-slate-900/50 border-slate-700 text-slate-300"
              rows={3}
            />
          ) : (
            <div className="bg-slate-900/50 p-3 rounded border border-slate-700 min-h-[80px]">
              <span className="text-slate-300">
                {streamDetail.notes || "No notes added"}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={onExportCsv}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Stream
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-800 border-slate-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  Delete Stream
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-300">
                  This will permanently delete the stream and all
                  associated bet data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-700 text-slate-300 border-slate-600">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDeleteStream}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isDeletingStream}
                >
                  {isDeletingStream
                    ? "Deleting..."
                    : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};
