import { IPFS_API_KEY, IPFS_GATEWAY_URL } from "@/config/ipfs";
import { ElectionMetadataDocument } from "@/types/election";
import { stableStringify } from "@/utils/hash";

const normalizeIpfsUri = (cidOrUri: string) =>
  cidOrUri.startsWith("ipfs://") ? cidOrUri : `ipfs://${cidOrUri}`;

const cidFromUri = (uri: string) => uri.replace(/^ipfs:\/\//i, "").replace(/^\/ipfs\//i, "");

const LIGHTHOUSE_UPLOAD_URL = "https://upload.lighthouse.storage/api/v0/add?cid-version=1";

const buildMultipartTextBody = ({
  fieldName,
  fileName,
  contentType,
  text,
  boundary,
}: {
  fieldName: string;
  fileName: string;
  contentType: string;
  text: string;
  boundary: string;
}) =>
  [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"`,
    `Content-Type: ${contentType}`,
    "",
    text,
    `--${boundary}--`,
    "",
  ].join("\r\n");

export const resolveIpfsGatewayUrl = (uri: string) => {
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri;
  }

  return `${IPFS_GATEWAY_URL.replace(/\/$/, "")}/${cidFromUri(uri)}`;
};

export const uploadElectionMetadataDocument = async (document: ElectionMetadataDocument) => {
  if (!IPFS_API_KEY) {
    throw new Error("Missing Lighthouse API key. Set EXPO_PUBLIC_LIGHTHOUSE_API_KEY or config/ipfs.ts.");
  }

  const fileName = `survey-election-metadata-${Date.now()}.json`;
  const boundary = `----zkdapp-survey-${Date.now().toString(16)}`;
  const response = await fetch(LIGHTHOUSE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${IPFS_API_KEY}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: buildMultipartTextBody({
      fieldName: "file",
      fileName,
      contentType: "application/json",
      text: stableStringify(document),
      boundary,
    }),
  });

  if (!response.ok) {
    let message = `Lighthouse upload failed (${response.status}).`;
    try {
      const payload = await response.json();
      message = payload?.error || payload?.message || message;
    } catch {
      const text = await response.text();
      message = text || message;
    }

    throw new Error(`Lighthouse/IPFS metadata upload failed: ${message}`);
  }

  const payload = await response.json();
  const cid = payload?.Hash || payload?.hash || payload?.cid;

  if (!cid || typeof cid !== "string") {
    throw new Error("Lighthouse upload did not return a CID.");
  }

  return normalizeIpfsUri(cid);
};

export const fetchElectionMetadataDocument = async (
  metadataURI: string
): Promise<ElectionMetadataDocument> => {
  const response = await fetch(resolveIpfsGatewayUrl(metadataURI));

  if (!response.ok) {
    throw new Error(`Unable to fetch metadata from IPFS (${response.status}).`);
  }

  const document = await response.json();

  if (
    !document ||
    document.version !== 1 ||
    !document.metadata ||
    !document.eligibility ||
    !Array.isArray(document.metadata.questions) ||
    !Array.isArray(document.eligibility.requirements)
  ) {
    throw new Error("Invalid election metadata document.");
  }

  return document as ElectionMetadataDocument;
};
