import { put } from "@vercel/blob";
import { requireRole } from "@/lib/require-role";

// Upload d'image produit → Vercel Blob (pattern Jumia /api/product-image/upload)
export async function POST(req: Request) {
  try {
    await requireRole(["SHOP_ADMIN", "SHOP_MANAGER"]);
  } catch {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Aucun fichier" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "Image trop volumineuse (max 5 Mo)" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Le fichier doit être une image" }, { status: 400 });
  }

  try {
    const blob = await put(`produits/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return Response.json({ url: blob.url });
  } catch (e) {
    console.error("upload image:", e);
    return Response.json(
      { error: "Stockage d'images non configuré (BLOB_READ_WRITE_TOKEN manquant ou store Blob absent)." },
      { status: 500 },
    );
  }
}
