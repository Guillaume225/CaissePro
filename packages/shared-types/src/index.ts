export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface JwtPayload {
  sub: string;
  role: Role;
}
