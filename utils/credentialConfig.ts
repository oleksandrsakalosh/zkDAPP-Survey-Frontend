export type CredentialType =
  | 'mdl'
  | 'pid'
  | 'health_id'
  | 'age_verification'
  | 'residence_permit'
  | 'passport';

export interface CredentialAttribute {
  id: string;          // Attribute identifier (e.g., 'given_name')
  label: string;       // Human-readable label
  selected: boolean;   // Whether this attribute is pre-selected by default
}

export interface CredentialTypeConfig {
  id: CredentialType;
  label: string;
  description: string;
  vct: string;           // Verifiable Credential Type for SD-JWT
  credentialTypes?: string[];
  isoDocType: string;    // ISO document type (for ISO mDoc matching)
  attributes: CredentialAttribute[];
}

/**
 * Complete credential type registry
 * These are extracted from Valera's RequestDocumentBuilder and credential adapters
 */
export const CREDENTIAL_TYPES: CredentialTypeConfig[] = [
  {
    id: 'pid',
    label: 'EU Digital ID (PID)',
    description: 'Personal Identification Data',
    vct: 'urn:eudi:pid:1',
    isoDocType: 'eu.europa.ec.eueid.pid.1',
    attributes: [
      { id: 'family_name', label: 'Family Name', selected: true },
      { id: 'given_name', label: 'Given Name', selected: true },
      { id: 'birth_date', label: 'Birth Date', selected: true },
      { id: 'gender', label: 'Gender', selected: false },
      { id: 'nationality', label: 'Nationality', selected: false },
      { id: 'resident_city', label: 'Resident City', selected: false },
      { id: 'resident_postal_code', label: 'Resident Postal Code', selected: false },
      { id: 'resident_country', label: 'Resident Country', selected: false },
      { id: 'resident_state', label: 'Resident State', selected: false },
      { id: 'issuing_authority', label: 'Issuing Authority', selected: false },
      { id: 'issuing_country', label: 'Issuing Country', selected: false },
      { id: 'issue_date', label: 'Issue Date', selected: false },
      { id: 'expiry_date', label: 'Expiry Date', selected: false },
    ],
  },
  {
    id: 'mdl',
    label: 'Mobile Driving Licence (MDL)',
    description: 'Mobile Driving Licence',
    vct: 'org.iso.18013.5.1.mDL',
    isoDocType: 'org.iso.18013.5.1.mDL',
    attributes: [
      { id: 'family_name', label: 'Family Name', selected: true },
      { id: 'given_name', label: 'Given Name', selected: true },
      { id: 'birth_date', label: 'Birth Date', selected: true },
      { id: 'issue_date', label: 'Issue Date', selected: true },
      { id: 'expiry_date', label: 'Expiry Date', selected: true },
      { id: 'issuing_country', label: 'Issuing Country', selected: true },
      { id: 'issuing_authority', label: 'Issuing Authority', selected: true },
      { id: 'document_number', label: 'Document Number', selected: false },
      { id: 'nationality', label: 'Nationality', selected: false },
      { id: 'sex', label: 'Gender', selected: false },
      { id: 'age_over_12', label: 'Age Over 12', selected: false },
      { id: 'age_over_13', label: 'Age Over 13', selected: false },
      { id: 'age_over_14', label: 'Age Over 14', selected: false },
      { id: 'age_over_16', label: 'Age Over 16', selected: false },
      { id: 'age_over_25', label: 'Age Over 25', selected: false },
      { id: 'height', label: 'Height', selected: false },
      { id: 'weight', label: 'Weight', selected: false },
      { id: 'eye_colour', label: 'Eye Colour', selected: false },
      { id: 'hair_colour', label: 'Hair Colour', selected: false },
      { id: 'resident_city', label: 'Resident City', selected: false },
      { id: 'resident_postal_code', label: 'Resident Postal Code', selected: false },
      { id: 'resident_country', label: 'Resident Country', selected: false },
      { id: 'resident_state', label: 'Resident State', selected: false },
    ],
  },
  {
    id: 'health_id',
    label: 'Health ID',
    description: 'Health Insurance Identification',
    vct: 'eu.europa.ec.eudi.healthid.1',
    isoDocType: 'eu.europa.ec.eudi.healthid.1',
    attributes: [
      { id: 'one_time_token', label: 'One Time Token', selected: true },
      { id: 'affiliation_country', label: 'Affiliation Country', selected: true },
      { id: 'issue_date', label: 'Issue Date', selected: true },
      { id: 'expiry_date', label: 'Expiry Date', selected: true },
      { id: 'issuing_authority', label: 'Issuing Authority', selected: true },
      { id: 'issuing_country', label: 'Issuing Country', selected: true },
      { id: 'health_insurance_id', label: 'Health Insurance ID', selected: false },
      { id: 'patient_id', label: 'Patient ID', selected: false },
      { id: 'tax_number', label: 'Tax Number', selected: false },
      { id: 'e_prescription_code', label: 'E-Prescription Code', selected: false },
      { id: 'document_number', label: 'Document Number', selected: false },
      { id: 'administrative_number', label: 'Administrative Number', selected: false },
      { id: 'issuing_jurisdiction', label: 'Issuing Jurisdiction', selected: false },
    ],
  },
  {
    id: 'residence_permit',
    label: 'Residence Permit',
    description: 'Residence Permit Credential',
    vct: 'ResidencePermit',
    credentialTypes: ['ResidencePermit'],
    isoDocType: 'ResidencePermit',
    attributes: [
      { id: 'country_code', label: 'Country Code', selected: true },
      { id: 'first_name', label: 'First Name', selected: true },
      { id: 'last_name', label: 'Last Name', selected: true },
      { id: 'permit_number', label: 'Permit Number', selected: true },
    ],
  },
  {
    id: 'passport',
    label: 'Passport',
    description: 'Passport Credential',
    vct: 'Passport8',
    credentialTypes: ['Passport8'],
    isoDocType: 'Passport8',
    attributes: [
      { id: 'first_name', label: 'First Name', selected: true },
      { id: 'last_name', label: 'Last Name', selected: true },
      { id: 'birth_date', label: 'Birth Date', selected: true },
      { id: 'document_id', label: 'Document ID', selected: true },
      { id: 'country_code', label: 'Country Code', selected: true },
      { id: 'issuance_date', label: 'Issuance Date', selected: true },
      { id: 'expiry_date', label: 'Expiry Date', selected: true },
      { id: 'issuing_country', label: 'Issuing Country', selected: true },
    ],
  },
  {
    id: 'age_verification',
    label: 'Age Verification',
    description: 'Age Verification Credential',
    vct: 'org.iso.18013.5.1.age_verification',
    isoDocType: 'org.iso.18013.5.1.age_verification',
    attributes: [
      { id: 'age_over_12', label: 'Age Over 12', selected: false },
      { id: 'age_over_13', label: 'Age Over 13', selected: false },
      { id: 'age_over_14', label: 'Age Over 14', selected: false },
      { id: 'age_over_16', label: 'Age Over 16', selected: false },
      { id: 'age_over_25', label: 'Age Over 25', selected: false },
      { id: 'age_over_60', label: 'Age Over 60', selected: false },
      { id: 'age_over_62', label: 'Age Over 62', selected: false },
      { id: 'age_over_65', label: 'Age Over 65', selected: false },
      { id: 'age_over_68', label: 'Age Over 68', selected: false },
    ],
  },
];

/**
 * Helper functions to get credential config
 */
export function getCredentialTypeConfig(typeId: CredentialType): CredentialTypeConfig | null {
  return CREDENTIAL_TYPES.find((ct) => ct.id === typeId) || null;
}

export function getCredentialTypeByVct(vct: string): CredentialTypeConfig | null {
  return CREDENTIAL_TYPES.find((ct) => ct.vct === vct) || null;
}

export function getDefaultAttributesForType(typeId: CredentialType): string[] {
  const config = getCredentialTypeConfig(typeId);
  if (!config) return [];
  return config.attributes.filter((attr) => attr.selected).map((attr) => attr.id);
}

export function getAllAttributesForType(typeId: CredentialType): string[] {
  const config = getCredentialTypeConfig(typeId);
  if (!config) return [];
  return config.attributes.map((attr) => attr.id);
}
