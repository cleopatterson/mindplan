import type { FinancialPlan, Client, Entity, Asset, Liability } from 'shared/types';
import { X } from 'lucide-react';
import { formatAUD } from '../../utils/calculations';

interface DetailPanelProps {
  data: FinancialPlan;
  nodeId: string;
  onClose: () => void;
}

export function DetailPanel({ data, nodeId, onClose }: DetailPanelProps) {
  // Find the item by ID across all collections
  const client = data.clients.find((c) => c.id === nodeId);
  const entity = data.entities.find((e) => e.id === nodeId);
  const allAssets = [...data.personalAssets, ...data.entities.flatMap((e) => e.assets)];
  const asset = allAssets.find((a) => a.id === nodeId);
  const allLiabilities = [
    ...data.personalLiabilities,
    ...data.entities.flatMap((e) => e.liabilities),
  ];
  const liability = allLiabilities.find((l) => l.id === nodeId);

  return (
    <div className="w-80 bg-white rounded-xl border border-gray-200 p-5 overflow-y-auto animate-slide-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {client && <ClientDetail client={client} />}
      {entity && <EntityDetail entity={entity} clients={data.clients} />}
      {asset && <AssetDetail asset={asset} />}
      {liability && <LiabilityDetail liability={liability} />}
    </div>
  );
}

function ClientDetail({ client }: { client: Client }) {
  return (
    <div className="space-y-3">
      <h4 className="text-lg font-medium text-blue-900">{client.name}</h4>
      <Field label="Age" value={client.age?.toString()} />
      <Field label="Occupation" value={client.occupation} />
      <Field label="Income" value={client.income != null ? formatAUD(client.income) : null} />
      <Field
        label="Super Balance"
        value={client.superBalance != null ? formatAUD(client.superBalance) : null}
      />
    </div>
  );
}

function EntityDetail({ entity, clients }: { entity: Entity; clients: Client[] }) {
  const linked = clients.filter((c) => entity.linkedClientIds.includes(c.id));
  return (
    <div className="space-y-3">
      <h4 className="text-lg font-medium">{entity.name}</h4>
      <Field label="Type" value={entity.type.toUpperCase()} />
      <Field label="Role" value={entity.role} />
      {linked.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Linked Clients</div>
          {linked.map((c) => (
            <div key={c.id} className="text-sm text-gray-700">
              {c.name}
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-gray-500 mt-2">
        {entity.assets.length} assets, {entity.liabilities.length} liabilities
      </div>
    </div>
  );
}

function AssetDetail({ asset }: { asset: Asset }) {
  return (
    <div className="space-y-3">
      <h4 className="text-lg font-medium text-gray-800">{asset.name}</h4>
      <Field label="Type" value={asset.type} />
      <Field label="Value" value={asset.value != null ? formatAUD(asset.value) : null} />
      <Field label="Details" value={asset.details} />
    </div>
  );
}

function LiabilityDetail({ liability }: { liability: Liability }) {
  return (
    <div className="space-y-3">
      <h4 className="text-lg font-medium text-red-800">{liability.name}</h4>
      <Field label="Type" value={liability.type} />
      <Field
        label="Outstanding"
        value={liability.amount != null ? formatAUD(liability.amount) : null}
      />
      <Field
        label="Interest Rate"
        value={liability.interestRate != null ? `${liability.interestRate}%` : null}
      />
      <Field label="Details" value={liability.details} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm ${value ? 'text-gray-800' : 'text-amber-500 italic'}`}>
        {value || 'Not provided'}
      </div>
    </div>
  );
}
