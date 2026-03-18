import type { FinancialPlan, Entity, Asset, Liability, Expense, Client, EstatePlanItem, FamilyMember, Grandchild, Goal, Relationship, InsuranceCover } from 'shared/types';
import type { Node, Edge } from '@xyflow/react';
import { formatAUD } from './calculations';

export type Side = 'left' | 'right' | 'center';

export interface NodeData extends Record<string, unknown> {
  label: string;
  sublabel?: string;
  value?: number | null;
  nodeType: 'family' | 'client' | 'entity' | 'asset' | 'liability' | 'assetGroup' | 'expensesGroup' | 'expense' | 'estateGroup' | 'estateClient' | 'estateItem' | 'familyGroup' | 'familyMember' | 'goalsGroup' | 'goalCategoryGroup' | 'goal' | 'relationshipsGroup' | 'relationship' | 'insuranceGroup' | 'insuranceClient' | 'insuranceCoverGroup' | 'insuranceCover';
  entityType?: Entity['type'];
  assetType?: Asset['type'];
  liabilityType?: Liability['type'];
  estateItemType?: EstatePlanItem['type'];
  familyRelationship?: FamilyMember['relationship'] | Grandchild['relationship'];
  hasIssue?: boolean;
  hasGap?: boolean;
  isJoint?: boolean;
  ownerNames?: string[];
  trusteeName?: string | null;
  assetGroupCategory?: string;
  assetGroupType?: string;
  goalGroupCategory?: string;
  insuranceCoverType?: string;
  isExpanded?: boolean;
  parentOwnerId?: string;
  side: Side;
  raw?: Client | Entity | Asset | Liability | Expense | EstatePlanItem | FamilyMember | Grandchild | Goal | Relationship | InsuranceCover;
}

