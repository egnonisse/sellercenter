import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listImportHistory } from "@/lib/products-import";
import { ImportClient } from "./import-client";

export default async function ImportProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.shopId) redirect("/products");

  const history = await listImportHistory(session.user.shopId);

  return <ImportClient history={history} />;
}
