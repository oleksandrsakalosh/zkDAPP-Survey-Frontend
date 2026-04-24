import {
    OLD_SDJWT_AGE_27,
    SDJWT_AGE_16,
    SDJWT_AGE_20,
    SDJWT_AGE_40,
    SDJWT_AGE_16_NAMESURNAME,
    SDJWT_AGE_20_NAMESURNAME,
    SDJWT_AGE_40_NAMESURNAME,
    SDJWT_AGE_21_COUNTRY_UA
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
    {
        id: "age-16-namesurname",
        label: "SDJWT_AGE_16_NAMESURNAME",
        token: SDJWT_AGE_16_NAMESURNAME,
    },
    {
        id: "age-20-namesurname",
        label: "SDJWT_AGE_20_NAMESURNAME",
        token: SDJWT_AGE_20_NAMESURNAME,
    },
    {
        id: "age-40-namesurname",
        label: "SDJWT_AGE_40_NAMESURNAME",
        token: SDJWT_AGE_40_NAMESURNAME,
    },
    {
        id: "age-21-country-ua",
        label: "SDJWT_AGE_21_COUNTRY_UA",
        token: SDJWT_AGE_21_COUNTRY_UA,
    }
];
