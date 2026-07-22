import {
  type ClipboardEvent,
  type ElementType,
  forwardRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  useCallback,
  useId,
  useRef,
} from "react";
import PhoneInput, {
  type Country,
  getCountryCallingCode,
  isPossiblePhoneNumber,
  isValidPhoneNumber,
  parsePhoneNumber,
} from "react-phone-number-input";

import { TextInput } from "./shared.js";

export type DaimoFormFieldProps = {
  label: string;
  children: (props: {
    id: string;
    describedBy?: string;
    invalid: boolean;
  }) => ReactNode;
  description?: string;
  error?: string;
  hideError?: boolean;
  labelVisibility?: "visible" | "sr-only";
  as?: "label" | "div";
};

export function DaimoFormField({
  label,
  children,
  description,
  error,
  hideError,
  labelVisibility = "visible",
  as = "label",
}: DaimoFormFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");
  const className = "daimo-flex daimo-flex-col daimo-gap-1.5";
  const content = (
    <>
      <span
        className={
          labelVisibility === "sr-only"
            ? "daimo-sr-only"
            : "daimo-text-xs daimo-font-medium daimo-text-[var(--daimo-text-secondary)]"
        }
      >
        {label}
      </span>
      {children({
        id,
        describedBy: describedBy || undefined,
        invalid: error != null,
      })}
      {description && (
        <span
          id={descriptionId}
          className="daimo-text-xs daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]"
        >
          {description}
        </span>
      )}
      {error && !hideError && (
        <span
          id={errorId}
          className="daimo-text-xs daimo-leading-relaxed daimo-text-[var(--daimo-error)]"
        >
          {error}
        </span>
      )}
    </>
  );

  if (as === "div") {
    return <div className={className}>{content}</div>;
  }

  return (
    <label className={className} htmlFor={id}>
      {content}
    </label>
  );
}

export const DaimoTextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function DaimoTextField({ className, invalid, ...props }, ref) {
  return (
    <TextInput
      {...props}
      ref={ref}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={`${invalid ? "daimo-ring-1 daimo-ring-[var(--daimo-error)] " : ""}${className ?? ""}`}
    />
  );
});

export type DaimoPhoneFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "inputMode" | "maxLength" | "onChange" | "type" | "value"
> & {
  value: string;
  defaultCountry?: Country;
  invalid?: boolean;
  onValueChange: (value: string) => void;
};

type PhoneCountryOption = {
  value?: Country;
  label: string;
  divider?: boolean;
};

type PhoneCountrySelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "value"
> & {
  value?: Country;
  options: PhoneCountryOption[];
  onChange: (country?: Country) => void;
  readOnly?: boolean;
  iconComponent?: ElementType;
};

/** Country-aware input backed by react-phone-number-input. */
export function DaimoPhoneField({
  value,
  defaultCountry,
  invalid,
  onValueChange,
  className,
  placeholder,
  ...props
}: DaimoPhoneFieldProps) {
  return (
    <PhoneInput
      {...props}
      value={value || undefined}
      defaultCountry={defaultCountry}
      addInternationalOption={false}
      countrySelectComponent={DaimoPhoneCountrySelect}
      limitMaxLength
      placeholder={phonePlaceholder(placeholder, defaultCountry)}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      onChange={(nextValue) => onValueChange(nextValue ?? "")}
      className={`daimo-flex daimo-h-12 daimo-w-full daimo-min-w-0 daimo-items-center daimo-overflow-hidden daimo-rounded-[var(--daimo-radius-md)] daimo-bg-[var(--daimo-surface-secondary)] daimo-transition-shadow focus-within:daimo-ring-2 focus-within:daimo-ring-[var(--daimo-accent)] ${invalid ? "daimo-ring-1 daimo-ring-[var(--daimo-error)]" : ""} ${className ?? ""}`}
      numberInputProps={{
        className:
          "daimo-h-12 daimo-min-w-0 daimo-flex-1 daimo-border-none daimo-bg-transparent daimo-px-3 daimo-py-3 daimo-text-base daimo-text-[var(--daimo-text)] daimo-caret-[var(--daimo-accent)] daimo-outline-none daimo-ring-0 daimo-placeholder-[var(--daimo-placeholder)] focus:daimo-border-none focus:daimo-outline-none focus:daimo-ring-0 focus:daimo-shadow-none",
        inputMode: "tel",
      }}
    />
  );
}

/** International examples identify the country used for local-number entry. */
export function inferPhoneCountry(example: string): Country | undefined {
  return parsePhoneNumber(example)?.country;
}

export function isPossiblePhoneInput(
  value: string,
  defaultCountry?: Country,
): boolean {
  return isPossiblePhoneNumber(value, defaultCountry);
}

export function isValidPhoneInput(
  value: string,
  defaultCountry?: Country,
): boolean {
  return isValidPhoneNumber(value, defaultCountry);
}

