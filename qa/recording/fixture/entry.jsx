import { createRoot } from "react-dom/client";
import CoachPage from "@/app/(interior)/acting-coach/page";

createRoot(document.getElementById("root")).render(
  <>
    <div className="bg-foreground text-background text-center p-2 font-semibold">
      Local component demo · Fictional coach response
    </div>
    <CoachPage />
  </>,
);
