import jwt, { type SignOptions } from 'jsonwebtoken';

export type Role = 'ADMIN' | 'CASHIER';

export type JwtPayload = {
  sub: string;
  role: Role;
  storeId: string;
  username: string;
};

function secret(): string {
  return process.env.JWT_SECRET || 'shablon-pos-dev-secret';
}

export function signToken(payload: JwtPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '12h') as SignOptions['expiresIn'];
  return jwt.sign(payload, secret(), { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret()) as JwtPayload;
}
