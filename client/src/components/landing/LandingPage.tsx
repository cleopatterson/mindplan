import { useCallback, useState } from 'react';
import { Upload, FileText, ArrowRight, Brain, Network, BarChart3 } from 'lucide-react';
import { LogoFull } from '../Logo';

interface LandingPageProps {
  onUpload: (file: File) => void;
  error: string | null;
}

export function LandingPage({ onUpload, error }: LandingPageProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onUpload(file);
    },
    [onUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
    },
    [onUpload],
  );

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white overflow-auto">
      {/* Ambient gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-emerald-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="text-center mb-4">
          <div className="flex justify-center mb-4">
            <LogoFull size="xl" />
          </div>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            Turn financial plan exports into interactive structure maps.
            <br className="hidden sm:block" />
            Upload a PDF — get a visual mind map in seconds.
          </p>
        </header>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-16">
          <Step
            icon={<FileText className="w-6 h-6" />}
            number="1"
            title="Upload"
            desc="Drop a PDF or Word export from Pluto, AdviserLogic, or Xplan"
            color="blue"
          />
          <Step
            icon={<Brain className="w-6 h-6" />}
            number="2"
            title="Smart Parse"
            desc="Clients, entities, assets, liabilities & gaps are extracted automatically"
            color="purple"
          />
          <Step
            icon={<Network className="w-6 h-6" />}
            number="3"
            title="Explore"
            desc="Interactive mind map with summaries, highlights & PDF export"
            color="emerald"
          />
        </div>

        {/* Upload zone */}
        <div className="max-w-xl mx-auto">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
            className={`
              relative group cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center
              transition-all duration-300
              ${isDragging
                ? 'border-blue-400 bg-blue-500/10 scale-[1.02]'
                : 'border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04]'
              }
            `}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className={`
              mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5
              transition-all duration-300
              ${isDragging
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-white/5 text-white/40 group-hover:text-white/60 group-hover:bg-white/10'
              }
            `}>
              {isDragging ? (
                <FileText className="w-8 h-8" />
              ) : (
                <Upload className="w-8 h-8" />
              )}
            </div>

            <p className="text-lg font-medium text-white/80 mb-2">
              {isDragging ? 'Drop your file here' : 'Drop a financial plan here'}
            </p>
            <p className="text-sm text-white/35 mb-4">
              PDF, Word, or plain text — typically 10–30 seconds to process
            </p>

            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium hover:from-blue-500 hover:to-purple-500 transition-all">
              Choose file
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-16">
          <Feature icon={<Network className="w-4 h-4" />} text="Interactive mind map" />
          <Feature icon={<BarChart3 className="w-4 h-4" />} text="Net worth & allocation" />
          <Feature icon={<Brain className="w-4 h-4" />} text="Detects missing data" />
          <Feature icon={<FileText className="w-4 h-4" />} text="Export to PDF" />
        </div>

        {/* Privacy note */}
        <p className="text-center text-xs text-white/20 mt-12">
          Your data is processed once and never stored. Nothing leaves your session.
        </p>
      </div>
    </div>
  );
}

function Step({
  icon,
  number,
  title,
  desc,
  color,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  desc: string;
  color: 'blue' | 'purple' | 'emerald';
}) {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <div className="flex flex-col items-center text-center p-6 rounded-xl bg-white/[0.02] border border-white/5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 border ${colors[color]}`}>
        {icon}
      </div>
      <div className="text-xs text-white/30 mb-1">Step {number}</div>
      <h3 className="text-base font-semibold text-white/90 mb-1">{title}</h3>
      <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-white/40 text-xs">
      {icon}
      {text}
    </div>
  );
}
