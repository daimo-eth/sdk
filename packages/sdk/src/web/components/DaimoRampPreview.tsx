"use client";

import type {
  DaimoCountryCode,
  NavLocation,
  NavLocationOption,
  NavNodeChooseOption,
} from "../api/index.js";
import { autoDetectLocale } from "../hooks/locale.js";
import { ChooseOptionPage } from "./ChooseOptionPage.js";
import { EmbeddedContainer } from "./containers.js";
import { ModalChrome } from "./ModalChrome.js";
import { Skeleton } from "./Skeleton.js";

export type DaimoRampPreviewProps = {
  rootNode: NavNodeChooseOption;
  location: NavLocation;
  locationOptions: NavLocationOption[];
  loadingCountryCode?: DaimoCountryCode | null;
  onCountryCodeChange: (countryCode: DaimoCountryCode) => Promise<void>;
  baseUrl?: string;
};

/** Non-transactional universal-ramp root picker. */
export function DaimoRampPreview({
  rootNode,
  location,
  locationOptions,
  loadingCountryCode = null,
  onCountryCodeChange,
  baseUrl = "",
}: DaimoRampPreviewProps) {
  autoDetectLocale();

  return (
    <EmbeddedContainer showFooterSpacer={false}>
      <ModalChrome
        controls={{ type: "none" }}
        country={{
          location,
          options: locationOptions,
          loadingCountryCode,
          onSelect: onCountryCodeChange,
        }}
      >
        {() => (
          <>
            {loadingCountryCode ? (
              <PreviewSkeleton />
            ) : (
              <ChooseOptionPage
                node={rootNode}
                onNavigate={() => {}}
                onBack={null}
                baseUrl={baseUrl}
              />
            )}
          </>
        )}
      </ModalChrome>
    </EmbeddedContainer>
  );
}

function PreviewSkeleton() {
  return (
    <div className="daimo-flex daimo-flex-col">
      <div className="daimo-flex daimo-items-center daimo-justify-center daimo-p-6">
        <Skeleton className="daimo-h-5 daimo-w-32" rounded="sm" />
      </div>
      <div className="daimo-flex daimo-flex-col daimo-gap-3 daimo-px-6 daimo-pb-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton
            key={index}
            className="daimo-h-16"
            rounded="lg"
            delayMs={index * 100}
          />
        ))}
      </div>
    </div>
  );
}
