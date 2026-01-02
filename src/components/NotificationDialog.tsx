import { useMemo, useState } from 'react';
import { Document, HistoryEvent } from '../types/docflow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Bell, X, FileText, AlertCircle, CheckCircle, Clock, User } from 'lucide-react';

interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: Document[];
  currentUser: string;
}

interface NotificationItem {
  id: string;
  ts: string;
  event: string;
  status?: string;
  by: string;
  note?: string;
  where?: string;
  docName: string;
  path: string;
}

export function NotificationDialog({ open, onOpenChange, documents, currentUser }: NotificationDialogProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const notifications = useMemo(() => {
    if (!currentUser) return [];

    const userLower = currentUser.toLowerCase();
    const hourAgo = Date.now() - 3600000 * 24; // Last 24 hours
    const items: NotificationItem[] = [];

    documents.forEach(doc => {
      // Only show notifications for documents assigned to current user
      const isAssigned = doc.assignees.some(a => a.toLowerCase() === userLower);
      
      doc.history.forEach((event, eventIndex) => {
        const eventTime = new Date(event.ts).getTime();
        if (eventTime < hourAgo) return;
        
        // Skip own actions
        if (event.by && event.by.toLowerCase() === userLower) return;
        
        // Only include if document is assigned to user
        if (!isAssigned && !event.assignees_snapshot?.some(a => a.toLowerCase() === userLower)) return;

        const id = `${doc.path}-${eventIndex}-${event.ts}`;
        if (dismissedIds.has(id)) return;

        items.push({
          id,
          ts: event.ts,
          event: event.event,
          status: event.status,
          by: event.by || '',
          note: event.note,
          where: event.where,
          docName: doc.name,
          path: doc.path,
        });
      });
    });

    return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 50);
  }, [documents, currentUser, dismissedIds]);

  const getEventInfo = (item: NotificationItem) => {
    const by = item.by ? ` door ${item.by}` : '';
    const note = item.note ? ` — ${item.note}` : '';

    switch (item.event) {
      case 'start':
        return { label: `Geclaimd${by}`, icon: User, color: 'text-blue-500' };
      case 'stuck':
        return { label: `Stagnatie${by}${note}`, icon: AlertCircle, color: 'text-orange-500' };
      case 'mark_mapproved':
        return { label: `Gemarkeerd voor valideren${by}`, icon: CheckCircle, color: 'text-green-500' };
      case 'disapprove':
        return { label: `Afgekeurd${by}${note}`, icon: AlertCircle, color: 'text-red-500' };
      case 'finalize_approve_move':
        return { label: `Verplaatst naar Approved${by}`, icon: CheckCircle, color: 'text-green-500' };
      case 'returned_to_concept':
        return { label: 'Terug naar Concept (detectie)', icon: Clock, color: 'text-gray-500' };
      case 'move_to_approved_detected':
        return { label: 'In Approved gedetecteerd', icon: CheckCircle, color: 'text-green-500' };
      case 'auto_back_to_concept_no_assignees':
        return { label: 'Automatisch terug naar Concept (niemand toegewezen)', icon: AlertCircle, color: 'text-orange-500' };
      case 'unassign':
        return { label: `Assignee verwijderd${by}`, icon: User, color: 'text-gray-500' };
      case 'indexed':
        return { label: `Nieuw gedetecteerd (${item.where})`, icon: FileText, color: 'text-blue-500' };
      default:
        return { label: item.event, icon: Bell, color: 'text-gray-500' };
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const handleClearAll = () => {
    const allIds = notifications.map(n => n.id);
    setDismissedIds(prev => new Set([...prev, ...allIds]));
  };

  const formatRelativeTime = (dateString: string) => {
    const now = Date.now();
    const time = new Date(dateString).getTime();
    const diff = now - time;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Zojuist';
    if (minutes < 60) return `${minutes}m geleden`;
    if (hours < 24) return `${hours}u geleden`;
    
    return new Date(dateString).toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[--primary]" />
            <DialogTitle>Meldingen</DialogTitle>
            {notifications.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-[--primary] text-white rounded-full">
                {notifications.length}
              </span>
            )}
          </div>
          <DialogDescription>Recente wijzigingen in jouw toegewezen documenten</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[450px] pr-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[--muted]">
              <Bell className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg">Geen nieuwe meldingen</p>
              <p className="text-sm mt-1">Je bent helemaal bij!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((item) => {
                const eventInfo = getEventInfo(item);
                const Icon = eventInfo.icon;
                
                return (
                  <div 
                    key={item.id} 
                    className="group relative flex gap-3 p-3 rounded-lg border border-[--border] bg-[--surface] hover:bg-[--hover] transition-colors"
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${eventInfo.color} bg-opacity-10`}>
                      <Icon className={`w-5 h-5 ${eventInfo.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-medium text-[--fg] truncate">
                          {item.docName}
                        </h4>
                        <time className="text-xs text-[--muted] whitespace-nowrap">
                          {formatRelativeTime(item.ts)}
                        </time>
                      </div>
                      <p className="text-sm text-[--muted]">
                        {eventInfo.label}
                      </p>
                    </div>

                    {/* Dismiss button */}
                    <button
                      onClick={() => handleDismiss(item.id)}
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[--border] transition-all"
                      title="Verwijder melding"
                    >
                      <X className="w-4 h-4 text-[--muted]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t border-[--border]">
          <Button 
            variant="ghost" 
            onClick={handleClearAll}
            disabled={notifications.length === 0}
            className="text-[--muted] hover:text-[--fg]"
          >
            <X className="w-4 h-4 mr-2" />
            Wis alle meldingen
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Sluiten
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}