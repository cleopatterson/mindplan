import { useState } from 'react';
import type { FinancialPlan, Client, Entity, Asset, Liability } from 'shared/types';
import { formatAUD, totalAssets, totalLiabilities, entityEquity } from '../../utils/calculations';
import {
  Check, X, Pencil, User, Building2, Landmark, CreditCard,
  Home, TrendingUp, Banknote, PieChart, Shield, Car, Package,
  Briefcase, Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DetailPanelProps {
  data: FinancialPlan;
  nodeId: string;
  onUpdateField: (nodeId: string, field: string, value: string) => void;
}

export function DetailPanel({ data, nodeId, onUpdateField }: DetailPanelProps) {
  const client = data.clients.find((c) => c.id === nodeId);
  if (client) return <ClientDetail client={client} data={data} nodeId={nodeId} onUpdate={onUpdateField} />;

  const entity = data.entities.find((e) => e.id === nodeId);
  if (entity) return <EntityDetail entity={entity} data={data} nodeId={nodeId} onUpdate={onUpdateField} />;

  // Only flatten if we didn't find a client or entity
  for (const source of [data.personalAssets, ...data.entities.map((e) => e.assets)]) {
    const asset = source.find((a) => a.id === nodeId);
    if (asset) return <AssetDetail asset={asset} data={data} nodeId={nodeId} onUpdate={onUpdateField} />;
  }

  for (const source of [data.personalLiabilities, ...data.entities.map((e) => e.liabilities)]) {
    const liability = source.find((l) => l.id === nodeId);
    if (liability) return <LiabilityDetail liability={liability} data={data} nodeId={nodeId} onUpdate={onUpdateField} />;
  }

  return null;
}

// ── Insight pills ──

function InsightPill({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400/80 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400/80 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400/80 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-400/80 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400/80 border-orange-500/20',
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

function HeroBanner({
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

// ── Asset type icons ──

const assetTypeConfig: Record<string, { label: string; icon: LucideIcon; color: string; gradient: string; iconColor: string; pillColor: string }> = {
  property: { label: 'Property', icon: Home, color: 'bg-emerald-500/15 text-emerald-400', gradient: 'bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-emerald-900/20', iconColor: 'text-emerald-400', pillColor: 'emerald' },
  shares: { label: 'Shares', icon: TrendingUp, color: 'bg-blue-500/15 text-blue-400', gradient: 'bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-blue-900/20', iconColor: 'text-blue-400', pillColor: 'blue' },
  cash: { label: 'Cash', icon: Banknote, color: 'bg-yellow-500/15 text-yellow-400', gradient: 'bg-gradient-to-br from-yellow-500/15 via-yellow-600/10 to-yellow-900/15', iconColor: 'text-yellow-400', pillColor: 'amber' },
  managed_fund: { label: 'Managed Fund', icon: PieChart, color: 'bg-purple-500/15 text-purple-400', gradient: 'bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-purple-900/20', iconColor: 'text-purple-400', pillColor: 'purple' },
  super: { label: 'Super', icon: Landmark, color: 'bg-orange-500/15 text-orange-400', gradient: 'bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-orange-900/20', iconColor: 'text-orange-400', pillColor: 'orange' },
  insurance: { label: 'Insurance', icon: Shield, color: 'bg-cyan-500/15 text-cyan-400', gradient: 'bg-gradient-to-br from-cyan-500/20 via-cyan-600/10 to-cyan-900/20', iconColor: 'text-cyan-400', pillColor: 'blue' },
  vehicle: { label: 'Vehicle', icon: Car, color: 'bg-slate-500/15 text-slate-400', gradient: 'bg-gradient-to-br from-slate-500/20 via-slate-600/10 to-slate-900/20', iconColor: 'text-slate-400', pillColor: 'white' },
  other: { label: 'Other', icon: Package, color: 'bg-gray-500/15 text-gray-400', gradient: 'bg-gradient-to-br from-gray-500/20 via-gray-600/10 to-gray-900/20', iconColor: 'text-gray-400', pillColor: 'white' },
};

// ── Entity type config ──

const entityConfig: Record<string, { icon: LucideIcon; gradient: string; iconColor: string; pillColor: string }> = {
  trust: { icon: Building2, gradient: 'bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-emerald-900/20', iconColor: 'text-emerald-400', pillColor: 'emerald' },
  smsf: { icon: Landmark, gradient: 'bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-orange-900/20', iconColor: 'text-orange-400', pillColor: 'orange' },
  company: { icon: Briefcase, gradient: 'bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-purple-900/20', iconColor: 'text-purple-400', pillColor: 'purple' },
  partnership: { icon: Building2, gradient: 'bg-gradient-to-br from-teal-500/20 via-teal-600/10 to-teal-900/20', iconColor: 'text-teal-400', pillColor: 'blue' },
};

// ── Client Detail ──

function ClientDetail({ client, data, nodeId, onUpdate }: { client: Client; data: FinancialPlan; nodeId: string; onUpdate: (id: string, field: string, value: string) => void }) {
  // Compute insights
  const totalIncome = data.clients.reduce((sum, c) => sum + (c.income ?? 0), 0);
  const totalSuper = data.clients.reduce((sum, c) => sum + (c.superBalance ?? 0), 0);
  const incomePct = totalIncome > 0 && client.income ? Math.round((client.income / totalIncome) * 100) : null;
  const superPct = totalSuper > 0 && client.superBalance ? Math.round((client.superBalance / totalSuper) * 100) : null;
  const linkedEntityCount = data.entities.filter((e) => e.linkedClientIds.includes(client.id)).length;

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={User}
        label={client.name}
        sublabel="Client"
        gradient="bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-indigo-900/20"
        iconColor="text-blue-400"
      />

      {/* Insights */}
      <div className="flex flex-wrap gap-1.5">
        {incomePct !== null && <InsightPill color="blue">{incomePct}% of household income</InsightPill>}
        {superPct !== null && <InsightPill color="orange">{superPct}% of total super</InsightPill>}
        {linkedEntityCount > 0 && <InsightPill color="purple">Linked to {linkedEntityCount} {linkedEntityCount === 1 ? 'entity' : 'entities'}</InsightPill>}
      </div>

      <div className="space-y-1 rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <EditableField label="Age" value={client.age?.toString() ?? ''} placeholder="e.g. 52" onSave={(v) => onUpdate(nodeId, 'age', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Occupation" value={client.occupation ?? ''} placeholder="e.g. Engineer" onSave={(v) => onUpdate(nodeId, 'occupation', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Income" value={client.income != null ? client.income.toString() : ''} display={client.income != null ? formatAUD(client.income) : undefined} placeholder="e.g. 150000" onSave={(v) => onUpdate(nodeId, 'income', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Super Balance" value={client.superBalance != null ? client.superBalance.toString() : ''} display={client.superBalance != null ? formatAUD(client.superBalance) : undefined} placeholder="e.g. 500000" onSave={(v) => onUpdate(nodeId, 'superBalance', v)} />
      </div>
    </div>
  );
}

// ── Entity Detail ──

function EntityDetail({ entity, data, nodeId, onUpdate }: { entity: Entity; data: FinancialPlan; nodeId: string; onUpdate: (id: string, field: string, value: string) => void }) {
  const linked = data.clients.filter((c) => entity.linkedClientIds.includes(c.id));
  const config = entityConfig[entity.type] ?? entityConfig.trust;

  // Compute insights
  const allAssetsTotal = totalAssets(data);
  const equity = entityEquity(entity);
  const entityAssetTotal = entity.assets.reduce((sum, a) => sum + (a.value ?? 0), 0);
  const pctOfWealth = allAssetsTotal > 0 ? Math.round((entityAssetTotal / allAssetsTotal) * 100) : 0;

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={config.icon}
        label={entity.name}
        sublabel={entity.type.toUpperCase()}
        gradient={config.gradient}
        iconColor={config.iconColor}
      />

      {/* Insights */}
      <div className="flex flex-wrap gap-1.5">
        {pctOfWealth > 0 && <InsightPill color={config.pillColor}>{pctOfWealth}% of total assets</InsightPill>}
        {equity !== 0 && <InsightPill color={equity > 0 ? 'emerald' : 'red'}>Net equity {formatAUD(equity)}</InsightPill>}
        <InsightPill color="white">{entity.assets.length} assets, {entity.liabilities.length} liabilities</InsightPill>
      </div>

      <div className="space-y-1 rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <EditableField label="Role" value={entity.role ?? ''} placeholder="e.g. Trustee" onSave={(v) => onUpdate(nodeId, 'role', v)} />
      </div>

      {linked.length > 0 && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Linked Clients</div>
          <div className="flex flex-wrap gap-2">
            {linked.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400/80 text-xs">
                <User className="w-3 h-3" />
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Asset Detail ──

function AssetDetail({ asset, data, nodeId, onUpdate }: { asset: Asset; data: FinancialPlan; nodeId: string; onUpdate: (id: string, field: string, value: string) => void }) {
  const config = assetTypeConfig[asset.type] ?? assetTypeConfig.other;

  // Compute insights
  const allAssetsTotal = totalAssets(data);
  const allLiabilitiesTotal = totalLiabilities(data);
  const netWorthVal = allAssetsTotal - allLiabilitiesTotal;
  const pctOfAssets = allAssetsTotal > 0 && asset.value ? Math.round((asset.value / allAssetsTotal) * 100) : null;
  const pctOfNetWorth = netWorthVal > 0 && asset.value ? Math.round((asset.value / netWorthVal) * 100) : null;

  // Find which entity/owner this belongs to
  const owner = findAssetOwner(asset.id, data);

  // Liquidity
  const isLiquid = ['cash', 'shares', 'managed_fund'].includes(asset.type);

  // Rank among all assets (only compute if asset has a value)
  let rank = 0;
  let totalRanked = 0;
  if (asset.value != null) {
    const allAssets = [...data.personalAssets, ...data.entities.flatMap((e) => e.assets)];
    let higher = 0;
    for (const a of allAssets) {
      if (a.value != null) {
        totalRanked++;
        if ((a.value ?? 0) > (asset.value ?? 0)) higher++;
      }
    }
    rank = higher + 1;
  }

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={config.icon}
        label={asset.name}
        sublabel={config.label}
        gradient={config.gradient}
        iconColor={config.iconColor}
      />

      {/* Insights */}
      <div className="flex flex-wrap gap-1.5">
        {pctOfAssets !== null && pctOfAssets > 0 && (
          <InsightPill color={config.pillColor}>{pctOfAssets}% of total assets</InsightPill>
        )}
        {pctOfNetWorth !== null && pctOfNetWorth > 0 && pctOfNetWorth !== pctOfAssets && (
          <InsightPill color="emerald">{pctOfNetWorth}% of net worth</InsightPill>
        )}
        {rank > 0 && rank <= 3 && totalRanked > 1 && (
          <InsightPill color="amber">
            {rank === 1 ? 'Largest asset' : rank === 2 ? '2nd largest asset' : '3rd largest asset'}
          </InsightPill>
        )}
        <InsightPill color="white">{isLiquid ? 'Liquid' : 'Illiquid'}</InsightPill>
        {owner && <InsightPill color="white">{owner}</InsightPill>}
      </div>

      {/* Big value display */}
      <div className={`rounded-lg ${config.gradient} border border-white/10 p-4 text-center`}>
        <div className={`text-[10px] ${config.iconColor} opacity-50 uppercase tracking-wide mb-1`}>Value</div>
        <div className={`text-2xl font-bold ${config.iconColor}`}>
          {asset.value != null ? formatAUD(asset.value) : '—'}
        </div>
        {pctOfAssets !== null && pctOfAssets > 0 && (
          <div className="mt-2">
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full bg-current ${config.iconColor} opacity-40`} style={{ width: `${Math.min(pctOfAssets, 100)}%` }} />
            </div>
            <div className="text-[10px] text-white/25 mt-1">{pctOfAssets}% of portfolio</div>
          </div>
        )}
      </div>

      <div className="space-y-1 rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <EditableField label="Value" value={asset.value != null ? asset.value.toString() : ''} display={asset.value != null ? formatAUD(asset.value) : undefined} placeholder="e.g. 850000" onSave={(v) => onUpdate(nodeId, 'value', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Details" value={asset.details ?? ''} placeholder="Add details..." onSave={(v) => onUpdate(nodeId, 'details', v)} />
      </div>
    </div>
  );
}

// ── Liability Detail ──

function LiabilityDetail({ liability, data, nodeId, onUpdate }: { liability: Liability; data: FinancialPlan; nodeId: string; onUpdate: (id: string, field: string, value: string) => void }) {
  // Compute insights
  const allLiabilitiesTotal = totalLiabilities(data);
  const allAssetsTotal = totalAssets(data);
  const pctOfLiabilities = allLiabilitiesTotal > 0 && liability.amount ? Math.round((liability.amount / allLiabilitiesTotal) * 100) : null;
  const debtToAssetRatio = allAssetsTotal > 0 ? Math.round((allLiabilitiesTotal / allAssetsTotal) * 100) : null;

  // Rank among all liabilities
  const allLiabilities = [...data.personalLiabilities, ...data.entities.flatMap((e) => e.liabilities)];
  const sortedLiabilities = allLiabilities.filter((l) => l.amount != null).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  const rank = sortedLiabilities.findIndex((l) => l.id === liability.id) + 1;

  // Find owner
  const owner = findLiabilityOwner(liability.id, data);

  // Interest severity
  const highInterest = liability.interestRate != null && liability.interestRate > 6;

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={CreditCard}
        label={liability.name}
        sublabel={liability.type.replace('_', ' ')}
        gradient="bg-gradient-to-br from-red-500/20 via-red-600/10 to-red-900/20"
        iconColor="text-red-400"
      />

      {/* Insights */}
      <div className="flex flex-wrap gap-1.5">
        {pctOfLiabilities !== null && pctOfLiabilities > 0 && (
          <InsightPill color="red">{pctOfLiabilities}% of total debt</InsightPill>
        )}
        {rank > 0 && rank <= 3 && sortedLiabilities.length > 1 && (
          <InsightPill color="amber">
            {rank === 1 ? 'Largest liability' : rank === 2 ? '2nd largest' : '3rd largest'}
          </InsightPill>
        )}
        {highInterest && <InsightPill color="red">High interest rate</InsightPill>}
        {debtToAssetRatio !== null && debtToAssetRatio > 0 && (
          <InsightPill color="white">Overall debt-to-asset: {debtToAssetRatio}%</InsightPill>
        )}
        {owner && <InsightPill color="white">{owner}</InsightPill>}
      </div>

      {/* Big amount display */}
      <div className="rounded-lg bg-gradient-to-br from-red-500/15 via-red-600/10 to-red-900/15 border border-red-500/15 p-4 text-center">
        <div className="text-[10px] text-red-400/50 uppercase tracking-wide mb-1">Outstanding</div>
        <div className="text-2xl font-bold text-red-400">
          {liability.amount != null ? formatAUD(liability.amount) : '—'}
        </div>
        {liability.interestRate != null && (
          <div className="text-xs text-red-400/50 mt-1">{liability.interestRate}% interest</div>
        )}
        {pctOfLiabilities !== null && pctOfLiabilities > 0 && (
          <div className="mt-2">
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-red-400/40" style={{ width: `${Math.min(pctOfLiabilities, 100)}%` }} />
            </div>
            <div className="text-[10px] text-white/25 mt-1">{pctOfLiabilities}% of total debt</div>
          </div>
        )}
      </div>

      <div className="space-y-1 rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <EditableField label="Outstanding" value={liability.amount != null ? liability.amount.toString() : ''} display={liability.amount != null ? formatAUD(liability.amount) : undefined} placeholder="e.g. 350000" onSave={(v) => onUpdate(nodeId, 'amount', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Interest Rate" value={liability.interestRate != null ? liability.interestRate.toString() : ''} display={liability.interestRate != null ? `${liability.interestRate}%` : undefined} placeholder="e.g. 5.5" onSave={(v) => onUpdate(nodeId, 'interestRate', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Details" value={liability.details ?? ''} placeholder="Add details..." onSave={(v) => onUpdate(nodeId, 'details', v)} />
      </div>
    </div>
  );
}

// ── Helpers ──

function findAssetOwner(assetId: string, data: FinancialPlan): string | null {
  if (data.personalAssets.some((a) => a.id === assetId)) return 'Personal';
  for (const entity of data.entities) {
    if (entity.assets.some((a) => a.id === assetId)) return entity.name;
  }
  return null;
}

function findLiabilityOwner(liabilityId: string, data: FinancialPlan): string | null {
  if (data.personalLiabilities.some((l) => l.id === liabilityId)) return 'Personal';
  for (const entity of data.entities) {
    if (entity.liabilities.some((l) => l.id === liabilityId)) return entity.name;
  }
  return null;
}

/** Click-to-edit field */
function EditableField({
  label,
  value,
  display,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  display?: string;
  placeholder?: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="py-1">
        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1">{label}</div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="flex-1 text-sm px-2 py-1 bg-white/5 border border-white/20 rounded text-white/80
              placeholder-white/20 focus:outline-none focus:border-blue-400 min-w-0"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') cancel();
            }}
          />
          <button onClick={save} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded shrink-0">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={cancel} className="p-1 text-white/30 hover:bg-white/5 rounded shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const hasValue = value !== '';

  return (
    <div className="group cursor-pointer py-1 -mx-1 px-1 rounded hover:bg-white/[0.03] transition-colors" onClick={startEdit}>
      <div className="text-[10px] text-white/30 uppercase tracking-wide">{label}</div>
      <div className="flex items-center gap-1.5">
        <div className={`text-sm ${hasValue ? 'text-white/70' : 'text-amber-400/70 italic'}`}>
          {hasValue ? (display || value) : 'Not provided'}
        </div>
        <Pencil className="w-3 h-3 text-white/15 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}
