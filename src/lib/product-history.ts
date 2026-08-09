import { prisma } from "@/lib/prisma";

// Journalise une transition sur un produit (pattern historique Jumia)
export async function logProductHistory(input: {
  productId: string;
  action: string;
  from?: string | null;
  to?: string | null;
  note?: string | null;
  actorUserId?: string | null;
}) {
  await prisma.productHistory.create({
    data: {
      productId: input.productId,
      action: input.action,
      from: input.from ?? null,
      to: input.to ?? null,
      note: input.note ?? null,
      actorUserId: input.actorUserId ?? null,
    },
  });
}
