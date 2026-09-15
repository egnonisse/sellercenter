"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  createProduct,
  updateProduct,
  submitProduct,
  delistProduct,
  requestProductDeletion,
  duplicateProduct,
} from "@/lib/products";
import { logProductHistory } from "@/lib/product-history";

export type ProductActionState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  // Attributs custom : attr_key_0 / attr_value_0 ...
  const custom: { key: string; value: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const key = String(formData.get(`attr_key_${i}`) ?? "").trim();
    const value = String(formData.get(`attr_value_${i}`) ?? "").trim();
    if (key && value) custom.push({ key, value });
  }
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    ean: String(formData.get("ean") ?? ""),
    price: String(formData.get("price") ?? ""),
    compareAtPrice: String(formData.get("compareAtPrice") ?? ""),
    saleStartDate: String(formData.get("saleStartDate") ?? ""),
    saleEndDate: String(formData.get("saleEndDate") ?? ""),
    stockQty: String(formData.get("stockQty") ?? ""),
    color: String(formData.get("color") ?? ""),
    size: String(formData.get("size") ?? ""),
    warranty: String(formData.get("warranty") ?? ""),
    custom,
    images: String(formData.get("images") ?? ""),
  };
}

function toInput(f: ReturnType<typeof parseForm>) {
  // Le formulaire envoie les URLs en JSON (liste visuelle) ; ancien format texte accepté
  const rawImages = f.images.trim();
  let images: string[] = [];
  if (rawImages) {
    if (rawImages.startsWith("[")) {
      try {
        images = JSON.parse(rawImages) as string[];
      } catch {
        images = [];
      }
    } else {
      images = rawImages
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return {
    name: f.name,
    description: f.description,
    categoryId: f.categoryId,
    brand: f.brand,
    sku: f.sku,
    ean: f.ean,
    price: Number(f.price),
    compareAtPrice: f.compareAtPrice ? Number(f.compareAtPrice) : null,
    saleStartDate: f.saleStartDate,
    saleEndDate: f.saleEndDate,
    stockQty: Number(f.stockQty),
    attributes: { color: f.color, size: f.size, warranty: f.warranty, custom: f.custom },
    images,
  };
}

function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Formulaire invalide.";
  if (e instanceof Error) {
    if (e.message === "PRODUIT_INTROUVABLE") return "Produit introuvable.";
    if (e.message === "PRODUIT_DELETION_PENDING") return "Produit en cours de suppression.";
    if (e.message === "PRODUIT_EAN_DUPLIQUE")
      return "Ce code-barres EAN/GTIN est déjà utilisé par un autre produit de votre boutique.";
  }
  console.error("productAction:", e);
  return "Erreur inattendue. Réessayez.";
}

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    const product = await createProduct(user.shopId, toInput(parseForm(formData)));
    await logProductHistory({ productId: product.id, action: "CREATED", actorUserId: user.id });
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function updateProductAction(
  productId: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    const updated = await updateProduct(user.shopId, productId, toInput(parseForm(formData)));
    await logProductHistory({
      productId,
      action: "UPDATED",
      from: updated.status,
      to: "DRAFT",
      actorUserId: user.id,
    });
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function submitProductAction(productId: string): Promise<void> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return;
    await submitProduct(user.shopId, productId);
    await logProductHistory({ productId, action: "SUBMITTED", to: "PENDING_QC", actorUserId: user.id });
    revalidatePath("/products");
  } catch (e) {
    console.error("submitProductAction:", e);
  }
}

export async function delistProductAction(productId: string): Promise<void> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return;
    await delistProduct(user.shopId, productId);
    await logProductHistory({ productId, action: "DELISTED", to: "DELISTED", actorUserId: user.id });
    revalidatePath("/products");
  } catch (e) {
    console.error("delistProductAction:", e);
  }
}

