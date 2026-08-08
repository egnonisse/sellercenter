import { syncPendingProducts } from "@/lib/sync";

// Endpoint appelé par le cron Vercel (header x-vercel-cron ajouté par Vercel)
export async function GET(req: Request) {
  if (req.headers.get("x-vercel-cron") !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncPendingProducts();
    return Response.json(result);
  } catch (error) {
    console.error("cron/sync:", error);
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }
}
