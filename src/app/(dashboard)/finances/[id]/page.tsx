import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Ouvert",
  PROCESSING: "En traitement",
  PAID: "Payé",
  FAILED: "Échec",
};

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const perms = session.user.permissions ?? [];
  if (!hasPermission(perms, "finance.read_all")) redirect("/");

  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      shop: { select: { name: true } },
      lines: {
        include: {
          orderItem: { include: { product: { select: { name: true, sku: true } } } },
        },
      },
    },
  });
  if (!settlement) redirect("/finances");

  const isGlobal = !session.user.shopId;
  if (!isGlobal && settlement.shopId !== session.user.shopId) redirect("/finances");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Relevé — {settlement.shop.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date(settlement.periodStart).toLocaleDateString("fr-FR")} au{" "}
          {new Date(settlement.periodEnd).toLocaleDateString("fr-FR")} ·{" "}
          <Badge variant={settlement.status === "PAID" ? "default" : "secondary"}>
            {STATUS_LABEL[settlement.status] ?? settlement.status}
          </Badge>
        </p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border rounded-md border text-center text-sm">
        <div className="p-4">
          <div className="text-xs text-muted-foreground">CA brut</div>
          <div className="text-xl font-semibold">{Number(settlement.grossSales).toLocaleString("fr-FR")} FCFA</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted-foreground">Commission</div>
          <div className="text-xl font-semibold">− {Number(settlement.commission).toLocaleString("fr-FR")} FCFA</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted-foreground">Net à percevoir</div>
          <div className="text-xl font-semibold text-primary">{Number(settlement.netPayable).toLocaleString("fr-FR")} FCFA</div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Montant (FCFA)</TableHead>
              <TableHead className="text-right">Commission (FCFA)</TableHead>
              <TableHead className="text-right">Net (FCFA)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlement.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="max-w-[300px] truncate">{line.orderItem.product.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{line.orderItem.product.sku || "—"}</TableCell>
                <TableCell className="text-right">{Number(line.gross).toLocaleString("fr-FR")}</TableCell>
                <TableCell className="text-right">− {Number(line.commission).toLocaleString("fr-FR")}</TableCell>
                <TableCell className="text-right font-medium">{Number(line.net).toLocaleString("fr-FR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
