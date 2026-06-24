import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
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
};

export function DaimoFormField({
  label,
  children,
  description,
  error,
}: DaimoFormFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");

  return (
    <label className="daimo-flex daimo-flex-col daimo-gap-1.5" htmlFor={id}>
      <span className="daimo-text-xs daimo-font-medium daimo-text-[var(--daimo-text-secondary)]">
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
      {error && (
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
