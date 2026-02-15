import type { FinancialPlan, Entity, Asset, Liability, Client } from 'shared/types';
import type { Node, Edge } from '@xyflow/react';

export interface NodeData extends Record<string, unknown> {
  label: string;
  sublabel?: string;
  value?: number | null;
  nodeType: 'client' | 'entity' | 'asset' | 'liability';
  entityType?: Entity['type'];
  assetType?: Asset['type'];
  liabilityType?: Liability['type'];
  hasMissingData?: boolean;
  raw?: Client | Entity | Asset | Liability;
}

export function transformToGraph(plan: FinancialPlan): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];
  const gapEntityIds = new Set(plan.dataGaps.map((g) => g.entityId));

  // Client nodes
  for (const client of plan.clients) {
    nodes.push({
      id: client.id,
      type: 'clientNode',
      position: { x: 0, y: 0 }, // dagre will set this
      data: {
        label: client.name,
        sublabel: client.occupation || undefined,
        nodeType: 'client',
        hasMissingData: client.age === null || client.income === null,
        raw: client,
      },
    });
  }

  // Entity nodes + their assets/liabilities
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
        raw: entity,
      },
    });

    // Connect entity to linked clients
    for (const clientId of entity.linkedClientIds) {
      edges.push({
        id: `${clientId}-${entity.id}`,
        source: clientId,
        target: entity.id,
        type: 'smoothstep',
      });
    }

    // Assets under this entity
    for (const asset of entity.assets) {
      addAssetNode(nodes, edges, asset, entity.id);
    }

    // Liabilities under this entity
    for (const liability of entity.liabilities) {
      addLiabilityNode(nodes, edges, liability, entity.id);
    }
  }

  // Personal assets connect to all clients (or first client)
  const primaryClientId = plan.clients[0]?.id;
  if (primaryClientId) {
    for (const asset of plan.personalAssets) {
      addAssetNode(nodes, edges, asset, primaryClientId);
    }
    for (const liability of plan.personalLiabilities) {
      addLiabilityNode(nodes, edges, liability, primaryClientId);
    }
  }

  return { nodes, edges };
}

function addAssetNode(nodes: Node<NodeData>[], edges: Edge[], asset: Asset, parentId: string) {
  nodes.push({
    id: asset.id,
    type: 'assetNode',
    position: { x: 0, y: 0 },
    data: {
      label: asset.name,
      sublabel: formatCurrency(asset.value),
      value: asset.value,
      nodeType: 'asset',
      assetType: asset.type,
      hasMissingData: asset.value === null,
      raw: asset,
    },
  });
  edges.push({
    id: `${parentId}-${asset.id}`,
    source: parentId,
    target: asset.id,
    type: 'smoothstep',
  });
}

function addLiabilityNode(
  nodes: Node<NodeData>[],
  edges: Edge[],
  liability: Liability,
  parentId: string,
) {
  nodes.push({
    id: liability.id,
    type: 'liabilityNode',
    position: { x: 0, y: 0 },
    data: {
      label: liability.name,
      sublabel: formatCurrency(liability.amount),
      value: liability.amount,
      nodeType: 'liability',
      liabilityType: liability.type,
      hasMissingData: liability.amount === null,
      raw: liability,
    },
  });
  edges.push({
    id: `${parentId}-${liability.id}`,
    source: parentId,
    target: liability.id,
    type: 'smoothstep',
  });
}

function formatCurrency(value: number | null | undefined): string | undefined {
  if (value == null) return undefined;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}
