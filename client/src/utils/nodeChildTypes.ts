import type { NodeData } from './transformToGraph';

export type ChildNodeType = 'asset' | 'liability' | 'familyMember' | 'grandchild' | 'goal' | 'relationship' | 'estateItem';

export interface PickerOption {
  label: string;
  childType: ChildNodeType;
  overrides?: Record<string, unknown>;
}

export function getPickerOptions(nodeType: NodeData['nodeType']): PickerOption[] | null {
  switch (nodeType) {
    case 'client':
    case 'entity':
      return [
        { label: 'Asset', childType: 'asset' },
        { label: 'Liability', childType: 'liability' },
      ];
    case 'familyGroup':
      return [
        { label: 'Son', childType: 'familyMember', overrides: { relationship: 'son' } },
        { label: 'Daughter', childType: 'familyMember', overrides: { relationship: 'daughter' } },
        { label: 'Other', childType: 'familyMember', overrides: { relationship: 'other' } },
      ];
    case 'familyMember':
      return [
        { label: 'Grandson', childType: 'grandchild', overrides: { relationship: 'grandson' } },
        { label: 'Granddaughter', childType: 'grandchild', overrides: { relationship: 'granddaughter' } },
      ];
    case 'goalsGroup':
      return [
        { label: 'Retirement', childType: 'goal', overrides: { category: 'retirement' } },
        { label: 'Wealth', childType: 'goal', overrides: { category: 'wealth' } },
        { label: 'Protection', childType: 'goal', overrides: { category: 'protection' } },
        { label: 'Estate', childType: 'goal', overrides: { category: 'estate' } },
        { label: 'Lifestyle', childType: 'goal', overrides: { category: 'lifestyle' } },
        { label: 'Education', childType: 'goal', overrides: { category: 'education' } },
        { label: 'Other', childType: 'goal', overrides: { category: 'other' } },
      ];
    case 'relationshipsGroup':
      return [
        { label: 'Accountant', childType: 'relationship', overrides: { type: 'accountant' } },
        { label: 'Financial Adviser', childType: 'relationship', overrides: { type: 'financial_adviser' } },
        { label: 'Stockbroker', childType: 'relationship', overrides: { type: 'stockbroker' } },
        { label: 'Solicitor', childType: 'relationship', overrides: { type: 'solicitor' } },
        { label: 'Insurance Adviser', childType: 'relationship', overrides: { type: 'insurance_adviser' } },
        { label: 'Mortgage Broker', childType: 'relationship', overrides: { type: 'mortgage_broker' } },
        { label: 'Other', childType: 'relationship', overrides: { type: 'other' } },
      ];
    case 'assetGroup':
      return [
        { label: 'Asset', childType: 'asset' },
      ];
    case 'estateClient':
      return [
        { label: 'Will', childType: 'estateItem', overrides: { type: 'will' } },
        { label: 'Power of Attorney', childType: 'estateItem', overrides: { type: 'poa' } },
        { label: 'Guardianship', childType: 'estateItem', overrides: { type: 'guardianship' } },
        { label: 'Super Nomination', childType: 'estateItem', overrides: { type: 'super_nomination' } },
      ];
    default:
      return null;
  }
}
