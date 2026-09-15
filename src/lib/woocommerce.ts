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
  WP_USER: z.string().optional(),
  WP_APP_PASSWORD: z.string().optional(),
});

function getEnv() {
  return envSchema.parse({
    WOO_URL: process.env.WOO_URL,
    WOO_CONSUMER_KEY: process.env.WOO_CONSUMER_KEY,
    WOO_CONSUMER_SECRET: process.env.WOO_CONSUMER_SECRET,
    WP_USER: process.env.WP_USER,
    WP_APP_PASSWORD: process.env.WP_APP_PASSWORD,
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

// Liste TOUTES les catégories WooCommerce (pagination).
export async function wooListAllCategories(): Promise<{ id: number; name: string; slug: string; parent: number }[]> {
  const out: { id: number; name: string; slug: string; parent: number }[] = [];
  let page = 1;
  for (;;) {
    const data = await wooFetch((api) =>
      api.get("products/categories", { per_page: 100, page, hide_empty: false }),
    );
    const list = data as { id: number; name: string; slug: string; parent: number }[];
    if (list.length === 0) break;
    out.push(...list);
    if (list.length < 100) break;
    page++;
  }
  return out;
}

// Création d'une catégorie WooCommerce → retourne l'objet créé (avec id)
export async function wooCreateCategory(data: Record<string, unknown>): Promise<{ id: number }> {
  return wooFetch((api) => api.post("products/categories", data));
}

// Recherche d'une catégorie WooCommerce par slug (évite les doublons)
export async function wooGetCategoryBySlug(slug: string): Promise<{ id: number } | null> {
  const data = await wooFetch((api) => api.get("products/categories", { slug, per_page: 1 }));
  const list = data as { id: number }[];
  return list[0] ?? null;
}

// Mise à jour d'une catégorie WooCommerce par son id
export async function wooUpdateCategory(id: number, data: Record<string, unknown>): Promise<{ id: number }> {
  return wooFetch((api) => api.put(`products/categories/${id}`, data));
}

// ---------------------------------------------------------------------------
// WordPress (wp/v2) — pour les taxonomies hors WooCommerce (ex : product_brand)
// ---------------------------------------------------------------------------

// Fetch wp/v2 avec Basic auth (Application Password WP) — SSL cassé désactivé, UA navigateur.
export async function wooFetchWp<T>(path: string): Promise<T> {
  const env = getEnv();
  if (!env.WP_USER || !env.WP_APP_PASSWORD) {
    throw new Error("WP_USER / WP_APP_PASSWORD manquants (nécessaires pour wp/v2)");
  }
  const url = `${env.WOO_URL}/wp-json/wp/v2/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.WP_USER}:${env.WP_APP_PASSWORD}`).toString("base64")}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  if (!res.ok) throw new Error(`wp/v2 ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

// Marques (taxonomie product_brand) — pagination complète.
export async function wooListProductBrands(): Promise<{ id: number; name: string; slug: string }[]> {
  const out: { id: number; name: string; slug: string }[] = [];
  let page = 1;
  for (;;) {
    const data = await wooFetchWp<{ id: number; name: string; slug: string }[]>(
      `product_brand?per_page=100&page=${page}`,
    );
    if (data.length === 0) break;
    out.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return out;
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
