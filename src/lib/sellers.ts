import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

// Validation des entrées d'inscription
export const sellerRegistrationSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(100),
  email: z.string().email("Email invalide"),
  phone: z.string().min(8, "Numéro de téléphone invalide").max(20),
  shopName: z.string().min(2, "Nom de boutique trop court").max(100),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum"),
});

export type SellerRegistration = z.infer<typeof sellerRegistrationSchema>;

async function uniqueSlug(base: string): Promise<string> {
  const root = base || "boutique";
  const existing = await prisma.shop.findMany({
    where: { slug: { startsWith: root } },
    select: { slug: true },
  });
  if (!existing.some((s) => s.slug === root)) return root;
  return `${root}-${existing.length + 1}`;
}

// Crée Seller (PENDING) + Shop (PENDING) + User (SHOP_ADMIN) en une transaction.
export async function createSellerWithShop(input: SellerRegistration) {
  const data = sellerRegistrationSchema.parse(input);
  const email = data.email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("EMAIL_EXISTE");

  const slug = await uniqueSlug(slugify(data.shopName));

  return prisma.$transaction(async (tx) => {
    const seller = await tx.seller.create({
      data: { name: data.name, email, phone: data.phone, status: "PENDING" },
    });
    const shop = await tx.shop.create({
      data: { sellerId: seller.id, name: data.shopName, slug, status: "PENDING" },
    });
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: "SHOP_ADMIN",
        shopId: shop.id,
        status: "ACTIVE",
      },
    });
    return { seller, shop, user };
  });
}

// Approbation par le super admin : seller + shop + user passent en ACTIVE.
export async function approveSeller(sellerId: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    include: { shops: true },
  });
  if (!seller) throw new Error("Vendeur introuvable");

  await prisma.$transaction([
    prisma.seller.update({ where: { id: sellerId }, data: { status: "ACTIVE" } }),
    prisma.shop.updateMany({ where: { sellerId }, data: { status: "ACTIVE" } }),
    prisma.user.updateMany({ where: { email: seller.email }, data: { status: "ACTIVE" } }),
  ]);
}

// Rejet : seller SUSPENDED + user SUSPENDED (bloque le login).
export async function rejectSeller(sellerId: string) {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) throw new Error("Vendeur introuvable");

  await prisma.$transaction([
    prisma.seller.update({ where: { id: sellerId }, data: { status: "SUSPENDED" } }),
    prisma.shop.updateMany({ where: { sellerId }, data: { status: "SUSPENDED" } }),
    prisma.user.updateMany({ where: { email: seller.email }, data: { status: "SUSPENDED" } }),
  ]);
}
