# SellerCenter Zariamall — Plan de conception

> Statut : v1.1 (08/08/2026) — décisions validées : marketplace **multi-vendeurs**, architecture **base centrale** (Option B), WooCommerce = front public synchronisé, self-signup ouvert + activation LEO, commission % par catégorie, payouts via API Mobile Money.
> Référence structurelle : ANALYSE.md (Seller Center Jumia).

## 1. Vision

Zariamall devient un **marketplace multi-vendeurs** en Côte d'Ivoire. Les vendeurs tiers s'inscrivent sur le SellerCenter, gèrent leurs produits/commandes/stock, et le front public (zariamall.com, WooCommerce) reste le shop visible par les clients. Le bot WhatsApp Zariamall continue de fonctionner sans changement.

## 2. Architecture cible

```
┌─────────────────────────── Vercel ───────────────────────────┐
│  SellerCenter (Next.js 14, App Router)                       │
│  ┌─────────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐  │
│  │ Web (vendeurs│ │ API      │ │ Worker    │ │ Webhook     │  │
│  │ + admin LEO)│ │ routes   │ │ cron sync │ │ WooCommerce  │  │
│  └──────┬──────┘ └────┬─────┘ └─────┬─────┘ └──────┬──────┘  │
│         │             │             │              │          │
│         └─────────────┼─────────────┼──────────────┘          │
│                  PostgreSQL (Neon)                            │
│                  Prisma ORM                                   │
└───────────────────────────────────────────────────────────────┘
         │ REST API (WooCommerce, clé LEO)
         ▼
┌───────────────────────────────────────────────────────────────┐
│  zariamall.com (WooCommerce — front public + bot WhatsApp)    │
│  produits, stock, prix  ← poussés par le SellerCenter         │
│  commandes clients → webhooks vers SellerCenter               │
└───────────────────────────────────────────────────────────────┘
```

**Principes** :
- Le SellerCenter est **la source de vérité** du marketplace (vendeurs, produits, commandes).
- WooCommerce = vitrine + caisse : il reçoit les produits des vendeurs (création/maj/stock/prix) et envoie les commandes clients.
- Les vendeurs n'accèdent **jamais** à WooCommerce : tout passe par le SellerCenter (sécurité + isolation).
- Le mapping WooCommerce est une simple colonne `wooId` sur les produits/commandes.
- Un produit = un vendeur (pas de stock partagé au MVP).

## 3. Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) | Déjà validé (IDEA.md), SSR, déploiement Vercel natif |
| ORM | Prisma | Typage, migrations, adapté PostgreSQL |
| Base de données | PostgreSQL — Neon (plan gratuit) | Natif Vercel, sans serveur à gérer |
| Auth | NextAuth (Auth.js) credentials + JWT | Simple, rôles custom |
| UI | TailwindCSS + shadcn/ui (thème Vercel monochrome) | Cohérent avec le dashboard bot |
| Validation | Zod | Validation entrées partout |
| Client WooCommerce | REST API officielle (woocommerce/woocommerce-rest-api) | ~1900 produits déjà accessibles |
| Worker sync | Vercel Cron + route API interne | Sync produits/stock périodique |
| Webhook commandes | Route API publique + vérification signature WC | Remontée commandes en temps réel |
| Tests | Vitest (services critiques : commissions, sync, RBAC) | Ciblé, pas de test excessif |

## 4. Modèle de données (entités principales)

```
sellers ─┬─< shops (1..n)              # un vendeur peut avoir plusieurs boutiques
shops ───┬─< shop_users                # users avec rôle (admin/manager/agent)
users ───┴─< sessions / refresh tokens
shops ───┬─< products                  # product.wooId → WooCommerce
         ├─< categories (arborescence, parent_id, commissionRate)
         ├─< orders ──< order_items ──< products
         ├─< order_status_history
         ├─< promotions ──< promotion_products
         ├─< settlements ──< settlement_lines (commissions)
         ├─< payment_providers         # WAVE / ORANGE / MTN (config + état)
         └─< api_applications          # tokens d'intégration (pattern Jumia)
```

**Détail des tables clés** :

| Table | Champs essentiels |
|---|---|
| `sellers` | id, name, email, phone, country (CI), status (pending/active/suspended), createdAt |
| `shops` | id, sellerId, name, slug, logoUrl, description, status |
| `users` | id, email, passwordHash, role (SUPER_ADMIN / SHOP_ADMIN / SHOP_MANAGER), shopId?, status |
| `products` | id, shopId, wooId, name, slug, description, categoryId, brand, price, compareAtPrice, stockQty, status (draft/pending_qc/active/rejected/delisted), qcNote, images (json), attributes (json) |
| `categories` | id, parentId, name, slug, wooId, commissionRate (%) — nullable : hérite du parent, défaut global sinon |
| `orders` | id, wooId, shopId, customerName, phone, address, itemsTotal, shippingFee, total, status (pending/ready_to_ship/shipped/delivered/cancelled), paymentMethod, createdAt |
| `order_items` | id, orderId, productId, name, qty, unitPrice, total |
| `order_status_history` | id, orderId, from, to, actorUserId, note, createdAt |
| `promotions` | id, shopId, name, type (percentage/fixed), value, startAt, endAt, status, products (via promotion_products) |
| `settlements` | id, shopId, periodStart, periodEnd, grossSales, commission (calculée par catégorie), netPayable, status (open/processing/paid/failed), payoutRef, paidAt |
| `payment_providers` | id, name (WAVE/ORANGE/MTN), enabled, config (json chiffré : apiKey, secret...), createdAt |
| `api_applications` | id, shopId, name, tokenHash, scopes (products.read, orders.read...), lastUsedAt |

