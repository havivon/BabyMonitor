import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
 * Hosts the account sheets once for the whole app (Home note, Settings and onboarding open them).
 * After a successful sign-in, as soon as family membership is known (status ≠ 'connecting'):
 * - with a family → toast "התחברת · הנתונים מסונכרנים";
 * - without one → the "התחברת · עוד צעד אחד" setup sheet (DESIGN §15.3 / §15.7).
 * Renders only its children when the cloud is not configured.
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
  /** Set right after a sign-in; cleared once setup is done, dismissed or not needed. */
  const [afterSignIn, setAfterSignIn] = useState<SignInIntent | null>(null);
  /** Last sign-in's intent + count; keeps the setup sheet mounted so it can animate closed. */
  const [setup, setSetup] = useState<{ intent: SignInIntent; n: number } | null>(null);
  const welcomePending = useRef(false);

  const membershipKnown = user !== null && status !== 'connecting';
  // Signed in to an account that already has a family: nothing to set up (adjusted during render).
  if (afterSignIn !== null && membershipKnown && family !== null) setAfterSignIn(null);
  const setupDue = afterSignIn !== null && membershipKnown && family === null;

  // One-time welcome toast for an account that already has a family.
  useEffect(() => {
    if (!welcomePending.current || !membershipKnown) return;
    welcomePending.current = false;
    if (family) toast.show({ text: he.account.signIn.signedInSynced });
  }, [membershipKnown, family, toast]);

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
          welcomePending.current = true;
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
        startOnJoin={request.step === 'join'}
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
          afterSignIn
          initialChoice={setup.intent === 'join' ? 'join' : 'create'}
          onClose={() => setAfterSignIn(null)}
        />
      )}
    </AccountFlowsContext.Provider>
  );
}