export function transformToGraph(plan: FinancialPlan): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  // Use override label if set, otherwise derive from client names
  let familyLabel = plan.familyLabel;
  if (!familyLabel) {
    const surnames = plan.clients.map((c) => c.name.split(' ').pop()).filter(Boolean);
    const uniqueSurnames = [...new Set(surnames)];
    const isSingleWordNames = plan.clients.every((c) => !c.name.includes(' '));
    familyLabel = isSingleWordNames
      ? plan.clients.map((c) => c.name).join(' & ')
      : uniqueSurnames.length === 1
        ? `${uniqueSurnames[0]} Family`
        : plan.clients.map((c) => c.name.split(' ')[0]).join(' & ');
  }

  // Central family node
  const familyId = 'family-root';
  nodes.push({
    id: familyId,
    type: 'familyNode',
    position: { x: 0, y: 0 },
    data: { label: familyLabel, nodeType: 'family', side: 'center' },
  });

  // LEFT SIDE — clients + personal assets/liabilities
  for (const client of plan.clients) {
    nodes.push({
      id: client.id,
      type: 'clientNode',
      position: { x: 0, y: 0 },
      data: {
        label: client.name,
        sublabel: client.occupation || undefined,
        nodeType: 'client',
        side: 'left',
        raw: client,
      },
    });
    edges.push({
      id: `${familyId}-${client.id}`,
      source: familyId,
      target: client.id,
      sourceHandle: 'left',
    });
  }

  // Personal assets — route to owner(s), cross-link for joint ownership
  const allClientIds = new Set(plan.clients.map((c) => c.id));
  const clientNameById = new Map(plan.clients.map((c) => [c.id, c.name.split(' ')[0]]));
  const defaultOwnerId = plan.clients[0]?.id;

  const resolveOwners = (ownerIds: string[]) =>
    (ownerIds?.length > 0 ? ownerIds : defaultOwnerId ? [defaultOwnerId] : [])
      .filter((id) => allClientIds.has(id));

  // Collect personal assets by primary owner for grouping
  const assetsByOwner = new Map<string, { asset: Asset; owners: string[]; ownerNames: string[] }[]>();
  for (const asset of plan.personalAssets) {
    const owners = resolveOwners(asset.ownerIds);
    const primaryOwner = owners[0];
    if (!primaryOwner) continue;
    const ownerNames = owners.map((id) => clientNameById.get(id) ?? id);
    const list = assetsByOwner.get(primaryOwner) ?? [];
    list.push({ asset, owners, ownerNames });
    assetsByOwner.set(primaryOwner, list);
  }

  for (const [ownerId, items] of assetsByOwner) {
    // Sort: individual assets first, joint assets last (pushes joint toward space between clients)
    items.sort((a, b) => (a.owners.length > 1 ? 1 : 0) - (b.owners.length > 1 ? 1 : 0));
    addGroupedAssetNodes(nodes, edges, items.map((i) => i.asset), ownerId, 'left',
      items.map((i) => ({ isJoint: i.owners.length > 1, ownerNames: i.ownerNames })));

    // Cross-link edges to additional owners (joint ownership)
    for (const { asset, owners } of items) {
      for (const additionalOwner of owners.slice(1)) {
        edges.push({
          id: `link-${additionalOwner}-${asset.id}`,
          source: additionalOwner,
          target: asset.id,
          type: 'default',
          data: { isCrossLink: true },
        });
      }
    }
  }

  // Sort personal liabilities: individual first, joint last (matches asset ordering)
  const sortedLiabilities = [...plan.personalLiabilities].sort((a, b) => {
    const aJoint = resolveOwners(a.ownerIds).length > 1 ? 1 : 0;
    const bJoint = resolveOwners(b.ownerIds).length > 1 ? 1 : 0;
    return aJoint - bJoint;
  });
  for (const liability of sortedLiabilities) {
    const owners = resolveOwners(liability.ownerIds);
    const primaryOwner = owners[0];
    if (!primaryOwner) continue;
    const ownerNames = owners.map((id) => clientNameById.get(id) ?? id);

    addLiabilityNode(nodes, edges, liability, primaryOwner, 'left', owners.length > 1, ownerNames);
    for (const ownerId of owners.slice(1)) {
      edges.push({
        id: `link-${ownerId}-${liability.id}`,
        source: ownerId,
        target: liability.id,
        type: 'default',
        data: { isCrossLink: true },
      });
    }
  }

  // LEFT SIDE — expenses group (shared, hangs off first client, cross-linked to others)
  if (plan.expenses?.length > 0) {
    const expGroupId = 'expenses-group';
    const totalAmount = plan.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const sublabelParts = [`${plan.expenses.length} item${plan.expenses.length > 1 ? 's' : ''}`];
    if (totalAmount > 0) sublabelParts.push(`${formatCompactAUD(totalAmount)}/yr`);

    // Determine primary owner: first client that appears in any expense's ownerIds, else first client
    const allExpenseOwnerIds = new Set(plan.expenses.flatMap((e) => resolveOwners(e.ownerIds)));
    const primaryExpenseOwner = plan.clients.find((c) => allExpenseOwnerIds.has(c.id))?.id ?? defaultOwnerId;

    nodes.push({
      id: expGroupId,
      type: 'expensesGroupNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Expenses',
        sublabel: sublabelParts.join(' · '),
        nodeType: 'expensesGroup',
        isExpanded: false,
        isJoint: allExpenseOwnerIds.size > 1,
        ownerNames: allExpenseOwnerIds.size > 1
          ? [...allExpenseOwnerIds].map((id) => clientNameById.get(id) ?? id)
          : undefined,
        side: 'left',
      },
    });

    // Primary edge to first client
    if (primaryExpenseOwner) {
      edges.push({
        id: `${primaryExpenseOwner}-${expGroupId}`,
        source: primaryExpenseOwner,
        target: expGroupId,
      });

      // Cross-link edges to additional clients
      for (const ownerId of allExpenseOwnerIds) {
        if (ownerId !== primaryExpenseOwner) {
          edges.push({
            id: `link-${ownerId}-${expGroupId}`,
            source: ownerId,
            target: expGroupId,
            type: 'default',
            data: { isCrossLink: true },
          });
        }
      }
    }

    for (const expense of plan.expenses) {
      const owners = resolveOwners(expense.ownerIds);
      const ownerNames = owners.map((id) => clientNameById.get(id) ?? id);
      const isJoint = owners.length > 1;

      nodes.push({
        id: expense.id,
        type: 'expenseNode',
        position: { x: 0, y: 0 },
        data: {
          label: expense.name,
          sublabel: expense.amount != null ? `${formatAUD(expense.amount)}/yr` : undefined,
          value: expense.amount,
          nodeType: 'expense',
          isJoint,
          ownerNames: isJoint ? ownerNames : undefined,
          side: 'left',
          raw: expense,
        },
      });
      edges.push({
        id: `${expGroupId}-${expense.id}`,
        source: expGroupId,
        target: expense.id,
      });
    }
  }

  // RIGHT SIDE — estate planning: group → per-client → document items
  if (plan.estatePlanning?.length > 0) {
    const estateGroupId = 'estate-group';

    // Group items by client
    const byClient = new Map<string, typeof plan.estatePlanning>();
    for (const item of plan.estatePlanning) {
      const list = byClient.get(item.clientId) ?? [];
      list.push(item);
      byClient.set(item.clientId, list);
    }

    const issueCount = plan.estatePlanning.filter((i) => i.hasIssue).length;
    nodes.push({
      id: estateGroupId,
      type: 'estateGroupNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Estate',
        sublabel: issueCount > 0 ? `${issueCount} issue${issueCount > 1 ? 's' : ''}` : `${byClient.size} clients`,
        nodeType: 'estateGroup',
        hasIssue: issueCount > 0,
        side: 'right',
      },
    });
    edges.push({
      id: `${familyId}-${estateGroupId}`,
      source: familyId,
      target: estateGroupId,
      sourceHandle: 'right',
    });

    // Per-client intermediate nodes
    for (const [clientId, clientItems] of byClient) {
      const client = plan.clients.find((c) => c.id === clientId);
      const clientName = client?.name ?? clientId;
      const clientIssues = clientItems.filter((i) => i.hasIssue).length;
      const estateClientId = `estate-client-${clientId}`;

      nodes.push({
        id: estateClientId,
        type: 'estateClientNode',
        position: { x: 0, y: 0 },
        data: {
          label: clientName,
          sublabel: clientIssues > 0 ? `${clientIssues} issue${clientIssues > 1 ? 's' : ''}` : `${clientItems.length} docs`,
          nodeType: 'estateClient',
          hasIssue: clientIssues > 0,
          side: 'right',
        },
      });
      edges.push({
        id: `${estateGroupId}-${estateClientId}`,
        source: estateGroupId,
        target: estateClientId,
      });

      // Document items under each client
      for (const item of clientItems) {
        const typeLabel = item.type === 'poa' ? 'Power of Attorney'
          : item.type === 'super_nomination' ? 'Super Nomination'
          : item.type === 'guardianship' ? 'Guardianship'
          : 'Will';
        const statusLabel = item.status === 'current' ? (item.hasIssue ? 'Needs review' : 'In Place')
          : item.status === 'expired' ? 'Expired'
          : item.status === 'not_established' ? 'Not established'
          : 'Unknown';

        nodes.push({
          id: item.id,
          type: 'estateItemNode',
          position: { x: 0, y: 0 },
          data: {
            label: typeLabel,
            sublabel: statusLabel,
            nodeType: 'estateItem',
            estateItemType: item.type,
            hasIssue: item.hasIssue,
            side: 'right',
            raw: item,
          },
        });
        edges.push({
          id: `${estateClientId}-${item.id}`,
          source: estateClientId,
          target: item.id,
        });
      }
    }
  }

  // RIGHT SIDE — insurance group → per-client → individual covers
  if (plan.insurance?.length > 0) {
    const insGroupId = 'insurance-group';

    // Group by client
    const byClient = new Map<string, typeof plan.insurance>();
    for (const cover of plan.insurance) {
      const list = byClient.get(cover.clientId) ?? [];
      list.push(cover);
      byClient.set(cover.clientId, list);
    }

    nodes.push({
      id: insGroupId,
      type: 'insuranceGroupNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Insurance',
        sublabel: `${plan.insurance.length} ${plan.insurance.length === 1 ? 'cover' : 'covers'}`,
        nodeType: 'insuranceGroup',
        side: 'right',
      },
    });
    edges.push({
      id: `${familyId}-${insGroupId}`,
      source: familyId,
      target: insGroupId,
      sourceHandle: 'right',
    });

    for (const [clientId, clientCovers] of byClient) {
      const client = plan.clients.find((c) => c.id === clientId);
      const clientName = client?.name ?? clientId;
      const insClientId = `insurance-client-${clientId}`;

      nodes.push({
        id: insClientId,
        type: 'insuranceClientNode',
        position: { x: 0, y: 0 },
        data: {
          label: clientName,
          sublabel: `${clientCovers.length} ${clientCovers.length === 1 ? 'cover' : 'covers'}`,
          nodeType: 'insuranceClient',
          side: 'right',
        },
      });
      edges.push({
        id: `${insGroupId}-${insClientId}`,
        source: insGroupId,
        target: insClientId,
      });

      // Group covers by type — if 2+ of same type, create a collapsible group
      const byType = new Map<string, typeof clientCovers>();
      for (const cover of clientCovers) {
        const list = byType.get(cover.type) ?? [];
        list.push(cover);
        byType.set(cover.type, list);
      }

      for (const [coverType, typeCovers] of byType) {
        const typeLabel = INSURANCE_COVER_DISPLAY[coverType] ?? coverType;

        if (typeCovers.length < 2) {
          // Single cover of this type — flat node, no group
          const cover = typeCovers[0];
          const sublabel = cover.coverAmount != null ? formatAUD(cover.coverAmount) : undefined;
          nodes.push({
            id: cover.id,
            type: 'insuranceCoverNode',
            position: { x: 0, y: 0 },
            data: { label: typeLabel, sublabel, value: cover.coverAmount, nodeType: 'insuranceCover', insuranceCoverType: cover.type, side: 'right', raw: cover },
          });
          edges.push({ id: `${insClientId}-${cover.id}`, source: insClientId, target: cover.id });
          continue;
        }

        // 2+ covers of same type → collapsible group
        const groupId = `ins-type-${clientId}-${coverType}`;
        const totalCover = typeCovers.reduce((sum, c) => sum + (c.coverAmount || 0), 0);
        const sublabelParts = [`${typeCovers.length} policies`];
        if (totalCover > 0) sublabelParts.push(formatCompactAUD(totalCover));

        nodes.push({
          id: groupId,
          type: 'insuranceCoverGroupNode',
          position: { x: 0, y: 0 },
          data: { label: typeLabel, sublabel: sublabelParts.join(' · '), nodeType: 'insuranceCoverGroup', insuranceCoverType: coverType, side: 'right' },
        });
        edges.push({ id: `${insClientId}-${groupId}`, source: insClientId, target: groupId });

        for (const cover of typeCovers) {
          const policyLabel = cover.policyName || typeLabel;
          const sublabel = cover.coverAmount != null ? formatAUD(cover.coverAmount) : undefined;
          nodes.push({
            id: cover.id,
            type: 'insuranceCoverNode',
            position: { x: 0, y: 0 },
            data: { label: policyLabel, sublabel, value: cover.coverAmount, nodeType: 'insuranceCover', insuranceCoverType: cover.type, side: 'right', raw: cover },
          });
          edges.push({ id: `${groupId}-${cover.id}`, source: groupId, target: cover.id });
        }
      }
    }
  }

  // RIGHT SIDE — family group + children + grandchildren (two-level hierarchy)
  if (plan.familyMembers?.length > 0) {
    const familyGroupId = 'family-group';
    const totalGrandchildren = plan.familyMembers.reduce((n, m) => n + (m.children?.length ?? 0), 0);
    const countParts = [`${plan.familyMembers.length} children`];
    if (totalGrandchildren > 0) countParts.push(`${totalGrandchildren} grandchildren`);

    nodes.push({
      id: familyGroupId,
      type: 'familyGroupNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Family',
        sublabel: countParts.join(', '),
        nodeType: 'familyGroup',
        side: 'right',
      },
    });
    edges.push({
      id: `${familyId}-${familyGroupId}`,
      source: familyId,
      target: familyGroupId,
      sourceHandle: 'right',
    });

    for (const member of plan.familyMembers) {
      // Build sublabel: partner + relationship
      const parts: string[] = [];
      if (member.partner) parts.push(`& ${member.partner}`);
      if (member.isDependant) parts.push('Dep.');

      nodes.push({
        id: member.id,
        type: 'familyMemberNode',
        position: { x: 0, y: 0 },
        data: {
          label: member.name,
          sublabel: parts.join(' · ') || member.relationship,
          nodeType: 'familyMember',
          familyRelationship: member.relationship,
          side: 'right',
          raw: member,
        },
      });
      edges.push({
        id: `${familyGroupId}-${member.id}`,
        source: familyGroupId,
        target: member.id,
      });

      // Grandchildren nested under their parent
      for (const grandchild of member.children ?? []) {
        const gcParts: string[] = [];
        if (grandchild.isDependant) gcParts.push('Dep.');
        if (grandchild.age != null) gcParts.push(`${grandchild.age}y`);

        nodes.push({
          id: grandchild.id,
          type: 'familyMemberNode',
          position: { x: 0, y: 0 },
          data: {
            label: grandchild.name,
            sublabel: gcParts.join(', ') || grandchild.relationship,
            nodeType: 'familyMember',
            familyRelationship: grandchild.relationship,
            side: 'right',
            raw: grandchild,
          },
        });
        edges.push({
          id: `${member.id}-${grandchild.id}`,
          source: member.id,
          target: grandchild.id,
        });
      }
    }
  }

  // RIGHT SIDE — goals group → category groups → individual goals
  if (plan.goals?.length > 0) {
    const goalsGroupId = 'goals-group';
    nodes.push({
      id: goalsGroupId,
      type: 'goalsGroupNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Goals',
        sublabel: `${plan.goals.length} ${plan.goals.length === 1 ? 'goal' : 'goals'}`,
        nodeType: 'goalsGroup',
        side: 'right',
      },
    });
    edges.push({
      id: `${familyId}-${goalsGroupId}`,
      source: familyId,
      target: goalsGroupId,
      sourceHandle: 'right',
    });

    // Group goals by category
    const goalsByCategory = new Map<string, Goal[]>();
    for (const goal of plan.goals) {
      const cat = goal.category || 'other';
      const list = goalsByCategory.get(cat) ?? [];
      list.push(goal);
      goalsByCategory.set(cat, list);
    }

    for (const [category, categoryGoals] of goalsByCategory) {
      if (categoryGoals.length < 2) {
        // Single goal in this category — flat node, no group wrapper
        const goal = categoryGoals[0];
        const parts: string[] = [];
        if (goal.category) parts.push(GOAL_CATEGORY_DISPLAY[goal.category] ?? goal.category);
        if (goal.timeframe) parts.push(goal.timeframe);

        nodes.push({
          id: goal.id,
          type: 'goalNode',
          position: { x: 0, y: 0 },
          data: {
            label: goal.name,
            sublabel: parts.join(' · ') || undefined,
            value: goal.value,
            nodeType: 'goal',
            side: 'right',
            raw: goal,
          },
        });
        edges.push({
          id: `${goalsGroupId}-${goal.id}`,
          source: goalsGroupId,
          target: goal.id,
        });
        continue;
      }

      // 2+ goals of same category → create group node
      const displayLabel = GOAL_CATEGORY_DISPLAY[category] ?? 'Other';
      const catGroupId = `goal-cat-${category}`;

      nodes.push({
        id: catGroupId,
        type: 'goalCategoryGroupNode',
        position: { x: 0, y: 0 },
        data: {
          label: displayLabel,
          sublabel: `${categoryGoals.length} goals`,
          nodeType: 'goalCategoryGroup',
          goalGroupCategory: displayLabel,
          side: 'right',
        },
      });
      edges.push({
        id: `${goalsGroupId}-${catGroupId}`,
        source: goalsGroupId,
        target: catGroupId,
      });

      for (const goal of categoryGoals) {
        const parts: string[] = [];
        if (goal.timeframe) parts.push(goal.timeframe);

        nodes.push({
          id: goal.id,
          type: 'goalNode',
          position: { x: 0, y: 0 },
          data: {
            label: goal.name,
            sublabel: parts.join(' · ') || undefined,
            value: goal.value,
            nodeType: 'goal',
            side: 'right',
            raw: goal,
          },
        });
        edges.push({
          id: `${catGroupId}-${goal.id}`,
          source: catGroupId,
          target: goal.id,
        });
      }
    }
  }

  // RIGHT SIDE — relationships group + individual advisers
  if (plan.relationships?.length > 0) {
    const relsGroupId = 'relationships-group';
    nodes.push({
      id: relsGroupId,
      type: 'relationshipsGroupNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Advisers',
        sublabel: `${plan.relationships.length} ${plan.relationships.length === 1 ? 'adviser' : 'advisers'}`,
        nodeType: 'relationshipsGroup',
        side: 'right',
      },
    });
    edges.push({
      id: `${familyId}-${relsGroupId}`,
      source: familyId,
      target: relsGroupId,
      sourceHandle: 'right',
    });

    for (const rel of plan.relationships) {
      const typeLabel = rel.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      nodes.push({
        id: rel.id,
        type: 'relationshipNode',
        position: { x: 0, y: 0 },
        data: {
          label: rel.contactName ?? rel.firmName ?? typeLabel,
          sublabel: typeLabel,
          nodeType: 'relationship',
          side: 'right',
          raw: rel,
        },
      });
      edges.push({
        id: `${relsGroupId}-${rel.id}`,
        source: relsGroupId,
        target: rel.id,
      });
    }
  }

  // LEFT SIDE — entities + their assets/liabilities
  for (const entity of plan.entities) {
    const isTrustLike = entity.type === 'trust' || entity.type === 'smsf';

    // For trusts/SMSFs with a trustee, sublabel becomes "Trustee ATF" — entity name is the trust name
    const sublabel = isTrustLike && entity.trusteeName
      ? `${entity.trusteeName} ATF`
      : entity.type.toUpperCase();

    nodes.push({
      id: entity.id,
      type: 'entityNode',
      position: { x: 0, y: 0 },
      data: {
        label: entity.name,
        sublabel,
        nodeType: 'entity',
        entityType: entity.type,
        trusteeName: entity.trusteeName,
        side: 'left',
        raw: entity,
      },
    });
    edges.push({
      id: `${familyId}-${entity.id}`,
      source: familyId,
      target: entity.id,
      sourceHandle: 'left',
    });

    addGroupedAssetNodes(nodes, edges, entity.assets, entity.id, 'left');
    for (const liability of entity.liabilities) {
      addLiabilityNode(nodes, edges, liability, entity.id, 'left');
    }
  }

  return { nodes, edges };
}

