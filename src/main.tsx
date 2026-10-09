
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { router } from "./app/routes";
  import { watchAppUpdates } from "./app/utils/appUpdates";

  watchAppUpdates(listener => router.subscribe(listener));

  createRoot(document.getElementById("root")!).render(<App />);

