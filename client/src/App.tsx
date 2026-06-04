import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CasesManagement from "./pages/CasesManagement";
import SessionsManagement from "./pages/SessionsManagement";
import CaseDetails from "./pages/CaseDetails";
import Reports from "./pages/Reports";
import Alerts from "./pages/Alerts";
import AIMonitoring from "./pages/AIMonitoring";
import OrganizationsManagement from "./pages/OrganizationsManagement";
import OrganizationDetails from "./pages/OrganizationDetails";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />

      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>

      <Route path="/cases">
        <DashboardLayout>
          <CasesManagement />
        </DashboardLayout>
      </Route>

      <Route path="/sessions">
        <DashboardLayout>
          <SessionsManagement />
        </DashboardLayout>
      </Route>

      <Route path="/organizations">
        <DashboardLayout>
          <OrganizationsManagement />
        </DashboardLayout>
      </Route>

      <Route path="/organizations/:id">
        <DashboardLayout>
          <OrganizationDetails />
        </DashboardLayout>
      </Route>

      <Route path="/cases/:id">
        <DashboardLayout>
          <CaseDetails />
        </DashboardLayout>
      </Route>

      <Route path="/reports">
        <DashboardLayout>
          <Reports />
        </DashboardLayout>
      </Route>

      <Route path="/alerts">
        <DashboardLayout>
          <Alerts />
        </DashboardLayout>
      </Route>

      <Route path="/ai-monitoring">
        <DashboardLayout>
          <AIMonitoring />
        </DashboardLayout>
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;