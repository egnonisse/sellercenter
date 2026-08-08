# Analyse — Seller Center Jumia (vendorcenter.jumia.com)

> Analyse de structure réalisée le 08/08/2026 par recon du portail (SSO, bundles JS Angular, config runtime, endpoints API).
> Source : compte vendeur actif, analyse statique du frontend (webpack/Module Federation) + tests d'accessibilité en direct des API.

## 1. Accès & authentification

| Élément | Valeur |
|---|---|
| Portail mondial | `https://vendorcenter.jumia.com` (SPA Angular) |
| SSO | Jumia Connect IdM — `auth-external.jumia.com` (OAuth2/OIDC) |
| Client OAuth | `vnc-ui` |
| Login | `POST /connect/vendor-center/login` — champs `id` (authRequestID), `username`, `password` |
| Échange du code | `POST api-acl-vendor.jumia.com/auth/sso/code` — nécessite Basic auth client (`client_id:client_secret`), secret serveur non exposé |
| Logout | `GET /connect/end_session` |
| Compte | email vendeur dédié (voir gestionnaire de secrets de LEO — pas de mot de passe dans ce fichier) |
| Pays (13) | DZ, CM, EG, GH, **CI → `https://sellercenter.jumia.ci`**, KE, MA, NG, SN, TZ, TN, UG, ZA |

### Flux d'authentification (reproduit en CLI, validé)
1. `GET /connect/vendor-center/login` → formulaire + `authRequestID`
2. `POST /connect/vendor-center/login` (id + username + password) → **302** vers `vendorcenter.jumia.com/sign-in?code=<CODE>`
3. Le code OAuth est échangé côté app via `POST api-acl-vendor.jumia.com/auth/sso/code` (Basic auth client `vnc-ui`) → token de session
4. Tokens stockés côté navigateur en **localStorage chiffré** (lib `secure-ls`)

## 2. Architecture frontend

SPA **Angular** (webpack 5, Module Federation) — un shell + 6 micro-frontends distants :

```
vendorcenter.jumia.com (shell : auth, dashboard, navigation, settings)
├── remote/orders-management      → Commandes
├── remote/products-management    → Produits
├── remote/promotions-subscriber  → Promotions
├── remote/account-statements     → Relevés financiers
├── remote/accounts-management    → Comptes utilisateurs
└── remote/vendor-settings        → Paramètres boutique
```

- Config runtime : `/assets/config/app-config.json` (URLs API, feature flags, pays, tracking)
- Manifest federation : `/assets/module-federation.manifest.json`
- i18n : `/assets/i18n/{lang}.json` (en/fr/ar)
- Stack : Angular Material, `secure-ls`, `ngx-infinite-scroll`, `file-saver`, `ng2-pdf-viewer`, `moment`, `class-transformer`
- Permissions RBAC par route : `AuthGuard` + permissions (`SETTINGS_READ`, `ACCOUNT_STATEMENTS_READ`, `SHOP_USERS_READ`, `BAR_ACCOUNT_PROFILE_READ`, `VENDOR_BATTLES_CAN_ACCESS`...)

### Pages par module (extraits des imports `@jumia-vnp/<domaine>/feature-*`)

| Module | Features |
|---|---|
| Commandes | feature-list, feature-details, feature-cancel, feature-ready-to-ship |
| Produits | category-selection, add-products, product-form, list, detail, feeds, consignment-create, consignment-list, consignment-inventory, consignment-details, consignment-export, return-order-list |
| Promotions | dashboard, list, details, join-promotion, monitoring, monitoring-grid, open-promotions, price-info, date-slots |
| Finances | account-statement feature-balance, feature-detail, feature-list, feature-export, feature-shell |
| Comptes | account-management feature-list, feature-detail |
| Boutique (shell) | currency-exchange, commissions/fees, manage-products, manage-pickers, holiday (jours fériés) |

## 3. Backend — microservices API

11 services REST, tous en ligne (testés 08/08/2026 — racines en 401/404 = actifs derrière auth) :

### aclApi — Auth/permissions
`https://api-acl-vendor.jumia.com`
- `POST /auth/sso/code` — échange code OAuth (Basic auth client)

