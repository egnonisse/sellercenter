// Envoi d'emails transactionnels via l'API Brevo.
// Sans BREVO_API_KEY dans l'environnement, l'email n'est pas envoyé : le contenu est loggé
// (permet de tester le flux d'invitation en local en récupérant le lien dans les logs).

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export type EmailResult = { sent: boolean; error?: string };

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM ?? "no-reply@zariamall.com";
  const fromName = process.env.EMAIL_FROM_NAME ?? "Zariamall SellerCenter";

  if (!apiKey) {
    console.warn(
      `[email] BREVO_API_KEY absente — email NON envoyé à ${input.to} (sujet : ${input.subject})`,
    );
    return { sent: false, error: "BREVO_API_KEY absente" };
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: from, name: fromName },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        ...(input.replyTo ? { replyTo: { email: input.replyTo } } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Brevo:", res.status, body.slice(0, 300));
      // Message d'erreur lisible (ex : expéditeur non validé dans Brevo)
      let detail = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(body) as { message?: string; code?: string };
        if (parsed.message) detail = parsed.message;
      } catch {
        // corps non JSON : on garde le code HTTP
      }
      return { sent: false, error: detail };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email]", e);
    return { sent: false, error: "Erreur réseau" };
  }
}
