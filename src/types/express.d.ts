import { AuthProvider } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  provider: AuthProvider;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthenticatedUser;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
