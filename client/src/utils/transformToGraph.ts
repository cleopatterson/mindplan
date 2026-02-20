import type { FinancialPlan, Entity, Asset, Liability, Client, EstatePlanItem, FamilyMember, Grandchild } from 'shared/types';
import type { Node, Edge } from '@xyflow/react';
import { formatAUD } from './calculations';

export type Side = 'left' | 'right' | 'center';

export interface NodeData extends Record<string, unknown> {
  label: string;
  sublabel?: string;
  value?: number | null;
  nodeType: 'family' | 'client' | 'entity' | 'asset' | 'liability' | 'estateGroup' | 'estateClient' | 'estateItem' | 'familyGroup' | 'familyMember';
  entityType?: Entity['type'];
  assetType?: Asset['type'];
  liabilityType?: Liability['type'];
  estateItemType?: EstatePlanItem['type'];
  familyRelationship?: FamilyMember['relationship'] | Grandchild['relationship'];
  hasIssue?: boolean;
  isJoint?: boolean;
  ownerNames?: string[];
  trusteeName?: string | null;
  side: Side;
  raw?: Client | Entity | Asset | Liability | EstatePlanItem | FamilyMember | Grandchild;
}

export function transformToGraph(plan: FinancialPlan): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  // Derive a family label from clients
  const surnames = plan.clients.map((c) => c.name.split(' ').pop()).filter(Boolean);
  const uniqueSurnames = [...new Set(surnames)];
  const isSingleWordNames = plan.clients.every((c) => !c.name.includes(' '));
  const familyLabel = isSingleWordNames
    ? plan.clients.map((c) => c.name).join(' & ')
    : uniqueSurnames.length === 1
      ? `${uniqueSurnames[0]} Family`
      : plan.clients.map((c) => c.name.split(' ')[0]).join(' & ');

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

  for (const asset of plan.personalAssets) {
    const owners = resolveOwners(asset.ownerIds);
    const primaryOwner = owners[0];
    if (!primaryOwner) continue;
    const ownerNames = owners.map((id) => clientNameById.get(id) ?? id);

    addAssetNode(nodes, edges, asset, primaryOwner, 'left', owners.length > 1, ownerNames);
    // Cross-link edges to additional owners (joint ownership)
    for (const ownerId of owners.slice(1)) {
      edges.push({
        id: `link-${ownerId}-${asset.id}`,
        source: ownerId,
        target: asset.id,
        type: 'smoothstep',
        data: { isCrossLink: true },
      });
    }
  }

  for (const liability of plan.personalLiabilities) {
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
        type: 'smoothstep',
        data: { isCrossLink: true },
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

    for (const asset of entity.assets) {
      addAssetNode(nodes, edges, asset, entity.id, 'left');
    }
    for (const liability of entity.liabilities) {
      addLiabilityNode(nodes, edges, liability, entity.id, 'left');
    }
  }

  return { nodes, edges };
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