### vcsApi — Commandes + transactions (Vendor Center Services)
`https://api-vcs-services.jumia.com`
- `/api/v2/orders` — liste
- `/api/v2/orders/{id}` — détail
- `/api/v2/orders/{id}/items/{itemId}`
- `/api/v2/orders/{id}/export`
- `/api/v2/orders/canceled`
- `/api/v2/orders/canceling-reasons`
- `/api/v2/orders/history`
- `/api/v2/orders/invoice/{id}`
- `/api/v2/orders/items/status-history/{id}`
- `/api/v2/orders/items/transactions/{id}`
- `/api/v2/orders/order-details`
- `/api/v2/orders/order-items-information`
- `/api/v2/orders/packages`
- `/api/v2/orders/pending/total`
- `/api/v2/orders/ready-to-ship`
- `/api/v2/orders/shipment-providers`
- `/api/v2/orders/shipping-label/{id}`
- `/api/v2/orders/statistics/total`
- `/api/v2/orders/stock-checklist`
- `/api/v2/orders/total-pending-last-seven-days`
- `/api/v2/orders/total-ready-to-ship`
- `/api/pickers`, `/api/pickers/{id}`, `/reset-password`, `/toggle-status`
- `/api/transactions/{country}/account-statements`, `/dashboards`, `/open`, `/exports`, `/exports/by-type`

### uvrApi — Comptes, utilisateurs, boutiques, paiements (User/Vendor Relations)
`https://api-uvr-services.jumia.com`
- `/api/authentication/login`, `/login/swap`, `/logout`
- `/api/v1/master-shops/{shopSid}`
- `/api/vendors/v2/shops`, `/api/vendors/v2/shops/{id}`, `/fees`, `/fees/categories`, `/holiday`, `/holiday/{id}`, `/sponsored-products/login`
- `/api/vendors/shops/{id}/users/{uid}`, `/settleable-status`, `/status`
- `/api/vendors/shop-settings/template`
- `/api/v3/users`, `/api/v3/users/{id}/activate`, `/deactivate`
- `/api/v2/users/{id}/sync`, `/updateCanReceiveOrderReport`, `/updateMasterShopAccess`, `/cache/{id}/clear`, `/logout`
- `/api/{version}applications`, `/api/{version}applications/{id}`, `/api/{version}applications/{id}/token` — **tokens API d'intégration tierce**
- `/api/shop-kpi/{id}/business-metrics`, `/seller-score-kpis`
- `/api/arrow/agent-payment-providers*`, `/banks/{country}`, `/branches`, `/payment-methods`, `/payment-provider-attributes`, `/payoneer/payee-status`, `/attachments`
- `/api/currency/fxRate`
- `/api/selfsignup/*` (ip-country, locations, shippingZones, validation email/shop)

### pimApi — Produits / catalogue (Product Information Management)
`https://api-pim-services.jumia.com`
- `/api/products` — CRUD, `/api/products/{id}`
- `/api/products/{id}/content/sync`, `/creation/sync`, `/delist/sync`, `/price/sync`, `/qc/sync`, `/status/sync`, `/gpc/{id}/sync/{country}`
- `/api/products/{id}/sellercenter/{sellerSid}/reconciliation`
- `/api/products/attributes-set/{id}`, `/catalog-information/`, `/categories/{id}`
- `/api/products/country`, `/country/{sid}/{id}`, `/country/bulk-update-status`, `/country/delist-status/export`, `/country/status/export`, `/country/update-status`
- `/api/products/export`, `/api/products/total`, `/total-qc-rejected`
- `/api/products/price/{r}`, `/retention/pending-deletion/summary`
- `/api/products/kpi/getProductKpis`
- `/api/products/template/create`, `/template/update`
- `/api/categories`, `/categories/{id}/children`, `/categories/most-used/{id}`, `/categories/search`, `/categories/sid/{id}`
- `/api/category-recommendations`
- `/api/attributes/`, `/attributes/{id}/options`, `/attributes/visible`
- `/api/brands`, `/api/brands/export`
- `/api/businessclients`, `/businessclients/{id}/languages`
- `/api/product-catalog`, `/api/product-set`, `/api/product-image/upload`

### stockApi — Stock
`https://api-stock-services.jumia.com`
- `/api/stock`
- `/api/products/{id}/stock/history?size=&page=&sort=createdAt,desc`
- `/api/products/{id}/stock/sync`
- `/api/products/stock?productSids=...`
- `/api/products/export`

### feedApi — Flux CSV / imports-exports
`https://api-feed-services.jumia.com`
- `/api/feeds/stockCsv`, `/priceCsv`, `/productCreation`, `/productUpdate`, `/productStatusCsv`
- `/api/feeds/seller`, `/api/feeds/shop`, `/api/feeds/shopCountryOrderLimitCsv`, `/api/feeds/shopDelistCsv`
- `/api/feeds/updateFinanceSettingsCsv`
- `/api/feeds/{type}/sync`
- `/api/feeds/promotionSubscribe`, `/promotionUnsubscribe`
- `/api/feeds/consignmentProductImport`, `/consignmentProductXlsx`, `/productXlsxStatus?promotionSid=&shopSid=`
- `/api/exports`

