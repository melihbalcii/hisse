// Telegram bildirimi. Anahtarlar ortam degiskeninden gelir; tanimli degilse
// sessizce devre disi kalir (sistem bildirim yuzunden durmamali).
const API = t => `https://api.telegram.org/bot${t}/sendMessage`;

export const yapilandirilmis = () =>
  Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

export async function gonder(mesaj) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat)
    return { gonderildi: false, sebep: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID tanimli degil' };

  try {
    const r = await fetch(API(token), {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat, text: mesaj,
        parse_mode: 'HTML', disable_web_page_preview: true,
      }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok
      ? { gonderildi: true }
      : { gonderildi: false, sebep: j.description ?? `HTTP ${r.status}` };
  } catch (e) {
    return { gonderildi: false, sebep: e.message };
  }
}
