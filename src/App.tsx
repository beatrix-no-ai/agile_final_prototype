import { RouterProvider } from "react-router";
import { router } from "./routes";
import { FasProvider } from "./data/fasStore";
import { FeeProvider } from "./data/feeStore";
import { ParentProvider } from "./data/parentStore";
import { SessionProvider } from "./session";

export default function App() {
  return (
    <SessionProvider>
      <ParentProvider>
        <FeeProvider>
          <FasProvider>
            <RouterProvider router={router} />
          </FasProvider>
        </FeeProvider>
      </ParentProvider>
    </SessionProvider>
  );
}
