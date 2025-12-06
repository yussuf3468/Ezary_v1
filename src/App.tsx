import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Auth from "./components/Auth";
import BiometricLock from "./components/BiometricLock";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Income from "./components/Income";
import Expenses from "./components/Expenses";
import Debts from "./components/Debts";
import Rent from "./components/Rent";
import ExpectedExpenses from "./components/ExpectedExpenses";
import Reports from "./components/Reports";

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    // Check if user should see biometric lock
    const checkBiometric = async () => {
      try {
        // Check if WebAuthn is supported
        if (!window.PublicKeyCredential) {
          setBiometricUnlocked(true);
          return;
        }

        // Check if platform authenticator is available
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        
        if (!available) {
          setBiometricUnlocked(true);
          return;
        }

        // Check if already unlocked in this session
        const unlockedTimestamp = sessionStorage.getItem('biometric_unlocked');
        if (unlockedTimestamp) {
          setBiometricUnlocked(true);
        } else {
          setBiometricAvailable(true);
        }
      } catch (err) {
        console.error('Error checking biometric:', err);
        setBiometricUnlocked(true);
      }
    };

    if (user) {
      checkBiometric();
    }
  }, [user]);

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

  // Show biometric lock if user is logged in but hasn't unlocked with Face ID
  if (user && biometricAvailable && !biometricUnlocked) {
    return <BiometricLock onUnlock={() => setBiometricUnlocked(true)} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "income":
        return <Income />;
      case "expenses":
        return <Expenses />;
      case "debts":
        return <Debts />;
      case "rent":
        return <Rent />;
      case "expected-expenses":
        return <ExpectedExpenses />;
      case "reports":
        return <Reports />;
      default:
        return <Dashboard />;
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
