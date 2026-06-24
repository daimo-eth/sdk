import { type FormEvent, useCallback, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { PrimaryButton } from "../buttons.js";
import { DaimoFormField, DaimoTextField } from "../formFields.js";
import {
  CenteredContent,
  ErrorMessage,
  PageHeader,
} from "../shared.js";
import {
  type EmailFormValues,
  type EmailSubmitValues,
  zEmailForm,
} from "./formSchemas.js";

type AccountEmailPageProps = {
  onBack: (() => void) | null;
  onOtpSent: () => void;
};

export function AccountEmailPage({ onBack, onOtpSent }: AccountEmailPageProps) {
  const account = useAccountFlow();
  const logoutDone = useRef(false);
  const {
    formState: { errors, isValid },
    handleSubmit,
    register,
  } = useForm<EmailFormValues, unknown, EmailSubmitValues>({
    resolver: zodResolver(zEmailForm),
    mode: "onChange",
    defaultValues: { email: account?.email ?? "" },
  });

  // Clear stale Privy sessions on mount so we get a clean login flow
  useEffect(() => {
    if (logoutDone.current) return;
    logoutDone.current = true;
    account?.logout();
  }, [account]);

  const submit = handleSubmit(
    useCallback(
      async ({ email }) => {
        if (!account) return;
        account.setEmail(email);
        const sent = await account.sendOtp(email);
        if (sent) onOtpSent();
      },
      [account, onOtpSent],
    ),
  );

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      void submit(event);
    },
    [submit],
  );

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountEmail} onBack={onBack} />

      <form
        className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
        onSubmit={handleFormSubmit}
      >
        <CenteredContent>
          <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center">
            {t.accountEmailDesc}
          </p>

          <div className="daimo-w-full daimo-max-w-xs">
            <DaimoFormField
              label={t.accountEmail}
              error={errors.email?.message}
              hideError
              labelVisibility="sr-only"
            >
              {({ id, describedBy, invalid }) => (
                <DaimoTextField
                  {...register("email")}
                  id={id}
                  type="email"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  placeholder={t.accountEmailPlaceholder}
                  autoComplete="email"
                  autoFocus
                  className="daimo-px-4 daimo-py-3 daimo-text-base"
                />
              )}
            </DaimoFormField>
          </div>

          {account?.authError && <ErrorMessage message={account.authError} />}
        </CenteredContent>

        <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
          <PrimaryButton
            type="submit"
            disabled={!isValid || account?.isLoggingIn}
          >
            {account?.isLoggingIn ? t.loading : t.continue}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
