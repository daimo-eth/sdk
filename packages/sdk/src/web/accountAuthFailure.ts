const MAX_PROVIDER_ERROR_CODE_LENGTH = 100;

export type AccountAuthStage =
  | "email_code_send"
  | "email_code_verify"
  | "phone_code_send"
  | "phone_code_verify"
  | "wallet_provisioning";

export type AccountAuthFailure = {
  stage: AccountAuthStage;
  eventError: string;
  errorCode: string;
};

/**
 * Classify auth failures without sending provider messages, emails, or tokens
 * to session telemetry.
 */
export function getAccountAuthFailure(
  stage: AccountAuthStage,
  error: unknown,
): AccountAuthFailure {
  return {
    stage,
    eventError: `${stage.replaceAll("_", " ")} failed`,
    errorCode: getProviderErrorCode(error) ?? getMessageErrorCode(error),
  };
}

function getProviderErrorCode(error: unknown): string | null {
  const direct =
    readScalarProperty(error, "privyErrorCode") ??
    readScalarProperty(error, "code") ??
    readScalarProperty(error, "type");
  const nested =
    typeof error === "object" && error !== null && "cause" in error
      ? (readScalarProperty(error.cause, "privyErrorCode") ??
        readScalarProperty(error.cause, "code") ??
        readScalarProperty(error.cause, "type"))
      : null;
  return normalizeErrorCode(direct ?? nested);
}

function getMessageErrorCode(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("missing auth token")) return "missing_auth_token";
  if (message.includes("not authenticated")) return "not_authenticated";
  if (message.includes("timed out")) return "timeout";
  if (
    message === "failed to fetch" ||
    message === "fetch failed" ||
    message.includes("network")
  ) {
    return "network_error";
  }
  return "provider_error";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return readStringProperty(error, "message") ?? "";
}

function readStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : null;
}

function readScalarProperty(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  if (typeof property === "string") return property;
  return typeof property === "number" ? String(property) : null;
}

function normalizeErrorCode(value: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_PROVIDER_ERROR_CODE_LENGTH);
  return normalized || null;
}
