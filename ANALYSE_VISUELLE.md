# Analyse visuelle & fonctionnelle — Seller Center Jumia

> Analyse UI/UX du portail vendorcenter.jumia.com — établie le 09/08/2026 à partir des fichiers de traduction i18n officiels (`/assets/i18n/fr.json` du shell + de chaque micro-frontend) et des bundles JS. Complète l'analyse technique (ANALYSE.md).
> Source : ~2 900 chaînes UI en français extraites (shell 1 147, produits 654, promotions 205, commandes 173, paramètres 170, relevés 40).

## 1. Menu principal (navigation latérale)

```
Home
├── Commandes
├── Produits
│   ├── Gérer vos produits        (liste produits)
│   ├── Ajouter des produits      (formulaire)
│   └── Demandes de retours
├── Livré par Jumia               (consignation / dropshipping)
│   ├── Inventaire à l'entrepôt Jumia
│   ├── Commandes en consignation
│   └── Créer une commande en consignation
├── Promotions
├── Recommandation de Stock
├── Promouvoir vos produits       (Sponsored Products)
├── Relevés de compte
├── Business Account Management
├── Profil
├── Paramètres
└── (footer) Choisir une boutique · Donnez-nous votre avis ! · Se déconnecter
```

**Boutons génériques (shell/buttons)** : Appliquer · Retour · Annuler · Choisir · Tout effacer · Fermer · Confirmer · Continuer · Créer · Supprimer · Terminé · Télécharger · Modifier · Exporter · Importer · **IMPORTER / EXPORTER** · Suivant · Ok · Poursuivre · Enlever · Réinitialiser · Sauvegarder · Soumettre · Mettre à jour · Vérifier · Renvoyer OTP · Oui, je suis sûr · Oui, continuer

## 2. Produits — Gérer vos produits (page principale)

| Élément | Détails i18n |
|---|---|
| Titre | « Gestion des produits » |
| Boutons header | `Ajouter un produit +` · `IMPORTER / EXPORTER` · `Gérer les colonnes` |
| Filtres statut (pills) | Tous · En attente de vérification · Pas prêt pour la vérification · Approuvé · Rejeté · Inactif · Désactivé · Supprimé · Non autorisé · Suppression en attente |
| Recherche | « Rechercher par nom de produit » + filtre **Pays** |
| Actions groupées | Sélectionner des éléments → **Activer** · **Plus d'actions** |
| Colonnes tableau | Nom · **SKU du vendeur** · Prix · Prix de vente · **Prix de subvention** · Visible · Actif · Actions |
| Champs produit | name · category · brand · **sellerSKU** · **parentSKU** · productSid · **barcodeEAN / gtinBarcode** · color · size · quantity · price · salePrice · promoPrice · **subsidyPrice** · **globalPrice** · salePeriod (saleStartDate/saleEndDate) · selectCountries |
| Cycle de vie | DRAFT → PENDING_QC → APPROVED/REJECTED → ACTIVE/DISABLED → DELETED ; **delist** (delistReason, delistDate, delistComment) ; **retention** (suppression en attente : deletionDate, deletionUser) |
| Statuts détaillés | pending · completed · failed · inProgress · finished (pour imports/exports) |
| Notes QC | approvedDate · rejectionDate · rejectionComment · rejectionReasons |

### Sous-modules produits
- **Ajouter des produits** (addEditproduct, 56 clés) : formulaire complet multi-étapes
- **Détails produit** (details, 72 clés) : fiche avec historique (createdAt, updatedAt, createdBy, user)
- **Spécifications** (productSpecification, 28 clés) : specs techniques par catégorie
- **Feeds / Import-Export** (feeds, 45 clés) : dropYourFileHere, importHistory, updateImportHistory, téléchargement rapports, traitement en cours (inProgress, progress)
- **Consignation** (consignments 52 + createConsignment 20 + consignmentExport 11) : commandes consignées, export, statuts
- **Inventaire entrepôt Jumia** (inventory, 51 clés) : stock FBJ
- **Édition en masse** : bulkEditPrices · bulkSetSaleDate · setBulkSaleDate · variantsSelected
- **Demandes de retours** (returnOrders)

## 3. Commandes (173 clés)

