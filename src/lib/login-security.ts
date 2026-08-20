import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Rate limiting login : 5 échecs consécutifs → verrouillage 15 minutes
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

/**
 * Vérifie les identifiants + applique le rate limiting par compte.
 * Retourne l'utilisateur si le login est valide, sinon null.
 */
export async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") return null;

  // Verrouillage actif : refuse
  const now = new Date();
  if (user.lockoutUntil && user.lockoutUntil > now) return null;
  // Verrouillage expiré : réinitialise le compteur
  if (user.lockoutUntil && user.lockoutUntil <= now) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockoutUntil: null },
    });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data:
        attempts >= MAX_FAILED_ATTEMPTS
          ? { failedAttempts: 0, lockoutUntil: new Date(now.getTime() + LOCKOUT_MS) }
          : { failedAttempts: attempts },
    });
    return null;
  }

  // Succès : réinitialise le compteur d'échecs
  if (user.failedAttempts > 0 || user.lockoutUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockoutUntil: null },
    });
  }

  return user;
}
