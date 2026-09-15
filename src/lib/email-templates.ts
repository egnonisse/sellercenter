// Templates d'emails transactionnels du SellerCenter.

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Administrateur",
  KAM: "Chargé de comptes (KAM)",
  SHOP_ADMIN: "Responsable de boutique",
  SHOP_MANAGER: "Employé de boutique",
};

export function invitationEmail(params: {
  role: string;
  shopName?: string | null;
  inviteUrl: string;
  expiresAt: Date;
  invitedByEmail: string;
}): { subject: string; html: string } {
  const roleLabel = ROLE_LABEL[params.role] ?? params.role;
  const scope = params.shopName ? ` pour la boutique « ${params.shopName} »` : "";
  const subject = `Zariamall — votre accès ${roleLabel}`;
  const expires = params.expiresAt.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f7f7f7;font-family:Poppins,Segoe UI,Roboto,Arial,sans-serif;color:#000">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:5px;overflow:hidden">
    <div style="background:#ff3e2a;padding:20px 24px;color:#fff">
      <div style="font-size:18px;font-weight:700">Zariamall SellerCenter</div>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 16px">Bonjour,</p>
      <p style="margin:0 0 16px">
        <strong>${params.invitedByEmail}</strong> vous a créé un accès <strong>${roleLabel}</strong>${scope}
        sur le portail vendeurs Zariamall.
      </p>
      <p style="margin:0 0 24px">Cliquez sur le bouton ci-dessous pour définir votre mot de passe et activer votre compte :</p>
      <p style="margin:0 0 24px;text-align:center">
        <a href="${params.inviteUrl}" style="display:inline-block;background:#ff3e2a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:5px;font-weight:600">
          Définir mon mot de passe
        </a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#767676">
        Ce lien est valable jusqu'au <strong>${expires}</strong> et ne peut être utilisé qu'une seule fois.
      </p>
      <p style="margin:0;font-size:12px;color:#767676;word-break:break-all">
        Si le bouton ne fonctionne pas, copiez ce lien :<br>${params.inviteUrl}
      </p>
    </div>
    <div style="padding:16px 24px;background:#f7f7f7;font-size:12px;color:#767676">
      Zariamall — portail vendeurs. Si vous n'êtes pas concerné, ignorez cet email.
    </div>
  </div>
</body></html>`;

  return { subject, html };
}
