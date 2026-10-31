// Запасной адрес Telegram для бота: если api.telegram.org недоступен с сервера, бот ходит сюда, а Worker пересылает запрос в Telegram.
// Вставляется в новый Cloudflare Worker целиком. Пропускает только запросы нашего бота — чужим ботам этот адрес не пригодится.
const BOT_ID = '8971212427';
export default {
  async fetch(req) {
    const u = new URL(req.url);
    if (!u.pathname.startsWith(`/bot${BOT_ID}:`) && !u.pathname.startsWith(`/file/bot${BOT_ID}:`)) return new Response('ok');
    return fetch(new Request('https://api.telegram.org' + u.pathname + u.search, req));
  },
};
