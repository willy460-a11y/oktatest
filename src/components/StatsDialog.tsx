import { useMemo, useState, useEffect } from 'react';
import { Document } from '../types/docflow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'motion/react';
import { FileText, Copy, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { getStats, resetStats, type GetStatsResponse } from '../lib/api';
import { toast } from 'sonner@2.0.3';

interface StatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: Document[];
  currentUser: string;
  isAdmin: boolean;
}

export function StatsDialog({ open, onOpenChange, documents, currentUser, isAdmin }: StatsDialogProps) {
  const [statsData, setStatsData] = useState<GetStatsResponse | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Fetch stats from backend
  useEffect(() => {
    if (open) {
      loadStats();
    }
  }, [open]);

  const loadStats = async () => {
    try {
      const data = await getStats();
      setStatsData(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error('Kon statistieken niet laden');
    }
  };

  const handleReset = async () => {
    if (!isAdmin) return;
    
    const conceptCount = documents.filter(d => !d.ignored && d.status === 'concept').length;
    
    if (!confirm(`Weet je zeker dat je de statistieken wilt resetten?\n\nDit zal de startdatum naar nu zetten en het initiële concept aantal op ${conceptCount} zetten.`)) {
      return;
    }

    setIsResetting(true);
    try {
      await resetStats({
        user: currentUser,
        initial_concept_count: conceptCount
      });
      toast.success('Statistieken zijn gereset');
      await loadStats();
    } catch (error) {
      console.error('Failed to reset stats:', error);
      toast.error('Kon statistieken niet resetten');
    } finally {
      setIsResetting(false);
    }
  };

  const stats = useMemo(() => {
    const filtered = documents.filter(d => !d.ignored);
    
    const counts = {
      total: filtered.length,
      concept: filtered.filter(d => d.status === 'concept').length,
      ongoing: filtered.filter(d => d.status === 'ongoing').length,
      stuck: filtered.filter(d => d.status === 'stuck').length,
      'm.approved': filtered.filter(d => d.status === 'm.approved').length,
      approved: filtered.filter(d => d.status === 'approved').length,
      duplicates: filtered.filter(d => d.dup_concept_approved).length,
      openTasks: filtered.filter(d => ['ongoing', 'm.approved', 'stuck'].includes(d.status)).length,
    };

    // Calculate percentages based on concept map files only (not approved files)
    const conceptMapTotal = counts.concept + counts.ongoing + counts.stuck + counts['m.approved'];
    const pctApproved = counts.total ? Math.round((counts.approved / counts.total) * 100) : 0;
    const pctConcept = conceptMapTotal ? Math.round((counts.concept / conceptMapTotal) * 100) : 0;
    const pctOngoing = conceptMapTotal ? Math.round((counts.ongoing / conceptMapTotal) * 100) : 0;
    const pctValidate = conceptMapTotal ? Math.round((counts['m.approved'] / conceptMapTotal) * 100) : 0;
    const pctStuck = conceptMapTotal ? Math.round((counts.stuck / conceptMapTotal) * 100) : 0;

    return {
      counts,
      percentages: { pctApproved, pctConcept, pctOngoing, pctValidate, pctStuck },
      conceptMapTotal,
    };
  }, [documents, statsData]);

  const statusData = [
    { name: 'Concept', count: stats.counts.concept, pct: stats.percentages.pctConcept, color: '#0077C8', bgColor: 'bg-[#0077C8]' },
    { name: 'Ongoing', count: stats.counts.ongoing, pct: stats.percentages.pctOngoing, color: '#fbbf24', bgColor: 'bg-[#fbbf24]' },
    { name: 'Valideren', count: stats.counts['m.approved'], pct: stats.percentages.pctValidate, color: '#10b981', bgColor: 'bg-[#10b981]' },
    { name: 'Stagnatie', count: stats.counts.stuck, pct: stats.percentages.pctStuck, color: '#ef4444', bgColor: 'bg-[#ef4444]' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] flex flex-col bg-gray-50 dark:bg-gray-950 p-3 sm:p-4 lg:p-6 overflow-hidden">
        {/* Header - fixed height */}
        <DialogHeader className="flex-shrink-0 pb-2 sm:pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl sm:text-2xl lg:text-3xl">Statistieken Dashboard</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm mt-1">
                Overzicht van documentstatistieken en voortgang
              </DialogDescription>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isResetting}
                className="gap-2"
              >
                <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
                Reset statistieken
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content - takes remaining space, no scroll */}
        <div className="flex-1 flex flex-col gap-2 sm:gap-3 lg:gap-4 min-h-0 overflow-hidden">
          {/* KPI Cards Grid - fixed proportion of space */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            <KPICard 
              label="Totaal bestanden" 
              value={stats.counts.total}
              icon={FileText}
              gradient="from-blue-500 to-cyan-500"
              delay={0}
            />
            <KPICard 
              label="% Approved" 
              value={`${stats.percentages.pctApproved}%`}
              subtitle={`Aantal: ${stats.counts.approved}`}
              icon={CheckCircle2}
              gradient="from-green-500 to-emerald-500"
              delay={0.1}
            />
            <KPICard 
              label="Duplicaten" 
              value={stats.counts.duplicates}
              icon={Copy}
              gradient="from-purple-500 to-pink-500"
              delay={0.2}
            />
            <KPICard 
              label="Open taken" 
              value={stats.counts.openTasks}
              icon={AlertCircle}
              gradient="from-orange-500 to-red-500"
              delay={0.3}
            />
          </div>

          {/* Charts Grid - takes remaining space */}
          <div className="grid md:grid-cols-2 gap-2 sm:gap-3 lg:gap-4 flex-1 min-h-0">
            {/* Status Distribution */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.3 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg sm:rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg hover:shadow-xl transition-shadow flex flex-col min-h-0"
            >
              <h3 className="text-sm sm:text-base lg:text-xl mb-2 sm:mb-3 lg:mb-4 flex-shrink-0">Status verdeling</h3>
              <div className="flex-1 flex flex-col justify-around min-h-0">
                {statusData.map((item, index) => (
                  <StatusBar 
                    key={item.name}
                    name={item.name}
                    count={item.count}
                    pct={item.pct}
                    color={item.color}
                    bgColor={item.bgColor}
                    delay={0.7 + index * 0.1}
                  />
                ))}
              </div>
            </motion.div>

            {/* Weekly Validation Chart */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.3 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg sm:rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg hover:shadow-xl transition-shadow flex flex-col min-h-0"
            >
              <h3 className="text-sm sm:text-base lg:text-xl mb-2 sm:mb-3 lg:mb-4 flex-shrink-0">Valideren per week</h3>
              <div className="flex-1 min-h-0">
                {statsData?.weekly_validation && statsData.weekly_validation.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData.weekly_validation} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                      <XAxis 
                        dataKey="week" 
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          fontSize: '12px'
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="url(#colorGradient)" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={35}
                      />
                      <defs>
                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#059669" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Geen data beschikbaar</p>
                      <p className="text-xs mt-1">Backend moet weekly validation data leveren</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KPICard({ 
  label, 
  value, 
  subtitle, 
  icon: Icon,
  gradient,
  delay 
}: { 
  label: string; 
  value: string | number; 
  subtitle?: string;
  icon: React.ElementType;
  gradient: string;
  delay: number;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg sm:rounded-xl lg:rounded-2xl p-2 sm:p-3 lg:p-4 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
    >
      <div className="flex items-start justify-between mb-1 sm:mb-2">
        <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 dark:text-gray-400 leading-tight pr-1">{label}</div>
        <div className={`p-1 sm:p-1.5 lg:p-2 rounded-md sm:rounded-lg bg-gradient-to-br ${gradient} bg-opacity-10 flex-shrink-0`}>
          <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-white" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.3))' }} />
        </div>
      </div>
      <div className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl mb-0.5 sm:mb-1 bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent leading-tight">
        {value}
      </div>
      {subtitle && (
        <div className="text-[9px] sm:text-[10px] lg:text-xs text-gray-500 dark:text-gray-500">{subtitle}</div>
      )}
    </motion.div>
  );
}

function StatusBar({ 
  name, 
  count, 
  pct, 
  color, 
  bgColor,
  delay 
}: { 
  name: string; 
  count: number; 
  pct: number; 
  color: string;
  bgColor: string;
  delay: number;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center gap-2 sm:gap-3 lg:gap-4"
    >
      {/* Colored bar */}
      <motion.div 
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: delay + 0.2, duration: 0.4 }}
        className={`w-1 sm:w-1.5 lg:w-2 h-8 sm:h-10 lg:h-12 ${bgColor} rounded-full origin-top flex-shrink-0`}
      />
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5 sm:mb-1">
          <span className="text-[10px] sm:text-xs lg:text-sm text-gray-700 dark:text-gray-300 truncate">{name}: {count} ({pct}%)</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 sm:h-2 lg:h-2.5 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: delay + 0.3, duration: 0.6, ease: "easeOut" }}
            className={`h-full ${bgColor} rounded-full`}
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
    </motion.div>
  );
}