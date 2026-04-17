import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ProjectProvider } from '@/lib/ProjectContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import DataSource from '@/pages/DataSource';
import Workspace from '@/pages/Workspace';
import DomainDetection from '@/pages/DomainDetection';
import TableClassification from '@/pages/TableClassification';
import SemanticIR from '@/pages/SemanticIR';
import TraceMap from '@/pages/TraceMap';
import ExportView from '@/pages/ExportView';
import SettingsPage from '@/pages/SettingsPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/connect" element={<DataSource />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/domain" element={<DomainDetection />} />
        <Route path="/classification" element={<TableClassification />} />
        <Route path="/semantic-ir" element={<SemanticIR />} />
        <Route path="/trace" element={<TraceMap />} />
        <Route path="/export" element={<ExportView />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ProjectProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
        </ProjectProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App