| Élément | Détails |
|---|---|
| Recherche | `searchByOrderNumber` · `searchBySellerSku` · filtre Pays |
| Filtres | applyFilters · clearFilters · resetFilters · `dateChips` (8 options) · customRange · startDate · endDate · statuts (`statusOptions`, 8) |
| Actions | `orderActionsOptions` (5) · `export` (18 clés : exportAll, exportSelected, exportLabel, processingExport, downloadAllTransactions) |
| Export | Exportation des transactions · Exportation toutes les transactions |
| Détail commande (43 clés) | orderNumber · product · sellerSku · price · currencyLocal/Usd · paymentMethod (prepaid/postpaid) · shipmentMethod · shipmentTypes (3) · shippingInformation · sendTo · packedItems · pendingSince · orderDate · updatedDate |
| Étiquettes / facture | invoice · labels · printed · notPrinted |
| Annulation | cancelPopup (8 clés) |
| Prêt à expédier | readyToShipPopup (17 clés) |
| Vide | noOrdersMsg · nItemsSelected · selected · clickToChoose |

## 4. Promotions (205 clés)

| Élément | Détails |
|---|---|
| Page | promotionsManagement · `joinPromotionSection` (86 clés — cœur) |
| Types | flashSale · storeDiscount · productLevelDiscount · jumiaCampaigns |
| Recherche/filtres | searchByPromotionName · promotionName · promotionType · country · dateSlot · status |
| Inscription | joinPromotion · registration · registered / notRegistered · eligible / notEligible · insertDiscount · minDiscount / maxDiscount · promoPrice · promoStock · currentStockAsPromoStock · productsSubmittedSuccessfully |
| Monitoring | monitorPromotions · promotionsRevenue · revenueFromPromotions · totalSalesFromPromotions · topContributors · pageViews · itemsSold · uplift · averageBeforeCampaign · highlightProducts · viewSubmittedProducts · viewSelectedItems |
| Statuts promo | draft · open · ongoing · expired · cancelled · idle · repleted |
| Actions | view · viewAll · storeDiscount · promotionCategories |

## 5. Paramètres (170 clés)

| Section | Détails |
|---|---|
| **Utilisateurs** (usersManagement, 43) | rôles, permissions boutique |
| **Applications API** (applicationsManagement, 29) | tokens d'intégration |
| **Pickers** (pickerManagement, 16) | préparateurs de commandes |
| **Activation boutique** (shopActivationStatus, 12) | statut d'activation |
| **Mode vacances** (holidayModeManagement, 11) | pause boutique |
| **Limites catalogue** (limitCatalog, 10) | seuils produits |
| **Devises** (currencyManagement, 11) | gestion devises |
| **Commissions & frais** (commissionsManagement 4 + fees 7) | taux par catégorie |
| Sous-titres | sellerSettings · platformSettings · settingsPage · anySettingSelected |

## 6. Relevés de compte (40 clés)

balanceType (3) · currencies (2) · dueDateError (7) · exportPopup (8 : exportTable, choix période) · list (7) · statusOptions (5) · title

## 7. Home / Dashboard (66 clés)

- **Recommandation de Stock** (stockRecommendation, 50) : suggestions de réapprovisionnement
- **Promouvoir vos produits** (advertiseYourProduct, 24) : sponsored products (campagnes self-service, boostSales, increaseYourVisibility, showcaseProducts, haveCompleteControl, chooseYourShop/country)

## 8. Profil & inscription (751 clés combinées)

- **Profil** (profile, 504) : compte, adresses, préférences, OTP, sécurité
- **Inscription vendeur** (selfSignUp, 247) : parcours complet (email, téléphone, boutique, vérification OTP, renvoyer code)

## 9. Ce qu'on a déjà dans notre SellerCenter vs Jumia

| Fonctionnalité | Jumia | Nous |
|---|---|---|
| Menu latéral modules | ✅ | ✅ (Produits, Commandes actifs ; Promotions, Finances, Paramètres en attente) |
| Filtres statut + recherche | ✅ | ✅ (ajouté 09/08) |
| Bulk actions | ✅ Activer/Plus d'actions | ✅ Soumettre/Retirer |
| Import/Export CSV | ✅ feeds | ✅ |
| **SKU vendeur** | ✅ | ❌ |
| **Prix de vente / promo / subvention** | ✅ | ⚠️ price + compareAtPrice seulement |
| **Gérer les colonnes** | ✅ | ❌ |
| **Retours produits** | ✅ | ❌ |
| **Consignation (Livré par Jumia)** | ✅ | ❌ (backlog) |
| **Recommandation de stock** | ✅ | ❌ |
| **Sponsored products** | ✅ | ❌ |
| **Commissions par catégorie** | ✅ | ⚠️ champ commissionRate prévu |
| **Users boutique + rôles** | ✅ | ⚠️ RBAC simple (SHOP_ADMIN/MANAGER) |
| **API applications (tokens)** | ✅ | ❌ (prévu phase 5) |
| **Mode vacances** | ✅ | ❌ |
| **Pickers** | ✅ | ❌ |