// Retrait motivé (raison + commentaire) — appelé depuis le détail produit
export async function delistProductWithReasonAction(
  productId: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    const reason = String(formData.get("reason") ?? "");
    const comment = String(formData.get("comment") ?? "");
    await delistProduct(user.shopId, productId, reason, comment);
    await logProductHistory({
      productId,
      action: "DELISTED",
      to: "DELISTED",
      note: `${reason}${comment ? ` — ${comment}` : ""}`,
      actorUserId: user.id,
    });
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// Demande de suppression (retention) : attend la confirmation admin
export async function requestDeletionAction(productId: string) {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    await requestProductDeletion(user.shopId, productId);
    await logProductHistory({
      productId,
      action: "DELETION_REQUESTED",
      to: "DELETION_PENDING",
      actorUserId: user.id,
    });
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// Actions en masse : soumettre (DRAFT/REJECTED → PENDING_QC) ou retirer (ACTIVE → DELISTED)
export async function bulkProductsAction(formData: FormData): Promise<void> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return;

    const ids = formData.getAll("ids").map(String);
    const action = String(formData.get("bulkAction") ?? "");
    if (ids.length === 0) return;

    const owned = await prisma.product.count({
      where: { id: { in: ids }, shopId: user.shopId },
    });
    if (owned !== ids.length) return;

    if (action === "submit") {
      await prisma.product.updateMany({
        where: { id: { in: ids }, status: { in: ["DRAFT", "REJECTED"] } },
        data: { status: "PENDING_QC", qcNote: null, qcReason: null },
      });
      await prisma.productHistory.createMany({
        data: ids.map((id) => ({
          productId: id,
          action: "SUBMITTED",
          to: "PENDING_QC",
          actorUserId: user.id,
        })),
      });
    } else if (action === "delist") {
      await prisma.product.updateMany({
        where: { id: { in: ids }, status: "ACTIVE" },
        data: { status: "DELISTED", syncStatus: "PENDING" },
      });
      await prisma.productHistory.createMany({
        data: ids.map((id) => ({
          productId: id,
          action: "DELISTED",
          to: "DELISTED",
          actorUserId: user.id,
        })),
      });
    } else {
      return;
    }

    revalidatePath("/products");
  } catch (e) {
    console.error("bulkProductsAction:", e);
  }
}

// Édition en masse (pattern Jumia bulkEditPrices / bulkSetSaleDate) :
// prix, ancien prix, stock et dates promo appliqués aux produits cochés.
export async function bulkEditProductsAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };

    const ids = formData.getAll("ids").map(String);
    if (ids.length === 0) return { error: "Sélectionnez au moins un produit." };

    const owned = await prisma.product.count({ where: { id: { in: ids }, shopId: user.shopId } });
    if (owned !== ids.length) return { error: "Produit invalide." };

    const data: Prisma.ProductUpdateManyMutationInput = {};
    const rawPrice = String(formData.get("bulkPrice") ?? "").trim();
    const rawCompare = String(formData.get("bulkCompareAt") ?? "").trim();
    const rawStock = String(formData.get("bulkStock") ?? "").trim();
    const rawStart = String(formData.get("bulkSaleStart") ?? "").trim();
    const rawEnd = String(formData.get("bulkSaleEnd") ?? "").trim();

    if (rawPrice) {
      const price = Number(rawPrice);
      if (!Number.isFinite(price) || price <= 0) return { error: "Prix invalide." };
      data.price = price;
    }
    if (rawCompare) {
      const compareAtPrice = Number(rawCompare);
      if (!Number.isFinite(compareAtPrice) || compareAtPrice <= 0) return { error: "Ancien prix invalide." };
      data.compareAtPrice = compareAtPrice;
    }
    if (rawStock) {
      const stockQty = Number(rawStock);
      if (!Number.isInteger(stockQty) || stockQty < 0) return { error: "Stock invalide." };
      data.stockQty = stockQty;
    }
    if (rawStart) data.saleStartDate = new Date(rawStart);
    if (rawEnd) data.saleEndDate = new Date(rawEnd);
    if (rawStart && rawEnd && new Date(rawStart) > new Date(rawEnd)) {
      return { error: "La date de début doit précéder la fin de promo." };
    }
    if (Object.keys(data).length === 0) return { error: "Renseignez au moins un champ à modifier." };

    data.status = "DRAFT";
    data.syncStatus = "PENDING";

    await prisma.$transaction([
      prisma.product.updateMany({ where: { id: { in: ids }, shopId: user.shopId }, data }),
      prisma.productHistory.createMany({
        data: ids.map((id) => ({
          productId: id,
          action: "UPDATED",
          to: "DRAFT",
          note: "Édition en masse",
          actorUserId: user.id,
        })),
      }),
    ]);

    revalidatePath("/products");
    return {};
  } catch (e) {
    console.error("bulkEditProductsAction:", e);
    return { error: "Erreur inattendue. Réessayez." };
  }
}

// Duplication d'un produit (pattern Jumia) : copie en brouillon, ouvre l'édition de la copie.
export async function duplicateProductAction(productId: string): Promise<void> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return;
    const copy = await duplicateProduct(user.shopId, productId);
    await logProductHistory({
      productId: copy.id,
      action: "CREATED",
      note: "Dupliqué depuis un produit existant",
      actorUserId: user.id,
    });
    revalidatePath("/products");
    redirect(`/products/${copy.id}/edit`);
  } catch (e) {
    console.error("duplicateProductAction:", e);
  }
}
