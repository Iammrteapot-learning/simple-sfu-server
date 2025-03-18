import { createRoot } from "react-dom/client";
import "./index.css";
import ClientStream from "./ClientStream.tsx";

createRoot(document.getElementById("root")!).render(<ClientStream />);
