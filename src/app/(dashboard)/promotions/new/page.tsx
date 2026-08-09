import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPromotionAction } from "../actions";

export default async function NewPromotionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.shopId) redirect("/products");

  const products = await prisma.product.findMany({
    where: { shopId: session.user.shopId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, price: true },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle promotion</h1>
        <p className="text-sm text-muted-foreground">
          Réduction sur des produits actifs. La vitrine appliquera la promo (chantier à venir).
        </p>
      </div>

      <form action={createPromotionAction} className="space-y-4 rounded-md border p-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom de la promotion</Label>
          <Input id="name" name="name" placeholder="Ex : Rentrée scolaire" required />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              defaultValue="PERCENTAGE"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-950"
            >
              <option value="PERCENTAGE">Pourcentage (%)</option>
              <option value="FIXED">Montant fixe (FCFA)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Réduction</Label>
            <Input id="value" name="value" type="number" min="1" step="0.01" placeholder="10" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Statut</Label>
            <Input id="status" value="Brouillon" disabled className="opacity-60" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startAt">Début</Label>
            <Input id="startAt" name="startAt" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endAt">Fin</Label>
            <Input id="endAt" name="endAt" type="date" required />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Produits concernés ({products.length} actifs)</Label>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {products.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                Aucun produit actif. Validez d&apos;abord des produits.
              </p>
            )}
            {products.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                <input type="checkbox" name="productIds" value={p.id} className="h-4 w-4 rounded border-input" />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{Number(p.price).toLocaleString("fr-FR")} FCFA</span>
              </label>
            ))}
          </div>
        </div>

        <Button type="submit">Créer la promotion</Button>
      </form>
    </div>
  );
}
