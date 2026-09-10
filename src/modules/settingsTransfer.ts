import { getString } from "../utils/locale";
import {
  publicEndpointUrl,
  validateEndpointUrl,
} from "../utils/endpointPolicy";

type PrefValue = string | boolean;
type Settings = Record<string, PrefValue>;
const MAX_IMPORT_SIZE = 1_000_000;
const BOOLEAN_KEYS = [
  "multiModelSummaryEnabled",
  "enableTemperature",
  "enableMaxTokens",
  "enableTopP",
  "stream",
  "autoScan",
  "autoScroll",
  "openTaskPanelOnSummon",
] as const;
const STRING_KEYS = [
  "provider",
  "llmEndpoints",
  "llmRoutingStrategy",
  "multiModelSummaryEndpointIds",
  "openaiApiUrl",
  "openaiApiModel",
  "geminiApiUrl",
  "geminiModel",
  "anthropicApiUrl",
  "anthropicModel",
  "temperature",
  "maxTokens",
  "topP",
  "reasoningEffort",
  "requestTimeout",
  "autoContinuationRounds",
  "summaryPrompt",
  "customPrompts",
  "multiRoundPromptTemplates",
  "multiRoundPromptTemplateId",
  "maxRetries",
  "batchSize",
  "batchInterval",
  "scanInterval",
  "pdfProcessMode",
  "pdfAttachmentMode",
  "theme",
  "fontSize",
  "windowWidth",
  "windowHeight",
  "notePrefix",
  "noteStrategy",
] as const;
export const TRANSFER_KEYS = [...BOOLEAN_KEYS, ...STRING_KEYS];
const SECRET_KEYS = ["openaiApiKey", "geminiApiKey", "anthropicApiKey"];
const RANGES: Record<string, [number, number]> = {
  temperature: [0, 2],
  topP: [0, 1],
  maxTokens: [1, 2_000_000],
  requestTimeout: [1000, 3_600_000],
  autoContinuationRounds: [0, 10],
  maxRetries: [0, 10],
  batchSize: [1, 32],
  batchInterval: [1, 86400],
  scanInterval: [1, 86400],
  fontSize: [10, 32],
  windowWidth: [320, 7680],
  windowHeight: [240, 4320],
};
const ENUMS: Record<string, string[]> = {
  provider: [
    "openai",
    "openai-compat",
    "google",
    "anthropic",
    "openrouter",
    "volcanoark",
    "ollama",
  ],
  llmRoutingStrategy: ["priority", "roundRobin"],
  theme: ["system", "light", "dark"],
  pdfProcessMode: ["base64", "text", "mineru"],
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(getString("security-invalid-settings"));
  }
  return value as Record<string, unknown>;
}

function endpointsWithoutSecrets(raw: string): string {
  const items: unknown = JSON.parse(raw);
  if (!Array.isArray(items) || items.length > 100) {
    throw new Error(getString("security-invalid-settings"));
  }
  const ids = new Set<string>();
  return JSON.stringify(
    items.map((value) => {
      const source = object(value);
      const endpoint: Record<string, string | boolean> = {};
      for (const key of [
        "id",
        "name",
        "providerType",
        "apiUrl",
        "model",
        "reasoningEffort",
        "pdfProcessMode",
        "createdAt",
        "updatedAt",
      ]) {
        if (source[key] === undefined) continue;
        if (typeof source[key] !== "string" || source[key].length > 4096) {
          throw new Error(getString("security-invalid-settings") + ": " + key);
        }
        endpoint[key] = source[key];
      }
      if (
        !endpoint.id ||
        ids.has(String(endpoint.id)) ||
        !ENUMS.provider.includes(String(endpoint.providerType)) ||
        !endpoint.apiUrl ||
        !endpoint.model
      ) {
        throw new Error(getString("security-invalid-settings"));
      }
      ids.add(String(endpoint.id));
      endpoint.apiUrl = publicEndpointUrl(String(endpoint.apiUrl));
      endpoint.apiKey = "";
      endpoint.enabled = false;
      return endpoint;
    }),
  );
}

/** Export a shareable configuration; credentials never leave the preference store. */
export function exportSettings(read: (key: string) => unknown): Settings {
  const result: Settings = {};
  for (const key of TRANSFER_KEYS) {
    const value = read(key);
    if (typeof value !== "string" && typeof value !== "boolean") continue;
    if (key === "llmEndpoints") {
      result[key] = endpointsWithoutSecrets(String(value || "[]"));
    } else if (key.endsWith("ApiUrl") && value) {
      result[key] = publicEndpointUrl(String(value));
    } else {
      result[key] = key === "autoScan" ? false : value;
    }
  }
  return result;
}

/** Validate the whole payload before the first preference write. */
export function parseSettingsImport(text: string): Settings {
  if (text.length > MAX_IMPORT_SIZE)
    throw new Error(getString("security-invalid-settings"));
  const source = object(JSON.parse(text));
  const result: Settings = {};
  for (const [key, value] of Object.entries(source)) {
    // Legacy exports may include keys. They are intentionally never imported.
    if (SECRET_KEYS.includes(key)) continue;
    if (!TRANSFER_KEYS.includes(key as (typeof TRANSFER_KEYS)[number])) {
      throw new Error(getString("security-invalid-settings") + ": " + key);
    }
    const expected = BOOLEAN_KEYS.includes(key as (typeof BOOLEAN_KEYS)[number])
      ? "boolean"
      : "string";
    if (
      typeof value !== expected ||
      (typeof value === "string" && value.length > 500_000)
    ) {
      throw new Error(getString("security-invalid-settings") + ": " + key);
    }
    if (Object.hasOwn(RANGES, key)) {
      const number = Number(value);
      const [min, max] = RANGES[key];
      if (
        !String(value).trim() ||
        !Number.isFinite(number) ||
        number < min ||
        number > max ||
        (!["temperature", "topP"].includes(key) && !Number.isInteger(number))
      ) {
        throw new Error(getString("security-invalid-settings") + ": " + key);
      }
    }
    if (Object.hasOwn(ENUMS, key) && !ENUMS[key].includes(String(value))) {
      throw new Error(getString("security-invalid-settings") + ": " + key);
    }
    if (key.endsWith("ApiUrl")) {
      if (value) validateEndpointUrl(String(value));
      result[key] = value ? publicEndpointUrl(String(value)) : "";
      // Never send an existing key to a destination supplied by an import.
      result[key.replace(/Url$/, "Key")] = "";
      result[key.replace(/Url$/, "KeysFallback")] = "[]";
    } else if (key === "llmEndpoints") {
      result[key] = endpointsWithoutSecrets(String(value));
    } else {
      result[key] = value as PrefValue;
    }
  }
  if (!Object.keys(result).length)
    throw new Error(getString("security-invalid-settings"));
  result.autoScan = false;
  return result;
}

export function applySettingsImport(
  settings: Settings,
  read: (key: string) => unknown,
  write: (key: string, value: PrefValue) => void,
  clear: (key: string) => void,
): void {
  const previous = Object.entries(settings).map(
    ([key]) => [key, read(key)] as const,
  );
  try {
    for (const [key, value] of Object.entries(settings)) write(key, value);
  } catch {
    for (const [key, value] of previous) {
      if (typeof value === "string" || typeof value === "boolean")
        write(key, value);
      else clear(key);
    }
    throw new Error(getString("security-import-rollback"));
  }
}
