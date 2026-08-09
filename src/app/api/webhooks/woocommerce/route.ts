import crypto from "crypto";
import { processWooOrder } from "@/lib/orders";

// Webhook WooCommerce : vérifie la signature HMAC-SHA256 puis traite la commande.
export async function POST(req: Request) {
  const secret = process.env.WOO_WEBHOOK_SECRET;
  const signature = req.headers.get("x-wc-webhook-signature");
  if (!secret || !signature) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.text();
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("base64");
  if (signature !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(raw);
    const result = await processWooOrder(payload);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("webhook/woocommerce:", error);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
