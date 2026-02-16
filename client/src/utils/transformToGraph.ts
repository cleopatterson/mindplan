import type { FinancialPlan, Entity, Asset, Liability, Client } from 'shared/types';
import type { Node, Edge } from '@xyflow/react';
import { formatAUD } from './calculations';

export type Side = 'left' | 'right' | 'center';

export interface NodeData extends Record<string, unknown> {
  label: string;
  sublabel?: string;
  value?: number | null;
  nodeType: 'family' | 'client' | 'entity' | 'asset' | 'liability';
  entityType?: Entity['type'];
  assetType?: Asset['type'];
  liabilityType?: Liability['type'];
  hasMissingData?: boolean;
  side: Side;
  raw?: Client | Entity | Asset | Liability;
}

export function transformToGraph(plan: FinancialPlan): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];
  const gapEntityIds = new Set(plan.dataGaps.map((g) => g.entityId));

  // Derive a family name from clients
  const surnames = plan.clients.map((c) => c.name.split(' ').pop()).filter(Boolean);
  const uniqueSurnames = [...new Set(surnames)];
  const familyLabel =
    uniqueSurnames.length === 1
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
        hasMissingData: client.age === null || client.income === null,
        side: 'left',
        raw: client,
      },
    });
    edges.push({
      id: `${familyId}-${client.id}`,
      source: familyId,
      target: client.id,
    });
  }

  // Personal assets/liabilities hang off first client
  const primaryClientId = plan.clients[0]?.id;
  if (primaryClientId) {
    for (const asset of plan.personalAssets) {
      addAssetNode(nodes, edges, asset, primaryClientId, 'left');
    }
    for (const liability of plan.personalLiabilities) {
      addLiabilityNode(nodes, edges, liability, primaryClientId, 'left');
    }
  }

  // RIGHT SIDE — entities + their assets/liabilities
  for (const entity of plan.entities) {
    nodes.push({
      id: entity.id,
      type: 'entityNode',
      position: { x: 0, y: 0 },
      data: {
        label: entity.name,
        sublabel: entity.type.toUpperCase(),
        nodeType: 'entity',
        entityType: entity.type,
        hasMissingData: gapEntityIds.has(entity.id),
        side: 'right',
        raw: entity,
      },
    });
    edges.push({
      id: `${familyId}-${entity.id}`,
      source: familyId,
      target: entity.id,
    });

    for (const asset of entity.assets) {
      addAssetNode(nodes, edges, asset, entity.id, 'right');
    }
    for (const liability of entity.liabilities) {
      addLiabilityNode(nodes, edges, liability, entity.id, 'right');
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
      hasMissingData: asset.value === null,
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
      hasMissingData: liability.amount === null,
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
