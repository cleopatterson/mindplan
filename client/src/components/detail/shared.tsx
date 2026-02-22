import {
  Info, Home, TrendingUp, Banknote, PieChart, Landmark, Shield, Car, Package,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Insight pills ──

export function InsightPill({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400/80 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400/80 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400/80 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-400/80 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400/80 border-orange-500/20',
    teal: 'bg-teal-500/10 text-teal-400/80 border-teal-500/20',
    rose: 'bg-rose-500/10 text-rose-400/80 border-rose-500/20',
    white: 'bg-white/5 text-white/50 border-white/10',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[color] ?? colors.white}`}>
      <Info className="w-2.5 h-2.5 opacity-60" />
      {children}
    </span>
  );
}

// ── Hero banner ──

export function HeroBanner({
  icon: Icon,
  label,
  sublabel,
  gradient,
  iconColor,
}: {
  icon: LucideIcon;
  label: string;
  sublabel: string;
  gradient: string;
  iconColor: string;
}) {
  return (
    <div className={`relative rounded-xl overflow-hidden ${gradient} p-4 pb-3`}>
      {/* Decorative large icon */}
      <Icon className={`absolute -right-3 -top-3 w-24 h-24 ${iconColor} opacity-[0.07]`} />
      <Icon className={`absolute right-3 bottom-3 w-8 h-8 ${iconColor} opacity-30`} />
      <div className="relative">
        <div className={`text-[10px] font-medium uppercase tracking-wider ${iconColor} opacity-60 mb-1`}>
          {sublabel}
        </div>
        <h4 className="text-lg font-bold text-white/90 leading-tight">{label}</h4>
      </div>
    </div>
  );
}

// ── Asset type config ──

export const assetTypeConfig: Record<string, { label: string; icon: LucideIcon; color: string; gradient: string; iconColor: string; pillColor: string }> = {
  property: { label: 'Property', icon: Home, color: 'bg-emerald-500/15 text-emerald-400', gradient: 'bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-emerald-900/20', iconColor: 'text-emerald-400', pillColor: 'emerald' },
  shares: { label: 'Shares', icon: TrendingUp, color: 'bg-blue-500/15 text-blue-400', gradient: 'bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-blue-900/20', iconColor: 'text-blue-400', pillColor: 'blue' },
  cash: { label: 'Cash', icon: Banknote, color: 'bg-yellow-500/15 text-yellow-400', gradient: 'bg-gradient-to-br from-yellow-500/15 via-yellow-600/10 to-yellow-900/15', iconColor: 'text-yellow-400', pillColor: 'amber' },
  managed_fund: { label: 'Managed Fund', icon: PieChart, color: 'bg-purple-500/15 text-purple-400', gradient: 'bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-purple-900/20', iconColor: 'text-purple-400', pillColor: 'purple' },
  super: { label: 'Super', icon: Landmark, color: 'bg-orange-500/15 text-orange-400', gradient: 'bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-orange-900/20', iconColor: 'text-orange-400', pillColor: 'orange' },
  insurance: { label: 'Insurance', icon: Shield, color: 'bg-cyan-500/15 text-cyan-400', gradient: 'bg-gradient-to-br from-cyan-500/20 via-cyan-600/10 to-cyan-900/20', iconColor: 'text-cyan-400', pillColor: 'blue' },
  vehicle: { label: 'Vehicle', icon: Car, color: 'bg-slate-500/15 text-slate-400', gradient: 'bg-gradient-to-br from-slate-500/20 via-slate-600/10 to-slate-900/20', iconColor: 'text-slate-400', pillColor: 'white' },
  other: { label: 'Other', icon: Package, color: 'bg-gray-500/15 text-gray-400', gradient: 'bg-gradient-to-br from-gray-500/20 via-gray-600/10 to-gray-900/20', iconColor: 'text-gray-400', pillColor: 'white' },
};
