// Sur le web : /api est proxié par Vite vers localhost:3001
// Sur Android (Capacitor) : VITE_API_URL doit pointer vers l'IP de la machine (ex: http://192.168.1.10:3001/api)
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '/api') + '/analyses';
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

function authHeaders(): Record<string, string> {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
}

function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError && (
    (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed'))
  );
}

function networkErrorMessage(): string {
  return 'Impossible de joindre le serveur. Vérifiez que l\'API est démarrée et accessible.';
}

export async function postText(content: string): Promise<{ id: string }> {
  let res: Response;
  try {
    res = await fetch(BASE + '/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ content }),
    });
  } catch (e) {
    throw new Error(isNetworkError(e) ? networkErrorMessage() : 'Erreur lors de l\'analyse.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Erreur lors de l\'analyse.');
  }
  return res.json() as Promise<{ id: string }>;
}

export async function getAnalysis(id: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${id}`, { headers: authHeaders() });
  } catch (e) {
    throw new Error(isNetworkError(e) ? networkErrorMessage() : 'Analyse introuvable.');
  }
  if (!res.ok) throw new Error('Analyse introuvable.');
  return res.json();
}

export async function postImage(file: File): Promise<{ id: string }> {
  const form = new FormData();
  form.append('file', file);
  let res: Response;
  try {
    res = await fetch(BASE + '/image', { method: 'POST', body: form, headers: authHeaders() });
  } catch (e) {
    throw new Error(isNetworkError(e) ? networkErrorMessage() : 'Erreur lors de l\'analyse.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Erreur lors de l\'analyse.');
  }
  return res.json() as Promise<{ id: string }>;
}
