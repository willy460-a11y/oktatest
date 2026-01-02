import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { motion } from 'motion/react';
import flowchartImage from '../imports/intro-3.png';

interface InfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InfoDialog({ open, onOpenChange }: InfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Over DocFlow</DialogTitle>
          <DialogDescription className="text-sm mt-1">
            Informatie en workflow overzicht
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* About section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-[--border]"
          >
            <h3 className="text-lg mb-3">Over DocFlow</h3>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>
                DocFlow is een web applicatie voor efficiënt documentbeheer, 
                speciaal ontwikkeld voor Trescal teams.
              </p>
              <p>
                De applicatie biedt real-time status tracking, voor optimale workflow efficiency, 
                waardoor planning minimaal is en mensen autonoom aan de slag kunnen gaan.
              </p>
              <p className="pt-2">
                Gebouwd met React, TypeScript, Tailwind CSS, en Python Flask backend
              </p>
            </div>
          </motion.div>

          {/* Workflow diagram */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-[--border]"
          >
            <h3 className="text-lg mb-4">Workflow overzicht</h3>
            <div className="bg-white dark:bg-gray-950 rounded-lg p-4 border border-[--border]">
              <img 
                src={flowchartImage} 
                alt="DocFlow workflow diagram" 
                className="w-full h-auto rounded-lg"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              Dit diagram toont de complete workflow van template claim tot en met goedkeuring en validatie.
            </p>
          </motion.div>

          {/* Credits section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-[--border]"
          >
            <h3 className="text-lg mb-3">Credits</h3>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div>
                <p className="font-semibold text-[#0077C8] dark:text-[#38bdf8]">Ontwikkeling & Design</p>
                <p>Oorspronkelijke Python applicatie (v4.9 docflow.py, 2800 regels)</p>
                <p>Web interface redesign met React/TypeScript</p>
              </div>
              <div>
                <p className="font-semibold text-[#0077C8] dark:text-[#38bdf8]">Technologie Stack</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Frontend: React, TypeScript, Tailwind CSS</li>
                  <li>UI Components: ShadCN UI</li>
                  <li>Charts: Recharts</li>
                  <li>Animaties: Motion (Framer Motion)</li>
                  <li>Backend: Python Flask API</li>
                  <li>Beveiliging: Okta</li>
                  <li>Icons: Lucide React</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[#0077C8] dark:text-[#38bdf8]">Ontwikkeling & Contact</p>
                <p>
                  Voor collega's die geïnteresseerd zijn in de code, deze willen leren, 
                  of zelf een project willen opstarten: neem contact op via Teams{' '}
                  <a 
                    href="https://teams.microsoft.com/l/chat/0/0?users=willy.spencer@trescal.com" 
                    className="text-[#0077C8] dark:text-[#38bdf8] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    willy.spencer@trescal.com
                  </a>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Version info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="text-center py-4 border-t border-[--border]"
          >
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}