import { useEffect, useState } from 'react';

type ListenerHandle = { remove(): Promise<void> | void };
type AddListenerResult = ListenerHandle | Promise<ListenerHandle>;

interface SmsShieldPlugin {
  getStatus(): Promise<{
    pendingSms: { address: string; body: string } | null;
    permissions: { receiveSms: string; postNotifications: string };
  }>;
  requestPermissions(): Promise<{ receiveSms: string; postNotifications: string }>;
  clearPendingSms(): Promise<void>;
  addListener(event: 'smsPending', cb: (data: { address: string; body: string }) => void): AddListenerResult;
}

interface CapApp {
  addListener(event: 'appStateChange', cb: (state: { isActive: boolean }) => void): AddListenerResult;
}

function getPlugin(): SmsShieldPlugin | null {
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?(): boolean; Plugins?: Record<string, unknown> }
  }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return (cap.Plugins?.SmsShield as SmsShieldPlugin) ?? null;
}

function getAppPlugin(): CapApp | null {
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?(): boolean; Plugins?: Record<string, unknown> }
  }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return (cap.Plugins?.App as CapApp) ?? null;
}

function safeAddListener<T>(
  addFn: (cb: T) => AddListenerResult,
  cb: T,
  onHandle: (h: ListenerHandle) => void
) {
  try {
    const result = addFn(cb);
    if (result && typeof (result as Promise<ListenerHandle>).then === 'function') {
      (result as Promise<ListenerHandle>).then(onHandle).catch(() => {});
    } else {
      onHandle(result as ListenerHandle);
    }
  } catch {}
}

export interface PendingSms {
  address: string;
  body: string;
}

export function useSmsShield(): { pending: PendingSms | null; clearPending: () => void } {
  const [pending, setPending] = useState<PendingSms | null>(null);

  useEffect(() => {
    const plugin = getPlugin();
    if (!plugin) return;

    let smsHandle: ListenerHandle | null = null;
    let appHandle: ListenerHandle | null = null;

    const checkPendingSms = async () => {
      try {
        const status = await plugin.getStatus();
        if (status.pendingSms?.body) {
          setPending(status.pendingSms);
        }
      } catch {}
    };

    const init = async () => {
      try {
        const status = await plugin.getStatus();

        // Demander les permissions si nécessaire
        if (
          status.permissions.receiveSms !== 'granted' ||
          status.permissions.postNotifications !== 'granted'
        ) {
          await plugin.requestPermissions().catch(() => {});
        }

        // SMS déjà en attente (tap notification → app froide)
        if (status.pendingSms?.body) {
          setPending(status.pendingSms);
        }
      } catch {}

      // SMS en temps réel (app déjà ouverte, SmsReceiver broadcast)
      safeAddListener(
        (cb) => plugin.addListener('smsPending', cb),
        (data: { address: string; body: string }) => setPending(data),
        (h) => { smsHandle = h; }
      );

      // Retour au premier plan (tap notification → app déjà ouverte en arrière-plan)
      // MainActivity.onNewIntent() envoie le broadcast → plugin émet smsPending,
      // mais au cas où ce serait manqué, on re-vérifie getStatus() au resume.
      const appPlugin = getAppPlugin();
      if (appPlugin) {
        safeAddListener(
          (cb) => appPlugin.addListener('appStateChange', cb),
          (state: { isActive: boolean }) => { if (state.isActive) void checkPendingSms(); },
          (h) => { appHandle = h; }
        );
      }
    };

    void init();

    return () => {
      try { smsHandle?.remove(); } catch {}
      try { appHandle?.remove(); } catch {}
    };
  }, []);

  const clearPending = () => {
    setPending(null);
    try { getPlugin()?.clearPendingSms().catch(() => {}); } catch {}
  };

  return { pending, clearPending };
}
