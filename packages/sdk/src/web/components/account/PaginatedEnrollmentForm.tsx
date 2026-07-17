import { type FormEvent, useEffect, useMemo, useState } from "react";

import type {
  EnrollmentForm,
  EnrollmentFormField,
  EnrollmentFormTextMask,
  EnrollmentFormValue,
} from "../../../common/account.js";
import { t } from "../../hooks/locale.js";
import { PrimaryButton } from "../buttons.js";
import { DaimoFormField, DaimoTextField } from "../formFields.js";
import { PageHeader } from "../shared.js";

export type PaginatedEnrollmentFormSubmitResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string> };

export type PaginatedEnrollmentFormProps = {
  form: EnrollmentForm;
  onBack: () => void;
  onSubmit: (
    values: Record<string, EnrollmentFormValue>,
  ) => Promise<PaginatedEnrollmentFormSubmitResult>;
  fieldsPerPage?: number;
};

const DEFAULT_FIELDS_PER_PAGE = 4;

export function PaginatedEnrollmentForm({
  form,
  onBack,
  onSubmit,
  fieldsPerPage = DEFAULT_FIELDS_PER_PAGE,
}: PaginatedEnrollmentFormProps) {
  const pages = useMemo(
    () => chunkFields(form.fields, fieldsPerPage),
    [fieldsPerPage, form.fields],
  );
  const [values, setValues] = useState<Record<string, EnrollmentFormValue>>(
    () => initialFormValues(form),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>(
    form.fieldErrors ?? {},
  );
  const [pageIndex, setPageIndex] = useState(() =>
    firstErrorPageIndex(pages, form.fieldErrors ?? {}),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const nextErrors = form.fieldErrors ?? {};
    setValues(initialFormValues(form));
    setFieldErrors(nextErrors);
    setPageIndex(firstErrorPageIndex(pages, nextErrors));
  }, [form, pages]);

  const visibleFields = pages[pageIndex] ?? [];
  const isLastPage = pageIndex === pages.length - 1;
  const hasMultiplePages = pages.length > 1;

  const setFieldValue = (key: string, value: EnrollmentFormValue) => {
    setValues((current) =>
      updateFormValuesForChange(form.fields, current, key, value),
    );
    setFieldErrors((current) => {
      const clearedKeys = new Set([
        key,
        ...dependentFieldKeys(form.fields, key),
        "_form",
      ]);
      return Object.fromEntries(
        Object.entries(current).filter(
          ([errorKey]) => !clearedKeys.has(errorKey),
        ),
      );
    });
  };

  const handleBack = () => {
    if (pageIndex > 0) {
      setPageIndex((current) => current - 1);
      return;
    }
    onBack();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isLastPage) {
      const pageErrors = validateFields(visibleFields, values);
      setFieldErrors((current) =>
        replaceErrorsForFields(current, visibleFields, pageErrors),
      );
      if (Object.keys(pageErrors).length > 0) return;
      setPageIndex((current) => Math.min(current + 1, pages.length - 1));
      return;
    }

    const nextErrors = validateFields(form.fields, values);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setPageIndex(firstErrorPageIndex(pages, nextErrors));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(values);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setPageIndex(firstErrorPageIndex(pages, result.fieldErrors));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={form.title} onBack={handleBack} />

      <form
        className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
        onSubmit={handleSubmit}
      >
        <div className="daimo-flex-1 daimo-min-h-0 daimo-overflow-y-auto daimo-px-6 daimo-pb-4">
          <div className="daimo-mx-auto daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-4 daimo-pt-2">
            {form.description && pageIndex === 0 && (
              <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
                {form.description}
              </p>
            )}

            {hasMultiplePages && (
              <div className="daimo-flex daimo-items-center daimo-justify-center daimo-gap-2">
                {pages.map((page, index) => (
                  <span
                    key={page[0]?.key ?? index}
                    className={`daimo-h-1.5 daimo-rounded-full daimo-transition-[width,background-color] daimo-duration-150 daimo-ease-out ${
                      index === pageIndex
                        ? "daimo-w-5 daimo-bg-[var(--daimo-text)]"
                        : "daimo-w-1.5 daimo-bg-[var(--daimo-border)]"
                    }`}
                    aria-hidden="true"
                  />
                ))}
                <span className="daimo-sr-only">
                  {t.accountDirectionsStep(pageIndex + 1, pages.length)}
                </span>
              </div>
            )}

            <div className="daimo-flex daimo-flex-col daimo-gap-3">
              {visibleFields.map((field) => (
                <EnrollmentFormFieldControl
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  values={values}
                  error={fieldErrors[field.key]}
                  onChange={(value) => setFieldValue(field.key, value)}
                />
              ))}
            </div>

            {fieldErrors._form && (
              <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-error)]">
                {fieldErrors._form}
              </p>
            )}
          </div>
        </div>

        <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isLastPage ? form.submitLabel : t.continue}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function EnrollmentFormFieldControl({
  field,
  value,
  values,
  error,
  onChange,
}: {
  field: EnrollmentFormField;
  value: EnrollmentFormValue | undefined;
  values: Record<string, EnrollmentFormValue>;
  error?: string;
  onChange: (value: EnrollmentFormValue) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <DaimoFormField
          label={field.label}
          description={field.description}
          error={error}
        >
          {({ id, describedBy, invalid }) => (
            <DaimoTextField
              id={id}
              type="text"
              inputMode={field.inputMode}
              autoComplete={field.autoComplete}
              maxLength={formattedMaxLength(field)}
              value={formatTextFieldValue(field, value)}
              placeholder={field.placeholder}
              aria-describedby={describedBy}
              invalid={invalid}
              onChange={(event) =>
                onChange(parseTextFieldValue(field, event.target.value))
              }
              className="daimo-px-4 daimo-py-3"
            />
          )}
        </DaimoFormField>
      );
    case "select":
      return (
        <DaimoFormField
          label={field.label}
          description={field.description}
          error={error}
        >
          {({ id, describedBy, invalid }) => (
            <select
              id={id}
              value={typeof value === "string" ? value : ""}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onChange={(event) => onChange(event.target.value)}
              className={`${baseSelectClass} ${invalid ? "daimo-ring-1 daimo-ring-[var(--daimo-error)]" : ""}`}
            >
              <option value="" disabled>
                {field.placeholder ?? field.label}
              </option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </DaimoFormField>
      );
    case "dependent-select": {
      const dependency = values[field.dependsOn];
      const options =
        typeof dependency === "string"
          ? (field.optionsByValue[dependency] ?? [])
          : [];
      return (
        <DaimoFormField
          label={field.label}
          description={field.description}
          error={error}
        >
          {({ id, describedBy, invalid }) => (
            <select
              id={id}
              value={typeof value === "string" ? value : ""}
              disabled={options.length === 0}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onChange={(event) => onChange(event.target.value)}
              className={`${baseSelectClass} disabled:daimo-opacity-60 ${invalid ? "daimo-ring-1 daimo-ring-[var(--daimo-error)]" : ""}`}
            >
              <option value="" disabled>
                {field.placeholder ?? field.label}
              </option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </DaimoFormField>
      );
    }
    case "date":
      return (
        <DaimoFormField
          label={field.label}
          description={field.description}
          error={error}
        >
          {({ id, describedBy, invalid }) => (
            <DaimoTextField
              id={id}
              type="date"
              value={typeof value === "string" ? value : ""}
              aria-describedby={describedBy}
              invalid={invalid}
              onChange={(event) => onChange(event.target.value)}
              className="daimo-px-4 daimo-py-3"
            />
          )}
        </DaimoFormField>
      );
    case "boolean":
      if (field.control === "yes_no") {
        return (
          <DaimoFormField
            as="div"
            label={field.label}
            description={field.description}
            error={error}
          >
            {({ id, describedBy, invalid }) => (
              <div
                id={id}
                role="radiogroup"
                aria-label={field.label}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={`daimo-grid daimo-grid-cols-2 daimo-gap-2 ${invalid ? "daimo-rounded-[var(--daimo-radius-md)] daimo-ring-1 daimo-ring-[var(--daimo-error)]" : ""}`}
              >
                {[
                  {
                    value: true,
                    label: field.trueLabel ?? t.accountBooleanYes,
                  },
                  {
                    value: false,
                    label: field.falseLabel ?? t.accountBooleanNo,
                  },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="radio"
                    aria-checked={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={`daimo-min-h-[48px] daimo-rounded-[var(--daimo-radius-md)] daimo-px-4 daimo-py-3 daimo-text-base daimo-font-medium daimo-touch-action-manipulation daimo-transition-[background-color,color,box-shadow] daimo-duration-150 daimo-ease-out ${
                      value === option.value
                        ? "daimo-bg-[var(--daimo-accent)] daimo-text-white daimo-shadow-sm"
                        : "daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </DaimoFormField>
        );
      }
      return (
        <DaimoFormField
          label={field.label}
          labelVisibility="sr-only"
          description={field.description}
          error={error}
        >
          {({ id, describedBy, invalid }) => (
            <label
              htmlFor={id}
              className={`daimo-flex daimo-min-h-[48px] daimo-items-center daimo-gap-3 daimo-rounded-[var(--daimo-radius-md)] daimo-bg-[var(--daimo-surface-secondary)] daimo-px-4 daimo-py-3 daimo-text-left daimo-touch-action-manipulation ${invalid ? "daimo-ring-1 daimo-ring-[var(--daimo-error)]" : ""}`}
            >
              <input
                id={id}
                type="checkbox"
                checked={value === true}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => onChange(event.target.checked)}
                className="daimo-h-4 daimo-w-4 daimo-shrink-0"
              />
              <span className="daimo-min-w-0 daimo-text-sm daimo-font-medium daimo-leading-snug daimo-text-[var(--daimo-text)]">
                {field.label}
              </span>
            </label>
          )}
        </DaimoFormField>
      );
    default:
      return assertUnreachable(field);
  }
}

const baseSelectClass =
  "daimo-box-border daimo-w-full daimo-min-w-0 daimo-max-w-full daimo-px-4 daimo-py-3 daimo-text-base daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text)] daimo-rounded-[var(--daimo-radius-md)] daimo-border-none daimo-outline-none focus:daimo-ring-2 focus:daimo-ring-[var(--daimo-accent)] daimo-transition-shadow";

function initialFormValues(
  form: EnrollmentForm,
): Record<string, EnrollmentFormValue> {
  return Object.fromEntries(
    form.fields.map((field) => [field.key, initialFieldValue(field)]),
  );
}

function initialFieldValue(field: EnrollmentFormField): EnrollmentFormValue {
  if (field.defaultValue != null) return field.defaultValue;
  if (field.type !== "boolean") return "";
  if (field.control !== "yes_no") return false;
  return field.required ? "" : false;
}

export function updateFormValuesForChange(
  fields: EnrollmentFormField[],
  current: Record<string, EnrollmentFormValue>,
  key: string,
  value: EnrollmentFormValue,
): Record<string, EnrollmentFormValue> {
  const next = { ...current, [key]: value };
  const pendingKeys = [key];
  const expandedKeys = new Set([key]);

  while (pendingKeys.length > 0) {
    const changedKey = pendingKeys.shift();
    if (changedKey == null) break;

    for (const field of fields) {
      if (field.type !== "dependent-select" || field.dependsOn !== changedKey) {
        continue;
      }

      const dependency = next[changedKey];
      const options =
        typeof dependency === "string"
          ? (field.optionsByValue[dependency] ?? [])
          : [];
      const selected = next[field.key];
      const selectionIsValid =
        typeof selected === "string" &&
        options.some((option) => option.value === selected);
      const shouldExpand = !expandedKeys.has(field.key);

      if (!selectionIsValid && selected !== "") {
        next[field.key] = "";
        pendingKeys.push(field.key);
      } else if (shouldExpand) {
        pendingKeys.push(field.key);
      }
      expandedKeys.add(field.key);
    }
  }
  return next;
}

/** Returns all transitive dependent fields, tolerating malformed cycles. */
export function dependentFieldKeys(
  fields: EnrollmentFormField[],
  key: string,
): string[] {
  const dependentKeys: string[] = [];
  const pendingKeys = [key];
  const seenKeys = new Set([key]);

  while (pendingKeys.length > 0) {
    const parentKey = pendingKeys.shift();
    if (parentKey == null) break;

    for (const field of fields) {
      if (
        field.type !== "dependent-select" ||
        field.dependsOn !== parentKey ||
        seenKeys.has(field.key)
      ) {
        continue;
      }
      seenKeys.add(field.key);
      dependentKeys.push(field.key);
      pendingKeys.push(field.key);
    }
  }

  return dependentKeys;
}

function validateFields(
  fields: EnrollmentFormField[],
  values: Record<string, EnrollmentFormValue>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!field.required) continue;
    const value = values[field.key];
    if (typeof value === "string" && value.trim() === "") {
      errors[field.key] = t.accountFieldRequired;
    } else if (
      field.type === "boolean" &&
      field.control !== "yes_no" &&
      typeof value === "boolean" &&
      !value
    ) {
      errors[field.key] = t.accountFieldRequired;
    } else if (field.type === "boolean" && typeof value !== "boolean") {
      errors[field.key] = t.accountFieldRequired;
    }
  }
  return errors;
}

function formattedMaxLength(field: EnrollmentFormField): number | undefined {
  if (field.type !== "text") return undefined;
  if (field.mask) return textMaskDisplayMaxLength(field.mask);
  return field.maxLength;
}

function formatTextFieldValue(
  field: EnrollmentFormField,
  value: EnrollmentFormValue | undefined,
): string {
  if (field.type !== "text" || typeof value !== "string") return "";
  if (field.mask) return formatMaskedText(field.mask, value);
  return value;
}

function parseTextFieldValue(
  field: EnrollmentFormField,
  value: string,
): string {
  if (field.type === "text" && field.mask) {
    return parseMaskedText(
      value,
      field.maxLength ?? textMaskRawMaxLength(field.mask),
    );
  }
  return value;
}

function parseMaskedText(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function formatMaskedText(mask: EnrollmentFormTextMask, value: string): string {
  return formatPatternMask(mask, value);
}

function formatPatternMask(
  mask: EnrollmentFormTextMask,
  value: string,
): string {
  const placeholder = mask.placeholder ?? "X";
  const rawValue = parseMaskedText(value, textMaskRawMaxLength(mask));
  let output = "";
  let rawIndex = 0;

  for (const patternChar of mask.pattern) {
    if (patternChar === placeholder) {
      if (rawIndex >= rawValue.length) break;
      output += rawValue[rawIndex];
      rawIndex += 1;
    } else if (rawIndex < rawValue.length) {
      output += patternChar;
    }
  }

  return output;
}

function textMaskRawMaxLength(mask: EnrollmentFormTextMask): number {
  const placeholder = mask.placeholder ?? "X";
  return [...mask.pattern].filter((char) => char === placeholder).length;
}

function textMaskDisplayMaxLength(mask: EnrollmentFormTextMask): number {
  return mask.pattern.length;
}

function replaceErrorsForFields(
  current: Record<string, string>,
  fields: EnrollmentFormField[],
  fieldErrors: Record<string, string>,
): Record<string, string> {
  const fieldKeys = new Set(fields.map((field) => field.key));
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if (!fieldKeys.has(key) && key !== "_form") next[key] = value;
  }
  return { ...next, ...fieldErrors };
}

function chunkFields(
  fields: EnrollmentFormField[],
  fieldsPerPage: number,
): EnrollmentFormField[][] {
  const pageSize = Number.isFinite(fieldsPerPage)
    ? Math.max(1, Math.floor(fieldsPerPage))
    : DEFAULT_FIELDS_PER_PAGE;
  const chunks: EnrollmentFormField[][] = [];
  for (let index = 0; index < fields.length; index += pageSize) {
    chunks.push(fields.slice(index, index + pageSize));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function firstErrorPageIndex(
  pages: EnrollmentFormField[][],
  fieldErrors: Record<string, string>,
): number {
  const erroredKeys = new Set(Object.keys(fieldErrors));
  const index = pages.findIndex((page) =>
    page.some((field) => erroredKeys.has(field.key)),
  );
  return index === -1 ? 0 : index;
}

function assertUnreachable(value: never): never {
  throw new Error(`unhandled value: ${String(value)}`);
}