### promotionApi — Promotions
`https://api-promotion-services.jumia.com`
- `/api/promotions` (CRUD), `/api/promotions/{id}` (+ cancel, categories, batchUpdate, duplicate, submit, subscribe, upload-image)
- `/api/v2/promotions`, `/api/v2/promotions/{id}`
- `/api/promotions/{id}/restricted-sellers*` (list, export, history, seller-search, upload, upload-template, upload-history)
- `/api/promotions/subscribed/{id}*`, `/subsidy-products*`, `/active-promo-price`, `/promotion-categories`, `/businessclients`
- `/api/promotions/subscribe/template`, `/unsubscribe/template`
- `/api/promotion-slots/{id}`
- `/api/products-criteria/{id}`, `/count?promotionSid=`
- `/api/productPromotionKpi/*` (getProductKpis, getProductRevenue, export)

### consignmentApi — Consignation / dropshipping
`https://api-consignment-services.jumia.com`
- `/api/consignment-orders`, `/cancel`, `/return`, `/return/{id}`, `/return/{id}/products`
- `/api/consignment-order/{id}`, `/products/{id}`, `/statusHistory/{id}`, `/update/{id}`, `/{id}/products/stock`
- `/api/consignment/export`
- `/api/eligible/shop/{shopSid}/{country}`
- `/api/stock-details`, `/api/stock-details/exports`

### barApi — Onboarding / selfsignup / compte (Business Analytics Reporting)
`https://api-production-services.jumia.com/bar`
- `/api/account-information/{id}/gvc`, `/api/account/gvc/communication/{id}`, `/api/account/update`
- `/api/selfsignup/otp/verify`, `/validation/phone-number/{id}`, `/verify-email`, `/verify-phone`
- `/api/otp/generate-otp`, `/validate`, `/is-validated/{id}`
- `/api/partners?`, `/api/partner-questions?partnerSid=&country=`, `/api/questions/gvc?`
- `/api/file/upload`, `/api/file/download?fileKey=`
- `/api/local-representative`, `/preferred-status`

### pimQcApi — Contrôle qualité
`https://api-qc-services.jumia.com` (ciblé via `/api/products/{id}/qc/sync` côté PIM)

### battlesApi — Battles vendeurs
`https://api-production-services.jumia.com/battles` (gaming/concours vendeurs, feature flag `VENDOR_BATTLES_CAN_ACCESS`)

## 4. Concepts métier / modèle de données

- **Identifiants globaux (SIDs)** : `shopSid`, `sellerSid`, `productSid`, `promotionSid`, `businessclient` — utilisés dans toutes les URLs
- **Scoping pays** : `countryCode` (13 pays) dans quasi toutes les requêtes
- **Commande** : items, packages, facture (`invoice`), transporteurs (`shipment-providers`), historique de statuts (`status-history`), checklist stock
- **Produit** : prix, stock, QC (validation qualité), statuts (création, delist, sync), template (création massive), KPI, réconciliation
- **Promotion** : slots (créneaux), criteria (critères produits éligibles), restricted-sellers (exclusions), subsidy-products (subventions), monitoring (suivi perf)
- **Consignation** : mode dropshipping — commandes consignées, stock dédié (`stock-details`), retours dédiés
- **Paiements vendeur** : `arrow` (banques, branches, moyens de paiement, Payoneer, taux FX)

## 5. Points d'intégration utiles

1. **API tokens tierces** : `uvrApi /api/applications/{id}/token` — porte d'entrée officielle pour automatiser (produits, commandes, stock) depuis un système externe. Probablement à activer côté compte Jumia.
2. **Pattern CSV feeds** : Jumia importe/exporte le catalogue via CSV (stock, prix, création produit, statuts) — modèle robuste pour un portail vendeur.
3. **RBAC par permission** : garde de routes par permission nommée — architecture à répliquer dans le SellerCenter Zariamall.
4. **Micro-frontends + config runtime** : séparation shell/domaines + config déployée (`app-config.json`) — pattern pertinent pour un portail multi-modules.

## 6. Limites de l'analyse

- Pas de session API obtenue : l'échange du code OAuth exige le `client_secret` de l'app `vnc-ui` (jamais exposé au navigateur) → les endpoints n'ont pas été exercés avec un token valide.
- Les routes exactes du dashboard (sidebar) et certains chunks lazy des remotes n'ont pas tous été téléchargés.
- Feature flags observés : `dropShippingEnabled`, `vmBulkActionsEnabled`, `exportGlobalPrice`, `productDeleteEnabled`, `pricingModeEnabled` (False), `rolloutKeycloakEnabled` (False), `selfSignupV2Enabled` (True)...