/** Goal category → display label for group nodes */
export const GOAL_CATEGORY_DISPLAY: Record<string, string> = {
  retirement: 'Retirement Planning',
  superannuation: 'Superannuation & Pensions',
  tax: 'Tax',
  wealth: 'Wealth',
  protection: 'Protection',
  estate: 'Estate Planning',
  lifestyle: 'Living & Lifestyle',
  cash_reserve: 'Cash Reserve',
  other_investments: 'Other Investments',
  debt: 'Debt & Credit',
  centrelink: 'Centrelink',
  education: 'Education',
  regular_review: 'Regular Review',
  other: 'Other',
};

/** Insurance cover type → display label */
const INSURANCE_COVER_DISPLAY: Record<string, string> = {
  life: 'Life Cover',
  tpd: 'TPD Cover',
  trauma: 'Trauma Cover',
  income_protection: 'Income Protection',
};

/** Raw asset type → display label for group nodes */
export const ASSET_TYPE_DISPLAY: Record<string, string> = {
  property: 'Property',
  shares: 'Shares',
  cash: 'Cash',
  managed_fund: 'Managed Funds',
  super: 'Super',
  pension: 'Pension',
  vehicle: 'Vehicle',
  other: 'Other',
};

function formatCompactAUD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return formatAUD(value);
}

