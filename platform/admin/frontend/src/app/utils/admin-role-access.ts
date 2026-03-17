export type AdminRole = 'author' | 'editor' | 'moderator' | 'legal' | 'admin' | 'root';

export const USER_MODULE_ROLES: readonly AdminRole[] = [
  'author',
  'editor',
  'moderator',
  'legal',
  'admin',
  'root'
] as const;

export const CONTENT_MODULE_ROLES: readonly AdminRole[] = [
  'author',
  'editor',
  'admin',
  'root'
] as const;

export const DSA_MODULE_ROLES: readonly AdminRole[] = [
  'moderator',
  'legal',
  'admin',
  'root'
] as const;

export const MODERATION_MODULE_ROLES = DSA_MODULE_ROLES;
export const ROOT_ADMIN_ROLES: readonly AdminRole[] = ['admin', 'root'] as const;

export function hasAllowedRole(role: string | null | undefined, allowedRoles: readonly string[]): boolean {
  return !!role && allowedRoles.includes(role);
}
