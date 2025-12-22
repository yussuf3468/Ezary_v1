import { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  AlertCircle,
  PieChart,
  LogOut,
  Shield,
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
  const { signOut, userRole } = useAuth();

  const navItems = [
    {
      id: "clients",
      label: "Clients",
      icon: Users,
      color: "from-emerald-500 to-teal-600",
    },
    {
      id: "debts",
      label: "Debts",
      icon: AlertCircle,
      color: "from-red-500 to-pink-600",
    },
    {
      id: "reports",
      label: "Reports",
      icon: PieChart,
      color: "from-purple-500 to-pink-600",
    },
  ];

  // Add admin item if user is admin or superadmin
  const allNavItems =
    userRole === "admin" || userRole === "superadmin"
      ? [
          ...navItems,
          {
            id: "admin",
            label: "Admin",
            icon: Shield,
            color: "from-purple-500 to-pink-600",
          },
        ]
      : navItems;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900 pb-20 md:pb-0">
      {/* Desktop & Tablet Top Navigation */}
      <nav className="hidden md:block bg-black/40 backdrop-blur-xl shadow-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex justify-between items-center h-16">
            {/* Ezary CMS Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
               allN<span className="text-white font-bold text-xl">E</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Ezary CMS
                </h1>
                <p className="text-xs text-gray-400 -mt-0.5">
                  Client Management System
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
                        : "text-gray-300 hover:bg-white/10 hover:scale-105"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-all ml-2 hover:scale-105"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Top Bar - Minimal */}
      <div className="md:hidden bg-black/40 backdrop-blur-xl shadow-md border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-lg shadow-md">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Ezary CMS
              </h1>
              <p className="text-xs text-gray-400 -mt-0.5">Client Management</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-4 sm:py-6 md:py-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation - App Style */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur-xl border-t border-white/10 shadow-2xl z-50">
        <div className="safe-area-inset-bottom">
          <div className="flex items-center justify-around px-2 py-2">
            {allNavItems.map((item) => {
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
                        : "bg-white/10"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        isActive ? "text-white" : "text-gray-400"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-semibold transition-colors ${
                      isActive
                        ? "bg-gradient-to-r " +
                          item.color +
                          " bg-clip-text text-transparent"
                        : "text-gray-400"
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
