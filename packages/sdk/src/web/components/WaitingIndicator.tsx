/** Static clock for waits that can take minutes; completion keeps its checkmark. */
export function WaitingIndicator() {
  return (
    <div
      aria-hidden="true"
      className="daimo-flex daimo-h-[100px] daimo-w-[100px] daimo-shrink-0 daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text-secondary)]"
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </div>
  );
}
