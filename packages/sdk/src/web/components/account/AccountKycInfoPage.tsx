import type { NavNodeFiat } from "../../api/navTree.js";

import { t } from "../../hooks/locale.js";
import { PrimaryButton } from "../buttons.js";
import { Skeleton } from "../Skeleton.js";
import { PageHeader } from "../shared.js";
import {
  getKycRequirement,
  KycIndicator,
  type KycRequirement,
} from "./kycRequirement.js";

type AccountKycInfoPageProps = {
  node: NavNodeFiat;
  onBack: (() => void) | null;
  onContinue: () => void;
};

export function AccountKycInfoPage({
  node,
  onBack,
  onContinue,
}: AccountKycInfoPageProps) {
  const requirement = getKycRequirement(node.kycRequirement);

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title="Verification" onBack={onBack} />

      <div className="daimo-flex-1 daimo-flex daimo-flex-col daimo-items-center daimo-justify-center daimo-gap-5 daimo-px-6 daimo-pt-4 daimo-pb-3">
        <KycIndicator requirement={requirement} size="lg" variant="badge" />

        <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-2 daimo-text-center">
          <div className="daimo-flex daimo-flex-col daimo-gap-2">
            <h2 className="daimo-text-lg daimo-font-semibold daimo-leading-tight daimo-text-[var(--daimo-title)]">
              {requirement.detailTitle}
            </h2>
          </div>
        </div>

        <RequirementList requirement={requirement} />
      </div>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <PrimaryButton onClick={onContinue}>{t.continue}</PrimaryButton>
      </div>
    </div>
  );
}

export function AccountKycInfoSkeleton({
  node,
  onBack,
}: {
  node: NavNodeFiat;
  onBack: (() => void) | null;
}) {
  const requirement = getKycRequirement(node.kycRequirement);
  const rowCount = Math.max(requirement.requirements.length, 1);

  return (
    <div
      className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
      aria-busy="true"
      aria-label={t.loading}
    >
      <PageHeader title="Verification" onBack={onBack} />

      <div className="daimo-flex-1 daimo-flex daimo-flex-col daimo-items-center daimo-justify-center daimo-gap-5 daimo-px-6 daimo-pt-4 daimo-pb-3">
        <Skeleton className="daimo-h-16 daimo-w-16" rounded="full" />

        <Skeleton
          className="daimo-h-7 daimo-w-full daimo-max-w-[300px]"
          rounded="sm"
        />

        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-2">
          {Array.from({ length: rowCount }).map((_, index) => (
            <KycRequirementRowSkeleton key={index} delayMs={index * 90} />
          ))}
        </div>
      </div>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <Skeleton className="daimo-h-[54px] daimo-w-full daimo-max-w-xs" />
      </div>
    </div>
  );
}

function RequirementList({ requirement }: { requirement: KycRequirement }) {
  const items = requirement.requirements;

  return (
    <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-2">
      {items.map((item) => (
        <RequirementRow
          key={item.id}
          label={item.label}
          requirement={requirement}
        />
      ))}
    </div>
  );
}

function KycRequirementRowSkeleton({ delayMs }: { delayMs: number }) {
  return (
    <div
      className="daimo-flex daimo-min-h-[44px] daimo-items-center daimo-gap-3 daimo-rounded-[var(--daimo-radius-md)] daimo-px-3 daimo-py-2.5"
      style={{ backgroundColor: "var(--daimo-surface-secondary)" }}
    >
      <Skeleton className="daimo-h-5 daimo-w-5 daimo-shrink-0" rounded="full" />
      <Skeleton
        className="daimo-h-4 daimo-w-full daimo-max-w-[210px]"
        rounded="sm"
        delayMs={delayMs}
      />
    </div>
  );
}

function RequirementRow({
  label,
  requirement,
}: {
  label: string;
  requirement: KycRequirement;
}) {
  return (
    <div
      className="daimo-flex daimo-min-h-[44px] daimo-items-center daimo-gap-3 daimo-rounded-[var(--daimo-radius-md)] daimo-px-3 daimo-py-2.5 daimo-text-left"
      style={{ backgroundColor: "var(--daimo-surface-secondary)" }}
    >
      <span
        className="daimo-flex daimo-h-5 daimo-w-5 daimo-shrink-0 daimo-items-center daimo-justify-center daimo-rounded-full daimo-text-[11px] daimo-font-bold"
        style={{
          color: getAccentColor(requirement.kind),
          backgroundColor: "var(--daimo-surface)",
        }}
      >
        <CheckGlyph />
      </span>
      <span className="daimo-min-w-0 daimo-text-sm daimo-font-medium daimo-leading-snug daimo-text-[var(--daimo-text)]">
        {label}
      </span>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 4.5 6.5 11 3 7.5" />
    </svg>
  );
}

function getAccentColor(kind: KycRequirement["kind"]) {
  if (kind === "none") return "var(--daimo-text-secondary)";
  return "var(--daimo-brand-green)";
}
