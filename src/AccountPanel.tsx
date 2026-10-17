import { useEffect, useState, useSyncExternalStore } from 'react';
import { progressStore } from './progress';

const reservedPaths = [
  '/signin-with-chatgpt',
  '/signout-with-chatgpt',
  '/callback',
];

function authPath(path: '/signin-with-chatgpt' | '/signout-with-chatgpt') {
  const current = new URL(window.location.href);
  const relative = `${current.pathname}${current.search}${current.hash}`;
  const returnTo =
    relative.startsWith('//') || reservedPaths.includes(current.pathname)
      ? '/'
      : relative;
  return `${path}?return_to=${encodeURIComponent(returnTo)}`;
}

export function AccountPanel() {
  const account = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getAccountSnapshot,
  );
  const progress = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
  );
  const [preview, setPreview] = useState<ReturnType<
    typeof progressStore.getGuestImportPreview
  > | null>(null);
  useEffect(() => {
    void progressStore.initialize();
  }, []);
  const saving =
    account.kind === 'account' &&
    account.pending.some((item) => item.status === 'saving');
  return (
    <section
      className="account-panel"
      aria-label="Progress account"
      data-account-state={
        account.kind === 'account'
          ? account.status
          : account.kind === 'unavailable'
            ? 'error'
            : account.kind
      }
    >
      <div className="account-summary">
        <strong>
          {account.kind === 'guest' ? 'Guest progress' : 'Account progress'}
        </strong>
        <p role="status" aria-live="polite">
          {account.kind === 'guest' && progress.unsaved
            ? 'Not saved. This browser is blocking storage. Guest changes last this visit only.'
            : account.message}
        </p>
      </div>
      <div className="account-actions">
        {account.kind === 'guest' && (
          <a href={authPath('/signin-with-chatgpt')} target="_top">
            Sign in with ChatGPT
          </a>
        )}
        {account.kind === 'unavailable' && (
          <button type="button" onClick={() => void progressStore.retry()}>
            Retry account
          </button>
        )}
        {account.kind === 'account' && (
          <>
            {account.pending.length > 0 && (
              <>
                <p>
                  Unsaved lessons.{' '}
                  {account.pending.map((item) => item.lessonId).join(', ')}.
                  Changes stay in this tab and are lost on reload.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void progressStore.retry()}
                >
                  Retry unsaved changes
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void progressStore.acceptRemote()}
                >
                  Use account version
                </button>
              </>
            )}
            {account.pending.length === 0 && (
              <button
                type="button"
                onClick={() =>
                  setPreview(progressStore.getGuestImportPreview())
                }
              >
                Preview guest import
              </button>
            )}
            <a href={authPath('/signout-with-chatgpt')} target="_top">
              Sign out
            </a>
          </>
        )}
      </div>
      {preview &&
        account.kind === 'account' &&
        preview.owner === account.owner && (
          <div className="guest-import-preview">
            <p>
              Import adds {preview.studied} studied marks and {preview.verdicts}{' '}
              self-ratings from this browser. Keeps {preview.preservedVerdicts}{' '}
              existing account self-ratings and the guest copy.
            </p>
            <button
              type="button"
              disabled={
                account.pending.length > 0 ||
                preview.studied + preview.verdicts === 0
              }
              onClick={() => {
                setPreview(null);
                void progressStore.importGuest(preview);
              }}
            >
              Import guest progress
            </button>
            <button type="button" onClick={() => setPreview(null)}>
              Cancel import
            </button>
          </div>
        )}
    </section>
  );
}
