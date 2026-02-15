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
      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm
        hover:bg-gray-800 disabled:opacity-50 transition-colors"
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
