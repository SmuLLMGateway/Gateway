import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class PasswordEncoderService {
  async encode(rawPassword: string): Promise<string> {
    return hash(rawPassword, BCRYPT_SALT_ROUNDS);
  }

  async matches(rawPassword: string, encodedPassword: string): Promise<boolean> {
    return compare(rawPassword, encodedPassword);
  }
}
