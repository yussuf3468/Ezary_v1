import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Auth from "./components/Auth";
import Layout from "./components/Layout";
import CMSDashboard from "./components/CMSDashboard";
import ClientList from "./components/ClientList";
import ClientDetail from "./components/ClientDetail";
import Vehicles from "./components/Vehicles";
import Reports from "./components/Reports";
import Debts from "./components/Debts";

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const handleNavigation = (page: string, clientId?: string) => {
    setCurrentPage(page);
    if (clientId) {
      setSelectedClientId(clientId);
    }
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentPage("client-detail");
  };

  const handleBackToClients = () => {
    setSelectedClientId(null);
    setCurrentPage("clients");
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <CMSDashboard onNavigate={handleNavigation} />;
      case "clients":
        return <ClientList onSelectClient={handleSelectClient} />;
      case "client-detail":
        return selectedClientId ? (
          <ClientDetail
            clientId={selectedClientId}
            onBack={handleBackToClients}
          />
        ) : (
          <ClientList onSelectClient={handleSelectClient} />
        );
      case "debts":
        return <Debts />;
      case "reports":
        return <Reports />;
      default:
        return <CMSDashboard onNavigate={handleNavigation} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