**RBAC (calqué Jumia)** :
- `SUPER_ADMIN` (LEO) : tout — boutiques, vendeurs, commissions, validation QC, payouts
- `SHOP_ADMIN` (vendeur) : sa boutique — produits, commandes, promotions, relevés
- `SHOP_MANAGER` : produits + commandes, pas les finances
- Chaque route et chaque action API est gardée par permission (pattern `AuthGuard` + permission Jumia)

## 5. Modules fonctionnels (calqués sur l'analyse Jumia)

| Module | Pages | Équivalent Jumia |
|---|---|---|
| **Auth & onboarding** | login, inscription vendeur (self-signup + validation email/OTP), activation par LEO | barApi selfsignup + uvrApi |
| **Dashboard** | KPIs vendeur (ventes, commandes en attente, stock faible), graphiques | shop-kpi/business-metrics |
| **Produits** | liste, détail, formulaire (ajout/édition), catégories, stock, QC (approbation par LEO), export/import CSV | products-management + pimApi + feedApi |
| **Commandes** | liste, détail, items, statuts (prêt à expédier → expédiée → livrée), annulation, historique | orders-management + vcsApi |
| **Promotions** | création promo (%, fixe), sélection produits, créneaux, suivi | promotions-subscriber |
| **Finances** | solde, relevés, commissions par catégorie, exports, payouts auto (Wave/Orange) via `PaymentProvider` | account-statements |
| **Boutique/Comptes** | profil boutique, frais, utilisateurs de la boutique, API applications (tokens) | accounts-management + vendor-settings |

## 6. Sync WooCommerce (flux)

**SellerCenter → WooCommerce** (worker cron, toutes les 5-15 min + à la demande) :
- Produit créé/modifié côté SellerCenter → `POST/PUT /wp-json/wc/v3/products` (avec meta `_zariamall_shop_id`)
- Stock/prix mis à jour → `PUT /products/{wooId}` (+ `/products/{wooId}/stock` si besoin)
- Delist → `POST /products/{wooId}` status private
- Image upload → URL distante (Vercel Blob) ou base64

**WooCommerce → SellerCenter** (webhooks) :
- `order.created` / `order.updated` → `POST /api/webhooks/woocommerce` (vérifier `X-WC-Webhook-Signature` avec le secret)
- Échec webhook → fallback : cron de polling des commandes récentes (diff WooCommerce vs table orders)

**Catalogue existant** (~1900 produits) : import initial → LEO les assigne à sa boutique Zariamall (shop par défaut). Les produits restent visibles sur le front.

## 7. Planning par phases (jalons)

| Phase | Contenu | Sortie |
|---|---|---|
| **0. Fondations** | Repo Next.js, Prisma + Neon, schéma DB, NextAuth, RBAC, layout shadcn | App qui boote, login super-admin |
| **1. Vendeurs + Produits (MVP)** | Inscription vendeur, validation LEO, boutique, CRUD produits, catégories, stock, export/import CSV, QC simple, sync produits → WooCommerce | Un vendeur crée ses produits → visibles sur zariamall.com |
| **2. Commandes** | Webhook WC, liste/détail commandes par boutique, statuts, prêt à expédier, annulation, historique | Suivi commandes multi-vendeurs |
| **3. Promotions** | Création promos, sélection produits, suivi | Réductions sur produits vendeurs |
| **4. Finances** | Commissions par catégorie, relevés, exports, interface `PaymentProvider` + implémentation Wave/Orange (API business), statuts payout | Payouts automatiques vers les vendeurs |
| **5. Comptes & API** | Users de boutique, permissions fines, API applications (tokens) | Intégrations tierces possibles |

**Ordre recommandé** : Phases 0 → 1 → 2 d'abord (cœur du business). 3-5 ensuite selon besoins.

## 8. Décisions validées (08/08/2026)

1. ✅ **Inscription vendeurs** : self-signup ouvert + activation manuelle par LEO (statut pending → active).
2. ✅ **Commissions** : % par catégorie (`categories.commissionRate`, héritage parent, défaut global). Ex : 5 % électronique, 12 % mode.
3. ✅ **Paiement vendeurs** : API Mobile Money (Wave/Orange) — abstraction `PaymentProvider` (interface `sendPayout / verifyPayout / getBalance`) ; implémentation en phase 4, nécessite comptes API business des opérateurs (à ouvrir par LEO). Fallback MVP : statut manuel.
4. ⏳ **Ouverture publique** : par défaut, lancement privé (vendeurs invités pendant le test des phases 1-2), puis public après validation. À confirmer.
5. ⏳ **Langue** : par défaut français uniquement. À confirmer.

## 9. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Sync bidirectionnelle lente/fragile | Webhook + cron de secours, colonnes `syncStatus`/`lastSyncedAt` |
| SSL cassé zariamall.com (verify=False) | Utiliser le client REST avec options désactivées de vérification (déjà éprouvé par le bot) |
| Un vendeur accède aux produits d'un autre | Isolation stricte côté API : toutes les requêtes filtrées par `shopId` du token ; jamais d'accès direct WooCommerce pour les vendeurs |
| Stock en double / rupture | Stock géré uniquement côté SellerCenter, poussé vers WC (pas de modification WC manuelle hors SellerCenter) |
| Perte de données marketplace | Neon backups, migrations Prisma versionnées, exports CSV |

## 10. Definition of Done (rappel SOUL.md)

Chaque phase est terminée quand : le besoin est satisfait, le code compile, les tests critiques passent, les logs sont propres, la doc est à jour, et les performances/sécurité vérifiées.
