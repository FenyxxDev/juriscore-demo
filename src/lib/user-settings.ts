import type { NotifCategoria, Preferencias } from '../store';
import { supabase } from './supabase';

export type UserSettings = {
  prefs: Partial<Preferencias>;
  notifPrefs: Partial<Record<NotifCategoria, boolean>>;
  readIds?: string[];
};

type NotificationSettings = Partial<Record<NotifCategoria, boolean>> & { readIds?: string[] };
type UserSettingsRow = {
  preferences: Partial<Preferencias> | null;
  notifications: NotificationSettings | null;
};

function db() {
  if (!supabase) throw new Error('O Supabase não está configurado.');
  return supabase;
}

async function currentUserId() {
  const client = db();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sessão expirada. Inicie sessão novamente.');
  return data.user.id;
}

export async function loadUserSettings(): Promise<UserSettings | null> {
  const client = db();
  const ownerId = await currentUserId();
  const { data, error } = await client.from('user_preferences')
    .select('preferences, notifications')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as UserSettingsRow;
  const { readIds, ...notifPrefs } = row.notifications ?? {};
  return {
    prefs: row.preferences ?? {},
    notifPrefs,
    readIds: Array.isArray(readIds) ? readIds.filter((id): id is string => typeof id === 'string').slice(-500) : [],
  };
}

export async function saveUserSettings(patch: UserSettings, expectedOwnerId: string): Promise<void> {
  const client = db();
  const ownerId = await currentUserId();
  if (ownerId !== expectedOwnerId) throw new Error('A conta ativa mudou. Recarregue a página antes de salvar.');
  const notifications = {
    ...patch.notifPrefs,
    ...(patch.readIds ? { readIds: patch.readIds.slice(-500) } : {}),
  };
  const { error } = await client.rpc('patch_user_preferences', {
    p_preferences: patch.prefs,
    p_notifications: notifications,
  });
  if (error) throw error;
  if (await currentUserId() !== ownerId) throw new Error('A conta mudou durante o salvamento.');
}
