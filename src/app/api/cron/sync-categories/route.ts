import { syncCategoriesFromWoo } from "@/lib/sync-categories";

// Endpoint appelé par le cron Vercel (header x-vercel-cron ajouté par Vercel)
// et utilisable manuellement : GET /api/cron/sync-categories
export async function GET(req: Request) {
  if (req.headers.get("x-vercel-cron") !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncCategoriesFromWoo();
    return Response.json(result);
  } catch (error) {
    console.error("cron/sync-categories:", error);
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }
}
