# SellerCenter — Marketplace multi-vendeurs

> Back-office complet pour une marketplace ivoirienne : les vendeurs gèrent leurs produits, commandes et revenus depuis une interface unique, pendant que le front public (WooCommerce) reste synchronisé automatiquement.

**Projet réel, en production** — Zariamall (Côte d'Ivoire).

---

## Le problème

Faire passer une boutique WooCommerce en **marketplace multi-vendeurs** impose de traiter des sujets que WooCommerce ne gère pas nativement :

- **Qui voit quoi** — un vendeur ne doit accéder qu'à ses produits, ses commandes, ses revenus
- **Qui gagne combien** — les commissions varient par catégorie, et le taux applicable doit être figé au moment de la vente
- **La synchronisation** — deux systèmes qui parlent des produits et des commandes en parallèle
- **La modération** — rien ne se publie sur le site sans validation

Ce dépôt est la réponse complète à ces quatre problèmes.

---

## Fonctionnalités

### 🔐 Contrôle d'accès granulaire (RBAC)

| Rôle | Portée |
|---|---|
| **Super Admin** | Administration complète, validation des vendeurs, configuration des commissions |
| **KAM** | Supervision d'un *portefeuille* de boutiques, avec cloisonnement strict |
| **Shop Admin** | Un vendeur : ses produits, ses commandes, ses finances |
| **Shop Manager** | Personnel du vendeur, droits restreints |

Les permissions sont **configurables** par rôle (table `RolePermission`), chargées dans le JWT à la connexion, et **re-vérifiées en base** pour les actions sensibles (modération, suspension, approbation, synchronisation, finances) — un jeton volé ne suffit donc pas à contourner un droit retiré.

### 💰 Commissions et relevés de paiement

- Taux **par catégorie**, avec héritage : catégorie → catégorie parente → défaut global
- **Gel du taux à la vente** : `OrderItem.commissionRate` est capturé au moment de la commande. Modifier une commission demain ne réécrit jamais le passé.
- Génération de **relevés** (`Settlement`) par période, avec détail par ligne de commande
- Vue administrateur en arbre, avec taux effectif calculé à chaque niveau

### 🛒 Produits et modération

- Création, édition, import/export **CSV**
- Upload d'images (Vercel Blob)
- Cycle de validation : *brouillon → en attente → approuvé / rejeté*, avec motif
- Notifications automatiques au vendeur

### 🔄 Synchronisation WooCommerce

- Import/export **idempotent des catégories** — deux passes (parents puis enfants), jamais de doublon, jamais de suppression
- **Webhooks signés HMAC-SHA256** sur `order.created` et `order.updated`
- Historique des synchronisations visible côté vendeur

### 📊 Espaces vendeur

Commandes · Finances et relevés · Promotions (% ou montant fixe) · Notifications · Réglages boutique (dont **mode vacances**) · Tableau de bord

---

## Architecture

```
┌──────────────────────────── Vercel ────────────────────────────┐
│  SellerCenter — Next.js (App Router)                           │
│                                                                │
│  ┌──────────────┐  ┌────────────┐  ┌───────────┐  ┌─────────┐  │
│  │  Interface   │  │ Routes API │  │  Cron     │  │ Webhook │  │
│  │  vendeurs    │  │ REST       │  │  de sync  │  │  Woo    │  │
│  │  + admin     │  │            │  │           │  │  signé  │  │
│  └───────┬──────┘  └──────┬─────┘  └─────┬─────┘  └────┬────┘  │
│          └────────────────┴──────────────┴─────────────┘       │
└───────────────────────────────┬────────────────────────────────┘
                                │
                   ┌────────────▼─────────────┐
                   │  PostgreSQL (Neon)       │
                   │  Prisma ORM              │
                   └────────────┬─────────────┘
                                │  synchronisation
                   ┌────────────▼─────────────┐
                   │  WooCommerce public      │
                   │  zariamall.com           │
                   └──────────────────────────┘
```

---

## Stack technique

| Domaine | Technologie |
|---|---|
| Framework | **Next.js 15** (App Router) · React 19 |
| Langage | **TypeScript 5** |
| Base de données | **PostgreSQL** (Neon) · **Prisma 7** + adapter `pg` |
| Authentification | **NextAuth v5** (credentials, JWT) |
| Interface | **Tailwind CSS 4** · shadcn · lucide-react |
| Validation | **Zod 4** |
| Fichiers | Vercel Blob |
| Intégration | API REST WooCommerce · webhooks signés |
| Déploiement | **Vercel** (CI/CD) |

---

## Décisions d'ingénierie

**Pourquoi geler le taux de commission à la vente ?**
Parce qu'un taux est une donnée *historique*, pas une donnée *courante*. Un vendeur qui conteste un relevé doit pouvoir consulter le taux qui s'appliquait réellement le jour de la vente, même si la grille a changé depuis trois fois.

**Pourquoi re-vérifier les permissions en base pour certaines actions ?**
Les permissions voyagent dans le JWT (8 h) pour rester rapides au quotidien. Mais une révocation de droits doit être effective **immédiatement** sur les actions sensibles. Le jeton sert au confort, la base sert à la vérité.

**Pourquoi une synchronisation de catégories sans suppression ?**
Supprimer une catégorie WooCommerce casse les produits qui la référencent. La synchronisation ne fait que créer et mettre à jour — jamais détruire. L'opération est idempotente et peut donc être rejouée sans risque.

**Pourquoi WooCommerce comme front public ?**
Parce que le catalogue, le référencement et le tunnel d'achat existants fonctionnent déjà. Le SellerCenter apporte la couche marketplace **sans réécrire** ce qui marche.

---

## Démarrage

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env
# renseigner DATABASE_URL, AUTH_SECRET, les clés WooCommerce…

# 3. Base de données
npx prisma migrate deploy
npm run db:seed

# 4. Lancer
npm run dev
```

### Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Migration Prisma |
| `npm run db:seed` | Données initiales (rôles, permissions) |

---

## Structure

```
src/
├── app/
│   ├── (dashboard)/       # Espaces vendeur et admin
│   ├── api/               # Routes API (produits, finances, webhooks…)
│   └── login/ register/ set-password/
├── components/
│   ├── admin/             # Modération, commissions, rôles
│   ├── products/          # Catalogue vendeur
│   ├── team/              # Gestion des utilisateurs
│   └── ui/                # Design system
├── lib/                   # RBAC, commissions, synchronisation, sécurité
├── types/
└── generated/prisma/      # Client Prisma
prisma/
├── schema.prisma
└── migrations/
```

---

## Sécurité

- Mots de passe **hachés** (bcrypt)
- **Limitation du débit** sur les tentatives de connexion (anti-force brute), persistée en base
- Comparaison de jetons en **temps constant** (protection contre les attaques temporelles)
- **Validation du type MIME** des fichiers téléversés
- Webhooks **signés** (HMAC-SHA256) et vérifiés
- Aucun secret dans le dépôt — `.env` exclu, `.env.example` fourni

---

## Contexte

Développé pour **Zariamall** (Côte d'Ivoire), en production. Le projet s'intègre à un écosystème existant : bot WhatsApp de vente (catalogue synchronisé), boutique WooCommerce, et un front public conservé pour sa visibilité.

---

**Egnonisse Léonard** — Abidjan, Côte d'Ivoire
[github.com/egnonisse](https://github.com/egnonisse) · [softhubapp.com](https://softhubapp.com)
