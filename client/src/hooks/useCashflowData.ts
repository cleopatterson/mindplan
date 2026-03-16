import { useMemo } from 'react';
import type { FinancialPlan, Expense, Liability } from 'shared/types';

export interface SankeyNode {
  id: string;
  label: string;
  value: number;
  column: 0 | 1 | 2;
  color: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalIncome: number;
  totalOutflows: number;
  surplus: number;
}

const INCOME_COLOR = '#3b82f6';       // blue
const HOUSEHOLD_COLOR = '#6366f1';    // indigo
const EXPENSE_COLORS: Record<string, string> = {
  Housing: '#f59e0b',          // amber
  Transport: '#8b5cf6',        // violet
  'Insurance & Health': '#10b981', // emerald
  Lifestyle: '#f97316',        // orange
  Education: '#3b82f6',        // blue
  Other: '#64748b',            // slate
};
const LIABILITY_COLOR = '#ef4444';    // red
const SURPLUS_COLOR = '#22c55e';      // green
const DEFICIT_COLOR = '#ef4444';      // red

const EXPENSE_CATEGORIES: Record<string, string[]> = {
  Housing: ['mortgage', 'rent', 'rates', 'strata', 'body corp', 'council'],
  Transport: ['car', 'fuel', 'transport', 'vehicle', 'rego', 'parking'],
  'Insurance & Health': ['insurance', 'health', 'medical', 'dental', 'gym'],
  Lifestyle: ['entertainment', 'dining', 'travel', 'holiday', 'clothing', 'grocer'],
  Education: ['school', 'education', 'childcare', 'university', 'tutor'],
};

function categoriseExpense(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(EXPENSE_CATEGORIES)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'Other';
}

/** Calculate P&I annual payment */
function annualPayment(principal: number, annualRate: number, termYears: number): number {
  if (annualRate === 0) return termYears > 0 ? principal / termYears : principal;
  const r = annualRate / 100;
  return (principal * r) / (1 - Math.pow(1 + r, -termYears));
}

function defaultTerm(liability: Liability): number {
  switch (liability.type) {
    case 'mortgage': return 25;
    case 'credit_card': return 3;
    default: return 5;
  }
}

export function useCashflowData(plan: FinancialPlan): SankeyData {
  return useMemo(() => buildCashflowData(plan), [plan]);
}

function buildCashflowData(plan: FinancialPlan): SankeyData {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const nodeSet = new Set<string>();

  const addNode = (node: SankeyNode) => {
    if (!nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      nodes.push(node);
    }
  };

  // ── Column 0: Inflows (client income) ──
  let totalIncome = 0;
  for (const client of plan.clients) {
    const income = client.income || 0;
    if (income <= 0) continue;
    totalIncome += income;
    addNode({ id: `income-${client.id}`, label: client.name, value: income, column: 0, color: INCOME_COLOR });
  }

  if (totalIncome === 0) {
    return { nodes: [], links: [], totalIncome: 0, totalOutflows: 0, surplus: 0 };
  }

  // ── Column 1: Household pass-through ──
  addNode({ id: 'household', label: 'Household Cashflow', value: totalIncome, column: 1, color: HOUSEHOLD_COLOR });

  // Link incomes → household
  for (const client of plan.clients) {
    const income = client.income || 0;
    if (income > 0) {
      links.push({ source: `income-${client.id}`, target: 'household', value: income });
    }
  }

  // ── Column 2: Outflows ──
  let totalOutflows = 0;

  // Grouped expenses
  const expenseGroups: Record<string, number> = {};
  for (const expense of plan.expenses) {
    const amount = expense.amount || 0;
    if (amount <= 0) continue;
    const category = categoriseExpense(expense.name);
    expenseGroups[category] = (expenseGroups[category] || 0) + amount;
  }

  for (const [category, total] of Object.entries(expenseGroups)) {
    const id = `expense-${category}`;
    addNode({ id, label: category, value: total, column: 2, color: EXPENSE_COLORS[category] || '#64748b' });
    links.push({ source: 'household', target: id, value: total });
    totalOutflows += total;
  }

  // Liability repayments (personal + entity)
  const allLiabilities: Liability[] = [
    ...plan.personalLiabilities,
    ...plan.entities.flatMap((e) => e.liabilities),
  ];
  let totalRepayments = 0;
  for (const liability of allLiabilities) {
    const amount = liability.amount || 0;
    if (amount <= 0) continue;
    const rate = liability.interestRate || 0;
    const term = defaultTerm(liability);
    const payment = annualPayment(amount, rate, term);
    totalRepayments += payment;
  }

  if (totalRepayments > 0) {
    const repaymentValue = Math.round(totalRepayments);
    addNode({ id: 'outflow-repayments', label: 'Loan Repayments', value: repaymentValue, column: 2, color: LIABILITY_COLOR });
    links.push({ source: 'household', target: 'outflow-repayments', value: repaymentValue });
    totalOutflows += repaymentValue;
  }

  // Surplus / Deficit
  const surplus = totalIncome - totalOutflows;
  if (surplus !== 0) {
    const isPositive = surplus > 0;
    addNode({
      id: 'surplus',
      label: isPositive ? 'Surplus' : 'Deficit',
      value: Math.abs(surplus),
      column: 2,
      color: isPositive ? SURPLUS_COLOR : DEFICIT_COLOR,
    });
    links.push({ source: 'household', target: 'surplus', value: Math.abs(surplus) });
  }

  return { nodes, links, totalIncome, totalOutflows, surplus };
}
