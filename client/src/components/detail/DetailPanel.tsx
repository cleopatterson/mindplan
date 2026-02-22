import { useState } from 'react';
import type { FinancialPlan, Client, Entity, Asset, Liability, EstatePlanItem, FamilyMember, Grandchild, Goal, Relationship } from 'shared/types';
import { formatAUD, totalAssets, totalLiabilities, entityEquity } from '../../utils/calculations';
import {
  Check, X, Pencil, User, Building2, Landmark, CreditCard,
  Briefcase, ScrollText, Users, Baby, Target, Handshake,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HeroBanner, InsightPill, assetTypeConfig } from './shared';

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

  // Estate planning group
  if (nodeId === 'estate-group') return <EstateGroupDetail data={data} />;

  // Estate planning per-client node (e.g. "estate-client-client-1")
  if (nodeId.startsWith('estate-client-')) {
    const clientId = nodeId.replace('estate-client-', '');
    const clientItems = data.estatePlanning?.filter((e) => e.clientId === clientId) ?? [];
    const clientName = data.clients.find((c) => c.id === clientId)?.name ?? clientId;
    if (clientItems.length > 0) return <EstateClientDetail clientName={clientName} items={clientItems} />;
  }

  // Estate planning items
  const estateItem = data.estatePlanning?.find((e) => e.id === nodeId);
  if (estateItem) return <EstateItemDetail item={estateItem} data={data} nodeId={nodeId} onUpdate={onUpdateField} />;

  // Family group
  if (nodeId === 'family-group') return <FamilyGroupDetail data={data} />;

  // Family members (children)
  const familyMember = data.familyMembers?.find((m) => m.id === nodeId);
  if (familyMember) return <FamilyMemberDetail member={familyMember} data={data} nodeId={nodeId} onUpdate={onUpdateField} />;

  // Grandchildren (nested under family members)
  for (const member of data.familyMembers ?? []) {
    const grandchild = member.children?.find((gc) => gc.id === nodeId);
    if (grandchild) return <GrandchildDetail grandchild={grandchild} parent={member} data={data} nodeId={nodeId} onUpdate={onUpdateField} />;
  }

  // Goals group
  if (nodeId === 'goals-group') return <GoalsGroupDetail data={data} />;

  // Individual goals
  const goal = data.goals?.find((g) => g.id === nodeId);
  if (goal) return <GoalDetail goal={goal} />;

  // Relationships group
  if (nodeId === 'relationships-group') return <RelationshipsGroupDetail data={data} />;

  // Individual relationships
  const relationship = data.relationships?.find((r) => r.id === nodeId);
  if (relationship) return <RelationshipDetail relationship={relationship} data={data} />;

  return null;
}


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
        {(entity.type === 'trust' || entity.type === 'smsf') && (
          <>
            <EditableField label="Trustee Name" value={entity.trusteeName ?? ''} placeholder="e.g. Tony Wall" onSave={(v) => onUpdate(nodeId, 'trusteeName', v)} />
            <div className="border-t border-white/5 my-2" />
            <EditableField label="Trustee Type" value={entity.trusteeType ?? ''} placeholder="individual / corporate" onSave={(v) => onUpdate(nodeId, 'trusteeType', v)} />
            <div className="border-t border-white/5 my-2" />
          </>
        )}
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

// ── Estate Group Detail ──

