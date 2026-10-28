import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { AppShell } from "./components/AppShell";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import MasterData from "./pages/MasterData";
import Reports from "./pages/Reports";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
  },
});

function Router() {
  const [addRequest, setAddRequest] = useState<"sales" | "purchases" | null>(null);
  const [, setLocation] = useLocation();
  const requestAdd = (kind: "sales" | "purchases") => {
    setAddRequest(kind);
    setLocation(kind === "sales" ? "/sales" : "/purchases");
  };
  return <RoutedErrorBoundary><AppShell onAddSale={() => requestAdd("sales")} onAddPurchase={() => requestAdd("purchases")}><Switch>
    <Route path="/" component={Dashboard} />
    <Route path="/sales">
      <Transactions kind="sales" addRequest={addRequest === "sales"} onAddHandled={() => setAddRequest(null)} />
    </Route>
    <Route path="/purchases">
      <Transactions kind="purchases" addRequest={addRequest === "purchases"} onAddHandled={() => setAddRequest(null)} />
    </Route>
    <Route path="/master-data" component={MasterData} />
    <Route path="/reports" component={Reports} />
    <Route component={NotFound} />
  </Switch></AppShell></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;
