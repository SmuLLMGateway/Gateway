import type { Request } from 'express';
import type {
  AuthenticatedUser,
  VerifiedAccessToken,
} from './jwt-payload.type.js';

export interface SecurityRequest extends Request {
  user?: AuthenticatedUser;
  refreshAccessToken?: VerifiedAccessToken;
  refreshToken?: string;
}
