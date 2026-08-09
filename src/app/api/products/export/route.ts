import { auth } from "@/auth";
import { exportProductsCsv } from "@/lib/products-export";

// Export CSV des produits (vendeur → sa boutique, admin → tous)
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const isAdmin = session.user.role === "SUPER_ADMIN";
  const shopId = isAdmin ? null : session.user.shopId;
  if (!isAdmin && !shopId) return new Response("Forbidden", { status: 403 });

  const csv = await exportProductsCsv(shopId);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="produits.csv"',
    },
  });
}
