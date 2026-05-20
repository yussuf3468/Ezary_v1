import { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Users, AlertCircle, PieChart, LogOut } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const NAV_ITEMS = [
  { id: "clients", label: "Clients", icon: Users },
  { id: "debts", label: "Debts", icon: AlertCircle },
  { id: "reports", label: "Reports", icon: PieChart },
];

export default function Layout({
  children,
  currentPage,
  onNavigate,
}: LayoutProps) {
  const { signOut } = useAuth();

  const activeId =
    currentPage === "client-detail" ? "clients" : currentPage;

  return (
    <div className="min-h-screen bg-surface-base text-ink-900 pb-16 md:pb-0">
      {/* Desktop top nav */}
      <nav className="hidden md:block sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-ink-200/70">
        <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={() => onNavigate("clients")}
              className="group flex items-center gap-2.5 focus-ring rounded-md"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
                <span className="text-white font-semibold text-sm tracking-tight">
                  E
                </span>
              </div>
              <div className="text-left leading-tight">
                <div className="text-sm font-semibold text-ink-900 tracking-tight">
                  Ezary
                </div>
                <div className="text-[10px] text-ink-500 -mt-0.5">
                  Client Management
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={[
                      "relative h-9 px-3 inline-flex items-center gap-2 rounded-md text-sm font-medium",
                      "transition-colors duration-150 focus-ring",
                      isActive
                        ? "text-brand-700 bg-brand-50"
                        : "text-ink-600 hover:text-ink-900 hover:bg-ink-100",
                    ].join(" ")}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="absolute inset-x-3 -bottom-[14px] h-0.5 bg-brand-500 rounded-full" />
                    )}
                  </button>
                );
              })}

              <div className="w-px h-5 bg-ink-200 mx-2" />

              <button
                onClick={signOut}
                className="h-9 px-3 inline-flex items-center gap-2 rounded-md text-sm font-medium text-ink-600 hover:text-negative-600 hover:bg-negative-50 transition-colors focus-ring"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-ink-200/70 safe-area-inset-top">
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <span className="text-white font-semibold text-xs">E</span>
            </div>
            <div className="text-sm font-semibold text-ink-900 tracking-tight">
              Ezary
            </div>
          </div>
          <button
            onClick={signOut}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-ink-600 hover:text-negative-600 hover:bg-negative-50 transition-colors press"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-3 sm:px-5 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="hidden md:block border-t border-ink-100 bg-white/60">
        <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-ink-500">
          <span>© {new Date().getFullYear()} Ezary</span>
          <a
            href="https://lenzro.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-ink-500 hover:text-brand-600 transition-colors"
          >
            <span>Built by</span>
            <span className="font-semibold text-ink-700">Lenzro</span>
          </a>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-ink-200/70 safe-area-inset-bottom">
        <div className="grid grid-cols-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={[
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 press",
                  "focus-ring",
                  isActive ? "text-brand-700" : "text-ink-500",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-brand-500" />
                )}
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
