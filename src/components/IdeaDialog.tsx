import { useState } from 'react';
import { Lightbulb, ThumbsUp, X, Check, AlertCircle, Clock, Monitor, Smartphone, User, Globe, Info, RefreshCw, Trash2, StickyNote } from 'lucide-react';
import { Idea, IdeaStatus } from '../types/docflow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';

interface IdeaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideas: Idea[];
  onAddIdea: (text: string) => void;
  onVoteIdea: (id: string) => void;
  onChangeStatus: (id: string, status: IdeaStatus) => void;
  onDeleteIdea?: (id: string) => void;
  onUpdateNote?: (id: string, note: string) => void;
  onResetIdeas?: () => void;
  currentUser: string;
  isAdmin?: boolean;
}

const statusConfig = {
  new: {
    label: 'Nieuw',
    color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
    icon: Lightbulb,
    description: 'Nieuw idee, nog niet beoordeeld'
  },
  'in-progress': {
    label: 'Bezig',
    color: 'bg-[#0077C8]/10 dark:bg-[#0077C8]/20 text-[#0077C8] border border-[#0077C8]/30',
    icon: Clock,
    description: 'In behandeling'
  },
  done: {
    label: 'Gedaan',
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-600',
    icon: Check,
    description: 'Geïmplementeerd'
  },
  rejected: {
    label: 'Afgewezen',
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-600',
    icon: AlertCircle,
    description: 'Niet haalbaar of gewenst'
  }
};