function DaimoPhoneCountrySelect({
  value,
  options,
  onChange,
  disabled,
  readOnly,
  iconComponent: _iconComponent,
  ...props
}: PhoneCountrySelectProps) {
  const selectedCallingCode = value ? `+${getCountryCallingCode(value)}` : "+";

  return (
    <div className="daimo-relative daimo-flex daimo-h-12 daimo-min-w-[96px] daimo-shrink-0 daimo-items-center daimo-justify-center daimo-gap-1.5 daimo-border-0 daimo-border-r daimo-border-solid daimo-border-[var(--daimo-border)] daimo-px-3 daimo-text-sm daimo-text-[var(--daimo-text)]">
      <span aria-hidden="true" className="daimo-text-base daimo-leading-none">
        {value ? countryFlag(value) : "🌐"}
      </span>
      <span aria-hidden="true" className="daimo-tabular-nums">
        {selectedCallingCode}
      </span>
      <svg
        aria-hidden="true"
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        className="daimo-shrink-0 daimo-text-[var(--daimo-text-secondary)]"
      >
        <path
          d="m1 1 4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <select
        {...props}
        value={value ?? ""}
        disabled={disabled || readOnly}
        onChange={(event) =>
          onChange(
            options.find((option) => option.value === event.target.value)
              ?.value,
          )
        }
        className="daimo-absolute daimo-inset-0 daimo-z-10 daimo-m-0 daimo-h-full daimo-w-full daimo-cursor-pointer daimo-appearance-none daimo-border-0 daimo-bg-transparent daimo-p-0 daimo-opacity-0 disabled:daimo-cursor-default"
      >
        {options.map((option) => (
          <option
            key={option.divider ? "divider" : (option.value ?? "international")}
            value={option.value ?? ""}
            disabled={option.divider}
          >
            {countryOptionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

export type DaimoSegmentedNumberSegment = {
  id?: string;
  name?: string;
  value: string;
  maxLength: number;
  placeholder: string;
  ariaLabel: string;
  autoComplete?: string;
  invalid?: boolean;
  className?: string;
  width?: string;
  inputRef?: (input: HTMLInputElement | null) => void;
  onBlur?: InputHTMLAttributes<HTMLInputElement>["onBlur"];
  onValueChange: (value: string) => void;
  canAutoAdvance?: (value: string) => boolean;
};

export type DaimoSegmentedNumberFieldProps = {
  segments: DaimoSegmentedNumberSegment[];
  describedBy?: string;
};

export function DaimoSegmentedNumberField({
  segments,
  describedBy,
}: DaimoSegmentedNumberFieldProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setInputRef = useCallback(
    (index: number, input: HTMLInputElement | null) => {
      inputRefs.current[index] = input;
      segments[index]?.inputRef?.(input);
    },
    [segments],
  );

  const focusNextWhenFilled = (
    index: number,
    value: string,
    segment: DaimoSegmentedNumberSegment,
  ) => {
    if (value.length !== segment.maxLength) return;
    if (segment.canAutoAdvance != null && !segment.canAutoAdvance(value)) {
      return;
    }
    inputRefs.current[index + 1]?.focus();
  };

  const focusPreviousOnEmptyBackspace = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === "Backspace" && event.currentTarget.value === "") {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const digitCount = segments.reduce(
      (total, segment) => total + segment.maxLength,
      0,
    );
    const pasted = digitsOnly(event.clipboardData.getData("text"), digitCount);
    if (pasted.length < 2) return;
    event.preventDefault();

    let offset = 0;
    let nextFocusIndex = 0;
    segments.forEach((segment, index) => {
      const value = pasted.slice(offset, offset + segment.maxLength);
      segment.onValueChange(value);
      offset += segment.maxLength;
      if (value.length === segment.maxLength) {
        nextFocusIndex = index + 1;
      }
    });
    inputRefs.current[Math.min(nextFocusIndex, segments.length - 1)]?.focus();
  };

  return (
    <div
      className="daimo-grid daimo-w-full daimo-min-w-0 daimo-gap-2"
      style={{
        gridTemplateColumns: segments
          .map((segment) => segment.width ?? "minmax(0, 1fr)")
          .join(" "),
      }}
    >
      {segments.map((segment, index) => (
        <DaimoTextField
          key={segment.name ?? segment.ariaLabel}
          ref={(input) => setInputRef(index, input)}
          id={segment.id}
          name={segment.name}
          onBlur={segment.onBlur}
          type="text"
          inputMode="numeric"
          autoComplete={segment.autoComplete}
          pattern="[0-9]*"
          maxLength={segment.maxLength}
          value={segment.value}
          onChange={(event) => {
            const value = digitsOnly(event.target.value, segment.maxLength);
            segment.onValueChange(value);
            focusNextWhenFilled(index, value, segment);
          }}
          onKeyDown={(event) => focusPreviousOnEmptyBackspace(event, index)}
          onPaste={handlePaste}
          placeholder={segment.placeholder}
          aria-label={segment.ariaLabel}
          aria-describedby={describedBy}
          invalid={segment.invalid}
          className={`daimo-h-12 daimo-px-2 daimo-py-3 daimo-text-center ${segment.className ?? ""}`}
        />
      ))}
    </div>
  );
}

function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function phonePlaceholder(
  placeholder: string | undefined,
  defaultCountry: Country | undefined,
): string | undefined {
  if (!placeholder) return placeholder;
  return (
    parsePhoneNumber(placeholder, defaultCountry)?.formatNational() ??
    placeholder
  );
}

function countryFlag(country: Country): string {
  return String.fromCodePoint(
    ...country.split("").map((character) => character.charCodeAt(0) + 127397),
  );
}

function countryOptionLabel(option: PhoneCountryOption): string {
  if (option.divider || !option.value) return option.label;
  return `${countryFlag(option.value)} +${getCountryCallingCode(option.value)} ${option.label}`;
}
