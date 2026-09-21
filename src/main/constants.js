'use strict';

const WHATSAPP_URL = 'https://web.whatsapp.com/';
const WHATSAPP_ORIGIN = 'https://web.whatsapp.com';

// Origins the embedded views are allowed to navigate to in-place. Everything
// else is handed to the user's browser.
const ALLOWED_ORIGINS = new Set([WHATSAPP_ORIGIN]);

module.exports = { WHATSAPP_URL, WHATSAPP_ORIGIN, ALLOWED_ORIGINS };
