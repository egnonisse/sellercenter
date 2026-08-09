import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { endPromotionAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  ENDED: "Terminée",
};

export default async function PromotionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.shopId) redirect("/");

  const promotions = await prisma.promotion.findMany({
    where: { shopId: session.user.shopId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
          <p className="text-sm text-muted-foreground">Créez des réductions sur vos produits</p>
        </div>
        <Link href="/promotions/new">
          <Button>Nouvelle promotion</Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Réduction</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Produits</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Aucune promotion. Créez votre première réduction.
                </TableCell>
              </TableRow>
            )}
            {promotions.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.type === "PERCENTAGE" ? "Pourcentage" : "Montant fixe"}</TableCell>
                <TableCell>
                  {p.type === "PERCENTAGE" ? `${Number(p.value)} %` : `${Number(p.value).toLocaleString("fr-FR")} FCFA`}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(p.startAt).toLocaleDateString("fr-FR")} →{" "}
                  {new Date(p.endAt).toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell>{p._count.products}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {p.status !== "ENDED" && (
                    <form
                      action={async () => {
                        "use server";
                        await endPromotionAction(p.id);
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        Terminer
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
