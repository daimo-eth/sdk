"use client";

import type {
  DepositConstraints,
  EnrollmentInteraction,
} from "../../common/account.js";
import { AccountFlowContext } from "../hooks/useAccountFlow.js";
import type { DaimoPlatform } from "../platform.js";
import {
  AccountEnrollmentInteractionPage,
  EnrollmentExternalActionPage,
} from "./account/AccountEnrollmentPage.js";
import { AccountAmountContent } from "./account/AccountPaymentPage.js";
import { EmbeddedContainer } from "./containers.js";
import { ModalChrome } from "./ModalChrome.js";

/** Hosted-step presentation contains no URL or action credential. */
export type DaimoAccountEnrollmentHostedStep = Pick<
  Extract<EnrollmentInteraction, { kind: "hosted" }>,
  "purpose" | "copy"
>;

export type DaimoAccountEnrollmentPreviewProps = {
  email: string;
  platform?: DaimoPlatform;
  baseUrl?: string;
} & (
  | {
      interaction: EnrollmentInteraction;
      hostedStep?: never;
      /** Required for an active enrollment; obtained from the same rail constraints. */
      constraints?: DepositConstraints | null;
    }
  | {
      hostedStep: DaimoAccountEnrollmentHostedStep;
      interaction?: never;
      constraints?: never;
    }
);

/** Displays a saved enrollment snapshot without authentication, polling, or writes. */
export function DaimoAccountEnrollmentPreview({
  interaction,
  hostedStep,
  email,
  constraints,
  platform = "desktop",
  baseUrl = "",
}: DaimoAccountEnrollmentPreviewProps) {
  const preview = (
    <EmbeddedContainer showFooterSpacer={false}>
      <ModalChrome controls={{ type: "none" }}>
        {() =>
          !hostedStep && interaction.kind === "active" ? (
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
              {hostedStep ? (
                <EnrollmentExternalActionPage
                  title={hostedStep.copy.title}
                  description={hostedStep.copy.description}
                  actionLabel={hostedStep.copy.openExternalLabel}
                  purpose={hostedStep.purpose}
                  onBack={() => undefined}
                  onOpen={() => undefined}
                  disabled
                />
              ) : (
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
              )}
            </fieldset>
          )
        }
      </ModalChrome>
    </EmbeddedContainer>
  );
  // A snapshot must not inherit another account's auth state from its host.
  return (
    <AccountFlowContext.Provider value={null}>
      {preview}
    </AccountFlowContext.Provider>
  );
}
