import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toggleHolidayAction, updateShopAction } from "./actions";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.shopId) redirect("/");

  const user = await requirePermission("products.manage");
  const shop = await prisma.shop.findUnique({
    where: { id: user.shopId! },
    include: { seller: { select: { name: true, email: true, phone: true } } },
  });
  if (!shop) redirect("/");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres boutique</h1>
        <p className="text-sm text-muted-foreground">
          {shop.name} · Vendeur : {shop.seller.name} ({shop.seller.email})
        </p>
      </div>

      <form action={updateShopAction} className="space-y-4 rounded-md border p-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom de la boutique</Label>
          <Input id="name" name="name" defaultValue={shop.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={shop.description ?? ""}
            rows={3}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo (URL)</Label>
          <Input id="logoUrl" name="logoUrl" defaultValue={shop.logoUrl ?? ""} placeholder="https://..." />
        </div>
        <div className="flex gap-3">
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>

      <div className="rounded-md border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Mode vacances</h2>
            <p className="text-sm text-muted-foreground">
              {shop.holidayMode
                ? "Votre boutique est en pause. Les équipes Zariamall le voient."
                : "Mettez votre boutique en pause (pattern Jumia holidayMode)."}
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await toggleHolidayAction();
            }}
          >
            <Button type="submit" size="sm" variant={shop.holidayMode ? "default" : "outline"}>
              {shop.holidayMode ? "Reprendre l'activité" : "Activer le mode vacances"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
