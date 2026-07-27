const MAX_ERROR_MESSAGE_LENGTH = 300;
const MAX_ERROR_CODE_LENGTH = 100;

export type AccountSetupStage = "wallet_preparation" | "account_creation";

export type AccountSetupFailure = {
  stage: AccountSetupStage;
  eventError: string;
  errorCode?: string;
};

/** Preserve useful provider details without exposing an unbounded error value. */
export function getAccountSetupFailure(
  stage: AccountSetupStage,
  error: unknown,
): AccountSetupFailure {
  const message = getErrorMessage(error);
  const errorCode = getErrorCode(error);
  return {
    stage,
    eventError: `${stage.replace("_", " ")} failed: ${message}`,
    ...(errorCode ? { errorCode } : {}),
  };
}

function getErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : (readStringProperty(error, "message") ??
        (typeof error === "string" ? error : "unknown error"));
  return normalizeValue(message, MAX_ERROR_MESSAGE_LENGTH);
}

function getErrorCode(error: unknown): string | undefined {
  const direct =
    readScalarProperty(error, "privyErrorCode") ??
    readScalarProperty(error, "code") ??
    readScalarProperty(error, "type");
  if (direct) return normalizeValue(direct, MAX_ERROR_CODE_LENGTH);

  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return undefined;
  }
  const cause = error.cause;
  const fromCause =
    readScalarProperty(cause, "privyErrorCode") ??
    readScalarProperty(cause, "code") ??
    readScalarProperty(cause, "type");
  return fromCause
    ? normalizeValue(fromCause, MAX_ERROR_CODE_LENGTH)
    : undefined;
}

function readStringProperty(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : undefined;
}

function readScalarProperty(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  const property = (value as Record<string, unknown>)[key];
  if (typeof property === "string") return property;
  return typeof property === "number" ? String(property) : undefined;
}

function normalizeValue(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return (normalized || "unknown error").slice(0, maxLength);
}
