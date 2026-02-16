import { Download, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  onClick: () => void;
  exporting: boolean;
}

export function ExportButton({ onClick, exporting }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={exporting}
      className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white/70 rounded-lg text-sm
        hover:bg-white/15 hover:text-white disabled:opacity-50 transition-colors border border-white/10"
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {exporting ? 'Exporting...' : 'Export PDF'}
    </button>
  );
}
