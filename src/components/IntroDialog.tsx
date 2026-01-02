import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, CheckCircle2, Zap, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';
// ℹ️ Om intro afbeeldingen te vervangen: plaats intro-1.png, intro-2.png, intro-3.png in /imports/ folder
import introImage1 from '../imports/intro-1.png';
import introImage2 from '../imports/intro-2.png';
import introImage3 from '../imports/intro-3.png';

interface IntroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const introPages = [
  {
    title: 'Welkom bij DocFlow',
    subtitle: 'Slimmer documentbeheer voor moderne teams',
    content: [
      'Documentworkflow van Concept → Approved',
      'Real-time samenwerking en tracking',
      'Automatische notificaties en updates',
      'Eén platform voor alle documenten'
    ],
    image: introImage1,
    icon: CheckCircle2,
    gradient: 'from-blue-600 to-cyan-500',
  },
  {
    title: 'Autonoom werken, maximale flow',
    subtitle: 'Neem de regie over je werk',
    content: [
      'Claim documenten en werk zonder wachttijd',
      'Directe feedback met statusupdates',
      'Los blokkades op met één klik',
      'Transparante voortgang voor iedereen'
    ],
    image: introImage2,
    icon: Zap,
    gradient: 'from-orange-600 to-pink-500',
  },
  {
    title: 'Volledige controle & inzicht',
    subtitle: 'Dashboard met real-time statistieken',
    content: [
      'Zie in één oogopslag alle actieve documenten',
      'Filter op status, eigenaar of type',
      'Bulkacties voor efficiënt werken',
      'Historie en audittrail per document'
    ],
    image: introImage3,
    icon: BarChart3,
    gradient: 'from-purple-600 to-blue-500',
  },
];

export function IntroDialog({ open, onOpenChange }: IntroDialogProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    if (currentPage < introPages.length - 1) {
      setDirection(1);
      setCurrentPage(currentPage + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setDirection(-1);
      setCurrentPage(currentPage - 1);
    }
  };

  const handleClose = () => {
    localStorage.setItem('docflow_intro_dismissed_v2', 'true'); // v2 om oude sessies te resetten
    onOpenChange(false);
    setTimeout(() => setCurrentPage(0), 300);
  };

  const page = introPages[currentPage];
  const Icon = page.icon;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">{page.title}</DialogTitle>
        <DialogDescription className="sr-only">Introductie van DocFlow</DialogDescription>
        
        <div className="relative overflow-hidden bg-white dark:bg-gray-900">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentPage}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
            >
              {/* Image Header */}
              <div className="relative h-48 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60 z-10" />
                <ImageWithFallback 
                  src={page.image} 
                  alt={page.title}
                  className="w-full h-full object-cover"
                />
                
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${page.gradient} opacity-30 z-20`} />
                
                {/* Icon */}
                <div className="absolute top-6 left-6 z-30">
                  <div className="bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/30">
                    <Icon className="w-8 h-8 text-white drop-shadow-lg" />
                  </div>
                </div>

                {/* Step indicator */}
                <div className="absolute top-6 right-6 z-30">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${page.gradient} text-white shadow-lg`}>
                    Stap {currentPage + 1} van {introPages.length}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2 text-[--fg]">
                    {page.title}
                  </h2>
                  <p className="text-[--muted]">
                    {page.subtitle}
                  </p>
                </div>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {page.content.map((item, index) => (
                    <li 
                      key={index}
                      className="flex items-start gap-3"
                    >
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r ${page.gradient} flex items-center justify-center mt-0.5`}>
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm text-[--fg]">{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Navigation */}
                <div className="pt-6 border-t border-[--border]">
                  {/* Progress indicators */}
                  <div className="flex justify-center gap-2 mb-6">
                    {introPages.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setDirection(index > currentPage ? 1 : -1);
                          setCurrentPage(index);
                        }}
                        className={`transition-all duration-300 rounded-full ${
                          index === currentPage 
                            ? `bg-gradient-to-r ${page.gradient} w-8 h-2` 
                            : 'bg-gray-300 dark:bg-gray-700 w-2 h-2 hover:bg-gray-400 dark:hover:bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-between items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={handlePrev}
                      disabled={currentPage === 0}
                      className="text-[--fg] border-[--border] hover:bg-[--brand-light] disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Vorige
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={handleClose}
                      className="text-[--muted] hover:text-[--fg]"
                    >
                      Overslaan
                    </Button>

                    {currentPage < introPages.length - 1 ? (
                      <Button 
                        onClick={handleNext}
                        className="!bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9]"
                      >
                        Volgende
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleClose}
                        className="!bg-green-600 !text-white hover:!bg-green-700"
                      >
                        Start DocFlow
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}