function addGroupedAssetNodes(
  nodes: Node<NodeData>[],
  edges: Edge[],
  assets: Asset[],
  parentId: string,
  side: Side,
  perAssetMeta?: { isJoint: boolean; ownerNames: string[] }[],
) {
  // Group assets by raw type
  const grouped = new Map<string, { asset: Asset; idx: number }[]>();
  for (let i = 0; i < assets.length; i++) {
    const rawType = assets[i].type;
    const list = grouped.get(rawType) ?? [];
    list.push({ asset: assets[i], idx: i });
    grouped.set(rawType, list);
  }

  for (const [rawType, items] of grouped) {
    if (items.length < 2) {
      // Single asset of this type — flat node, no group wrapper
      const { asset, idx } = items[0];
      const meta = perAssetMeta?.[idx];
      addAssetNode(nodes, edges, asset, parentId, side, meta?.isJoint, meta?.ownerNames);
      continue;
    }

    // 2+ assets of same type → create group node
    const displayLabel = ASSET_TYPE_DISPLAY[rawType] ?? 'Other';
    const groupId = `asset-group-${parentId}-${rawType}`;
    const totalValue = items.reduce((sum, { asset }) => sum + (asset.value || 0), 0);
    const sublabelParts = [`${items.length} item${items.length > 1 ? 's' : ''}`];
    if (totalValue > 0) sublabelParts.push(formatCompactAUD(totalValue));

    nodes.push({
      id: groupId,
      type: 'assetGroupNode',
      position: { x: 0, y: 0 },
      data: {
        label: displayLabel,
        sublabel: sublabelParts.join(' · '),
        nodeType: 'assetGroup',
        assetGroupCategory: displayLabel,
        assetGroupType: rawType,
        parentOwnerId: parentId,
        side,
      },
    });
    edges.push({
      id: `${parentId}-${groupId}`,
      source: parentId,
      target: groupId,
    });

    for (const { asset, idx } of items) {
      const meta = perAssetMeta?.[idx];
      addAssetNode(nodes, edges, asset, groupId, side, meta?.isJoint, meta?.ownerNames);
    }
  }
}

