"use client";

import type {
  DepositConstraints,
  EnrollmentInteraction,
} from "../../common/account.js";
import type { DaimoPlatform } from "../platform.js";
import { AccountEnrollmentInteractionPage } from "./account/AccountEnrollmentPage.js";
import { AccountAmountContent } from "./account/AccountPaymentPage.js";
import { EmbeddedContainer } from "./containers.js";
import { ModalChrome } from "./ModalChrome.js";

export type DaimoAccountEnrollmentPreviewProps = {
  interaction: EnrollmentInteraction;
  email: string;
  /** Required for an active enrollment; obtained from the same rail constraints. */
  constraints?: DepositConstraints | null;
  platform?: DaimoPlatform;
  baseUrl?: string;
};

/** Displays a saved enrollment snapshot without authentication, polling, or writes. */
export function DaimoAccountEnrollmentPreview({
  interaction,
  email,
  constraints,
  platform = "desktop",
  baseUrl = "",
}: DaimoAccountEnrollmentPreviewProps) {
  return (
    <EmbeddedContainer showFooterSpacer={false}>
      <ModalChrome controls={{ type: "none" }}>
        {() =>
          interaction.kind === "active" ? (
            constraints ? (
              <AccountAmountContent
                key={`${email}:${constraints.currency.code}`}
                constraints={constraints}
                platform={platform}
                baseUrl={baseUrl}
              />
            ) : (
              <p className="daimo-p-6 daimo-text-sm" role="status">
                Deposit amount preview is unavailable: payment constraints are
                missing.
              </p>
            )
          ) : (
            <fieldset
              disabled
              onClickCapture={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onSubmitCapture={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className="daimo-m-0 daimo-border-0 daimo-p-0 daimo-min-w-0 daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
            >
              <AccountEnrollmentInteractionPage
                step={{ protocol: "generic", interaction }}
                platform={platform}
                sessionId=""
                clientSecret=""
                email={email}
                onBack={() => undefined}
                onUseAnotherEmail={async () => undefined}
                onSubmit={async () => null}
                readOnly
              />
            </fieldset>
          )
        }
      </ModalChrome>
    </EmbeddedContainer>
  );
}
