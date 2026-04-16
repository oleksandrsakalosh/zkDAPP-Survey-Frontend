import {
    OLD_SDJWT_AGE_27,
    SDJWT_AGE_16,
    SDJWT_AGE_20,
    SDJWT_AGE_40,
} from "@/utils/sdjwt/mocks/sdJwtMockAge";

export interface SdJwtMockToken {
    id: string;
    label: string;
    token: string;
}

export const SD_JWT_MOCK_TOKENS: SdJwtMockToken[] = [
    {
        id: "old-age-27",
        label: "OLD_SDJWT_AGE_27",
        token: OLD_SDJWT_AGE_27,
    },
    {
        id: "age-16",
        label: "SDJWT_AGE_16",
        token: SDJWT_AGE_16,
    },
    {
        id: "age-20",
        label: "SDJWT_AGE_20",
        token: SDJWT_AGE_20,
    },
    {
        id: "age-40",
        label: "SDJWT_AGE_40",
        token: SDJWT_AGE_40,
    },
];
