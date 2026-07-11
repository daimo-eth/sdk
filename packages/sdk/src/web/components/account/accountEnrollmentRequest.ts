import type {
  AccountLegalName,
  AccountRail,
  StartEnrollmentRequest,
} from "../../../common/account.js";

export function getAccountEnrollmentRequest(args: {
  rail: AccountRail;
  legalName: AccountLegalName | null;
}): StartEnrollmentRequest {
  return {
    rail: args.rail,
    ...(args.legalName ? { legalName: args.legalName } : {}),
  };
}
