import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

// Export CSV des relevés (vendeur → sa boutique, sinon tous)
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!hasPermission(session.user.permissions ?? [], "finance.read_all")) {
    return new Response("Forbidden", { status: 403 });
  }

  const shopId = session.user.shopId ?? null;
  const settlements = await prisma.settlement.findMany({
    where: shopId ? { shopId } : undefined,
    orderBy: { periodEnd: "desc" },
    include: { shop: { select: { name: true } } },
  });

  const rows = [
    ["Boutique", "Période début", "Période fin", "CA brut", "Commission", "Net", "Statut", "Payé le"],
    ...settlements.map((s) => [
      s.shop.name,
      s.periodStart.toISOString().slice(0, 10),
      s.periodEnd.toISOString().slice(0, 10),
      String(Number(s.grossSales)),
      String(Number(s.commission)),
      String(Number(s.netPayable)),
      s.status,
      s.paidAt ? s.paidAt.toISOString().slice(0, 10) : "",
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="releves.csv"',
    },
  });
}
