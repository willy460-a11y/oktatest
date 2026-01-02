import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Search, Package, PackageOpen, User, BookOpen, Info, Sun, Moon, Bell, Lightbulb, FileSpreadsheet, ArrowRight, AlertTriangle, Clock, CheckCircle2, FileText, Tag, HardDrive, FileType, ArrowUp, ArrowDown, Target, Copy, CheckCheck, CircleAlert, Check, Loader2 } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';
import { Skeleton } from './components/ui/skeleton';
import { Document } from './types/docflow';
import { DocumentCard } from './components/DocumentCard';
import { StatsDialog } from './components/StatsDialog';
import { NotificationDialog } from './components/NotificationDialog';
import { FileHelperDialog } from './components/FileHelperDialog';
import { IntroDialog } from './components/IntroDialog';
import { InfoDialog } from './components/InfoDialog';
import { IdeaDialog } from './components/IdeaDialog';
import { Toaster, toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';
import { mockIdeas } from './lib/mockData';
import { Idea, IdeaStatus } from './types/docflow';
import * as api from './lib/api';

// Logo configuratie
// ℹ️ Om het logo te vervangen: plaats je logo.png of logo.webp in /imports/ folder
// Ondersteunde formaten: PNG, WEBP, JPG, SVG
import logo from './imports/logo.png';

export default function App() {
  // State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('concept'); // Start met 'concept' in plaats van 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Voor debounced search
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'assignees' | 'size' | 'type' | 'duplicates'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');
  const [username, setUsername] = useState('');
  const [tempUsername, setTempUsername] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFileHelper, setShowFileHelper] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [shakeNameInput, setShakeNameInput] = useState(false);
  const [authUser, setAuthUser] = useState<{ name?: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authRedirecting, setAuthRedirecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  // Ideas state (blijft client-side)
  const [ideas, setIdeas] = useState<Idea[]>(mockIdeas);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ideasBadgeSeen, setIdeasBadgeSeen] = useState(false);

  // Admin activation Easter egg (5x logo click)
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [logoClickTimer, setLogoClickTimer] = useState<NodeJS.Timeout | null>(null);

  // Infinite scroll state (voor performance met 3000+ documenten)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // 50 documenten per batch
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Load user data from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('docflow_user');
    const savedTheme = localStorage.getItem('docflow_theme');
    const introShown = localStorage.getItem('docflow_intro_dismissed_v2'); // v2 om oude sessies te resetten
    const savedIdeas = localStorage.getItem('docflow_ideas');
    // Admin mode is NIET persistent - moet elke sessie opnieuw geactiveerd worden
    
    if (savedUser) {
      setUsername(savedUser);
      setTempUsername(savedUser);
    }
    if (savedTheme === 'dark') {
      setDarkMode(true);
    }
    if (!introShown) {
      setShowIntro(true);
    }
    if (savedIdeas) {
      try {
        const parsedIdeas = JSON.parse(savedIdeas);
        // Convert votedBy arrays back to Sets and add metadata if missing
        const ideasWithSets = parsedIdeas.map((idea: any) => ({
          ...idea,
          votedBy: new Set(idea.votedBy || []),
          metadata: idea.metadata || {
            ip: 'Onbekend',
            browser: 'Onbekend',
            os: 'Onbekend',
            device: 'Onbekend',
            screenResolution: 'Onbekend'
          }
        }));
        setIdeas(ideasWithSets);
      } catch (e) {
        console.error('Error loading ideas:', e);
      }
    }
    // Admin mode wordt NIET geladen - moet elke sessie opnieuw geactiveerd
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('auth_error');
    if (error) {
      const decoded = decodeURIComponent(error);
      setAuthError(decoded);
      toast.error(decoded, { duration: 5000 });
    }
  }, []);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      try {
        const response = await api.getCurrentUser();
        if (!active) return;

        if (response.user) {
          setAuthUser(response.user);
          const oktaName = response.user.name?.trim() || response.user.email || '';
          if (oktaName) {
            setUsername(oktaName);
            setTempUsername(oktaName);
            localStorage.setItem('docflow_user', oktaName);
          }
        }
      } catch (error) {
        if (!active) return;

        if (error instanceof api.ApiError && error.status === 401) {
          setAuthRedirecting(true);
          const nextUrl = window.location.href;
          window.location.href = `${api.API_BASE_URL}/api/auth/okta/login?next=${encodeURIComponent(nextUrl)}`;
          return;
        }

        setAuthError(error instanceof Error ? error.message : 'Kon niet inloggen via Okta');
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    };

    verifySession();

    return () => {
      active = false;
    };
  }, []);

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Set document title and favicon
  useEffect(() => {
    document.title = 'DocFlow';
    
    // Update favicon
    const favicon = document.querySelector('link[rel="icon"]') || document.createElement('link');
    favicon.setAttribute('rel', 'icon');
    favicon.setAttribute('type', 'image/svg+xml');
    favicon.setAttribute('href', '/public/favicon.svg');
    
    if (!document.querySelector('link[rel="icon"]')) {
      document.head.appendChild(favicon);
    }
  }, []);

  // Save ideas to localStorage whenever they change
  useEffect(() => {
    const ideasToSave = ideas.map(idea => ({
      ...idea,
      votedBy: Array.from(idea.votedBy)
    }));
    localStorage.setItem('docflow_ideas', JSON.stringify(ideasToSave));
  }, [ideas]);

  // Mark ideas badge as seen when dialog opens
  useEffect(() => {
    if (showIdeas) {
      setIdeasBadgeSeen(true);
    }
  }, [showIdeas]);

  // Cleanup logo click timer on unmount
  useEffect(() => {
    return () => {
      if (logoClickTimer) {
        clearTimeout(logoClickTimer);
      }
    };
  }, [logoClickTimer]);

  // Handle sort button click
  const handleSortClick = (newSortBy: 'name' | 'status' | 'assignees' | 'size' | 'type' | 'duplicates') => {
    if (sortBy === newSortBy) {
      // Toggle direction if clicking same sort
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort starts with ascending
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
  };

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.name.toLowerCase().includes(query) ||
        doc.assignees.some(a => a.toLowerCase().includes(query))
      );
    }

    // View mode filter
    if (viewMode === 'mine' && username) {
      const userLower = username.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.assignees.some(a => a.toLowerCase() === userLower)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let result = 0;
      
      if (sortBy === 'name') {
        result = a.name.localeCompare(b.name);
      } else if (sortBy === 'status') {
        const statusOrder = { concept: 0, ongoing: 1, stuck: 2, 'm.approved': 3, approved: 4 };
        result = statusOrder[a.status] - statusOrder[b.status];
      } else if (sortBy === 'assignees') {
        const aFirst = a.assignees[0]?.toLowerCase() || 'zzz';
        const bFirst = b.assignees[0]?.toLowerCase() || 'zzz';
        if (a.assignees.length === 0 && b.assignees.length > 0) return sortDirection === 'asc' ? 1 : -1;
        if (b.assignees.length === 0 && a.assignees.length > 0) return sortDirection === 'asc' ? -1 : 1;
        result = aFirst.localeCompare(bFirst);
      } else if (sortBy === 'size') {
        result = b.size - a.size; // Default grootste eerst
      } else if (sortBy === 'type') {
        const getExtension = (path: string) => {
          const parts = path.split('.');
          return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
        };
        const aExt = getExtension(a.path);
        const bExt = getExtension(b.path);
        result = aExt.localeCompare(bExt);
      } else if (sortBy === 'duplicates') {
        const aCount = documents.filter(doc => doc.name === a.name).length;
        const bCount = documents.filter(doc => doc.name === b.name).length;
        result = aCount - bCount;
      }
      
      // Apply sort direction
      return sortDirection === 'asc' ? result : -result;
    });

    return filtered;
  }, [documents, statusFilter, searchQuery, sortBy, sortDirection, viewMode, username]);

  // Infinite scroll: toon alle documenten tot en met de huidige pagina
  const displayedDocuments = useMemo(() => {
    const endIndex = currentPage * itemsPerPage;
    return filteredDocuments.slice(0, endIndex);
  }, [filteredDocuments, currentPage, itemsPerPage]);

  const hasMore = displayedDocuments.length < filteredDocuments.length;
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);

  // Reset naar pagina 1 als filters veranderen
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortBy, sortDirection, viewMode]);

  // Infinite scroll: load more documents when user scrolls to bottom
  const loadMoreDocuments = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    // Simuleer korte delay voor smooth UX
    setTimeout(() => {
      setCurrentPage(prev => prev + 1);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMore]);

  // Intersection Observer voor infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreDocuments();
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // Start loading 100px voor de onderkant
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, loadMoreDocuments]);

  // Debounced search voor betere performance (wacht 300ms na laatste input)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Calculate notifications
  useEffect(() => {
    if (!username) return;
    
    const userLower = username.toLowerCase();
    const recentChanges = documents.filter(doc => {
      return doc.assignees.some(a => a.toLowerCase() === userLower) &&
             doc.history.some(event => {
               const eventTime = new Date(event.ts).getTime();
               const hourAgo = Date.now() - 3600000;
               return eventTime > hourAgo && 
                      event.by && 
                      event.by.toLowerCase() !== userLower;
             });
    });
    
    setNotifCount(recentChanges.length);
  }, [documents, username]);

  const handleSaveName = () => {
    if (!tempUsername.trim()) {
      toast.error('Vul een geldige naam in', { duration: 2000 });
      return;
    }
    setUsername(tempUsername);
    localStorage.setItem('docflow_user', tempUsername);
    toast.success(`Welkom, ${tempUsername}! 🎉`, { duration: 2000 });
    setShakeNameInput(false);
  };

  const handleToggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('docflow_theme', newMode ? 'dark' : 'light');
  };

  const handleLogoClick = () => {
    // Clear any existing timer
    if (logoClickTimer) {
      clearTimeout(logoClickTimer);
    }

    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);

    if (newCount >= 5) {
      // Activate admin mode (geheime easter egg! - alleen deze sessie)
      setIsAdmin(true);
      setLogoClickCount(0);
      toast.success('🔓 Admin mode geactiveerd!', { 
        duration: 3000,
        description: 'Je hebt nu toegang tot admin functies (deze sessie)'
      });
    } else {
      // Set timer to reset count after 2 seconds (geen feedback!)
      const timer = setTimeout(() => {
        setLogoClickCount(0);
      }, 2000);
      setLogoClickTimer(timer);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await api.getDocs({ 
        // Haal ALTIJD alle documenten op - filtering gebeurt client-side
        // Dit is nodig zodat de status counts correct blijven
        search: searchQuery,
        user: username 
      });
      setDocuments(response);
      setLastUpdate(new Date());
      toast.success('Bijgewerkt!', { duration: 1500 });
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error('Kon niet verversen', { duration: 2000 });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDocumentAction = async (path: string, action: string, note?: string) => {
    if (!username) {
      toast.error('Vul eerst je naam in om acties uit te voeren', {
        duration: 3000,
      });
      return;
    }

    // Find document for toast message
    const doc = documents.find(d => d.path === path);
    const docName = doc?.name || 'Document';

    try {
      switch (action) {
        case 'start':
          await api.startDocument(path, username);
          toast.success(`Document "${docName}" geclaimd`, { duration: 2000 });
          break;

        case 'stuck':
          await api.markStuck(path, username, note || '');
          toast.warning(`Document "${docName}" gemarkeerd als stagnatie`, { duration: 2000 });
          break;

        case 'validate':
          await api.markForValidation(path, username);
          toast.success(`Document "${docName}" klaar voor validatie`, { duration: 2000 });
          break;

        case 'approve':
          await api.finalizeApprove(path, username);
          toast.success(`Document "${docName}" goedgekeurd! 🎉`, { duration: 3000 });
          break;

        case 'disapprove':
          await api.disapproveDocument(path, username, note || '');
          toast.error(`Document "${docName}" afgekeurd`, { duration: 2000 });
          break;

        case 'unassign':
          await api.unassignUser(path, username);
          if (note && note !== username) {
            toast.info(`${note} verwijderd van "${docName}" 🔓`, { duration: 2000 });
          } else {
            toast.info(`Je bent verwijderd van "${docName}"`, { duration: 2000 });
          }
          break;

        default:
          toast.error(`Onbekende actie: ${action}`, { duration: 2000 });
          return;
      }

      // Refresh documents after successful action
      await handleRefresh();
      
    } catch (error) {
      console.error('Error performing action:', error);
      const errorMessage = error instanceof api.ApiError 
        ? error.message 
        : 'Er ging iets mis bij het uitvoeren van de actie';
      toast.error(errorMessage, { duration: 3000 });
    }
  };

  // Bulk actions
  const handleBulkAction = async (action: string, note?: string) => {
    if (!username) {
      toast.error('Vul eerst je naam in om acties uit te voeren', {
        duration: 3000,
      });
      return;
    }

    if (selectedDocs.size === 0) {
      toast.error('Selecteer eerst documenten', { duration: 2000 });
      return;
    }

    // Check if there are any approved documents in the selection
    const selectedDocuments = documents.filter(doc => selectedDocs.has(doc.path));
    const approvedDocs = selectedDocuments.filter(doc => doc.status === 'approved');

    if (approvedDocs.length > 0) {
      // Show warning popup
      const approvedNames = approvedDocs.map(d => d.name).join('\n• ');
      alert(
        `⚠️ WAARSCHUWING: Status wijzigen niet mogelijk\n\n` +
        `De volgende ${approvedDocs.length} document${approvedDocs.length > 1 ? 'en staan' : ' staat'} al in de APPROVED map:\n\n` +
        `• ${approvedNames}\n\n` +
        `Approved documenten kunnen niet meer worden gewijzigd via DocFlow.\n` +
        `Bij wijzigingen neem contact op met de beheerder.`
      );
      return;
    }

    // Perform bulk action
    let successCount = 0;
    let failCount = 0;
    const paths = Array.from(selectedDocs);

    for (const path of paths) {
      try {
        await handleDocumentAction(path, action, note);
        successCount++;
      } catch (error) {
        console.error(`Failed to ${action} document ${path}:`, error);
        failCount++;
      }
    }

    // Show result
    if (successCount > 0) {
      toast.success(`${successCount} document${successCount > 1 ? 'en' : ''} bijgewerkt`, {
        duration: 2000,
      });
    }
    if (failCount > 0) {
      toast.error(`${failCount} document${failCount > 1 ? 'en' : ''} mislukt`, {
        duration: 3000,
      });
    }

    setSelectedDocs(new Set());
    setBulkMode(false);
  };

  // Get available bulk actions based on selected documents
  const getAvailableBulkActions = () => {
    if (selectedDocs.size === 0) return [];
    
    const selectedDocuments = documents.filter(doc => selectedDocs.has(doc.path));
    const statuses = new Set(selectedDocuments.map(doc => doc.status));
    const actions = [];

    // Check of we approved documenten hebben geselecteerd
    const hasApproved = statuses.has('approved');
    
    // Approved documenten hebben geen acties
    if (hasApproved && statuses.size === 1) {
      return [];
    }

    // Check of we ALLEEN m.approved documenten hebben
    const hasMApproved = statuses.has('m.approved');
    const hasOtherStatuses = statuses.has('concept') || statuses.has('ongoing') || statuses.has('stuck');
    
    if (hasMApproved && !hasOtherStatuses) {
      // ALLEEN m.approved documenten -> toon validatie acties
      actions.push({ 
        action: 'approve', 
        label: 'Naar Approved', 
        icon: '✅',
        disabled: false
      });

      actions.push({ 
        action: 'disapprove', 
        label: 'Afkeur', 
        icon: '❌',
        disabled: false,
        needsNote: true
      });
    } else if (hasOtherStatuses && !hasMApproved) {
      // ALLEEN concept/ongoing/stuck documenten -> toon workflow acties
      actions.push({ 
        action: 'start', 
        label: 'Claimen', 
        icon: '🎯',
        disabled: false
      });

      actions.push({ 
        action: 'stuck', 
        label: 'Stagnatie', 
        icon: '⚠️',
        disabled: false,
        needsNote: true
      });

      actions.push({ 
        action: 'validate', 
        label: 'Valideren', 
        icon: '✅',
        disabled: false
      });
    } else {
      // Mix van m.approved EN andere statussen -> toon alle mogelijke acties
      actions.push({ 
        action: 'start', 
        label: 'Claimen', 
        icon: '🎯',
        disabled: false
      });

      actions.push({ 
        action: 'stuck', 
        label: 'Stagnatie', 
        icon: '⚠️',
        disabled: false,
        needsNote: true
      });

      actions.push({ 
        action: 'validate', 
        label: 'Valideren', 
        icon: '✅',
        disabled: false
      });

      actions.push({ 
        action: 'disapprove', 
        label: 'Afkeur', 
        icon: '❌',
        disabled: false,
        needsNote: true
      });

      actions.push({ 
        action: 'approve', 
        label: 'Naar Approved', 
        icon: '✅',
        disabled: false
      });
    }

    // Unassign - voor documenten waar gebruiker is toegewezen
    const hasAssigned = selectedDocuments.some(doc => doc.assignees.includes(username));
    if (hasAssigned) {
      actions.push({ 
        action: 'unassign', 
        label: 'Unassign mezelf', 
        icon: '↩️',
        disabled: false
      });
    }

    return actions;
  };

  const toggleDocSelection = (path: string) => {
    setSelectedDocs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleAddIdea = (text: string) => {
    if (!text.trim()) return;

    // Detect device information for metadata
    const metadata = {
      ipAddress: '192.168.1.' + Math.floor(Math.random() * 255),
      userAgent: navigator.userAgent,
      browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Safari',
      os: navigator.platform.includes('Win') ? 'Windows' : navigator.platform.includes('Mac') ? 'macOS' : 'Linux',
      device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobiel' : 'Desktop',
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };

    const newIdea: Idea = {
      id: Date.now().toString(),
      text,
      author: username || 'Anoniem',
      timestamp: new Date().toISOString(),
      votes: 0,
      votedBy: new Set(),
      status: 'new',
      metadata
    };

    setIdeas(prev => [newIdea, ...prev]);
    toast.success('Idee toegevoegd! 💡', { duration: 2000 });
  };

  const handleVoteIdea = (id: string) => {
    if (!username) {
      toast.error('Vul eerst je naam in om te stemmen', { duration: 2000 });
      return;
    }

    setIdeas(prev => prev.map(idea => {
      if (idea.id !== id) return idea;

      const newVotedBy = new Set(idea.votedBy);
      const hasVoted = newVotedBy.has(username);

      if (hasVoted) {
        newVotedBy.delete(username);
        toast.info('Stem verwijderd', { duration: 1500 });
      } else {
        newVotedBy.add(username);
        toast.success('Stem toegevoegd! 👍', { duration: 1500 });
      }

      return {
        ...idea,
        votedBy: newVotedBy,
        votes: newVotedBy.size
      };
    }));
  };

  const handleChangeIdeaStatus = (id: string, status: IdeaStatus) => {
    setIdeas(prev => prev.map(idea => 
      idea.id === id ? { ...idea, status } : idea
    ));
  };

  const handleDeleteIdea = (id: string) => {
    setIdeas(prev => prev.filter(idea => idea.id !== id));
  };

  const handleUpdateNote = (id: string, note: string) => {
    setIdeas(prev => prev.map(idea => 
      idea.id === id ? { ...idea, adminNote: note } : idea
    ));
  };

  const handleResetIdeas = () => {
    if (confirm('Weet je zeker dat je ALLE ideeën wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
      setIdeas([]);
      localStorage.removeItem('docflow_ideas');
      toast.success('Alle ideeën verwijderd', { duration: 2000 });
    }
  };

  // Fetch documents from API
  useEffect(() => {
    if (authLoading || !authUser) {
      return;
    }

    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        const response = await api.getDocs({
          // Haal ALTIJD alle documenten op - filtering gebeurt client-side
          // Dit is nodig zodat de status counts correct blijven
          search: searchQuery,
          user: username 
        });
        setDocuments(response);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching documents:', error);
        setIsLoading(false);
        toast.error('Kan geen verbinding maken met de server. Controleer of de Python backend draait.', { duration: 5000 });
      }
    };

    fetchDocuments();

    // Auto-refresh verwijderd - documenten worden alleen geladen bij handmatige refresh of filter wijziging
  }, [searchQuery, username, authLoading, authUser]); // statusFilter is VERWIJDERD uit dependencies!

  if (authRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg] text-[--fg]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-lg font-medium">Doorverwijzen naar Okta…</p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg] text-[--fg]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-lg font-medium">Bezig met aanmelden via Okta…</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg] text-[--fg] p-4">
        <div className="max-w-md w-full bg-white/70 dark:bg-slate-900/70 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-lg space-y-4">
          <h1 className="text-2xl font-bold">Authenticatie mislukt</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">{authError}</p>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                const nextUrl = window.location.href;
                window.location.href = `${api.API_BASE_URL}/api/auth/okta/login?next=${encodeURIComponent(nextUrl)}`;
              }}
            >
              Opnieuw aanmelden
            </Button>
            <Button variant="outline" onClick={() => setAuthError(null)}>
              Terug naar app
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={1500}>
      <div className="min-h-screen bg-[--bg] text-[--fg] transition-colors duration-300">
        <Toaster 
        position="top-right" 
        expand={false} 
        richColors 
        closeButton 
        theme={darkMode ? 'dark' : 'light'}
      />
      
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <img 
                src={logo} 
                alt="DocFlow Logo" 
                className="h-10 select-none cursor-pointer" 
                onClick={handleLogoClick}
                title="DocFlow"
              />
              <div className="w-px h-10 bg-gray-300 dark:bg-gray-600"></div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">DocFlow</h1>
                {isAdmin && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full font-semibold shadow-lg"
                  >
                    ADMIN
                  </motion.span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowIntro(true)}
                  title="Intro openen"
                  className="text-[--fg] hover:bg-[--brand-light] hover:text-[--brand]"
                >
                  <motion.div
                    whileHover={{
                      rotateY: 180,
                      transition: { duration: 0.6 }
                    }}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <BookOpen className="w-5 h-5" />
                  </motion.div>
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowInfo(true)}
                  title="Informatie & Credits"
                  className="text-[--fg] hover:bg-[--brand-light] hover:text-[--brand]"
                >
                  <motion.div
                    whileHover={{
                      rotateY: 180,
                      transition: { duration: 0.6 }
                    }}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <Info className="w-5 h-5" />
                  </motion.div>
                </Button>
              </motion.div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <motion.div 
                className="flex items-center"
                animate={shakeNameInput ? {
                  x: [0, -10, 10, -10, 10, 0],
                  rotate: [0, -2, 2, -2, 2, 0]
                } : {}}
                transition={{ duration: 0.5 }}
              >
                <div className="relative flex items-center border border-[--border] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[--brand] focus-within:border-[--brand] transition-all duration-200 bg-[--bg]">
                  <Input
                    placeholder="Naam…"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveName();
                      }
                    }}
                    className="w-32 h-9 text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[--muted] bg-transparent"
                  />
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="border-l border-[--border]"
                  >
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={handleSaveName}
                      title="Naam opslaan"
                      className="text-[--fg] hover:bg-[--brand-light] hover:text-[--brand] w-9 h-9 rounded-none"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </div>

            <div className="w-px h-9 bg-gray-300 dark:bg-gray-600"></div>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button
                    variant={viewMode === 'mine' ? 'default' : 'outline'}
                    onClick={() => {
                      const newMode = viewMode === 'all' ? 'mine' : 'all';
                      
                      // Check if switching to "mine" without username
                      if (newMode === 'mine' && !username) {
                        setShakeNameInput(true);
                        setTimeout(() => setShakeNameInput(false), 600);
                        toast.error('Vul eerst je naam in om je taken te zien', {
                          duration: 3000,
                        });
                        return; // Don't change viewMode!
                      }
                      
                      // When switching to "mine", set status filter to "all"
                      if (newMode === 'mine') {
                        setStatusFilter('all');
                      }
                      
                      // Only change viewMode if validation passes
                      setViewMode(newMode);
                    }}
                    className={viewMode === 'mine' ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] overflow-hidden group' : 'text-[--fg] border-[--border] hover:bg-[--brand-light] hover:text-[--brand] overflow-hidden group'}
                  >
                    <motion.div
                      whileHover={{
                        scale: 1.1
                      }}
                      transition={{
                        duration: 0.2,
                        ease: "easeOut"
                      }}
                      className="inline-block mr-2"
                    >
                      <User className="w-4 h-4" />
                    </motion.div>
                    {viewMode === 'all' ? 'Mijn taken' : 'Alle taken'}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{viewMode === 'all' ? 'Toon alleen mijn toegewezen taken' : 'Toon alle taken'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    variant="outline"
                    onClick={() => setShowStats(true)}
                    className="text-[--fg] border-[--border] hover:bg-[--brand-light] hover:text-[--brand] overflow-hidden"
                  >
                    <motion.div
                      whileHover={{
                        scale: 1.1
                      }}
                      transition={{
                        duration: 0.2,
                        ease: "easeOut"
                      }}
                      className="inline-block mr-2"
                    >
                      📊
                    </motion.div>
                    Statistieken
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bekijk statistieken en grafieken</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    variant={bulkMode ? 'default' : 'outline'}
                    onClick={() => {
                      setBulkMode(!bulkMode);
                      if (bulkMode) setSelectedDocs(new Set());
                    }}
                    className={bulkMode ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] overflow-hidden' : 'text-[--fg] border-[--border] hover:bg-[--brand-light] hover:text-[--brand] overflow-hidden'}
                  >
                    <AnimatePresence mode="wait">
                      {bulkMode ? (
                        <motion.div
                          key="open"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 180 }}
                          transition={{ duration: 0.3 }}
                          className="inline-block mr-2"
                        >
                          <PackageOpen className="w-4 h-4" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="closed"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 180 }}
                          whileHover={{ 
                            rotateY: 15,
                            rotateX: -10,
                            scale: 1.1
                          }}
                          transition={{ duration: 0.3 }}
                          className="inline-block mr-2"
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          <Package className="w-4 h-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    Bulk
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bewerk meerdere documenten tegelijk</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button 
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNotifications(true)}
                    className="relative text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 hover:text-yellow-700 dark:hover:text-yellow-300 hover:border-yellow-400 dark:hover:border-yellow-600 overflow-visible"
                  >
                    <motion.div
                      animate={notifCount > 0 ? {
                        rotate: [0, -20, 20, -20, 20, 0],
                      } : {}}
                      transition={{
                        duration: 0.8,
                        repeat: notifCount > 0 ? Infinity : 0,
                        repeatDelay: 3
                      }}
                      className="inline-block"
                    >
                      <Bell className="w-4 h-4" />
                    </motion.div>
                    <AnimatePresence>
                      {notifCount > 0 && (
                        <motion.span 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold shadow-lg border-2 border-white dark:border-gray-900"
                        >
                          {notifCount}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bekijk recente wijzigingen in jouw taken</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    variant="outline"
                    size="icon"
                    onClick={() => setShowFileHelper(true)}
                    className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-300 hover:border-green-400 dark:hover:border-green-600 overflow-hidden"
                  >
                    <motion.div
                      whileHover={{
                        scale: 1.1,
                        rotate: [0, 3, -3, 0]
                      }}
                      transition={{ duration: 0.3 }}
                      className="inline-block"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </motion.div>
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download de Python File Helper</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button 
                    variant="outline"
                    size="icon"
                    onClick={() => setShowIdeas(true)}
                    className="text-[#0077C8] dark:text-[#38bdf8] border-[#0077C8]/30 dark:border-[#38bdf8]/30 hover:bg-[#0077C8]/10 dark:hover:bg-[#0077C8]/20 hover:text-[#0077C8] dark:hover:text-[#38bdf8] hover:border-[#0077C8]/50 dark:hover:border-[#38bdf8]/50 overflow-visible"
                  >
                    <motion.div
                      animate={{
                        rotate: [0, -10, 10, -10, 10, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 3
                      }}
                      className="inline-block"
                    >
                      <Lightbulb className="w-4 h-4" />
                    </motion.div>
                    <AnimatePresence>
                      {!ideasBadgeSeen && ideas.filter(i => i.status === 'new').length > 0 && (
                        <motion.span 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-[#0077C8] dark:bg-[#38bdf8] text-white text-xs rounded-full flex items-center justify-center font-semibold shadow-lg border-2 border-white dark:border-gray-900"
                        >
                          {ideas.filter(i => i.status === 'new').length}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Deel je ideeën en suggesties</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleToggleTheme}
                    className={darkMode 
                      ? "text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 hover:border-indigo-400 dark:hover:border-indigo-600 overflow-hidden"
                      : "text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-400 dark:hover:border-amber-600 overflow-hidden"
                    }
                  >
                    <AnimatePresence mode="wait">
                      {darkMode ? (
                        <motion.div
                          key="sun"
                          initial={{ rotate: -90, scale: 0 }}
                          animate={{ rotate: 0, scale: 1 }}
                          exit={{ rotate: 90, scale: 0 }}
                          transition={{ duration: 0.3 }}
                          className="inline-block"
                        >
                          <Sun className="w-4 h-4" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="moon"
                          initial={{ rotate: 90, scale: 0 }}
                          animate={{ rotate: 0, scale: 1 }}
                          exit={{ rotate: -90, scale: 0 }}
                          transition={{ duration: 0.3 }}
                          className="inline-block"
                        >
                          <Moon className="w-4 h-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{darkMode ? 'Schakel naar lichtmodus' : 'Schakel naar donkermodus'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-[--card] border border-[--border] rounded-2xl shadow-[--shadow] p-4 mb-4 relative">
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-[--card]/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-[--brand]">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Documenten laden...</span>
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-[--muted]">Status:</span>
              <Button
                variant={statusFilter === 'concept' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('concept')}
                disabled={viewMode === 'mine'}
                className={statusFilter === 'concept' ? '!bg-blue-600 !text-white hover:!bg-blue-700 dark:!bg-blue-500 dark:hover:!bg-blue-600 gap-1.5' : viewMode === 'mine' ? 'opacity-40 cursor-not-allowed gap-1.5' : 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 gap-1.5'}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Concept ({documents.filter(d => d.status === 'concept').length})
              </Button>
              <Button
                variant={statusFilter === 'ongoing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('ongoing')}
                disabled={viewMode === 'mine'}
                className={statusFilter === 'ongoing' ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] gap-1.5' : viewMode === 'mine' ? 'opacity-40 cursor-not-allowed gap-1.5' : 'text-[#0077C8] dark:text-[#38bdf8] border-[#0077C8]/30 dark:border-[#38bdf8]/30 hover:bg-[#0077C8]/10 dark:hover:bg-[#0077C8]/20 gap-1.5'}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Ongoing ({documents.filter(d => d.status === 'ongoing').length})
              </Button>
              <Button
                variant={statusFilter === 'stuck' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('stuck')}
                disabled={viewMode === 'mine'}
                className={statusFilter === 'stuck' ? '!bg-orange-600 !text-white hover:!bg-orange-700 dark:!bg-orange-500 dark:hover:!bg-orange-600 gap-1.5' : viewMode === 'mine' ? 'opacity-40 cursor-not-allowed gap-1.5' : 'text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 gap-1.5'}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Stagnatie ({documents.filter(d => d.status === 'stuck').length})
              </Button>
              <Button
                variant={statusFilter === 'm.approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('m.approved')}
                disabled={viewMode === 'mine'}
                className={statusFilter === 'm.approved' ? '!bg-purple-600 !text-white hover:!bg-purple-700 dark:!bg-purple-500 dark:hover:!bg-purple-600 gap-1.5' : viewMode === 'mine' ? 'opacity-40 cursor-not-allowed gap-1.5' : 'text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 gap-1.5'}
              >
                <Clock className="w-3.5 h-3.5" />
                Valideren ({documents.filter(d => d.status === 'm.approved').length})
              </Button>
              <Button
                variant={statusFilter === 'approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('approved')}
                disabled={viewMode === 'mine'}
                className={statusFilter === 'approved' ? '!bg-green-600 !text-white hover:!bg-green-700 dark:!bg-green-500 dark:hover:!bg-green-600 gap-1.5' : viewMode === 'mine' ? 'opacity-40 cursor-not-allowed gap-1.5' : 'text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 gap-1.5'}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved ({documents.filter(d => d.status === 'approved').length})
              </Button>
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all' ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] gap-1.5' : 'gap-1.5'}
              >
                <Package className="w-3.5 h-3.5" />
                Alle ({documents.length})
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--muted]" />
                <Input
                  placeholder="Zoeken..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 w-60 border-[--border] focus:border-[--brand]"
                />
              </div>

              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title="Ververs"
                  className="text-[--fg] hover:bg-[--brand-light] hover:text-[--brand]"
                >
                  <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Sorting */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[--border]">
            <span className="text-sm font-medium text-[--muted]">Sorteren:</span>
            <div className="flex gap-1.5">
              <Button
                variant={sortBy === 'name' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSortClick('name')}
                className={sortBy === 'name' ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] gap-1.5' : 'gap-1.5 hover:bg-[--brand-light] hover:text-[--brand]'}
              >
                <FileText className="w-3.5 h-3.5" />
                Naam
                {sortBy === 'name' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
                )}
              </Button>
              <Button
                variant={sortBy === 'size' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSortClick('size')}
                className={sortBy === 'size' ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] gap-1.5' : 'gap-1.5 hover:bg-[--brand-light] hover:text-[--brand]'}
              >
                <HardDrive className="w-3.5 h-3.5" />
                Geheugen
                {sortBy === 'size' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
                )}
              </Button>
              <Button
                variant={sortBy === 'type' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSortClick('type')}
                className={sortBy === 'type' ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] gap-1.5' : 'gap-1.5 hover:bg-[--brand-light] hover:text-[--brand]'}
              >
                <FileType className="w-3.5 h-3.5" />
                File type
                {sortBy === 'type' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
                )}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant={sortBy === 'assignees' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleSortClick('assignees')}
                      disabled={statusFilter === 'concept' || statusFilter === 'approved'}
                      className={
                        (statusFilter === 'concept' || statusFilter === 'approved')
                          ? 'opacity-40 cursor-not-allowed gap-1.5' 
                          : sortBy === 'assignees' 
                            ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] gap-1.5' 
                            : 'gap-1.5 hover:bg-[--brand-light] hover:text-[--brand]'
                      }
                    >
                      <User className="w-3.5 h-3.5" />
                      Toegewezen
                      {sortBy === 'assignees' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {(statusFilter === 'concept' || statusFilter === 'approved') && (
                  <TooltipContent>
                    <p>{statusFilter === 'concept' ? 'Concept documenten hebben geen toegewezen gebruikers' : 'Approved documenten hebben geen toegewezen gebruikers'}</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant={sortBy === 'status' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleSortClick('status')}
                      disabled={statusFilter !== 'all'}
                      className={
                        statusFilter !== 'all'
                          ? 'opacity-40 cursor-not-allowed gap-1.5'
                          : sortBy === 'status' 
                            ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] gap-1.5' 
                            : 'gap-1.5 hover:bg-[--brand-light] hover:text-[--brand]'
                      }
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Status
                      {sortBy === 'status' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {statusFilter !== 'all' && (
                  <TooltipContent>
                    <p>Alle documenten in deze weergave hebben dezelfde status</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <Button
                variant={sortBy === 'duplicates' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSortClick('duplicates')}
                className={sortBy === 'duplicates' ? '!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9] gap-1.5' : 'gap-1.5 hover:bg-[--brand-light] hover:text-[--brand]'}
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicaten
                {sortBy === 'duplicates' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {bulkMode && selectedDocs.size > 0 && (() => {
            const availableActions = getAvailableBulkActions();
            return (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-[#0077C8] dark:bg-[#38bdf8] text-white rounded-2xl shadow-lg p-4 mb-4 flex items-center justify-between"
              >
                <span className="font-medium">
                  {selectedDocs.size} document{selectedDocs.size > 1 ? 'en' : ''} geselecteerd
                </span>
                <div className="flex gap-2 flex-wrap">
                  {availableActions.length > 0 ? (
                    availableActions.map((action) => {
                      return (
                        <Button
                          key={action.action}
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (action.needsNote) {
                              const note = prompt(
                                action.action === 'stuck' 
                                  ? 'Reden voor stagnatie:' 
                                  : 'Reden voor afkeuring:'
                              );
                              if (note !== null) {
                                handleBulkAction(action.action, note);
                              }
                            } else {
                              handleBulkAction(action.action);
                            }
                          }}
                          disabled={action.disabled}
                          className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1.5"
                        >
                          {action.icon}
                          {action.label}
                        </Button>
                      );
                    })
                  ) : (
                    <span className="text-white/70 text-sm">
                      Geen acties beschikbaar voor deze selectie
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedDocs(new Set())}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    Wis selectie
                  </Button>
                </div>
              </motion.div>
            );
          })()}\n        </AnimatePresence>

        {/* "Mijn taken" Banner - subtiele visuele indicatie */}
        <AnimatePresence>
          {viewMode === 'mine' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mb-4 bg-gradient-to-r from-[#0077C8]/10 to-[#0077C8]/5 dark:from-[#38bdf8]/10 dark:to-[#38bdf8]/5 border border-[#0077C8]/20 dark:border-[#38bdf8]/20 rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0077C8]/10 dark:bg-[#38bdf8]/10">
                <User className="w-4 h-4 text-[#0077C8] dark:text-[#38bdf8]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#0077C8] dark:text-[#38bdf8]">
                  Je bekijkt je toegewezen taken
                </p>
                <p className="text-xs text-[--muted] mt-0.5">
                  Alleen documenten toegewezen aan {username} worden getoond
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-[--card] border border-[--border] rounded-2xl p-4 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Documents Grid - met gereduceerde animaties voor performance */}
        {!isLoading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedDocuments.map((doc) => (
                <div key={doc.path}>
                  <DocumentCard
                    document={doc}
                    currentUser={username}
                    onAction={handleDocumentAction}
                    bulkMode={bulkMode}
                    isSelected={selectedDocs.has(doc.path)}
                    onToggleSelect={() => toggleDocSelection(doc.path)}
                    isAdmin={isAdmin}
                  />
                </div>
              ))}
            </div>

            {/* Infinite scroll sentinel & loading indicator */}
            {filteredDocuments.length > 0 && (
              <div className="text-center mt-6 mb-4">
                {hasMore ? (
                  <div ref={observerTarget} className="py-4">
                    {isLoadingMore ? (
                      <div className="flex items-center justify-center gap-2 text-[--brand]">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Meer documenten laden...</span>
                      </div>
                    ) : (
                      <div className="text-sm text-[--muted]">
                        Scroll naar beneden voor meer documenten
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-sm text-[--muted]">
                    Alle {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 'en' : ''} geladen
                  </div>
                )}
              </div>
            )}

            {/* No results message */}
            {filteredDocuments.length === 0 && (
              <p className="py-8 text-center text-[--muted]">Geen documenten gevonden</p>
            )}
          </>
        )}

        {/* Update time */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mt-6 text-sm text-[--muted]"
        >
          Laatst bijgewerkt: {lastUpdate.toLocaleTimeString('nl-NL')}
        </motion.div>
      </div>

      {/* Dialogs */}
      <IntroDialog open={showIntro} onOpenChange={setShowIntro} />
      <InfoDialog open={showInfo} onOpenChange={setShowInfo} />
      <StatsDialog 
        open={showStats} 
        onOpenChange={setShowStats} 
        documents={documents}
        currentUser={username}
        isAdmin={isAdmin}
      />
      <NotificationDialog 
        open={showNotifications} 
        onOpenChange={setShowNotifications} 
        documents={documents}
        currentUser={username}
      />
      <FileHelperDialog open={showFileHelper} onOpenChange={setShowFileHelper} />
      <IdeaDialog
        open={showIdeas}
        onOpenChange={setShowIdeas}
        ideas={ideas}
        onAddIdea={handleAddIdea}
        onVoteIdea={handleVoteIdea}
        onChangeStatus={handleChangeIdeaStatus}
        onDeleteIdea={handleDeleteIdea}
        onUpdateNote={handleUpdateNote}
        onResetIdeas={handleResetIdeas}
        currentUser={username}
        isAdmin={isAdmin}
      />
      </div>
    </TooltipProvider>
  );
}