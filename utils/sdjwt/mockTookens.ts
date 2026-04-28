import {
    SDJWT_AGE20_PASSPORT4,
    SDJWT_AGE20_PASSPORT7,
    SDJWT_AGE20_PASSPORT8,
    SDJWT_AGE20_PASSPORT3,
    SDJWT_AGE20_TAMPERED
} from "@/utils/sdjwt/mocks/sdJwtMockV1";

export interface SdJwtMockToken {
    id: string;
    label: string;
    token: string;
}

export const SD_JWT_MOCK_TOKENS: SdJwtMockToken[] = [
    {
        id: "age-20-passport-4",
        label: "SDJWT_AGE20_PASSPORT4",
        token: SDJWT_AGE20_PASSPORT4,
    },
    {
        id: "age-20-passport-7",
        label: "SDJWT_AGE20_PASSPORT7",
        token: SDJWT_AGE20_PASSPORT7,
    },
    {
        id: "age-20-passport-8",
        label: "SDJWT_AGE20_PASSPORT8",
        token: SDJWT_AGE20_PASSPORT8,
    },
    {
        id: "age-20-passport-3",
        label: "SDJWT_AGE20_PASSPORT3",
        token: SDJWT_AGE20_PASSPORT3,
    },
    {
        id: "age-20-tampered",
        label: "SDJWT_AGE20_TAMPERED",
        token: SDJWT_AGE20_TAMPERED,
    },
];