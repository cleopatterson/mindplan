import { Loader2 } from 'lucide-react';

export function ParseProgress() {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      <div className="text-center">
        <p className="text-lg font-medium text-gray-700">Analysing your financial plan...</p>
        <p className="text-sm text-gray-500 mt-1">
          Claude is extracting entities, assets, and liabilities. This takes 10-30 seconds.
        </p>
      </div>
    </div>
  );
}
