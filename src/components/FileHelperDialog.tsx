import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Download, Minimize2, Settings, Zap, Shield, FileSpreadsheet, Folder } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "sonner@2.0.3";
import { FILE_HELPER_CONFIG, NETWORK_PATHS } from "../lib/config";

interface FileHelperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileHelperDialog({ open, onOpenChange }: FileHelperDialogProps) {
  const [helperStatus, setHelperStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHelperStatus = async () => {
    setHelperStatus('checking');
    
    try {
      // Eerst proberen via de File Helper (direct connection)
      try {
        const localResponse = await fetch(`${FILE_HELPER_CONFIG.BASE_URL}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000), // 2 second timeout
        });
        
        if (localResponse.ok) {
          setHelperStatus('active');
          setLastCheck(new Date());
          toast.success('DocFlow File Helper is actief! 🎉', { duration: 2000 });
          return;
        }
      } catch (localError) {
        // Local check failed, try via backend
      }
      
      // Als directe check faalt, probeer via backend API
      const backendResponse = await fetch('/api/file-helper/status', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      
      if (backendResponse.ok) {
        const data = await backendResponse.json();
        if (data.status === 'active') {
          setHelperStatus('active');
          setLastCheck(new Date());
          toast.success('DocFlow File Helper is actief via backend! 🎉', { duration: 2000 });
          return;
        }
      }
      
      // Both failed
      setHelperStatus('inactive');
      setLastCheck(new Date());
    } catch (error) {
      setHelperStatus('inactive');
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    if (open) {
      checkHelperStatus();
    }
  }, [open]);

  const getStatusBadge = () => {
    switch (helperStatus) {
      case 'checking':
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            Controleren...
          </Badge>
        );
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Actief in systeem tray
          </Badge>
        );
      case 'inactive':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Niet actief
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: helperStatus === 'active' ? 360 : 0 }}
              transition={{ duration: 2, ease: "easeInOut" }}
            >
              <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" />
            </motion.div>
            DocFlow File Helper
          </DialogTitle>
          <DialogDescription>
            Open documenten rechtstreeks vanuit DocFlow - Draait op de achtergrond
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Section */}
          <div className="bg-[--card-soft] p-4 rounded-lg border border-[--border]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <motion.div
                  animate={helperStatus === 'checking' ? { rotate: 360 } : {}}
                  transition={{ duration: 1, repeat: helperStatus === 'checking' ? Infinity : 0, ease: "linear" }}
                >
                  {helperStatus === 'active' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : helperStatus === 'inactive' ? (
                    <XCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                  )}
                </motion.div>
                Helper Status
              </h3>
              {getStatusBadge()}
            </div>
            
            {lastCheck && (
              <p className="text-xs text-[--muted] mb-3">
                Laatst gecontroleerd: {lastCheck.toLocaleTimeString()}
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={checkHelperStatus}
              disabled={helperStatus === 'checking'}
              className="w-full transition-all duration-150 hover:scale-[1.02]"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${helperStatus === 'checking' ? 'animate-spin' : ''}`} />
              Opnieuw controleren
            </Button>
          </div>

          {/* What is it? */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[--brand]" />
              Wat is de DocFlow File Helper?
            </h3>
            <p className="text-sm text-[--muted]">
              Een lichtgewicht programma dat <strong>op de achtergrond draait</strong> in je system tray (taakbalk). 
              Het maakt het mogelijk om bestanden (Excel, Word, etc.) direct te openen vanuit de DocFlow web interface.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Minimize2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-200">Achtergrond Proces</p>
                    <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                      Draait onzichtbaar in system tray, geen terminal venster
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-green-900 dark:text-green-200">Instant Open</p>
                    <p className="text-xs text-green-800 dark:text-green-300 mt-1">
                      Bestanden openen direct in hun applicatie met één klik
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/10 p-3 rounded border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-2">
                  <Settings className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-purple-900 dark:text-purple-200">Auto-Start</p>
                    <p className="text-xs text-purple-800 dark:text-purple-300 mt-1">
                      Optioneel opstarten bij Windows boot
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-orange-900 dark:text-orange-200">Lokaal & Veilig</p>
                    <p className="text-xs text-orange-800 dark:text-orange-300 mt-1">
                      Draait alleen lokaal, geen internet verbinding nodig
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-900 dark:text-yellow-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Waarom nodig?</strong> Browsers kunnen om veiligheidsredenen geen lokale bestanden openen. 
                  De File Helper fungeert als veilige "brug" tussen DocFlow en je lokale documenten.
                </span>
              </p>
            </div>
          </div>

          {/* Installation Instructions */}
          {helperStatus === 'inactive' && (
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="font-medium flex items-center gap-2">
                <Download className="w-5 h-5 text-[--brand]" />
                Installatie - Super Simpel! 🚀
              </h3>
              
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 p-4 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0077C8] text-white font-bold flex-shrink-0">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-2">Download DocFlowFileHelper.exe</p>
                      <Button
                        className="w-full !bg-[#0077C8] !text-white hover:!bg-[#005fa3] dark:!bg-[#38bdf8] dark:hover:!bg-[#0ea5e9]"
                        onClick={async () => {
                          try {
                            // Download from backend API
                            const response = await fetch('/api/download/docflow-file-helper', {
                              method: 'GET',
                            });
                            
                            if (!response.ok) {
                              throw new Error('Download failed');
                            }
                            
                            // Create blob and download
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'DocFlowFileHelper.exe';
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            
                            toast.success('Download gestart! 🎉', {
                              duration: 3000,
                              description: 'DocFlowFileHelper.exe wordt gedownload'
                            });
                          } catch (error) {
                            toast.error('Download mislukt', {
                              duration: 3000,
                              description: 'Neem contact op met IT support'
                            });
                          }
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download DocFlowFileHelper.exe (± 8 MB)
                      </Button>
                      <p className="text-xs text-[--muted] mt-2">
                        💾 Geen installatie nodig - gewoon één EXE bestand!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-4 rounded-lg border-2 border-green-300 dark:border-green-700">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white font-bold flex-shrink-0">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-2">Dubbelklik op DocFlowFileHelper.exe</p>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                        <p className="text-xs text-[--muted] mb-2">Het programma start automatisch en:</p>
                        <ul className="text-xs space-y-1 text-[--muted]">
                          <li>✅ Verschijnt als groen icoon in system tray (bij klok)</li>
                          <li>✅ Draait onzichtbaar op de achtergrond (geen venster)</li>
                          <li>✅ Start local server op de geconfigureerde helper-URL</li>
                          <li>✅ Is direct klaar voor gebruik!</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-300 dark:border-purple-700">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex-shrink-0">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-2">Optioneel: Auto-start bij Windows boot</p>
                      <p className="text-xs text-[--muted] mb-2">
                        Rechtermuisklik op het system tray icoon → <strong>"Start met Windows"</strong>
                      </p>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-300 dark:border-yellow-700">
                        <p className="text-xs text-yellow-900 dark:text-yellow-200">
                          💡 <strong>Tip:</strong> Zet dit aan zodat de helper altijd actief is wanneer je DocFlow gebruikt!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-100 to-blue-100 dark:from-green-900/20 dark:to-blue-900/20 p-4 rounded-lg border-2 border-green-400 dark:border-green-600">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  Klaar! Zo gebruik je het:
                </h4>
                <ol className="text-xs space-y-2 text-[--muted]">
                  <li className="flex gap-2">
                    <span className="font-bold text-[--brand]">1.</span>
                    <span>Zorg dat DocFlowFileHelper.exe draait (groen icoon in system tray)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-[--brand]">2.</span>
                    <span>Klik in DocFlow op het <strong>bestand icoon</strong> 📊 bij een document</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-[--brand]">3.</span>
                    <span>Het bestand opent direct in de juiste applicatie! ✨</span>
                  </li>
                </ol>
              </div>
            </motion.div>
          )}

          {/* Active Status Info */}
          {helperStatus === 'active' && (
            <motion.div
              className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-800"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-200 mb-1">
                    File Helper is actief! 🎉
                  </h4>
                  <p className="text-sm text-green-800 dark:text-green-300 mb-2">
                    Perfect! De Helper draait op de achtergrond. Je kunt nu bestanden openen door op het 
                    bestand icoon 📊 bij een document te klikken.
                  </p>
                  <div className="bg-white dark:bg-green-950 p-3 rounded border border-green-300 dark:border-green-700 mt-2">
                    <p className="text-xs text-green-900 dark:text-green-200 font-medium mb-1">
                      💡 System Tray Icoon
                    </p>
                    <p className="text-xs text-green-800 dark:text-green-300">
                      Je ziet een groen icoon bij je klok (rechtsonder). Rechtermuisklik voor opties:
                    </p>
                    <ul className="text-xs text-green-800 dark:text-green-300 mt-1 ml-4 space-y-1">
                      <li>• Start met Windows</li>
                      <li>• Toon status</li>
                      <li>• Afsluiten</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Network Paths Configuration */}
          <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <Folder className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-sm mb-2">📂 Netwerk Paden Configuratie</h4>
                <p className="text-xs text-[--muted] mb-3">
                  DocFlow gebruikt de volgende netwerk paden voor document opslag:
                </p>
                
                <div className="space-y-2">
                  <div className="bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-300 dark:border-gray-600">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">CONCEPT folder:</p>
                    <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded block break-all font-mono">
                      {NETWORK_PATHS.CONCEPT_DIR}
                    </code>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-300 dark:border-gray-600">
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">APPROVED folder:</p>
                    <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded block break-all font-mono">
                      {NETWORK_PATHS.APPROVED_DIR}
                    </code>
                  </div>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2.5 rounded border border-yellow-300 dark:border-yellow-700 mt-3">
                  <p className="text-xs text-yellow-900 dark:text-yellow-200">
                    <strong>⚙️ Admin:</strong> Deze paden zijn geconfigureerd in <code className="bg-yellow-100 dark:bg-yellow-950 px-1 rounded">/lib/config.ts</code> en moeten overeenkomen met de Python backend configuratie.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-[--brand] hover:underline">
              Technische details & Geavanceerde opties
            </summary>
            <div className="mt-3 space-y-3 text-[--muted]">
              <div>
                <p className="font-medium text-[--fg] mb-1">📡 Server Informatie:</p>
                <ul className="ml-4 space-y-1 text-xs">
                  <li>• <strong>Poort:</strong> volgens je helper-configuratie</li>
                  <li>• <strong>Protocol:</strong> HTTP REST API</li>
                  <li>• <strong>Endpoints:</strong> GET /health, POST /open</li>
                  <li>• <strong>Beveiliging:</strong> Alleen lokale verbindingen</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-[--fg] mb-1">🔧 Systeemvereisten:</p>
                <ul className="ml-4 space-y-1 text-xs">
                  <li>• <strong>OS:</strong> Windows 10/11 (64-bit)</li>
                  <li>• <strong>RAM:</strong> 50 MB</li>
                  <li>• <strong>Schijfruimte:</strong> 8 MB</li>
                  <li>• <strong>Applicaties:</strong> Microsoft Office of compatibele viewers geïnstalleerd</li>
                </ul>
              </div>

              <div className="border-t border-[--border] pt-3">
                <p className="font-medium text-[--fg] mb-2">👨‍💻 Voor Developers: Python Versie</p>
                <p className="text-xs mb-2">
                  Als je de broncode wilt aanpassen of een eigen versie wilt bouwen, is de Python source beschikbaar.
                  De EXE is gemaakt met PyInstaller.
                </p>
                <details className="text-xs">
                  <summary className="cursor-pointer text-[--brand] hover:underline">
                    Toon Python source code
                  </summary>
                  <div className="bg-gray-900 p-3 rounded mt-2 overflow-x-auto">
                    <pre className="text-green-400 font-mono text-xs">
{`from flask import Flask, request, jsonify
from flask_cors import CORS
import os, subprocess, platform
import pystray
from PIL import Image
from threading import Thread

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200

@app.route('/open', methods=['POST'])
def open_file():
    data = request.json
    file_path = data.get('path')
    
    if platform.system() == 'Windows':
        os.startfile(file_path)
    elif platform.system() == 'Darwin':
        subprocess.call(['open', file_path])
    else:
        subprocess.call(['xdg-open', file_path])
    
    return jsonify({"success": True}), 200

# System tray setup
def run_server():
    app.run(port=5000, debug=False)

# PyInstaller: pyinstaller --onefile --windowed docflow_file_helper.py`}
                    </pre>
                  </div>
                </details>
              </div>
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
