import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import https from "https";
import { z } from "zod";

// Client WooCommerce REST API pour la sync SellerCenter → zariamall.com
// SSL cassé sur zariamall.com → vérification TLS désactivée + follow_redirects
// (même config que le bot WhatsApp, éprouvée en production)

const envSchema = z.object({
  WOO_URL: z.string().url(),
  WOO_CONSUMER_KEY: z.string().min(3),
  WOO_CONSUMER_SECRET: z.string().min(3),
});

function getEnv() {
  return envSchema.parse({
    WOO_URL: process.env.WOO_URL,
    WOO_CONSUMER_KEY: process.env.WOO_CONSUMER_KEY,
    WOO_CONSUMER_SECRET: process.env.WOO_CONSUMER_SECRET,
  });
}

let cachedApi: WooCommerceRestApi | null = null;

export function getWooApi(): WooCommerceRestApi {
  if (cachedApi) return cachedApi;
  const env = getEnv();
  cachedApi = new WooCommerceRestApi({
    url: env.WOO_URL,
    consumerKey: env.WOO_CONSUMER_KEY,
    consumerSecret: env.WOO_CONSUMER_SECRET,
    version: "wc/v3",
    axiosConfig: {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      maxRedirects: 5,
      timeout: 30_000,
    },
  });
  return cachedApi;
}

// Réutilisable par les pages serveur : wrapper typé sur les appels fréquents.
export async function wooFetch<T>(fn: (api: WooCommerceRestApi) => Promise<{ data: T }>): Promise<T> {
  const res = await fn(getWooApi());
  return res.data;
}

export async function wooGetCategories(): Promise<unknown[]> {
  return wooFetch((api) => api.get("products/categories", { per_page: 100, page: 1 }));
}

// Création d'un produit sur WooCommerce → retourne l'objet créé (avec id)
export async function wooCreateProduct(data: Record<string, unknown>): Promise<{ id: number }> {
  return wooFetch((api) => api.post("products", data));
}

// Recherche d'un produit WooCommerce par slug (évite les doublons à la recréation)
export async function wooGetProductBySlug(slug: string): Promise<{ id: number } | null> {
  const data = await wooFetch((api) => api.get("products", { slug, per_page: 1 }));
  const list = data as { id: number }[];
  return list[0] ?? null;
}

// Mise à jour d'un produit WooCommerce par son id
export async function wooUpdateProduct(
  id: number,
  data: Record<string, unknown>,
): Promise<{ id: number }> {
  return wooFetch((api) => api.put(`products/${id}`, data));
}
