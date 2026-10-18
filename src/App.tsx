import { RouterProvider } from "react-router";
import { router } from "./routes";
import { FeeProvider } from "./data/feeStore";
import { ParentProvider } from "./data/parentStore";
import { SbfasProvider } from "./data/sbfasStore";
import { SessionProvider } from "./session";

export default function App() {
  return (
    <SessionProvider>
      <ParentProvider>
        <FeeProvider>
          <SbfasProvider>
            <RouterProvider router={router} />
          </SbfasProvider>
        </FeeProvider>
      </ParentProvider>
    </SessionProvider>
  );
}
