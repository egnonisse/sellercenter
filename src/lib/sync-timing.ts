// ===================== Timing de la synchronisation WooCommerce =====================
// Le cron (vercel.json) pousse les produits approuvés à 03:00 UTC chaque jour.
// Ces helpers calculent le délai jusqu'au prochain créneau — recalculé à CHAQUE
// chargement de page (SSR), l'information est donc toujours à jour.

// Prochain créneau 03:00 UTC (aujourd'hui si pas encore passé, sinon demain)
export function nextSyncSlot(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(3, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

// Délai lisible jusqu'au prochain créneau : "~3h12" | "~12 min" | "~1j 3h"
export function formatSyncDelay(now = new Date()): string {
  const ms = nextSyncSlot(now).getTime() - now.getTime();
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  if (totalMinutes < 60) return `~${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h < 24) return `~${h}h${String(m).padStart(2, "0")}`;
  return `~${Math.floor(h / 24)}j ${h % 24}h`;
}
