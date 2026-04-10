import { CUSTOM_SD_JWT_MOCK_1 } from "@/utils/sdjwt/mocks/customSdJwtMock1";
import { CUSTOM_SD_JWT_MOCK_2 } from "@/utils/sdjwt/mocks/customSdJwtMock2";
import { SD_JWT_MOCK_AGE } from "@/utils/sdjwt/mocks/sdJwtMockAge";

export interface SdJwtMockToken {
    id: string;
    label: string;
    token: string;
}

export const SD_JWT_MOCK_TOKENS: SdJwtMockToken[] = [
    {
        id: "mock-1",
        label: "Custom SD-JWT Mock 1",
        token: CUSTOM_SD_JWT_MOCK_1,
    },
    {
        id: "mock-2",
        label: "Custom SD-JWT Mock 2",
        token: CUSTOM_SD_JWT_MOCK_2,
    },
    {
        id: "mock-age",
        label: "Custom SD-JWT Mock Age",
        token: SD_JWT_MOCK_AGE,
    },
];
