export type ProofInputSource = 'user' | 'sd-jwt' | 'computed';

export interface ProofInputDefinition {
  key: string;
  source: ProofInputSource;
  label: string;
  format: 'yyyymmdd' | 'nonNegativeInteger';
  sdJwtAttributeKeys?: string[];
  computedBy?: 'utcPlus2CurrentDate';
}

export interface ProofCheckDefinition {
  key: string;
  label: string;
  description: string;
  inputs: ProofInputDefinition[];
}

// Mirrors zk/config.js check metadata so UI can render dynamic inputs.
export const PROOF_CHECKS: ProofCheckDefinition[] = [
  {
    key: 'age',
    label: 'Age Check',
    description: 'Prove age threshold based on birth date disclosure.',
    inputs: [
      {
        key: 'currentDate',
        source: 'computed',
        label: 'Current date',
        format: 'yyyymmdd',
        computedBy: 'utcPlus2CurrentDate',
      },
      {
        key: 'dobValue',
        source: 'sd-jwt',
        label: 'Birth date',
        format: 'yyyymmdd',
        sdJwtAttributeKeys: ['birth_date', 'date_of_birth', 'dob', 'dobValue'],
      },
      {
        key: 'minAge',
        source: 'user',
        label: 'Minimum age',
        format: 'nonNegativeInteger',
      },
    ],
  },
];

export function getProofCheckByKey(checkKey: string): ProofCheckDefinition | undefined {
  return PROOF_CHECKS.find((check) => check.key === checkKey);
}

export function getUtcPlus2YyyyMmDd(now: Date = new Date()): string {
  const plus2 = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const y = plus2.getUTCFullYear();
  const m = String(plus2.getUTCMonth() + 1).padStart(2, '0');
  const d = String(plus2.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function getTodayFileStamp(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
