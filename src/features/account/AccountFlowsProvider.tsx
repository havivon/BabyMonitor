import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useToast } from '../../components/toast';
import { he } from '../../i18n/he';
import { isCloudConfigured, useCloud } from '../../platform/cloud';
import { FamilySetupSheet } from './FamilySetupSheet';
import { AccountFlowsContext, type AccountFlowsApi, type SignInIntent } from './flowsContext';
import { InviteSheet } from './InviteSheet';
import { SignInSheet } from './SignInSheet';

type Request =
  | { kind: 'signIn'; intent: SignInIntent }
  | { kind: 'family'; step: 'choose' | 'join' }
  | { kind: 'invite' };

/**
 * Hosts the account sheets once for the whole app (Home note, Settings, onboarding all open them).
 * After a successful sign-in, as soon as the user's family membership is known (status is no longer
 * 'connecting'), a user without a family is offered create / join. Renders nothing extra when the
 * cloud is not configured.
 */
export function AccountFlowsProvider({ children }: { children: ReactNode }) {
  if (!isCloudConfigured) return <>{children}</>;
  return <ConfiguredAccountFlows>{children}</ConfiguredAccountFlows>;
}

function ConfiguredAccountFlows({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { user, family, status } = useCloud();
  const [request, setRequest] = useState<(Request & { key: number }) | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  /** Set right after a sign-in; cleared once family setup is done or not needed. */
  const [afterSignIn, setAfterSignIn] = useState<SignInIntent | null>(null);
  /** Last sign-in's intent + count; keeps the setup sheet mounted so it can animate closed. */
  const [setup, setSetup] = useState<{ intent: SignInIntent; n: number } | null>(null);

  const membershipKnown = user !== null && status !== 'connecting';
  // Signed in to an account that already has a family: nothing to set up (adjusted during render).
  if (afterSignIn !== null && membershipKnown && family !== null) setAfterSignIn(null);
  const setupDue = afterSignIn !== null && membershipKnown && family === null;

  const open = useCallback((r: Request) => {
    setRequest((prev) => ({ ...r, key: (prev?.key ?? 0) + 1 }));
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const api = useMemo<AccountFlowsApi>(
    () => ({
      openSignIn: (intent = 'default') => open({ kind: 'signIn', intent }),
      openFamilySetup: (step = 'choose') => open({ kind: 'family', step }),
      openInvite: () => open({ kind: 'invite' }),
    }),
    [open],
  );

  let sheet: ReactNode = null;
  if (request?.kind === 'signIn') {
    const { intent } = request;
    sheet = (
      <SignInSheet
        key={request.key}
        open={isOpen}
        onClose={close}
        onSignedIn={() => {
          close();
          toast.show({ text: he.account.signIn.signedIn });
          setAfterSignIn(intent);
          setSetup((prev) => ({ intent, n: (prev?.n ?? 0) + 1 }));
        }}
      />
    );
  } else if (request?.kind === 'family') {
    sheet = (
      <FamilySetupSheet
        key={request.key}
        open={isOpen}
        onClose={close}
        initialStep={request.step}
      />
    );
  } else if (request?.kind === 'invite') {
    sheet = <InviteSheet key={request.key} open={isOpen} onClose={close} />;
  }

  return (
    <AccountFlowsContext.Provider value={api}>
      {children}
      {sheet}
      {setup !== null && (
        <FamilySetupSheet
          key={`setup-${setup.n}`}
          open={setupDue}
          initialStep={setup.intent === 'join' ? 'join' : 'choose'}
          onClose={() => setAfterSignIn(null)}
        />
      )}
    </AccountFlowsContext.Provider>
  );
}
