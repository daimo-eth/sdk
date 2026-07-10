import type {
  AccountLegalName,
  AccountRail,
  StartEnrollmentRequest,
} from "../../../common/account.js";

export function getAccountEnrollmentRequest(args: {
  rail: AccountRail;
  legalName: AccountLegalName | null;
  returnUrl?: string;
}): StartEnrollmentRequest {
  return {
    rail: args.rail,
    ...(args.legalName ? { legalName: args.legalName } : {}),
    ...(args.returnUrl ? { returnUrl: args.returnUrl } : {}),
  };
}
