import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "PRODUCT_REJECTED"
  | "PRODUCT_APPROVED"
  | "ORDER_RECEIVED"
  | "SELLER_APPROVED"
  | "SETTLEMENT_PAID";

// Crée une notification pour une boutique
export async function createNotification(input: {
  shopId: string;
  type: NotificationType;
  title: string;
  message?: string;
  actorUserId?: string | null;
}) {
  return prisma.notification.create({
    data: {
      shopId: input.shopId,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
    },
  });
}

// Notifications d'une boutique (ou toutes si shopId null)
export async function listNotifications(shopId: string | null, take = 50) {
  return prisma.notification.findMany({
    where: shopId ? { shopId } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
}

// Nombre de notifications non lues d'une boutique
export async function countUnreadNotifications(shopId: string | null) {
  return prisma.notification.count({
    where: shopId ? { shopId, readAt: null } : { readAt: null },
  });
}

// Marque toutes les notifications d'une boutique comme lues
export async function markAllRead(shopId: string) {
  return prisma.notification.updateMany({
    where: { shopId, readAt: null },
    data: { readAt: new Date() },
  });
}