function addAssetNode(
  nodes: Node<NodeData>[],
  edges: Edge[],
  asset: Asset,
  parentId: string,
  side: Side,
  isJoint = false,
  ownerNames?: string[],
) {
  nodes.push({
    id: asset.id,
    type: 'assetNode',
    position: { x: 0, y: 0 },
    data: {
      label: asset.name,
      sublabel: asset.value != null ? formatAUD(asset.value) : undefined,
      value: asset.value,
      nodeType: 'asset',
      assetType: asset.type,
      isJoint,
      ownerNames,
      side,
      raw: asset,
    },
  });
  edges.push({
    id: `${parentId}-${asset.id}`,
    source: parentId,
    target: asset.id,
  });
}

function addLiabilityNode(
  nodes: Node<NodeData>[],
  edges: Edge[],
  liability: Liability,
  parentId: string,
  side: Side,
  isJoint = false,
  ownerNames?: string[],
) {
  nodes.push({
    id: liability.id,
    type: 'liabilityNode',
    position: { x: 0, y: 0 },
    data: {
      label: liability.name,
      sublabel: liability.amount != null ? formatAUD(liability.amount) : undefined,
      value: liability.amount,
      nodeType: 'liability',
      liabilityType: liability.type,
      isJoint,
      ownerNames,
      side,
      raw: liability,
    },
  });
  edges.push({
    id: `${parentId}-${liability.id}`,
    source: parentId,
    target: liability.id,
  });
}