export function IdeaDialog({
  open,
  onOpenChange,
  ideas,
  onAddIdea,
  onVoteIdea,
  onChangeStatus,
  onDeleteIdea,
  onUpdateNote,
  onResetIdeas,
  currentUser,
  isAdmin = false
}: IdeaDialogProps) {
  const [newIdeaText, setNewIdeaText] = useState('');
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const handleSubmitIdea = () => {
    if (!newIdeaText.trim()) {
      toast.error('Voer een idee in');
      return;
    }
    if (!currentUser) {
      toast.error('Vul eerst je naam in om een idee te delen');
      return;
    }
    onAddIdea(newIdeaText);
    setNewIdeaText('');
    setShowNewIdea(false);
    toast.success('Idee gedeeld! 💡');
  };

  const handleVote = (id: string) => {
    if (!currentUser) {
      toast.error('Vul eerst je naam in om te stemmen');
      return;
    }
    onVoteIdea(id);
  };

  // Sorteer ideeën: hoogste votes eerst
  const sortedIdeas = [...ideas].sort((a, b) => b.votes - a.votes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2.5 bg-gradient-to-br from-[#0077C8] to-[#005a9e] rounded-xl"
              animate={{
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3
              }}
            >
              <Lightbulb className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <DialogTitle className="text-2xl">Ideeënbox</DialogTitle>
              <DialogDescription>
                Deel je ideeën en stem op anderen. Samen maken we DocFlow beter!
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-950/30 border-y border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-200">
              <Lightbulb className="w-4 h-4" />
              <span><strong>{ideas.length}</strong> ideeën gedeeld</span>
              <span className="mx-2">•</span>
              <ThumbsUp className="w-4 h-4" />
              <span><strong>{ideas.reduce((sum, idea) => sum + idea.votes, 0)}</strong> stemmen</span>
            </div>
            
            <div className="flex items-center gap-2">
              {isAdmin && onResetIdeas && (
                <Button
                  onClick={() => {
                    if (window.confirm('Weet je zeker dat je ALLE ideeën definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
                      onResetIdeas();
                      toast.success('Alle ideeën verwijderd!');
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-300"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Alles Wissen
                </Button>
              )}
                {!showNewIdea ? (
                  <Button
                    onClick={() => setShowNewIdea(true)}
                  className="bg-[#0077C8] hover:bg-[#005a9e] text-white shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Nieuw idee
                </Button>
              ) : (
                <Button
                  onClick={() => setShowNewIdea(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4 mr-1" />
                  Annuleren
                </Button>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showNewIdea && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-6 pb-4 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-950/20">
                <Textarea
                  value={newIdeaText}
                  onChange={(e) => setNewIdeaText(e.target.value)}
                  placeholder="Beschrijf je idee voor het verbeteren van DocFlow..."
                  className="min-h-[100px] resize-none border-2 border-blue-200 dark:border-blue-800 focus:border-[#0077C8] transition-colors"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-3">
                  <Button
                    onClick={() => setShowNewIdea(false)}
                    variant="ghost"
                  >
                    Annuleren
                  </Button>
                  <Button
                    onClick={handleSubmitIdea}
                    className="bg-[#0077C8] hover:bg-[#005a9e] text-white"
                  >
                    Delen
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ScrollArea className="flex-1 px-6 py-4 overflow-x-hidden" style={{ maxHeight: 'calc(85vh - 280px)' }}>
          <div className="space-y-4 overflow-x-hidden">
            {sortedIdeas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nog geen ideeën gedeeld.</p>
                <p className="text-sm">Wees de eerste om een idee te delen!</p>
              </div>
            ) : (
              sortedIdeas.map((idea, index) => {
                const config = statusConfig[idea.status];
                const StatusIcon = config.icon;
                const hasVoted = idea.votedBy.has(currentUser);

                // Safe fallback for metadata
                const metadata = idea.metadata || {
                  ipAddress: 'Onbekend',
                  userAgent: 'Niet beschikbaar',
                  browser: 'Onbekend',
                  os: 'Onbekend',
                  device: 'Onbekend',
                  screenResolution: 'Onbekend'
                };

                const DeviceIcon = metadata.device === 'Mobiel' || metadata.device === 'Tablet' 
                  ? Smartphone 
                  : Monitor;

                return (
                  <motion.div
                    key={idea.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                      idea.status === 'new' 
                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                        : config.color
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant="secondary" 
                            className={`${config.color} gap-1.5 transition-all duration-200 shrink-0`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {config.label}
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                            door <strong>{idea.author}</strong>
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            {new Date(idea.timestamp).toLocaleDateString('nl-NL', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        <p className="text-gray-800 dark:text-gray-200 break-words">
                          {idea.text}
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleVote(idea.id)}
                          disabled={hasVoted}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            hasVoted
                              ? 'bg-[#0077C8] text-white cursor-not-allowed'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-[#0077C8] hover:text-white hover:shadow-lg'
                          }`}
                          title={hasVoted ? 'Je hebt al gestemd' : 'Stem op dit idee'}
                        >
                          <ThumbsUp className="w-5 h-5" />
                        </motion.button>
                        <motion.span
                          key={idea.votes}
                          initial={{ scale: 1.5 }}
                          animate={{ scale: 1 }}
                          className="font-bold text-lg text-gray-700 dark:text-gray-300"
                        >
                          {idea.votes}
                        </motion.span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        {/* Status Controls */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 block">Status wijzigen:</span>
                            {onDeleteIdea && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (window.confirm('Weet je zeker dat je dit idee wilt verwijderen?')) {
                                    onDeleteIdea(idea.id);
                                    toast.success('Idee verwijderd');
                                  }
                                }}
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                Verwijder
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(['new', 'in-progress', 'done', 'rejected'] as IdeaStatus[]).map((status) => {
                              const statusConf = statusConfig[status];
                              const Icon = statusConf.icon;
                              const isActive = idea.status === status;

                              return (
                                <Button
                                  key={status}
                                  size="sm"
                                  variant={isActive ? 'default' : 'outline'}
                                  onClick={() => onChangeStatus(idea.id, status)}
                                  className={`h-7 text-xs gap-1.5 transition-all duration-200 shrink-0 ${
                                    isActive 
                                      ? statusConf.color + ' opacity-100' 
                                      : 'opacity-60 hover:opacity-100'
                                  }`}
                                >
                                  <Icon className="w-3 h-3" />
                                  {statusConf.label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Admin Note Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 flex items-center gap-1.5">
                              <StickyNote className="w-3.5 h-3.5" />
                              Admin notitie:
                            </span>
                            {editingNoteId === idea.id ? (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingNoteText('');
                                  }}
                                  className="h-6 text-xs px-2"
                                >
                                  Annuleer
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (onUpdateNote) {
                                      onUpdateNote(idea.id, editingNoteText);
                                      toast.success('Notitie opgeslagen');
                                    }
                                    setEditingNoteId(null);
                                    setEditingNoteText('');
                                  }}
                                  className="h-6 text-xs px-2 bg-[#0077C8] hover:bg-[#005a9e]"
                                >
                                  Opslaan
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingNoteId(idea.id);
                                  setEditingNoteText(idea.adminNote || '');
                                }}
                                className="h-6 text-xs px-2"
                              >
                                {idea.adminNote ? 'Bewerk' : 'Toevoegen'}
                              </Button>
                            )}
                          </div>
                          {editingNoteId === idea.id ? (
                            <Textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              placeholder="Voeg een interne notitie toe voor dit idee..."
                              className="min-h-[80px] text-xs resize-none"
                              autoFocus
                            />
                          ) : idea.adminNote ? (
                            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-300">
                              {idea.adminNote}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">Geen notitie</p>
                          )}
                        </div>

                        {/* Metadata Section */}
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs h-7 gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                            >
                              <Info className="w-3.5 h-3.5" />
                              Toon metadata (IP, apparaat, etc.)
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 space-y-2 text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2">
                                  <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                  <div>
                                    <p className="text-gray-500 dark:text-gray-400">Auteur</p>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{idea.author}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                  <div>
                                    <p className="text-gray-500 dark:text-gray-400">IP-adres</p>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{metadata.ipAddress}</p>
                                  </div>
                                </div>
                              </div>
                              
                              <Separator />
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2">
                                  <DeviceIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                  <div>
                                    <p className="text-gray-500 dark:text-gray-400">Apparaat</p>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{metadata.device}</p>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400">Browser</p>
                                  <p className="font-medium text-gray-800 dark:text-gray-200">{metadata.browser}</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400">OS</p>
                                  <p className="font-medium text-gray-800 dark:text-gray-200">{metadata.os}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400">Resolutie</p>
                                  <p className="font-medium text-gray-800 dark:text-gray-200">{metadata.screenResolution}</p>
                                </div>
                              </div>
                              
                              <Separator />
                              
                              <div>
                                <p className="text-gray-500 dark:text-gray-400 mb-1">User Agent</p>
                                <p className="font-mono text-[10px] text-gray-700 dark:text-gray-300 break-all bg-white dark:bg-gray-900 p-2 rounded">
                                  {metadata.userAgent}
                                </p>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
