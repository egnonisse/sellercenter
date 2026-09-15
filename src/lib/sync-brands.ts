// Synchronisation des marques WooCommerce (taxonomie product_brand) → SellerCenter.
// Import idempotent : par wooId, sinon par nom (liaison), sinon création.

import { prisma } from "@/lib/prisma";
import { wooListProductBrands } from "@/lib/woocommerce";

export type BrandSyncResult = {
  total: number;
  created: number;
  updated: number;
  errors: number;
};

export async function syncBrandsFromWoo(): Promise<BrandSyncResult> {
  const wooBrands = await wooListProductBrands();
  const result: BrandSyncResult = { total: wooBrands.length, created: 0, updated: 0, errors: 0 };

  for (const b of wooBrands) {
    try {
      // 1. Déjà importée par wooId → mise à jour du nom si différent
      const byWoo = await prisma.brand.findFirst({ where: { wooId: b.id } });
      if (byWoo) {
        if (byWoo.name !== b.name) {
          await prisma.brand.update({ where: { id: byWoo.id }, data: { name: b.name } });
        }
        result.updated++;
        continue;
      }

      // 2. Même nom localement (marque créée à la volée par un vendeur) → liaison
      const byName = await prisma.brand.findUnique({ where: { name: b.name } });
      if (byName) {
        await prisma.brand.update({ where: { id: byName.id }, data: { wooId: b.id } });
        result.updated++;
        continue;
      }

      // 3. Nouvelle marque
      await prisma.brand.create({ data: { name: b.name, wooId: b.id } });
      result.created++;
    } catch (e) {
      result.errors++;
      console.error(`syncBrandsFromWoo (${b.name}):`, e);
    }
  }

  return result;
}
