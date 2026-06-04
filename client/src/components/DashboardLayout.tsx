import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Bell,
  Brain,
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type DashboardLayoutProps = {
  children: ReactNode;
};

type CurrentUser = {
  name: string;
  email: string;
  role: string;
};

type MenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/dashboard" },
  { icon: Brain, label: "المراقبة الذكية", path: "/ai-monitoring" },
  { icon: Users, label: "الحالات", path: "/cases" },
  { icon: CalendarDays, label: "الجلسات", path: "/sessions" },
  { icon: Building2, label: "الجمعيات", path: "/organizations" },
  { icon: FileText, label: "التقارير", path: "/reports" },
  { icon: Bell, label: "التنبيهات", path: "/alerts" },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [user, setUser] = useState<CurrentUser>({
    name: "",
    email: "",
    role: "",
  });

  const sidebarWidth = isCollapsed ? 76 : 280;

  const activeMenuItem = useMemo(() => {
    return menuItems.find((item) => location.startsWith(item.path));
  }, [location]);

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!res.ok) {
          setUser({ name: "", email: "", role: "" });
          return;
        }

        const data = await res.json();

        setUser({
          name: data?.name || "",
          email: data?.email || "",
          role: data?.role || "",
        });
      } catch {
        setUser({ name: "", email: "", role: "" });
      } finally {
        setLoadingUser(false);
      }
    };

    void loadUser();
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/login";
    }
  };

  const userInitial =
    user.name?.charAt(0)?.toUpperCase() ||
    user.email?.charAt(0)?.toUpperCase() ||
    "م";

  const displayName = user.name || "مستخدم النظام";
  const displayEmail = user.email || "";
  const displayRole = user.role === "admin" ? "مدير النظام" : "مستخدم";

  if (loadingUser) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#F8FAFC]"
      >
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          جاري تحميل النظام...
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40"
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen flex-col overflow-hidden border-l border-slate-200 bg-white shadow-sm transition-transform duration-300 ${
          isMobile
            ? mobileOpen
              ? "translate-x-0"
              : "translate-x-full"
            : "translate-x-0"
        }`}
        style={{ width: isMobile ? 280 : sidebarWidth }}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50">
              <ShieldCheck className="h-5 w-5 text-orange-600" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  نظام أنما الذكي
                </p>
                <p className="truncate text-xs text-slate-500">
                  AI Patient Monitoring
                </p>
              </div>
            )}
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="إغلاق القائمة"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsCollapsed((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="طي القائمة"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto bg-white px-3 py-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location === item.path || location.startsWith(`${item.path}/`);

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    setLocation(item.path);
                    setMobileOpen(false);
                  }}
                  title={item.label}
                  className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-orange-50 text-orange-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  } ${isCollapsed ? "justify-center" : "justify-start"}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-orange-600" : "text-slate-500"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-slate-200 bg-white p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-2xl bg-white p-2 text-right hover:bg-orange-50 ${
                  isCollapsed ? "justify-center" : "justify-start"
                }`}
              >
                <Avatar className="h-10 w-10 shrink-0 border border-slate-200">
                  <AvatarFallback className="bg-orange-100 text-xs font-bold text-orange-700">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>

                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {displayEmail}
                    </p>
                    <p className="mt-1 text-xs text-orange-600">
                      {displayRole}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52 bg-white">
              <DropdownMenuItem
                onClick={() => setLocation("/dashboard")}
                className="cursor-pointer"
              >
                <LayoutDashboard className="ml-2 h-4 w-4" />
                <span>لوحة التحكم</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setLocation("/dashboard")}
                className="cursor-pointer"
              >
                <Settings className="ml-2 h-4 w-4" />
                <span>إعدادات الحساب</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-red-600"
              >
                <LogOut className="ml-2 h-4 w-4" />
                <span>تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <section
        className="min-h-screen transition-[margin] duration-300"
        style={{ marginRight: isMobile ? 0 : sidebarWidth }}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                aria-label="فتح القائمة"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-900">
                {activeMenuItem?.label ?? "لوحة التحكم"}
              </h1>
              <p className="truncate text-xs text-slate-500">
                مرحبًا {displayName}، يمكنك إدارة النظام من هنا
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
              {user.role === "admin" ? "صلاحية المدير" : "صلاحية المستخدم"}
            </div>

            <button
              type="button"
              onClick={() => setLocation("/alerts")}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
              aria-label="التنبيهات"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500" />
            </button>
          </div>
        </header>

        <main className="h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden bg-[#F8FAFC] p-5 md:p-7">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </section>
    </div>
  );
}