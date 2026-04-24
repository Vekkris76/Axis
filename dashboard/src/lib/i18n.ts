type Lang = 'ca' | 'es'

const dict: Record<Lang, Record<string, string>> = {
  ca: {
    'login.title': 'Axis',
    'login.subtitle': 'Accés privat',
    'login.password': 'Contrasenya',
    'login.submit': 'Entrar',
    'login.error.invalid': 'Contrasenya incorrecta.',
    'login.error.network': 'No s\'ha pogut connectar.',

    'app.tagline': 'el teu copilot',
    'app.new_session': 'Nova sessió',
    'app.logout': 'Sortir',
    'app.composer.placeholder': 'Escriu a l\'Axis… (Enter envia · Shift+Enter salt de línia)',
    'app.thinking': 'Axis està pensant…',
    'app.session_label': 'Sessió',
    'app.error.send': 'No s\'ha pogut enviar.',
    'app.error.reply': 'L\'Axis no ha pogut respondre.',
    'app.empty.title': 'Xateja amb Axis',
    'app.empty.body': 'Envia un missatge per començar. Pots parlar-li en català o castellà.',

    'header.back': 'Tornar al panell',

    'mesh.open_chat': 'Obrir xat',
    'mesh.sign_in': 'Entrar',
  },
  es: {
    'login.title': 'Axis',
    'login.subtitle': 'Acceso privado',
    'login.password': 'Contraseña',
    'login.submit': 'Entrar',
    'login.error.invalid': 'Contraseña incorrecta.',
    'login.error.network': 'No se pudo conectar.',

    'app.tagline': 'tu copiloto',
    'app.new_session': 'Nueva sesión',
    'app.logout': 'Salir',
    'app.composer.placeholder': 'Escribe a Axis… (Enter envía · Shift+Enter salto de línea)',
    'app.thinking': 'Axis está pensando…',
    'app.session_label': 'Sesión',
    'app.error.send': 'No se pudo enviar.',
    'app.error.reply': 'Axis no pudo responder.',
    'app.empty.title': 'Chatea con Axis',
    'app.empty.body': 'Envía un mensaje para empezar. Puedes hablarle en catalán o español.',

    'header.back': 'Volver al panel',

    'mesh.open_chat': 'Abrir chat',
    'mesh.sign_in': 'Entrar',
  },
}

function detectLang(): Lang {
  const nav =
    typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'ca'
  if (nav.startsWith('ca')) return 'ca'
  if (nav.startsWith('es')) return 'es'
  // Any other locale (en, fr, …) falls back to Catalan (primary).
  return 'ca'
}

const LANG: Lang = detectLang()

export function t(key: keyof (typeof dict)['ca']): string {
  return dict[LANG][key] ?? dict.ca[key] ?? key
}

export const currentLang = LANG
