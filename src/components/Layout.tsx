import { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Home,
  PieChart,
  LogOut,
  Wallet,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({
  children,
  currentPage,
  onNavigate,
}: LayoutProps) {
  const { signOut } = useAuth();

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      color: "from-blue-500 to-cyan-600",
    },
    {
      id: "income",
      label: "Income",
      icon: TrendingUp,
      color: "from-emerald-500 to-teal-600",
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: TrendingDown,
      color: "from-red-500 to-pink-600",
    },
    {
      id: "debts",
      label: "Debts",
      icon: CreditCard,
      color: "from-purple-500 to-pink-600",
    },
    {
      id: "rent",
      label: "Rent",
      icon: Home,
      color: "from-orange-500 to-amber-600",
    },
    {
      id: "reports",
      label: "Reports",
      icon: PieChart,
      color: "from-indigo-500 to-purple-600",
    },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pb-20 md:pb-0">
      {/* Desktop & Tablet Top Navigation */}
      <nav className="hidden md:block bg-white/80 backdrop-blur-xl shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-xl shadow-lg">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  KeshaTrack
                </h1>
                <p className="text-xs text-gray-500 -mt-0.5">
                  Personal Finance Manager
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all transform ${
                      isActive
                        ? `bg-gradient-to-r ${item.color} text-white shadow-lg scale-105`
                        : "text-gray-700 hover:bg-gray-100 hover:scale-105"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-all ml-2 hover:scale-105"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Top Bar - Minimal */}
      <div className="md:hidden bg-white/90 backdrop-blur-xl shadow-md border-b border-gray-200/50 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-lg shadow-md">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                MyFinance
              </h1>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation - App Style */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200/50 shadow-2xl z-50">
        <div className="safe-area-inset-bottom">
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all transform active:scale-95 min-w-[60px] ${
                    isActive ? "scale-105" : "scale-100"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                      isActive
                        ? `bg-gradient-to-br ${item.color} shadow-lg`
                        : "bg-gray-100"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        isActive ? "text-white" : "text-gray-600"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-semibold transition-colors ${
                      isActive
                        ? "bg-gradient-to-r " +
                          item.color +
                          " bg-clip-text text-transparent"
                        : "text-gray-600"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
