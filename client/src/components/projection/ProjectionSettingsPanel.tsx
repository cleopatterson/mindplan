import { useState } from 'react';
import type { FinancialPlan, ProjectionSettings, Asset, OngoingExpense, LumpSumExpense, RiskProfile } from 'shared/types';
import { useTheme } from '../../contexts/ThemeContext';
import { defaultGrowthRate, defaultIncomeRate } from '../../utils/projectionDefaults';
import { ChevronDown, ChevronRight, Sparkles, Plus, Trash2, Home } from 'lucide-react';

interface Props {
  plan: FinancialPlan;
  settings: ProjectionSettings;
  onUpdate: (settings: ProjectionSettings) => void;
}

function NumberInput({ label, value, onChange, suffix = '%', min, max, step = 0.5, isDark, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; min?: number; max?: number; step?: number; isDark: boolean; hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <label className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{label}</label>
        {hint && <p className={`text-xs mt-0.5 ${isDark ? 'text-white/25' : 'text-gray-400'}`}>{hint}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className={`w-20 text-right text-sm font-mono rounded-md px-2 py-1 border
            ${isDark
              ? 'bg-white/5 border-white/10 text-white/80 focus:border-blue-400/50'
              : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-blue-400'
            } outline-none transition-colors`}
        />
        {suffix && <span className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{suffix}</span>}
      </div>
    </div>
  );
}

function AccordionSection({ title, badge, children, isDark, defaultOpen = true }: {
  title: string; badge?: string; children: React.ReactNode; isDark: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border rounded-lg overflow-hidden ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`cursor-pointer w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors
          ${isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'}`}
      >
        <div className="flex items-center gap-2">
          {title}
          {badge && (
            <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full
              ${isDark ? 'bg-purple-500/15 text-purple-300/70' : 'bg-purple-50 text-purple-500'}`}>
              <Sparkles className="w-3 h-3" />
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className={`px-4 pb-3 space-y-3 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
          <div className="pt-3 space-y-3">{children}</div>
        </div>
      )}
    </div>
  );
}

