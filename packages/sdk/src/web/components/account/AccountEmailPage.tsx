import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { PrimaryButton } from "../buttons.js";
import { DaimoFormField, DaimoTextField } from "../formFields.js";
import { CenteredContent, PageHeader } from "../shared.js";
import { AccountAuthErrorMessage } from "./AccountAuthErrorMessage.js";
import {
  type EmailFormValues,
  type EmailSubmitValues,
  zEmailForm,
} from "./formSchemas.js";

type AccountEmailPageProps = {
  methodLabel: string;
  sessionId: string;
  clientSecret: string;
  onBack: (() => void) | null;
  onOtpSent: () => void;
};

export function AccountEmailPage({
  methodLabel,
  sessionId,
  clientSecret,
  onBack,
  onOtpSent,
}: AccountEmailPageProps) {
  const account = useAccountFlow();
  const logoutDone = useRef(false);
  const [isPreparingAuth, setIsPreparingAuth] = useState(true);
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
    if (!account) {
      setIsPreparingAuth(false);
      return;
    }
    let cancelled = false;
    void account.logout().finally(() => {
      if (!cancelled) setIsPreparingAuth(false);
    });
    return () => {
      cancelled = true;
    };
  }, [account?.logout]);

  const submit = handleSubmit(
    useCallback(
      async ({ email }) => {
        if (!account || isPreparingAuth) return;
        account.setEmail(email);
        const sent = await account.sendOtp(email);
        if (sent) onOtpSent();
      },
      [account, isPreparingAuth, onOtpSent],
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
      <PageHeader title={methodLabel} onBack={onBack} />

      <form
        className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
        onSubmit={handleFormSubmit}
        aria-busy={isPreparingAuth || !!account?.isLoggingIn}
      >
        <CenteredContent>
          <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center">
            {t.accountEmailMethodDesc(methodLabel)}
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

          <AccountAuthErrorMessage
            sessionId={sessionId}
            clientSecret={clientSecret}
          />
        </CenteredContent>

        <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
          <PrimaryButton
            type="submit"
            disabled={!isValid || isPreparingAuth || account?.isLoggingIn}
          >
            {isPreparingAuth || account?.isLoggingIn ? t.loading : t.continue}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
