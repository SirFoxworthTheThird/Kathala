/*
  The app's Content-Security-Policy, put into the built `index.html` as a
  `<meta>` (vite.config.ts). Not in development: Vite's dev server runs inline
  scripts of its own, and it never ships.

  It is there for the API key the AI audit can be run with (next-plan.md, Part
  F3): a key in the page is only as safe as the page is from script it did not
  ship. So scripts come from the app itself and nowhere else — not inline, not
  from `eval`, not from another site — and nothing can be embedded as a plugin,
  posted as a form, or rebase the page's relative URLs.

  Where the page may *connect* stays wide (`https:`): a linked picture is saved
  to the device by fetching it from whatever site it is on, the Library may be
  a fork's own site, and the export fetches its cover. Narrowing it to the API
  would break those; the script rule is what keeps a stranger's script from
  being there to use them.

  Styles allow inline: React's `style` attributes, CodeMirror's and Leaflet's
  own stylesheets are inline, and a style cannot read a key.
*/
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // Pictures linked from anywhere, and the ones made in the page (maps, covers).
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self' https: data: blob:",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')
