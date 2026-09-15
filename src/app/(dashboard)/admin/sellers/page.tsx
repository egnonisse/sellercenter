import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { resolveShopScope } from "@/lib/shop-assignment";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  approveSellerAction,
  rejectSellerAction,
  suspendSellerAction,
  activateSellerAction,
} from "./actions";
import { KamAssignForm } from "@/components/admin/kam-assign-form";
import { listActiveAssignments, listActiveKams } from "@/lib/shop-assignment";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
};

export default async function AdminSellersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const perms = session.user.permissions ?? [];
  // Lecture pour le KAM (supervision), approbations pour qui a la permission
  if (!hasPermission(perms, "sellers.read")) redirect("/");

  // Un KAM ne voit que les vendeurs de son portefeuille ; l'admin voit tout
  const scope = await resolveShopScope({
    id: session.user.id,
    role: session.user.role,
    shopId: session.user.shopId,
  });
  const sellers = await prisma.seller.findMany({
    where: scope.isGlobal ? {} : { shops: { some: { id: { in: scope.shopIds } } } },
    orderBy: { createdAt: "desc" },
    include: {
      shops: scope.isGlobal ? true : { where: { id: { in: scope.shopIds } } },
    },
  });

  const pending = sellers.filter((s) => s.status === "PENDING");
  const canApprove = hasPermission(perms, "sellers.approve");
  const canSuspend = hasPermission(perms, "sellers.suspend");
  const canAssign = hasPermission(perms, "shops.assign");

  // Chargé de comptes (KAM) en poste pour chaque boutique
  const [kams, activeAssignments] = await Promise.all([
    canAssign ? listActiveKams() : Promise.resolve([]),
    listActiveAssignments(),
  ]);
  const kamByShop = new Map(activeAssignments.map((a) => [a.shopId, a.kam]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendeurs &amp; candidatures</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} inscription(s) en attente de validation · {sellers.length} vendeur(s) au total
          — approuver ou suspendre ici agit sur la boutique <em>et</em> sur les comptes de connexion du
          vendeur.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendeur</TableHead>
              <TableHead>Boutique &amp; chargé de comptes</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Inscrit le</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Aucun vendeur inscrit pour le moment.
                </TableCell>
              </TableRow>
            )}
            {sellers.map((seller) => (
              <TableRow key={seller.id}>
                <TableCell className="font-medium">{seller.name}</TableCell>
                <TableCell>
                  {seller.shops.length === 0 && "—"}
                  <div className="space-y-3">
                    {seller.shops.map((s) => (
                      <div key={s.id} className="space-y-1">
                        <div className="text-sm font-medium">{s.name}</div>
                        {canAssign ? (
                          <KamAssignForm
                            shopId={s.id}
                            kams={kams}
                            currentKamId={kamByShop.get(s.id)?.id ?? null}
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            KAM : {kamByShop.get(s.id)?.email ?? "aucun"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{seller.email}</div>
                  <div className="text-xs text-muted-foreground">{seller.phone}</div>
                </TableCell>
                <TableCell>
                  {new Date(seller.createdAt).toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell>
                  <Badge variant={seller.status === "ACTIVE" ? "default" : "secondary"}>
                    {STATUS_LABEL[seller.status] ?? seller.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {seller.status === "PENDING" && canApprove && (
                      <>
                        <form
                          action={async () => {
                            "use server";
                            await approveSellerAction(seller.id);
                          }}
                        >
                          <Button type="submit" size="sm">
                            Approuver
                          </Button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await rejectSellerAction(seller.id);
                          }}
                        >
                          <Button type="submit" size="sm" variant="outline">
                            Rejeter
                          </Button>
                        </form>
                      </>
                    )}
                    {seller.status === "ACTIVE" && canSuspend && (
                      <form
                        action={async () => {
                          "use server";
                          await suspendSellerAction(seller.id);
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline" className="text-red-600">
                          Suspendre
                        </Button>
                      </form>
                    )}
                    {seller.status === "SUSPENDED" && canSuspend && (
                      <form
                        action={async () => {
                          "use server";
                          await activateSellerAction(seller.id);
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          Réactiver
                        </Button>
                      </form>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
