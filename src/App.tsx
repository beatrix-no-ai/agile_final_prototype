import { RouterProvider } from "react-router";
import { router } from "./routes";
import { FasProvider } from "./data/fasStore";
import { FeeProvider } from "./data/feeStore";
import { MoefasProvider } from "./data/moefasStore";
import { ParentProvider } from "./data/parentStore";
import { SbfasProvider } from "./data/sbfasStore";
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
                <SbfasProvider>
                  <MoefasProvider>
                    <RouterProvider router={router} />
                  </MoefasProvider>
                </SbfasProvider>
              </ParentProvider>
            </FasProvider>
          </FeeProvider>
        </TopUpProvider>
      </RegistryProvider>
    </SessionProvider>
  );
}