function EstateGroupDetail({ data }: { data: FinancialPlan }) {
  const items = data.estatePlanning ?? [];
  const issues = items.filter((i) => i.hasIssue);
  const byClient = new Map<string, typeof items>();
  for (const item of items) {
    const list = byClient.get(item.clientId) ?? [];
    list.push(item);
    byClient.set(item.clientId, list);
  }

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={ScrollText}
        label="Estate Planning"
        sublabel={`${items.length} documents`}
        gradient="bg-gradient-to-br from-indigo-500/20 via-indigo-600/10 to-indigo-900/20"
        iconColor="text-indigo-400"
      />

      <div className="flex flex-wrap gap-1.5">
        {issues.length > 0
          ? <InsightPill color="red">{issues.length} {issues.length === 1 ? 'issue' : 'issues'} need attention</InsightPill>
          : <InsightPill color="emerald">All documents current</InsightPill>}
        <InsightPill color="white">{byClient.size} {byClient.size === 1 ? 'client' : 'clients'} covered</InsightPill>
      </div>

      {[...byClient.entries()].map(([clientId, clientItems]) => {
        const clientName = data.clients.find((c) => c.id === clientId)?.name ?? clientId;
        return (
          <div key={clientId} className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">{clientName}</div>
            <div className="space-y-1.5">
              {clientItems.map((item) => {
                const typeLabel = estateTypeLabels[item.type] ?? item.type;
                const statusColor = item.hasIssue ? 'text-red-400' : 'text-emerald-400';
                const statusLabel = item.status === 'expired' ? 'Expired'
                  : item.status === 'not_established' ? 'Not established'
                  : item.status === 'current' && item.hasIssue ? 'Needs review'
                  : 'Current';
                return (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ScrollText className="w-3 h-3 text-indigo-400/50" />
                      <span className="text-white/80">{typeLabel}</span>
                    </div>
                    <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Estate Client Detail ──

function EstateClientDetail({ clientName, items }: { clientName: string; items: EstatePlanItem[] }) {
  const issues = items.filter((i) => i.hasIssue);

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={ScrollText}
        label={clientName}
        sublabel="Estate Planning"
        gradient={issues.length > 0
          ? 'bg-gradient-to-br from-indigo-500/15 via-red-600/10 to-indigo-900/20'
          : 'bg-gradient-to-br from-indigo-500/20 via-indigo-600/10 to-indigo-900/20'}
        iconColor="text-indigo-400"
      />

      <div className="flex flex-wrap gap-1.5">
        {issues.length > 0
          ? <InsightPill color="red">{issues.length} {issues.length === 1 ? 'issue' : 'issues'} need attention</InsightPill>
          : <InsightPill color="emerald">All documents in place</InsightPill>}
        <InsightPill color="white">{items.length} documents</InsightPill>
      </div>

      <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 space-y-2">
        {items.map((item) => {
          const typeLabel = estateTypeLabels[item.type] ?? item.type;
          const statusColor = item.hasIssue ? 'text-red-400' : 'text-emerald-400';
          const statusLabel = item.status === 'expired' ? 'Expired'
            : item.status === 'not_established' ? 'Not established'
            : item.status === 'current' && item.hasIssue ? 'Needs review'
            : 'In Place';

          return (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-3 h-3 text-indigo-400/50" />
                  <span className="text-white/80 font-medium">{typeLabel}</span>
                </div>
                <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
              </div>
              {item.primaryPerson && (
                <div className="text-[10px] text-white/40 pl-5">
                  {item.type === 'will' ? 'Executor' : item.type === 'guardianship' ? 'Guardian' : 'Attorney'}: {item.primaryPerson}
                  {item.alternatePeople?.length ? ` + ${item.alternatePeople.length} alternates` : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Family Group Detail ──

function FamilyGroupDetail({ data }: { data: FinancialPlan }) {
  const members = data.familyMembers ?? [];
  const totalGrandchildren = members.reduce((n, m) => n + (m.children?.length ?? 0), 0);
  const dependants = members.filter((m) => m.isDependant);
  const dependantGrandchildren = members.flatMap((m) => m.children ?? []).filter((gc) => gc.isDependant);

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={Users}
        label="Family"
        sublabel={`${members.length} children, ${totalGrandchildren} grandchildren`}
        gradient="bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-amber-900/20"
        iconColor="text-amber-400"
      />

      <div className="flex flex-wrap gap-1.5">
        {(dependants.length + dependantGrandchildren.length) > 0 && (
          <InsightPill color="amber">{dependants.length + dependantGrandchildren.length} dependants</InsightPill>
        )}
        <InsightPill color="white">{members.length} {members.length === 1 ? 'child' : 'children'}</InsightPill>
        {totalGrandchildren > 0 && <InsightPill color="white">{totalGrandchildren} grandchildren</InsightPill>}
      </div>

      {members.map((member) => (
        <div key={member.id} className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-white/80 font-medium">{member.name}</div>
            <span className="text-[10px] text-white/30">{member.relationship}{member.partner ? ` · ${member.partner}` : ''}</span>
          </div>
          {(member.children?.length ?? 0) > 0 && (
            <div className="space-y-1 mt-1.5">
              {member.children!.map((gc) => (
                <div key={gc.id} className="flex items-center gap-2 text-xs text-white/50 pl-2">
                  <Baby className="w-3 h-3 text-amber-400/40" />
                  <span className="text-white/60">{gc.name}</span>
                  <span className="text-white/25">{gc.age != null ? `${gc.age}y` : gc.relationship}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Estate Item Detail ──

const estateTypeLabels: Record<string, string> = {
  will: 'Will',
  poa: 'Power of Attorney',
  guardianship: 'Guardianship',
  super_nomination: 'Super Nomination',
};

function EstateItemDetail({ item, data, nodeId, onUpdate }: { item: EstatePlanItem; data: FinancialPlan; nodeId: string; onUpdate: (id: string, field: string, value: string) => void }) {
  const clientName = data.clients.find((c) => c.id === item.clientId)?.name ?? 'Unknown';
  const typeLabel = estateTypeLabels[item.type] ?? item.type;

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={ScrollText}
        label={typeLabel}
        sublabel={`${clientName} · Estate Planning`}
        gradient={item.hasIssue
          ? 'bg-gradient-to-br from-red-500/20 via-red-600/10 to-red-900/20'
          : 'bg-gradient-to-br from-indigo-500/20 via-indigo-600/10 to-indigo-900/20'}
        iconColor={item.hasIssue ? 'text-red-400' : 'text-indigo-400'}
      />

      <div className="flex flex-wrap gap-1.5">
        {item.status === 'expired' && <InsightPill color="red">Expired — needs renewal</InsightPill>}
        {item.status === 'not_established' && <InsightPill color="red">Not established</InsightPill>}
        {item.status === 'current' && item.hasIssue && <InsightPill color="amber">Needs review</InsightPill>}
        {item.status === 'current' && !item.hasIssue && <InsightPill color="emerald">Current</InsightPill>}
        {item.lastReviewed && <InsightPill color="white">Last reviewed {item.lastReviewed}</InsightPill>}
      </div>

      <div className="space-y-1 rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <EditableField label="Status" value={item.status ?? ''} placeholder="current / expired / not_established" onSave={(v) => onUpdate(nodeId, 'status', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Primary Person" value={item.primaryPerson ?? ''} placeholder="e.g. Mary Wall" onSave={(v) => onUpdate(nodeId, 'primaryPerson', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Alternates" value={item.alternatePeople?.join(', ') ?? ''} placeholder="e.g. Katie McDonald, Nicholas Wall" onSave={(v) => onUpdate(nodeId, 'alternatePeople', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Details" value={item.details ?? ''} placeholder="Add notes..." onSave={(v) => onUpdate(nodeId, 'details', v)} />
      </div>
    </div>
  );
}

// ── Family Member Detail ──

function FamilyMemberDetail({ member, data, nodeId, onUpdate }: { member: FamilyMember; data: FinancialPlan; nodeId: string; onUpdate: (id: string, field: string, value: string) => void }) {
  const grandchildCount = member.children?.length ?? 0;
  const relLabel = member.relationship.charAt(0).toUpperCase() + member.relationship.slice(1);

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={Users}
        label={member.name}
        sublabel={`${relLabel}${member.partner ? ` · married to ${member.partner}` : ''}`}
        gradient="bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-amber-900/20"
        iconColor="text-amber-400"
      />

      <div className="flex flex-wrap gap-1.5">
        {member.isDependant && <InsightPill color="amber">Dependant</InsightPill>}
        {!member.isDependant && <InsightPill color="white">Non-dependant</InsightPill>}
        {grandchildCount > 0 && <InsightPill color="amber">{grandchildCount} {grandchildCount === 1 ? 'child' : 'children'}</InsightPill>}
        {member.partner && <InsightPill color="white">Partner: {member.partner}</InsightPill>}
      </div>

      <div className="space-y-1 rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <EditableField label="Age" value={member.age?.toString() ?? ''} placeholder="e.g. 45" onSave={(v) => onUpdate(nodeId, 'age', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Partner" value={member.partner ?? ''} placeholder="e.g. Alex" onSave={(v) => onUpdate(nodeId, 'partner', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Details" value={member.details ?? ''} placeholder="Add notes..." onSave={(v) => onUpdate(nodeId, 'details', v)} />
      </div>

      {grandchildCount > 0 && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Children</div>
          <div className="space-y-1.5">
            {member.children!.map((gc) => (
              <div key={gc.id} className="flex items-center gap-2 text-xs text-white/60">
                <Baby className="w-3 h-3 text-amber-400/50" />
                <span className="text-white/80">{gc.name}</span>
                <span className="text-white/30">{gc.relationship}{gc.age != null ? `, ${gc.age}y` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grandchild Detail ──

function GrandchildDetail({ grandchild, parent, data, nodeId, onUpdate }: { grandchild: Grandchild; parent: FamilyMember; data: FinancialPlan; nodeId: string; onUpdate: (id: string, field: string, value: string) => void }) {
  const relLabel = grandchild.relationship === 'grandson' ? 'Grandson' : 'Granddaughter';

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={Baby}
        label={grandchild.name}
        sublabel={`${relLabel} · child of ${parent.name}`}
        gradient="bg-gradient-to-br from-amber-400/15 via-amber-500/10 to-amber-900/15"
        iconColor="text-amber-300"
      />

      <div className="flex flex-wrap gap-1.5">
        {grandchild.isDependant && <InsightPill color="amber">Dependant</InsightPill>}
        {grandchild.age != null && <InsightPill color="white">Age {grandchild.age}</InsightPill>}
        <InsightPill color="white">Parent: {parent.name}{parent.partner ? ` & ${parent.partner}` : ''}</InsightPill>
      </div>

      <div className="space-y-1 rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <EditableField label="Age" value={grandchild.age?.toString() ?? ''} placeholder="e.g. 8" onSave={(v) => onUpdate(nodeId, 'age', v)} />
        <div className="border-t border-white/5 my-2" />
        <EditableField label="Details" value={grandchild.details ?? ''} placeholder="e.g. School fees being funded" onSave={(v) => onUpdate(nodeId, 'details', v)} />
      </div>
    </div>
  );
}

// ── Goals Group Detail ──

function GoalsGroupDetail({ data }: { data: FinancialPlan }) {
  const goals = data.goals ?? [];
  const categories = [...new Set(goals.map((g) => g.category))];

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={Target}
        label="Goals"
        sublabel={`${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`}
        gradient="bg-gradient-to-br from-teal-500/20 via-teal-600/10 to-teal-900/20"
        iconColor="text-teal-400"
      />

      <div className="flex flex-wrap gap-1.5">
        <InsightPill color="teal">{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</InsightPill>
        {categories.length > 1 && <InsightPill color="white">{categories.length} categories</InsightPill>}
      </div>

      {goals.map((goal) => (
        <div key={goal.id} className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-3 h-3 text-teal-400/50" />
            <span className="text-xs text-white/80 font-medium">{goal.name}</span>
          </div>
          <div className="text-[10px] text-white/40 pl-5">
            {goal.category}{goal.timeframe ? ` · ${goal.timeframe}` : ''}
            {goal.value != null ? ` · ${formatAUD(goal.value)}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Goal Detail ──

function GoalDetail({ goal }: { goal: Goal }) {
  return (
    <div className="space-y-3">
      <HeroBanner
        icon={Target}
        label={goal.name}
        sublabel={goal.category}
        gradient="bg-gradient-to-br from-teal-500/20 via-teal-600/10 to-teal-900/20"
        iconColor="text-teal-400"
      />

      <div className="flex flex-wrap gap-1.5">
        <InsightPill color="teal">{goal.category}</InsightPill>
        {goal.timeframe && <InsightPill color="white">{goal.timeframe}</InsightPill>}
        {goal.value != null && <InsightPill color="teal">{formatAUD(goal.value)}</InsightPill>}
      </div>

      {goal.detail && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Detail</div>
          <div className="text-xs text-white/70">{goal.detail}</div>
        </div>
      )}
    </div>
  );
}

// ── Relationships Group Detail ──

const relTypeLabels: Record<string, string> = {
  accountant: 'Accountant',
  stockbroker: 'Stockbroker',
  solicitor: 'Solicitor',
  insurance_adviser: 'Insurance Adviser',
  mortgage_broker: 'Mortgage Broker',
  other: 'Other',
};

function RelationshipsGroupDetail({ data }: { data: FinancialPlan }) {
  const rels = data.relationships ?? [];

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={Handshake}
        label="Advisers"
        sublabel={`${rels.length} ${rels.length === 1 ? 'adviser' : 'advisers'}`}
        gradient="bg-gradient-to-br from-rose-500/20 via-rose-600/10 to-rose-900/20"
        iconColor="text-rose-400"
      />

      <div className="flex flex-wrap gap-1.5">
        <InsightPill color="rose">{rels.length} {rels.length === 1 ? 'adviser' : 'advisers'}</InsightPill>
      </div>

      {rels.map((rel) => (
        <div key={rel.id} className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Handshake className="w-3 h-3 text-rose-400/50" />
            <span className="text-xs text-white/80 font-medium">{rel.firmName ?? rel.contactName ?? relTypeLabels[rel.type]}</span>
          </div>
          <div className="text-[10px] text-white/40 pl-5">
            {relTypeLabels[rel.type] ?? rel.type}
            {rel.contactName && rel.firmName ? ` · ${rel.contactName}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Relationship Detail ──

function RelationshipDetail({ relationship, data }: { relationship: Relationship; data: FinancialPlan }) {
  const linkedClients = data.clients.filter((c) => relationship.clientIds.includes(c.id));

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={Handshake}
        label={relationship.firmName ?? relationship.contactName ?? relTypeLabels[relationship.type]}
        sublabel={relTypeLabels[relationship.type] ?? relationship.type}
        gradient="bg-gradient-to-br from-rose-500/20 via-rose-600/10 to-rose-900/20"
        iconColor="text-rose-400"
      />

      <div className="flex flex-wrap gap-1.5">
        <InsightPill color="rose">{relTypeLabels[relationship.type]}</InsightPill>
        {relationship.contactName && <InsightPill color="white">Contact: {relationship.contactName}</InsightPill>}
        {linkedClients.length > 0 && (
          <InsightPill color="white">{linkedClients.map((c) => c.name).join(' & ')}</InsightPill>
        )}
      </div>

      {relationship.notes && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Notes</div>
          <div className="text-xs text-white/70">{relationship.notes}</div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function findAssetOwner(assetId: string, data: FinancialPlan): string | null {
  const personal = data.personalAssets.find((a) => a.id === assetId);
  if (personal) {
    const ownerNames = resolveOwnerNames(personal.ownerIds, data);
    return ownerNames ?? 'Personal';
  }
  for (const entity of data.entities) {
    if (entity.assets.some((a) => a.id === assetId)) return entity.name;
  }
  return null;
}

function findLiabilityOwner(liabilityId: string, data: FinancialPlan): string | null {
  const personal = data.personalLiabilities.find((l) => l.id === liabilityId);
  if (personal) {
    const ownerNames = resolveOwnerNames(personal.ownerIds, data);
    return ownerNames ?? 'Personal';
  }
  for (const entity of data.entities) {
    if (entity.liabilities.some((l) => l.id === liabilityId)) return entity.name;
  }
  return null;
}

function resolveOwnerNames(ownerIds: string[], data: FinancialPlan): string | null {
  if (!ownerIds || ownerIds.length === 0) return null;
  const names = ownerIds
    .map((id) => data.clients.find((c) => c.id === id)?.name.split(' ')[0])
    .filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0]!;
  return names.join(' & ') + ' (Joint)';
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
          <button onClick={save} className="cursor-pointer p-1 text-emerald-400 hover:bg-emerald-500/10 rounded shrink-0">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={cancel} className="cursor-pointer p-1 text-white/30 hover:bg-white/5 rounded shrink-0">
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
