import {
  type ClipboardEvent,
  forwardRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useRef,
} from "react";

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
};

export function DaimoFormField({
  label,
  children,
  description,
  error,
  hideError,
  labelVisibility = "visible",
}: DaimoFormFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");

  return (
    <label className="daimo-flex daimo-flex-col daimo-gap-1.5" htmlFor={id}>
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
