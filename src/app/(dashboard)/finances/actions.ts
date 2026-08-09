"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionDb } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { generateAllSettlements } from "@/lib/settlements";
import { createNotification } from "@/lib/notifications";
import type { SettlementStatus } from "@/generated/prisma/enums";

// Génération des relevés du mois (admin — finance.manage_all)
export async function generateSettlementsAction() {
  try {
    await requirePermissionDb("finance.manage_all");
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const created = await generateAllSettlements(start, end);
    for (const s of created) {
      await createNotification({
        shopId: s.shopId,
        type: "SETTLEMENT_PAID",
        title: "Relevé disponible",
        message: `Votre relevé de ${s.periodStart.toLocaleDateString("fr-FR")} est disponible (${Number(s.netPayable).toLocaleString("fr-FR")} FCFA net).`,
      });
    }
    revalidatePath("/finances");
    return { created: created.length };
  } catch (e) {
    console.error("generateSettlementsAction:", e);
    return { error: "Erreur lors de la génération." };
  }
}

// Marquage PAYÉ d'un relevé (finance.manage_all)
export async function markSettlementPaidAction(settlementId: string) {
  try {
    const user = await requirePermissionDb("finance.manage_all");
    const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) return { error: "Relevé introuvable." };
    await prisma.settlement.update({
      where: { id: settlementId },
      data: { status: "PAID" as SettlementStatus, payoutRef: `PAY-${Date.now()}`, paidAt: new Date() },
    });
    await createNotification({
      shopId: settlement.shopId,
      type: "SETTLEMENT_PAID",
      title: "Relevé payé",
      message: `Votre relevé de ${settlement.periodEnd.toLocaleDateString("fr-FR")} a été payé (${Number(settlement.netPayable).toLocaleString("fr-FR")} FCFA).`,
      actorUserId: user.id,
    });
    revalidatePath("/finances");
    return {};
  } catch (e) {
    console.error("markSettlementPaidAction:", e);
    return { error: "Erreur lors du paiement." };
  }
}