export function ProjectionSettingsPanel({ plan, settings, onUpdate }: Props) {
  const theme = useTheme();
  const isDark = theme === 'dark';

  const update = <K extends keyof ProjectionSettings>(key: K, value: ProjectionSettings[K]) => {
    onUpdate({ ...settings, [key]: value });
  };

  const updateClientRetirement = (clientId: string, retirementAge: number) => {
    onUpdate({
      ...settings,
      clients: settings.clients.map((c) =>
        c.clientId === clientId ? { ...c, retirementAge } : c,
      ),
    });
  };

  const updateClientSalarySacrifice = (clientId: string, salarySacrificeAmount: number) => {
    onUpdate({
      ...settings,
      clients: settings.clients.map((c) =>
        c.clientId === clientId ? { ...c, salarySacrificeAmount } : c,
      ),
    });
  };

  const updateAssetRate = (assetId: string, growthRate: number) => {
    const existing = settings.assetOverrides.find((o) => o.assetId === assetId);
    if (existing) {
      onUpdate({
        ...settings,
        assetOverrides: settings.assetOverrides.map((o) =>
          o.assetId === assetId ? { ...o, growthRate } : o,
        ),
      });
    } else {
      onUpdate({
        ...settings,
        assetOverrides: [...settings.assetOverrides, { assetId, growthRate }],
      });
    }
  };

  const updateLiabilityRate = (liabilityId: string, interestRate: number) => {
    const existing = settings.liabilityOverrides.find((o) => o.liabilityId === liabilityId);
    if (existing) {
      onUpdate({
        ...settings,
        liabilityOverrides: settings.liabilityOverrides.map((o) =>
          o.liabilityId === liabilityId ? { ...o, interestRate } : o,
        ),
      });
    } else {
      onUpdate({
        ...settings,
        liabilityOverrides: [...settings.liabilityOverrides, { liabilityId, interestRate, remainingTermYears: 25 }],
      });
    }
  };

  const updateLiabilityTerm = (liabilityId: string, remainingTermYears: number) => {
    const existing = settings.liabilityOverrides.find((o) => o.liabilityId === liabilityId);
    if (existing) {
      onUpdate({
        ...settings,
        liabilityOverrides: settings.liabilityOverrides.map((o) =>
          o.liabilityId === liabilityId ? { ...o, remainingTermYears } : o,
        ),
      });
    } else {
      onUpdate({
        ...settings,
        liabilityOverrides: [...settings.liabilityOverrides, { liabilityId, interestRate: 6.0, remainingTermYears }],
      });
    }
  };

  const riskProfile = plan.clients[0]?.riskProfile ?? 'balanced';

  // Collect all non-insurance assets with their resolved rates
  const allAssets: (Asset & { owner: string })[] = [
    ...plan.personalAssets.filter((a) => a.type !== 'insurance').map((a) => ({ ...a, owner: 'Personal' })),
    ...plan.entities.flatMap((e) => e.assets.filter((a) => a.type !== 'insurance').map((a) => ({ ...a, owner: e.name }))),
  ];

  const togglePPR = (assetId: string) => {
    const current = settings.pprAssetIds ?? [];
    const isPPR = current.includes(assetId);
    onUpdate({
      ...settings,
      pprAssetIds: isPPR ? current.filter((id) => id !== assetId) : [...current, assetId],
    });
  };

  const updateAssetIncomeRate = (assetId: string, incomeRate: number) => {
    const existing = settings.assetOverrides.find((o) => o.assetId === assetId);
    if (existing) {
      onUpdate({
        ...settings,
        assetOverrides: settings.assetOverrides.map((o) =>
          o.assetId === assetId ? { ...o, incomeRate } : o,
        ),
      });
    } else {
      const asset = allAssets.find((a) => a.id === assetId);
      const defaultRate = defaultGrowthRate(asset?.type ?? 'other', riskProfile);
      onUpdate({
        ...settings,
        assetOverrides: [...settings.assetOverrides, { assetId, growthRate: defaultRate, incomeRate }],
      });
    }
  };

  const allLiabilities = [
    ...plan.personalLiabilities.map((l) => ({ ...l, owner: 'Personal' })),
    ...plan.entities.flatMap((e) => e.liabilities.map((l) => ({ ...l, owner: e.name }))),
  ];

  const ongoingExpenses: OngoingExpense[] = settings.ongoingExpenses ?? [];
  const lumpSumExpenses: LumpSumExpense[] = settings.lumpSumExpenses ?? [];

  const addOngoingExpense = () => {
    onUpdate({
      ...settings,
      ongoingExpenses: [...ongoingExpenses, { id: `exp-${Date.now()}`, name: 'New Expense', annualAmount: 0, indexedToInflation: true }],
    });
  };

  const updateOngoingExpense = (id: string, field: keyof OngoingExpense, value: string | number | boolean) => {
    onUpdate({
      ...settings,
      ongoingExpenses: ongoingExpenses.map((e) => e.id === id ? { ...e, [field]: value } : e),
    });
  };

  const removeOngoingExpense = (id: string) => {
    onUpdate({ ...settings, ongoingExpenses: ongoingExpenses.filter((e) => e.id !== id) });
  };

  const addLumpSumExpense = () => {
    onUpdate({
      ...settings,
      lumpSumExpenses: [...lumpSumExpenses, { id: `lump-${Date.now()}`, name: 'New Expense', amount: 0, targetYear: new Date().getFullYear() + 1 }],
    });
  };

  const updateLumpSumExpense = (id: string, field: keyof LumpSumExpense, value: string | number) => {
    onUpdate({
      ...settings,
      lumpSumExpenses: lumpSumExpenses.map((e) => e.id === id ? { ...e, [field]: value } : e),
    });
  };

  const removeLumpSumExpense = (id: string) => {
    onUpdate({ ...settings, lumpSumExpenses: lumpSumExpenses.filter((e) => e.id !== id) });
  };

  const aiAssetIds = new Set(settings.assetOverrides.map((o) => o.assetId));
  const aiLiabilityIds = new Set(settings.liabilityOverrides.map((o) => o.liabilityId));
  const hasAiOverrides = aiAssetIds.size > 0 || aiLiabilityIds.size > 0;

  return (
    <div className="space-y-4">
      <AccordionSection title="Global Settings" isDark={isDark}>
        <NumberInput label="Horizon" value={settings.horizonYears} onChange={(v) => update('horizonYears', v)} suffix="yrs" min={5} max={50} step={1} isDark={isDark} />
        <NumberInput label="Inflation" value={settings.inflationRate} onChange={(v) => update('inflationRate', v)} isDark={isDark} />
        <NumberInput label="Salary Growth" value={settings.salaryGrowthRate} onChange={(v) => update('salaryGrowthRate', v)} isDark={isDark} />
        <NumberInput label="Super SG Rate" value={settings.superContributionRate} onChange={(v) => update('superContributionRate', v)} isDark={isDark} />
        <NumberInput label="Super Contributions Tax" value={settings.superContributionsTaxRate ?? 15} onChange={(v) => update('superContributionsTaxRate', v)} isDark={isDark} hint="Tax on employer SG contributions" />
        <NumberInput label="Super Earnings Tax" value={settings.superEarningsTaxRate ?? 15} onChange={(v) => update('superEarningsTaxRate', v)} isDark={isDark} hint="Tax on accumulation earnings (0% for pension)" />
        <NumberInput label="Preservation Age" value={settings.superPreservationAge ?? 60} onChange={(v) => update('superPreservationAge', v)} suffix="" min={55} max={65} step={1} isDark={isDark} hint="Age super can be accessed" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <label className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Retirement Risk Profile</label>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-white/25' : 'text-gray-400'}`}>Growth rates shift at retirement</p>
          </div>
          <select
            value={settings.retirementRiskProfile ?? ''}
            onChange={(e) => update('retirementRiskProfile', (e.target.value || null) as RiskProfile | null)}
            className={`text-sm rounded-md px-2 py-1 border outline-none transition-colors
              ${isDark
                ? 'bg-white/5 border-white/10 text-white/80 focus:border-blue-400/50'
                : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-blue-400'
              }`}
          >
            <option value="">No shift</option>
            <option value="conservative">Conservative</option>
            <option value="moderately_conservative">Mod. Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="growth">Growth</option>
            <option value="high_growth">High Growth</option>
          </select>
        </div>
        <NumberInput label="Concessional Cap" value={settings.concessionalCap ?? 30000} onChange={(v) => update('concessionalCap', v)} suffix="$" min={0} max={100000} step={1000} isDark={isDark} hint="Max concessional super contributions p.a." />
        <NumberInput label="Div 293 Threshold" value={settings.div293Threshold ?? 250000} onChange={(v) => update('div293Threshold', v)} suffix="$" min={0} step={10000} isDark={isDark} hint="Extra 15% tax on super if income exceeds" />
        <NumberInput label="Franking Credit Rate" value={settings.frankingCreditRate ?? 30} onChange={(v) => update('frankingCreditRate', v)} isDark={isDark} hint="Company tax rate for dividend imputation" />
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <label className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Age Pension</label>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-white/25' : 'text-gray-400'}`}>Simplified assets-test model post-67</p>
          </div>
          <button
            onClick={() => update('enableAgePension', !(settings.enableAgePension ?? true))}
            className={`cursor-pointer text-xs px-2 py-0.5 rounded-full transition-colors
              ${(settings.enableAgePension ?? true)
                ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                : isDark ? 'bg-white/5 text-white/30' : 'bg-gray-100 text-gray-400'
              }`}
          >
            {(settings.enableAgePension ?? true) ? 'On' : 'Off'}
          </button>
        </div>
      </AccordionSection>

      <AccordionSection title="Client Settings" isDark={isDark}>
        {plan.clients.map((c) => {
          const cs = settings.clients.find((s) => s.clientId === c.id);
          return (
            <div key={c.id} className="space-y-2">
              <p className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                {c.name} {c.age ? `(age ${c.age})` : ''}
              </p>
              <NumberInput
                label="Retirement Age"
                value={cs?.retirementAge ?? 67}
                onChange={(v) => updateClientRetirement(c.id, v)}
                suffix=""
                min={50}
                max={85}
                step={1}
                isDark={isDark}
              />
              <NumberInput
                label="Salary Sacrifice"
                value={cs?.salarySacrificeAmount ?? 0}
                onChange={(v) => updateClientSalarySacrifice(c.id, v)}
                suffix="$"
                min={0}
                max={30000}
                step={1000}
                isDark={isDark}
                hint="Annual pre-tax to super"
              />
            </div>
          );
        })}
      </AccordionSection>

      <AccordionSection
        title="Asset Returns"
        badge={hasAiOverrides ? 'AI' : undefined}
        isDark={isDark}
        defaultOpen={false}
      >
        <p className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
          Risk profile: <span className="font-medium capitalize">{(riskProfile ?? 'balanced').replace(/_/g, ' ')}</span>
        </p>
        {allAssets.map((a) => {
          const override = settings.assetOverrides.find((o) => o.assetId === a.id);
          const resolvedRate = override?.growthRate ?? defaultGrowthRate(a.type, riskProfile);
          const resolvedIncome = override?.incomeRate ?? defaultIncomeRate(a.type);
          const isAi = aiAssetIds.has(a.id);
          const isSuper = a.type === 'super' || a.type === 'pension';
          const isProperty = a.type === 'property';
          const isPPR = (settings.pprAssetIds ?? []).includes(a.id);
          return (
            <div key={a.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className={`text-xs font-medium truncate ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  {a.name}
                  {isAi && override?.reason && (
                    <span className={`ml-1 ${isDark ? 'text-purple-300/50' : 'text-purple-500'}`}>
                      - AI: {override.reason}
                    </span>
                  )}
                </p>
                {isProperty && (
                  <button
                    onClick={() => togglePPR(a.id)}
                    title={isPPR ? 'Primary residence (excluded from drawdown)' : 'Mark as primary residence'}
                    className={`cursor-pointer flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full transition-colors
                      ${isPPR
                        ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                        : isDark ? 'bg-white/5 text-white/20 hover:text-white/40' : 'bg-gray-100 text-gray-300 hover:text-gray-500'
                      }`}
                  >
                    <Home className="w-3 h-3" />
                    {isPPR && 'PPR'}
                  </button>
                )}
              </div>
              <NumberInput
                label="Total Return"
                value={resolvedRate}
                onChange={(v) => updateAssetRate(a.id, v)}
                isDark={isDark}
                min={-20}
                max={30}
                hint={a.owner}
              />
              {!isSuper && (
                <NumberInput
                  label="Income Yield"
                  value={resolvedIncome}
                  onChange={(v) => updateAssetIncomeRate(a.id, v)}
                  isDark={isDark}
                  min={0}
                  max={20}
                  hint="Rent, dividends, interest"
                />
              )}
            </div>
          );
        })}
      </AccordionSection>

      {allLiabilities.length > 0 && (
        <AccordionSection
          title="Liabilities"
          badge={aiLiabilityIds.size > 0 ? 'AI' : undefined}
          isDark={isDark}
          defaultOpen={false}
        >
          {allLiabilities.map((l) => {
            const override = settings.liabilityOverrides.find((o) => o.liabilityId === l.id);
            const resolvedRate = override?.interestRate ?? l.interestRate ?? 6.0;
            const resolvedTerm = override?.remainingTermYears ?? 25;
            const isAi = aiLiabilityIds.has(l.id);
            return (
              <div key={l.id} className="space-y-2">
                <p className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  {l.name}
                  {isAi && override?.reason && (
                    <span className={`ml-1 ${isDark ? 'text-purple-300/50' : 'text-purple-500'}`}>
                      - AI: {override.reason}
                    </span>
                  )}
                </p>
                <NumberInput label="Interest Rate" value={resolvedRate} onChange={(v) => updateLiabilityRate(l.id, v)} isDark={isDark} />
                <NumberInput label="Remaining Term" value={resolvedTerm} onChange={(v) => updateLiabilityTerm(l.id, v)} suffix="yrs" min={1} max={40} step={1} isDark={isDark} />
              </div>
            );
          })}
        </AccordionSection>
      )}

      <AccordionSection title="Ongoing Expenses" isDark={isDark} defaultOpen={false}>
        <p className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
          Annual expenses deducted from income (pre-retirement) or drawn from assets (post-retirement).
        </p>
        {ongoingExpenses.map((exp) => (
          <div key={exp.id} className={`space-y-2 p-2.5 rounded-lg border ${isDark ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={exp.name}
                onChange={(e) => updateOngoingExpense(exp.id, 'name', e.target.value)}
                className={`flex-1 text-sm rounded px-2 py-1 border outline-none transition-colors
                  ${isDark ? 'bg-white/5 border-white/10 text-white/80 focus:border-blue-400/50' : 'bg-white border-gray-200 text-gray-800 focus:border-blue-400'}`}
              />
              <button
                onClick={() => removeOngoingExpense(exp.id)}
                className={`cursor-pointer p-1 rounded transition-colors ${isDark ? 'text-white/20 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <NumberInput
              label="Annual Amount"
              value={exp.annualAmount}
              onChange={(v) => updateOngoingExpense(exp.id, 'annualAmount', v)}
              suffix="$"
              min={0}
              step={1000}
              isDark={isDark}
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Indexed to inflation</span>
              <button
                onClick={() => updateOngoingExpense(exp.id, 'indexedToInflation', !exp.indexedToInflation)}
                className={`cursor-pointer text-xs px-2 py-0.5 rounded-full transition-colors
                  ${exp.indexedToInflation
                    ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                    : isDark ? 'bg-white/5 text-white/30' : 'bg-gray-100 text-gray-400'
                  }`}
              >
                {exp.indexedToInflation ? 'Yes' : 'No'}
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={addOngoingExpense}
          className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors
            ${isDark ? 'text-blue-400/70 hover:bg-white/5' : 'text-blue-500 hover:bg-blue-50'}`}
        >
          <Plus className="w-3 h-3" />
          Add Expense
        </button>
      </AccordionSection>

      <AccordionSection title="Lump Sum Expenses" isDark={isDark} defaultOpen={false}>
        <p className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
          One-off costs deducted in a specific year (e.g. renovations, car purchase).
        </p>
        {lumpSumExpenses.map((lump) => (
          <div key={lump.id} className={`space-y-2 p-2.5 rounded-lg border ${isDark ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={lump.name}
                onChange={(e) => updateLumpSumExpense(lump.id, 'name', e.target.value)}
                className={`flex-1 text-sm rounded px-2 py-1 border outline-none transition-colors
                  ${isDark ? 'bg-white/5 border-white/10 text-white/80 focus:border-blue-400/50' : 'bg-white border-gray-200 text-gray-800 focus:border-blue-400'}`}
              />
              <button
                onClick={() => removeLumpSumExpense(lump.id)}
                className={`cursor-pointer p-1 rounded transition-colors ${isDark ? 'text-white/20 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <NumberInput
              label="Amount"
              value={lump.amount}
              onChange={(v) => updateLumpSumExpense(lump.id, 'amount', v)}
              suffix="$"
              min={0}
              step={1000}
              isDark={isDark}
            />
            <NumberInput
              label="Target Year"
              value={lump.targetYear}
              onChange={(v) => updateLumpSumExpense(lump.id, 'targetYear', v)}
              suffix=""
              min={new Date().getFullYear()}
              max={new Date().getFullYear() + 50}
              step={1}
              isDark={isDark}
            />
          </div>
        ))}
        <button
          onClick={addLumpSumExpense}
          className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors
            ${isDark ? 'text-blue-400/70 hover:bg-white/5' : 'text-blue-500 hover:bg-blue-50'}`}
        >
          <Plus className="w-3 h-3" />
          Add Lump Sum
        </button>
      </AccordionSection>

      {/* Disclaimer */}
      <p className={`text-xs text-center px-2 ${isDark ? 'text-white/20' : 'text-gray-300'}`}>
        Projections are illustrative only and do not constitute financial advice.
      </p>
    </div>
  );
}
