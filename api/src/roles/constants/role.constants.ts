export const RoleName = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
  ACCOUNTANT: 'ACCOUNTANT',
  SUPPORT: 'SUPPORT',
} as const;

export type RoleName = (typeof RoleName)[keyof typeof RoleName];

export function isValidRole(role: string): role is RoleName {
  return Object.values(RoleName).includes(role as RoleName);
}

export const PRIVILEGED_ROLES = [RoleName.ADMIN, RoleName.MANAGER];

export const ALL_ROLES = Object.values(RoleName);
