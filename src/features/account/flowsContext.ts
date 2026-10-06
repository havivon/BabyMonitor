import { createContext, useContext } from 'react';

/** Why sign-in was opened: `join` = "כבר יש לנו חשבון" (prefer joining a family afterwards). */
export type SignInIntent = 'default' | 'join';

export interface AccountFlowsApi {
  /** Sign-in sheet; afterwards, a user without a family is offered create / join. */
  openSignIn: (intent?: SignInIntent) => void;
  /** Create-or-join choice for a signed-in user without a family. */
  openFamilySetup: (step?: 'choose' | 'join') => void;
  openInvite: () => void;
}

const noop = (): void => undefined;
/** Default (cloud not configured / outside the provider): every flow is a no-op. */
export const AccountFlowsContext = createContext<AccountFlowsApi>({
  openSignIn: noop,
  openFamilySetup: noop,
  openInvite: noop,
});

export const useAccountFlows = (): AccountFlowsApi => useContext(AccountFlowsContext);
