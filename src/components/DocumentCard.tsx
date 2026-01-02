import { useState, memo } from 'react';
import { FileSpreadsheet, FileText as FileTextIcon, File, X, Lightbulb, ArrowRight, AlertTriangle, CheckCircle2, Clock, Copy } from 'lucide-react';
import { Document } from '../types/docflow';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { motion } from 'motion/react';
import { toast } from 'sonner@2.0.3';

interface DocumentCardProps {
  document: Document;
  currentUser: string;
  onAction: (path: string, action: string, note?: string) => void;
  bulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isAdmin?: boolean;
}

const DocumentCardComponent = ({ document, currentUser, onAction, bulkMode, isSelected, onToggleSelect, isAdmin }: DocumentCardProps) => {
  const [showStuckDialog, setShowStuckDialog] = useState(false);
  const [showDisapproveDialog, setShowDisapproveDialog] = useState(false);
  const [note, setNote] = useState('');

  const handleActionWithCheck = (action: string, note?: string) => {
    // Check if document is approved
    if (document.status === 'approved') {
      alert(
        `⚠️ WAARSCHUWING: Status wijzigen niet mogelijk\n\n` +
        `Dit document staat al in de APPROVED map.\n\n` +
        `Approved documenten kunnen niet meer worden gewijzigd via DocFlow.\n` +
        `Bij wijzigingen neem contact op met de beheerder.`
      );
      return;
    }
    
    // Execute action if not approved
    onAction(document.path, action, note);
  };

  const handleFileOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      toast.info('Opening bestand...', { duration: 1500 });
      
      const response = await fetch('http://localhost:5000/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: document.path,
          name: document.name
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`${document.name} geopend! 📂`, { duration: 2000 });
      } else {
        throw new Error('Helper niet bereikbaar');
      }
    } catch (error) {
      toast.error('DocFlow File Helper is niet actief', {
        duration: 4000,
        description: 'Klik op het groene icoon (📊) in de header voor instructies',
      });
    }
  };

  const getFileIcon = () => {
    const name = document.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      return (
        <button
          onClick={handleFileOpen}
          className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-200 hover:bg-green-100 dark:hover:bg-green-900/30 hover:scale-110 hover:shadow-lg hover:shadow-green-500/50 group"
          title="Open in Excel"
        >
          <FileSpreadsheet className="w-5 h-5 text-green-600 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors" />
        </button>
      );
    }
    if (name.endsWith('.docx') || name.endsWith('.doc')) {
      return (
        <button
          onClick={handleFileOpen}
          className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/50 group"
          title="Open in Word"
        >
          <FileTextIcon className="w-5 h-5 text-blue-600 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors" />
        </button>
      );
    }
    return (
      <button
        onClick={handleFileOpen}
        className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700/30 hover:scale-110 hover:shadow-lg hover:shadow-gray-500/50 group"
        title="Open bestand"
      >
        <File className="w-5 h-5 text-gray-600 group-hover:text-gray-700 dark:group-hover:text-gray-400 transition-colors" />
      </button>
    );
  };

  const getStatusBadge = () => {
    const statusConfig = {
      concept: { 
        label: 'Concept', 
        icon: Lightbulb,
        className: 'bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-800 dark:text-blue-200 border-2 border-blue-300 dark:border-blue-700',
        glowColor: 'shadow-blue-400/50',
        description: 'Document is in conceptfase en nog niet klaar voor review'
      },
      ongoing: { 
        label: 'Ongoing', 
        icon: ArrowRight,
        className: 'bg-gradient-to-r from-[#0077C8]/20 to-[#38bdf8]/20 dark:from-[#0077C8]/30 dark:to-[#38bdf8]/20 text-[#0077C8] dark:text-[#38bdf8] border-2 border-[#0077C8] dark:border-[#38bdf8]',
        glowColor: 'shadow-[#0077C8]/50',
        description: 'Document is actief in bewerking en wordt momenteel aan gewerkt'
      },
      stuck: { 
        label: 'Stagnatie', 
        icon: AlertTriangle,
        className: 'bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 text-orange-800 dark:text-orange-200 border-2 border-orange-400 dark:border-orange-600',
        glowColor: 'shadow-orange-400/50',
        description: 'Document zit vast en heeft aandacht nodig om verder te komen'
      },
      'm.approved': { 
        label: 'Valideren', 
        icon: Clock,
        className: 'bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 text-purple-800 dark:text-purple-200 border-2 border-purple-400 dark:border-purple-600',
        glowColor: 'shadow-purple-400/50',
        description: 'Document wacht op validatie en goedkeuring door management'
      },
      approved: { 
        label: 'Approved', 
        icon: CheckCircle2,
        className: 'bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 text-green-800 dark:text-green-200 border-2 border-green-400 dark:border-green-600',
        glowColor: 'shadow-green-400/50',
        description: 'Document is volledig goedgekeurd en klaar voor gebruik'
      },
    };

    const config = statusConfig[document.status];
    const StatusIcon = config.icon;
    
    return (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className={`${config.className} relative overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md px-3 py-1.5 gap-1.5 font-medium cursor-help group`}
            style={{ willChange: 'transform' }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 dark:via-white/15 to-transparent pointer-events-none group-hover:opacity-0"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatDelay: 4,
                ease: 'linear'
              }}
            />
            <StatusIcon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const handleStuck = () => {
    handleActionWithCheck('stuck', note);
    setShowStuckDialog(false);
    setNote('');
  };

  const handleDisapprove = () => {
    handleActionWithCheck('disapprove', note);
    setShowDisapproveDialog(false);
    setNote('');
  };

  const handleUnassign = (assignee: string) => {
    const isMe = assignee.toLowerCase() === currentUser.toLowerCase();
    
    if (isMe) {
      if (confirm('Zeker dat je jezelf wilt verwijderen?')) {
        onAction(document.path, 'unassign');
      }
    } else if (isAdmin) {
      // Admin kan iedereen verwijderen
      if (confirm(`Wil je ${assignee} verwijderen van dit document?`)) {
        onAction(document.path, 'unassign', assignee); // Pass the specific assignee to remove
      }
    }
  };

  return (
    <>
      <article 
        className={`bg-[--card] border rounded-2xl shadow-[--shadow] p-4 flex flex-col min-h-[200px] transition-all duration-200 ease-out cursor-pointer relative hover:-translate-y-1 hover:border-[--brand] ${
          isSelected ? 'border-[--brand] border-2 bg-[--brand-light] shadow-[0_0_30px_rgba(0,119,200,0.4)]' : 'border-[--border] hover:shadow-[0_8px_30px_rgba(0,119,200,0.3)]'
        }`}
        style={{
          willChange: 'transform, box-shadow'
        }}
        onClick={bulkMode ? onToggleSelect : undefined}
      >
        {/* Bulk mode checkbox */}
        {bulkMode && (
          <div className="absolute top-3 left-3 z-10">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-5 h-5 accent-[--brand] cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 mb-3 ${bulkMode ? 'ml-8' : ''}`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {getFileIcon()}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[--fg] truncate" title={document.name}>
                {document.name}
              </h3>
              <p className="text-xs text-[--muted]">
                {(document.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <TooltipProvider delayDuration={500}>
            <div className="flex items-center gap-2 flex-shrink-0">
              {getStatusBadge()}
              {document.dup_concept_approved && (
                <Tooltip delayDuration={500}>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/30 text-amber-900 dark:text-amber-200 border-2 border-amber-500 dark:border-amber-600 transition-all duration-200 hover:scale-105 hover:shadow-md px-3 py-1.5 gap-1.5 font-medium relative overflow-hidden cursor-help group"
                      style={{ willChange: 'transform' }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 dark:via-white/15 to-transparent pointer-events-none group-hover:opacity-0"
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          repeatDelay: 4,
                          ease: 'linear'
                        }}
                      />
                      <Copy className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10">DUBBEL</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Dit document bestaat zowel als Concept als Approved versie in het systeem</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </div>

        {/* Notes */}
        {document.notes && (
          <div className="mb-3 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded transition-all duration-150 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:shadow-md">
            {document.notes}
          </div>
        )}

        {/* Assignees */}
        {document.assignees.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {document.assignees.map((assignee) => {
              const isMe = currentUser && assignee.toLowerCase() === currentUser.toLowerCase();
              const canRemove = isMe || isAdmin;
              return (
                <Badge 
                  key={assignee}
                  variant="outline"
                  className="flex items-center gap-1 transition-all duration-150 hover:scale-105 hover:-translate-y-0.5 hover:shadow-md hover:shadow-[--brand]/40 hover:ring-2 hover:ring-[--brand]/30 hover:border-[--brand]"
                  style={{ willChange: 'transform' }}
                >
                  {assignee}
                  {canRemove && (
                    <button
                      onClick={() => handleUnassign(assignee)}
                      className="ml-1 transition-all duration-150 hover:scale-110 hover:text-red-600 active:scale-90"
                      title={isAdmin && !isMe ? '🔓 Admin: verwijder gebruiker' : 'Verwijder jezelf'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-2 flex-wrap">
          {document.status === 'approved' ? (
            <div className="w-full p-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg text-center">
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                ✅ Dit document is goedgekeurd en kan niet meer worden gewijzigd
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Voor wijzigingen neem contact op met de beheerder
              </p>
            </div>
          ) : document.status === 'm.approved' ? (
            <>
              <Button
                size="sm"
                className="flex-1 min-w-[110px] bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                onClick={() => onAction(document.path, 'approve')}
                style={{ willChange: 'transform' }}
              >
                <span className="relative z-10">Naar Approved</span>
                <span className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 pointer-events-none" />
              </Button>
              <Button
                size="sm"
                className="flex-1 min-w-[110px] !bg-orange-600 !text-white hover:!bg-orange-700 dark:!bg-orange-500 dark:hover:!bg-orange-600 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                onClick={() => setShowDisapproveDialog(true)}
                style={{ willChange: 'transform' }}
              >
                <span className="relative z-10">Afkeur</span>
                <span className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 pointer-events-none" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="default"
                className="flex-1 min-w-[110px] !bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                onClick={() => handleActionWithCheck('start')}
                style={{ willChange: 'transform' }}
              >
                <span className="relative z-10">Claimen</span>
                <span className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 pointer-events-none" />
              </Button>
              <Button
                size="sm"
                className="flex-1 min-w-[110px] !bg-orange-600 !text-white hover:!bg-orange-700 dark:!bg-orange-500 dark:hover:!bg-orange-600 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                onClick={() => setShowStuckDialog(true)}
                style={{ willChange: 'transform' }}
              >
                <span className="relative z-10">Stagnatie</span>
                <span className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 pointer-events-none" />
              </Button>
              <Button
                size="sm"
                className="flex-1 min-w-[110px] bg-green-600 hover:bg-green-700 text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                onClick={() => handleActionWithCheck('validate')}
                style={{ willChange: 'transform' }}
              >
                <span className="relative z-10">Valideren</span>
                <span className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 pointer-events-none" />
              </Button>
            </>
          )}
        </div>
      </article>

      {/* Stuck Dialog */}
      <Dialog open={showStuckDialog} onOpenChange={setShowStuckDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Markeer als Stagnatie</DialogTitle>
            <DialogDescription>
              Geef aan wat er vastloopt zodat anderen kunnen helpen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[--muted]">
              Beschrijf kort wat er vastloopt (optioneel):
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bijvoorbeeld: Wachten op feedback van manager"
              className="h-24"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowStuckDialog(false)}
              className="flex-1 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Annuleren
            </Button>
            <Button 
              onClick={handleStuck}
              className="flex-1 !bg-orange-600 !text-white hover:!bg-orange-700 dark:!bg-orange-500 dark:hover:!bg-orange-600 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
            >
              <span className="relative z-10">Markeer als Stagnatie</span>
              <span className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 pointer-events-none" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disapprove Dialog */}
      <Dialog open={showDisapproveDialog} onOpenChange={setShowDisapproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Afkeur (Valideren → Ongoing)</DialogTitle>
            <DialogDescription>
              Document voldoet niet aan de kwaliteitseisen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[--muted]">
              Waarom afgekeurd? (korte opmerking):
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bijvoorbeeld: Fouten gevonden in berekeningen"
              className="h-24"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDisapproveDialog(false)}
              className="flex-1 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Annuleren
            </Button>
            <Button 
              onClick={handleDisapprove}
              className="flex-1 !bg-orange-600 !text-white hover:!bg-orange-700 dark:!bg-orange-500 dark:hover:!bg-orange-600 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
            >
              <span className="relative z-10">Afkeur Document</span>
              <span className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 pointer-events-none" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Memoize component to prevent unnecessary re-renders with 3000+ documents
export const DocumentCard = memo(DocumentCardComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.document.path === nextProps.document.path &&
    prevProps.document.status === nextProps.document.status &&
    prevProps.currentUser === nextProps.currentUser &&
    prevProps.bulkMode === nextProps.bulkMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isAdmin === nextProps.isAdmin &&
    prevProps.document.assignees.length === nextProps.document.assignees.length
  );
});