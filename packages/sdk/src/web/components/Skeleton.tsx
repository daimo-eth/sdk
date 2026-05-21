import type { CSSProperties } from "react";

type SkeletonRadius = "sm" | "md" | "lg" | "full";

type SkeletonProps = {
  className?: string;
  rounded?: SkeletonRadius;
  delayMs?: number;
  style?: CSSProperties;
};

type SkeletonTextProps = {
  lines?: number;
  widths?: string[];
  className?: string;
};

const RADIUS_CLASS: Record<SkeletonRadius, string> = {
  sm: "daimo-rounded",
  md: "daimo-rounded-[var(--daimo-radius-md)]",
  lg: "daimo-rounded-[var(--daimo-radius-lg)]",
  full: "daimo-rounded-full",
};

/** Theme-aware loading placeholder with reduced-motion support. */
export function Skeleton({
  className = "",
  rounded = "md",
  delayMs,
  style,
}: SkeletonProps) {
  const animationStyle =
    delayMs == null ? undefined : { animationDelay: `${delayMs}ms` };

  return (
    <div
      aria-hidden="true"
      className={`${RADIUS_CLASS[rounded]} motion-safe:daimo-animate-daimo-pulse ${className}`}
      style={{
        backgroundColor: "var(--daimo-skeleton)",
        ...animationStyle,
        ...style,
      }}
    />
  );
}

/** Stacked text-line skeleton for descriptions and loading messages. */
export function SkeletonText({
  lines = 2,
  widths = ["80%", "60%"],
  className = "",
}: SkeletonTextProps) {
  return (
    <div
      className={`daimo-flex daimo-w-full daimo-flex-col daimo-items-center daimo-gap-2 ${className}`}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="daimo-h-4"
          rounded="sm"
          delayMs={i * 100}
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}
