import type { ProjectionResult } from 'shared/types';
import type { ProjectionCardId } from './ProjectionSummaryStrip';
import { useTheme } from '../../contexts/ThemeContext';
import { formatAUD } from '../../utils/calculations';

interface Props {
  result: ProjectionResult;
  activeCard: ProjectionCardId;
}

const TYPE_LABELS: Record<string, string> = {
  property: 'Property', shares: 'Shares', managed_fund: 'Managed Fund',
  cash: 'Cash', super: 'Super', pension: 'Pension', vehicle: 'Vehicle', other: 'Other',
  mortgage: 'Mortgage', loan: 'Loan', credit_card: 'Credit Card',
};

function Row({ label, value, sub, isDark }: { label: string; value: string; sub?: string; isDark: boolean }) {
  return (
    <div className={`flex items-start justify-between py-2 border-b last:border-b-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isDark ? 'text-white/70' : 'text-gray-700'}`}>{label}</p>
        {sub && <p className={`text-xs mt-0.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{sub}</p>}
      </div>
      <span className={`text-sm font-mono ml-3 shrink-0 ${isDark ? 'text-white/80' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ title, isDark }: { title: string; isDark: boolean }) {
  return (
    <h4 className={`text-xs font-semibold uppercase tracking-wider mt-4 mb-2 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
      {title}
    </h4>
  );
}

function NetWorthRetirementDetail({ result, isDark }: { result: ProjectionResult; isDark: boolean }) {
  const retYear = result.retirementYear;
  const retRow = retYear ? result.yearData.find((r) => r.year === retYear) : null;

  return (
    <div>
      <p className={`text-sm mb-3 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
        Projected net worth at retirement ({retYear ?? '?'}), broken down by asset category minus liabilities.
      </p>
      {retRow && (
        <>
          <SectionHeader title="Assets at Retirement" isDark={isDark} />
          {retRow.property > 0 && <Row label="Property" value={formatAUD(retRow.property)} isDark={isDark} />}
          {retRow.shares > 0 && <Row label="Shares & Funds" value={formatAUD(retRow.shares)} isDark={isDark} />}
          {retRow.super > 0 && <Row label="Super & Pension" value={formatAUD(retRow.super)} isDark={isDark} />}
          {retRow.cash > 0 && <Row label="Cash" value={formatAUD(retRow.cash)} isDark={isDark} />}
          {retRow.vehicle > 0 && <Row label="Vehicles" value={formatAUD(retRow.vehicle)} isDark={isDark} />}
          {retRow.other > 0 && <Row label="Other" value={formatAUD(retRow.other)} isDark={isDark} />}
          {retRow.liabilities < 0 && <Row label="Liabilities" value={formatAUD(retRow.liabilities)} isDark={isDark} />}

          <SectionHeader title="Total" isDark={isDark} />
          <Row label="Net Worth" value={formatAUD(retRow.netWorth)} isDark={isDark} />
        </>
      )}

      <SectionHeader title="Growth Assumptions" isDark={isDark} />
      {result.assetDetails
        .filter((a) => a.startValue > 0)
        .sort((a, b) => b.endValue - a.endValue)
        .slice(0, 10)
        .map((a, i) => (
          <Row
            key={i}
            label={a.name}
            value={`${a.growthRate > 0 ? '+' : ''}${a.growthRate}% p.a.`}
            sub={`${TYPE_LABELS[a.type] ?? a.type} | ${formatAUD(a.startValue)} → ${formatAUD(a.endValue)}`}
            isDark={isDark}
          />
        ))}
    </div>
  );
}

function SuperRetirementDetail({ result, isDark }: { result: ProjectionResult; isDark: boolean }) {
  const superAssets = result.assetDetails.filter((a) => a.type === 'super' || a.type === 'pension');

  return (
    <div>
      <p className={`text-sm mb-3 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
        Projected super and pension balances at retirement ({result.retirementYear ?? '?'}), including employer contributions and investment growth.
      </p>

      <SectionHeader title="Super Accounts" isDark={isDark} />
      {superAssets.map((a, i) => (
        <Row
          key={i}
          label={a.name}
          value={formatAUD(a.endValue)}
          sub={`Start: ${formatAUD(a.startValue)} | Growth: ${a.growthRate}% p.a.`}
          isDark={isDark}
        />
      ))}

      {superAssets.length > 0 && (
        <>
          <SectionHeader title="Total" isDark={isDark} />
          <Row
            label="Combined Super"
            value={formatAUD(superAssets.reduce((s, a) => s + a.endValue, 0))}
            sub={`Started at ${formatAUD(superAssets.reduce((s, a) => s + a.startValue, 0))}`}
            isDark={isDark}
          />
        </>
      )}
    </div>
  );
}

function DebtFreeDetail({ result, isDark }: { result: ProjectionResult; isDark: boolean }) {
  const currentYear = new Date().getFullYear();

  return (
    <div>
      <p className={`text-sm mb-3 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
        {result.yearsUntilDebtFree !== null
          ? `All debts are projected to be paid off by ${currentYear + result.yearsUntilDebtFree}.`
          : result.liabilityDetails.length === 0
            ? 'No liabilities in the plan.'
            : 'Some debts may not be fully paid within the projection horizon.'
        }
      </p>

      <SectionHeader title="Liabilities" isDark={isDark} />
      {result.liabilityDetails
        .sort((a, b) => b.startBalance - a.startBalance)
        .map((l, i) => (
          <Row
            key={i}
            label={l.name}
            value={l.paidOffYear ? `Paid off ${l.paidOffYear}` : formatAUD(l.endBalance)}
            sub={`${TYPE_LABELS[l.type] ?? l.type} | ${formatAUD(l.startBalance)} at ${l.interestRate}% | ${formatAUD(l.annualPayment)}/yr over ${l.termYears}yr`}
            isDark={isDark}
          />
        ))}

      {result.liabilityDetails.length > 0 && (
        <>
          <SectionHeader title="Total" isDark={isDark} />
          <Row
            label="Starting Debt"
            value={formatAUD(result.liabilityDetails.reduce((s, l) => s + l.startBalance, 0))}
            isDark={isDark}
          />
          <Row
            label="Remaining at End"
            value={formatAUD(result.liabilityDetails.reduce((s, l) => s + l.endBalance, 0))}
            isDark={isDark}
          />
        </>
      )}
    </div>
  );
}

function FinalNetWorthDetail({ result, isDark }: { result: ProjectionResult; isDark: boolean }) {
  const firstRow = result.yearData[0];
  const lastRow = result.yearData[result.yearData.length - 1];
  if (!firstRow || !lastRow) return null;

  const growth = lastRow.netWorth - firstRow.netWorth;
  const years = lastRow.year - firstRow.year;

  return (
    <div>
      <p className={`text-sm mb-3 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
        Projected net worth at the end of the {years}-year projection ({lastRow.year}).
      </p>

      <SectionHeader title="Summary" isDark={isDark} />
      <Row label="Starting Net Worth" value={formatAUD(firstRow.netWorth)} isDark={isDark} />
      <Row label="Final Net Worth" value={formatAUD(lastRow.netWorth)} isDark={isDark} />
      <Row label="Total Growth" value={formatAUD(growth)} sub={`Over ${years} years`} isDark={isDark} />

      <SectionHeader title="Final Breakdown" isDark={isDark} />
      {lastRow.property > 0 && <Row label="Property" value={formatAUD(lastRow.property)} isDark={isDark} />}
      {lastRow.shares > 0 && <Row label="Shares & Funds" value={formatAUD(lastRow.shares)} isDark={isDark} />}
      {lastRow.super > 0 && <Row label="Super & Pension" value={formatAUD(lastRow.super)} isDark={isDark} />}
      {lastRow.cash > 0 && <Row label="Cash" value={formatAUD(lastRow.cash)} isDark={isDark} />}
      {lastRow.vehicle > 0 && <Row label="Vehicles" value={formatAUD(lastRow.vehicle)} isDark={isDark} />}
      {lastRow.other > 0 && <Row label="Other" value={formatAUD(lastRow.other)} isDark={isDark} />}
      {lastRow.liabilities < 0 && <Row label="Liabilities" value={formatAUD(lastRow.liabilities)} isDark={isDark} />}

      <SectionHeader title="Top Growth Assets" isDark={isDark} />
      {result.assetDetails
        .filter((a) => a.startValue > 0)
        .sort((a, b) => (b.endValue - b.startValue) - (a.endValue - a.startValue))
        .slice(0, 5)
        .map((a, i) => (
          <Row
            key={i}
            label={a.name}
            value={formatAUD(a.endValue - a.startValue)}
            sub={`${formatAUD(a.startValue)} → ${formatAUD(a.endValue)} (${a.growthRate}% p.a.)`}
            isDark={isDark}
          />
        ))}
    </div>
  );
}

export function ProjectionDetailPanel({ result, activeCard }: Props) {
  const theme = useTheme();
  const isDark = theme === 'dark';

  switch (activeCard) {
    case 'netWorthRetirement':
      return <NetWorthRetirementDetail result={result} isDark={isDark} />;
    case 'superRetirement':
      return <SuperRetirementDetail result={result} isDark={isDark} />;
    case 'debtFree':
      return <DebtFreeDetail result={result} isDark={isDark} />;
    case 'finalNetWorth':
      return <FinalNetWorthDetail result={result} isDark={isDark} />;
  }
}
