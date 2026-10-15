import bcrypt from 'bcryptjs';

/** Password hashing boundary — swap implementation here if migrating to argon2. */
const COST = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
