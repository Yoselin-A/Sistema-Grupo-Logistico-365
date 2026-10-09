// Las pestañas abiertas detectan una publicación al navegar, sin conservar
// indefinidamente el JavaScript de una versión anterior.
export function watchAppUpdates(subscribe: (listener: () => void) => () => void) {
  const current = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
  if (!current || !new URL(current).pathname.startsWith("/assets/")) return;
  let checking = false;
  let pending = false;
  const check = async () => {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const response = await fetch("/index.html", { cache: "no-store" });
      if (!response.ok) return;
      const html = new DOMParser().parseFromString(await response.text(), "text/html");
      const src = html.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute("src");
      if (src && new URL(src, location.origin).href !== current) pending = true;
    } catch { /* Una interrupción de red no bloquea el trabajo. */ }
    finally { checking = false; }
  };
  subscribe(() => {
    // Solo aplica al navegar, nunca durante la edición de un formulario.
    if (pending) location.reload();
    else void check();
  });
  window.addEventListener("focus", check);
  window.setInterval(check, 60000);
  void check();
}
