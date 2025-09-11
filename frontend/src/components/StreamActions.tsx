import { useState } from 'react';
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
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  AlertTriangle,
  FileText,
  ExternalLink 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { liveStreamsApi, type StreamDetail } from '@/lib/api';

interface StreamActionsProps {
  stream: StreamDetail;
  onStreamUpdate?: (updatedStream: StreamDetail) => void;
  onStreamDelete?: (streamId: string) => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

interface ActionState {
  isLoading: boolean;
  error?: string;
}

/**
 * Stream management actions component
 * Implements export, delete, and note management actions
 * Includes confirmation dialogs for destructive operations
 * Requirements: 6.1, 6.2, 6.4
 */
export function StreamActions({
  stream,
  onStreamUpdate,
  onStreamDelete,
  onError,
  onSuccess,
  disabled = false,
  className,
}: StreamActionsProps) {
  const [deleteState, setDeleteState] = useState<ActionState>({ isLoading: false });
  const [updateState, setUpdateState] = useState<ActionState>({ isLoading: false });
  const [exportState, setExportState] = useState<ActionState>({ isLoading: false });
  
  const [, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(stream.notes || '');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);

  // Handle CSV export
  const handleExport = async () => {
    try {
      setExportState({ isLoading: true });
      
      // Create download link
      const exportUrl = liveStreamsApi.getExportCsvUrl(stream.id);
      
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = exportUrl;
      link.download = `stream-${stream.id}-bets.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      onSuccess?.('CSV export started successfully');
      setExportState({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      setExportState({ isLoading: false, error: errorMessage });
      onError?.(errorMessage);
    }
  };

  // Handle stream deletion
  const handleDelete = async () => {
    try {
      setDeleteState({ isLoading: true });
      
      await liveStreamsApi.delete(stream.id);
      
      onStreamDelete?.(stream.id);
      onSuccess?.('Stream deleted successfully');
      setIsDeleteDialogOpen(false);
      setDeleteState({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      setDeleteState({ isLoading: false, error: errorMessage });
      onError?.(errorMessage);
    }
  };

  // Handle notes update
  const handleNotesUpdate = async () => {
    try {
      setUpdateState({ isLoading: true });
      
      const response = await liveStreamsApi.update(stream.id, { 
        notes: notesValue.trim() || undefined 
      });
      
      onStreamUpdate?.(response.data);
      onSuccess?.('Notes updated successfully');
      setIsNotesDialogOpen(false);
      setIsEditingNotes(false);
      setUpdateState({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      setUpdateState({ isLoading: false, error: errorMessage });
      onError?.(errorMessage);
    }
  };

  // Reset notes dialog state
  const handleNotesDialogClose = () => {
    setNotesValue(stream.notes || '');
    setIsNotesDialogOpen(false);
    setIsEditingNotes(false);
    setUpdateState({ isLoading: false });
  };

  // Format stream info for delete confirmation
  const formatStreamInfo = () => {
    const seedPrefix = stream.server_seed_hashed.substring(0, 10);
    return `${seedPrefix}... / ${stream.client_seed}`;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Export Action */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={disabled || exportState.isLoading}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        {exportState.isLoading ? 'Exporting...' : 'Export CSV'}
      </Button>

      {/* Notes Management */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="gap-2"
            onClick={() => {
              setNotesValue(stream.notes || '');
              setIsNotesDialogOpen(true);
            }}
          >
            <Edit3 className="h-4 w-4" />
            Notes
            {stream.notes && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                ✓
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Stream Notes
            </DialogTitle>
            <DialogDescription>
              Add notes or comments for stream {formatStreamInfo()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about this stream..."
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                className="min-h-24 resize-none"
                disabled={updateState.isLoading}
              />
              <div className="text-xs text-muted-foreground">
                {notesValue.length}/500 characters
              </div>
            </div>

            {updateState.error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {updateState.error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleNotesDialogClose}
              disabled={updateState.isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleNotesUpdate}
              disabled={updateState.isLoading || notesValue.length > 500}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateState.isLoading ? 'Saving...' : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Action with Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Stream
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete this stream? This action cannot be undone.
              </p>
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div className="font-medium">Stream Details:</div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Seed Hash:</span>{' '}
                    <span className="font-mono">{formatStreamInfo()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Bets:</span>{' '}
                    <span className="font-medium">{stream.total_bets.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{' '}
                    <span>{new Date(stream.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                All associated bet records will also be permanently deleted.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {deleteState.error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {deleteState.error}
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteState.isLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteState.isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteState.isLoading ? 'Deleting...' : 'Delete Stream'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Actions Separator */}
      <div className="h-4 w-px bg-border" />

      {/* Stream Info Badge */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="font-mono text-xs">
          {stream.total_bets.toLocaleString()} bets
        </Badge>
        {stream.notes && (
          <Badge variant="secondary" className="text-xs">
            Has notes
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version of StreamActions for use in cards or limited space
 */
export function StreamActionsCompact({
  stream,
  onError,
  onSuccess,
  disabled = false,
  className,
}: StreamActionsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Export */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={async () => {
          try {
            const exportUrl = liveStreamsApi.getExportCsvUrl(stream.id);
            const link = document.createElement('a');
            link.href = exportUrl;
            link.download = `stream-${stream.id}-bets.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            onSuccess?.('Export started');
          } catch (error) {
            onError?.('Export failed');
          }
        }}
        disabled={disabled}
        title="Export CSV"
      >
        <Download className="h-3 w-3" />
      </Button>

      {/* View Details */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={disabled}
        title="View Details"
      >
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
}