# Studio AI cu abonament (server)

Serverul care face Cadru Muzică vandabil: conturi, credite, abonamente și generări AI plătite (cu voce și versuri). Generatorul local din pagină rămâne gratuit și nelimitat pentru toată lumea; se plătesc doar generările AI, care costă și pe noi bani.

Rulează pe **Cloudflare Workers** (plan gratuit: 100.000 de cereri pe zi) cu baza de date **D1**. Cheile secrete stau doar pe server.

## Cum funcționează

1. Clientul intră cu e-mailul. Primește un link (prin Resend), îl deschide și rămâne conectat 60 de zile. Fără parole.
2. Primește 3 credite gratuite în fiecare lună. 1 credit = 1 minut de muzică AI.
3. Cumpără un plan prin Lemon Squeezy, care încasează, emite factura și plătește TVA-ul UE în locul tău (merchant of record).
4. Lemon Squeezy anunță serverul (webhook semnat), iar serverul adaugă creditele.
5. La „Generează cu AI”, serverul scade creditele, cere piesa de la ElevenLabs Music și o trimite înapoi. Dacă generarea eșuează, creditele se întorc automat.

| Plan | Preț propus | Credite | Lungime maximă |
|---|---|---|---|
| Gratuit | 0 € | 3 pe lună | 4 min |
| Creator | 5 € / lună | 40 pe lună | 4 min |
| Pro | 12 € / lună | 120 pe lună | 10 min |
| Pachet | 3 € o dată | 25, nu expiră | după plan |

Prețurile și creditele se schimbă în `worker.js` (`PLANS`, `PACK_CREDITS`) și în pagină (`PLANS` din `muzica/index.html`). Verifică marja: costul ElevenLabs pe minut depinde de planul tău la ei.

## Ce trebuie să faci tu (o singură dată)

1. **KvK**: înregistrează activitatea (eenmanszaak) înainte să încasezi bani. Lemon Squeezy cere date de firmă pentru plăți.
2. **Lemon Squeezy** (lemonsqueezy.com): fă un magazin și 3 produse: „Creator” (abonament lunar 5 €), „Pro” (abonament lunar 12 €), „Pachet credite” (plată unică 3 €). Copiază linkul de cumpărare al fiecăruia în `wrangler.toml` (`LS_CHECKOUT_*`).
   Apoi Settings › Webhooks: adresa `https://<serverul-tău>/webhook/lemonsqueezy`, un „signing secret” ales de tine, și bifează evenimentele `order_created`, `subscription_created`, `subscription_payment_success`, `subscription_expired`.
3. **ElevenLabs** (elevenlabs.io): cont cu plan care permite folosirea comercială a muzicii și o cheie API.
4. **Resend** (resend.com): cont gratuit, domeniul tău verificat, o cheie API. Pune adresa expeditorului în `MAIL_FROM`.
5. **Cloudflare**: cont gratuit, apoi în terminal:

```bash
cd muzica/server
npx wrangler login
npx wrangler d1 create cadru-muzica          # copiază database_id în wrangler.toml
npx wrangler d1 execute cadru-muzica --remote --file=schema.sql
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put LS_SIGNING_SECRET
npx wrangler deploy                          # îți arată adresa serverului
```

6. Pune adresa serverului în `wrangler.toml` (`API_URL`), adresa site-ului în `ALLOWED_ORIGINS`, apoi `npx wrangler deploy` din nou.
7. În `muzica/index.html`, completează `<meta name="cm-api" content="https://adresa-serverului">`. De acum Studio AI apare activ în pagină.

## Test local (fără conturi)

```bash
node test.mjs
```

Imită baza de date, e-mailul și ElevenLabs și verifică: intrarea cu link (o singură folosire, doar pe site-urile permise), creditele, limita de lungime pe plan, returnarea creditelor la eroare, linkul de plată, semnătura webhook-ului, evenimentele duplicate și expirarea abonamentului.

## De știut

- **Legal**: ai nevoie de termeni și condiții și de o politică de confidențialitate (GDPR) pe site. Stocăm doar e-mailul, planul, creditele și descrierile cerute.
- **Drepturi**: ce generează ElevenLabs pe un plan plătit poate fi folosit comercial; verifică termenii lor actuali înainte de lansare.
- Integrarea cu ElevenLabs și Lemon Squeezy e scrisă după documentația lor publică și testată cu imitații, nu cu conturi reale. Prima generare și prima plată reală trebuie verificate după configurare.
