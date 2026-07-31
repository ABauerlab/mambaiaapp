// Head tags que tornam o app instalável (PWA).
// Usados APENAS nas rotas da área interna (/login, /primeiro-acesso e /_app),
// para que as páginas públicas do site não ofereçam instalação.
export const pwaMeta = [
  { name: "apple-mobile-web-app-capable", content: "yes" },
  { name: "mobile-web-app-capable", content: "yes" },
  { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
  { name: "apple-mobile-web-app-title", content: "Mambaia" },
];

export const pwaLinks = [
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];
