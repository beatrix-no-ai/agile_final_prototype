import { RouterProvider } from "react-router";
import { router } from "./routes";
import { FasProvider } from "./data/fasStore";
import { FeeProvider } from "./data/feeStore";
import { ParentProvider } from "./data/parentStore";
import { RegistryProvider } from "./data/registryStore";
import { TopUpProvider } from "./data/topupStore";
import { SessionProvider } from "./session";

export default function App() {
  return (
    <SessionProvider>
      <RegistryProvider>
        <TopUpProvider>
          <FeeProvider>
            <FasProvider>
              <ParentProvider>
                <RouterProvider router={router} />
              </ParentProvider>
            </FasProvider>
          </FeeProvider>
        </TopUpProvider>
      </RegistryProvider>
    </SessionProvider>
  );
}
