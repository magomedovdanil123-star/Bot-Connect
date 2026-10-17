// Сайт-визитка для экрана согласия Google (OAuth): главная, политика конфиденциальности, условия.
// Вставляется в новый Cloudflare Worker целиком. Ссылки: /  /privacy  /terms
const page = (title, body) => new Response(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:17px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1b1a1f;background:#f6f3ec}h1{font-size:28px}a{color:#6b3fd6}</style>
<h1>${title}</h1>${body}<p><a href="/">Главная</a> · <a href="/privacy">Конфиденциальность</a> · <a href="/terms">Условия</a></p></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });

const CONTACT = 'magom3dovdanil@yandex.ru';

export default {
  fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === '/privacy') return page('Политика конфиденциальности', `
<p>Приложение «Хомяк на Трафике» — личный инструмент автора для публикации собственных видео на собственные YouTube-каналы.</p>
<p><b>Какие данные используются.</b> С вашего разрешения приложение получает доступ к YouTube-аккаунту (области youtube.upload и youtube.readonly): название и идентификатор канала, а также право загружать видео и обложки.</p>
<p><b>Зачем.</b> Только чтобы загружать видео, которые вы сами создали и выбрали для публикации. Приложение не читает личные данные, не публикует ничего без вашей команды и не передаёт данные третьим лицам.</p>
<p><b>Хранение.</b> Токен доступа хранится в зашифрованном виде (AES-256-GCM) на сервере владельца. Отозвать доступ можно в любой момент: <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
<p>Использование данных, полученных через API Google, соответствует <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, включая требования Limited Use.</p>
<p>Контакт: ${CONTACT}</p>`);
    if (p === '/terms') return page('Условия использования', `
<p>«Хомяк на Трафике» — частный инструмент для публикации видео автора на его YouTube-каналах. Используя приложение, вы подтверждаете, что публикуете только свой контент и соблюдаете правила YouTube.</p>
<p>Приложение предоставляется «как есть». Контакт: ${CONTACT}</p>`);
    return page('Хомяк на Трафике 🐹', `
<p>Мультики с Хомяком про заработок в интернете, трафик и рефералы.</p>
<p>Telegram-канал: <a href="https://t.me/traffichomyak">t.me/traffichomyak</a></p>
<p>Этот сайт — визитка приложения, которое публикует наши ролики на YouTube.</p>`);
  },
};
