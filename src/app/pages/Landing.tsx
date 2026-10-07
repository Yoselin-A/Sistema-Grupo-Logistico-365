import { useEffect } from "react";

/** La página corporativa conserva sus estilos en un documento independiente. */
export function Landing() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Logistics Group 365 | Transporte y logística";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <iframe
      src="/empresa/index.html"
      title="Logistics Group 365: servicios, nosotros y contacto"
      style={{ display: "block", width: "100%", height: "100dvh", border: 0, background: "white" }}
    />
  );
}
