import { useState } from 'react';
import type { FinancialPlan, ProjectionSettings, Asset } from 'shared/types';
import { useTheme } from '../../contexts/ThemeContext';
import { defaultGrowthRate } from '../../utils/projectionDefaults';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

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

  const allLiabilities = [
    ...plan.personalLiabilities.map((l) => ({ ...l, owner: 'Personal' })),
    ...plan.entities.flatMap((e) => e.liabilities.map((l) => ({ ...l, owner: e.name }))),
  ];

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
          const isAi = aiAssetIds.has(a.id);
          return (
            <NumberInput
              key={a.id}
              label={a.name}
              value={resolvedRate}
              onChange={(v) => updateAssetRate(a.id, v)}
              isDark={isDark}
              min={-20}
              max={30}
              hint={isAi && override?.reason ? `AI: ${override.reason}` : a.owner}
            />
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

      {/* Disclaimer */}
      <p className={`text-xs text-center px-2 ${isDark ? 'text-white/20' : 'text-gray-300'}`}>
        Projections are illustrative only and do not constitute financial advice.
      </p>
    </div>
  );
}
