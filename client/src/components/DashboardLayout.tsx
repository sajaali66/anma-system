import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  Brain,
  Building2,
  LogOut,
  Menu,
  Stethoscope,
  ShieldCheck,
  Bell,
  UserRound,
  KeyRound,
  Camera,
  X,
  Loader2,
  Sparkles,
  MessageCircle,
} from "lucide-react";

type DashboardLayoutProps = { children: ReactNode };

type UserRole =
  | "super_admin"
  | "admin"
  | "organization"
  | "doctor"
  | "case_manager";

type CurrentUser = {
  id?: number;
  name?: string;
  email?: string;
  role?: UserRole | string;
  organizationId?: number | null;
  doctorId?: number | null;
  status?: string;
  avatarUrl?: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
};

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  type: "warning" | "info" | "success";
};

const USER_STORAGE_KEY = "anma_demo_user";
const PROFILE_STORAGE_KEY = "anma_profile_settings";

const navItems: NavItem[] = [
  { label: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "case_manager", "organization", "doctor"] },
  { label: "إدارة الحالات", href: "/cases", icon: Users, roles: ["super_admin", "admin", "case_manager", "organization", "doctor"] },
  { label: "المختصين", href: "/doctors", icon: Stethoscope, roles: ["super_admin", "admin", "case_manager"] },
  { label: "إدارة المستخدمين", href: "/users", icon: ShieldCheck, roles: ["super_admin", "admin"] },
  { label: "الجلسات", href: "/sessions", icon: CalendarDays, roles: ["super_admin", "admin", "case_manager", "doctor"] },
  { label: "الجمعيات", href: "/organizations", icon: Building2, roles: ["super_admin", "admin", "case_manager"] },
  { label: "التقارير", href: "/reports", icon: FileText, roles: ["super_admin", "admin", "case_manager", "organization"] },
  { label: "المراقبة الذكية", href: "/ai-monitoring", icon: Brain, roles: ["super_admin", "admin", "case_manager"] },
];

const roleLabels: Record<UserRole, string> = {
  super_admin: "مدير النظام الرئيسي",
  admin: "مدير النظام",
  case_manager: "مشرف حالات",
  organization: "حساب جمعية",
  doctor: "مختص",
};

function getCurrentUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCurrentUser(user: CurrentUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function getProfileSettings(): Partial<CurrentUser> {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProfileSettings(settings: Partial<CurrentUser>) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(settings));
}

function getRole(user: CurrentUser | null): UserRole {
  const role = user?.role as UserRole | undefined;

  if (
    role === "super_admin" ||
    role === "admin" ||
    role === "organization" ||
    role === "doctor" ||
    role === "case_manager"
  ) {
    return role;
  }

  return "super_admin";
}

function getInitials(name?: string) {
  const cleanName = String(name || "مستخدم").trim();
  if (!cleanName) return "م";

  return cleanName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function getPageTitle(location: string) {
  if (location.startsWith("/cases/")) return "ملف الحالة";
  if (location.startsWith("/organizations/")) return "ملف الجمعية";

  const item = navItems.find(
    (navItem) =>
      location === navItem.href || location.startsWith(navItem.href + "/")
  );

  return item?.label || "لوحة التشغيل";
}

function getPageDescription(role: UserRole) {
  if (role === "doctor") return "مساحة المختص لمتابعة الحالات والجلسات والتقارير السريرية.";
  if (role === "organization") return "واجهة الجمعية لمتابعة الحالات والتقارير التشغيلية.";
  if (role === "case_manager") return "متابعة تشغيلية للحالات والجلسات والتقارير.";
  return "مركز قيادة شامل لإدارة الحالات، التقارير، التنبيهات، والتحليل الذكي.";
}

function getRoleNotice(role: UserRole) {
  if (role === "super_admin" || role === "admin") return "صلاحية إدارة كاملة للمنصة والبيانات.";
  if (role === "doctor") return "تظهر لك الحالات المرتبطة بالمختص فقط.";
  if (role === "organization") return "تظهر لك حالات الجمعية المرتبطة فقط.";
  return "صلاحية متابعة الحالات والجلسات والتقارير.";
}

function readNotifications(): NotificationItem[] {
  const smartMap = (() => {
    try {
      const raw = localStorage.getItem("anma-case-smart-sync");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();

  const items = Object.entries(smartMap || {})
    .slice(0, 5)
    .map(([caseId, value]: [string, any]) => {
      const level = value?.smartLevel || "متابعة";

      return {
        id: caseId,
        title:
          level === "خطر"
            ? "حالة تحتاج تدخل عاجل"
            : level === "متابعة"
            ? "حالة تحتاج متابعة"
            : "تحديث على ملف حالة",
        description:
          value?.reason ||
          value?.recommendation ||
          "تم تحديث بيانات الحالة أو تقرير المختص.",
        type: level === "خطر" ? "warning" : level === "ممتاز" ? "success" : "info",
      } as NotificationItem;
    });

  return items.length
    ? items
    : [
        {
          id: "welcome",
          title: "لا توجد تنبيهات عاجلة",
          description: "كل شيء مستقر حاليًا. ستظهر هنا تنبيهات الغياب والتقارير والتمويل.",
          type: "success",
        },
      ];
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const user = getCurrentUser();
    const profile = getProfileSettings();
    return { ...user, ...profile };
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(readNotifications);

  const [profileName, setProfileName] = useState(currentUser?.name || "سجا علي الأمير");
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || "admin@test.com");
  const [profileAvatar, setProfileAvatar] = useState(currentUser?.avatarUrl || "");
  const [newPassword, setNewPassword] = useState("");

  const currentRole = getRole(currentUser);
  const displayName = currentUser?.name || "سجا علي الأمير";
  const role = roleLabels[currentRole];

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => item.roles.includes(currentRole));
  }, [currentRole]);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = window.setTimeout(() => setIsTransitioning(false), 420);
    return () => window.clearTimeout(timer);
  }, [location]);

  useEffect(() => {
    const refresh = () => setNotifications(readNotifications());
    window.addEventListener("anma-case-smart-sync-updated", refresh);
    window.addEventListener("anma-ai-monitoring-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("anma-case-smart-sync-updated", refresh);
      window.removeEventListener("anma-ai-monitoring-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    window.location.href = "/login";
  };

  const handleSaveProfile = () => {
    const updatedUser = {
      ...currentUser,
      name: profileName,
      email: profileEmail,
      avatarUrl: profileAvatar,
    };

    setCurrentUser(updatedUser);
    saveCurrentUser(updatedUser);
    saveProfileSettings({ name: profileName, email: profileEmail, avatarUrl: profileAvatar });

    if (newPassword.trim()) {
      localStorage.setItem("anma_password_updated_at", new Date().toISOString());
      setNewPassword("");
    }

    setIsProfileOpen(false);
  };

  const handleAvatarUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfileAvatar(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const openWhatsAppSupport = () => {
    const message = encodeURIComponent(
      `مرحباً، أحتاج متابعة بخصوص منصة أنما. المستخدم: ${displayName} - الدور: ${role}`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F6F7FB] text-slate-900">
      {isTransitioning && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white/75 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-orange-100 bg-white p-7 shadow-2xl">
            <img src="/logo-anma.jpg" alt="ANMA" className="h-14 w-14 rounded-3xl object-cover shadow-lg" />
            <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
            <p className="text-sm font-bold text-slate-700">جاري فتح {getPageTitle(location)}...</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-28 left-20 h-72 w-72 rounded-full bg-orange-400/10 blur-3xl" />
        <div className="absolute bottom-16 right-20 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen w-full">
        <aside className="hidden w-72 shrink-0 border-l border-slate-200 bg-white shadow-sm lg:flex lg:flex-col">
          <div className="flex h-24 items-center gap-3 border-b border-slate-100 px-5">
            <div className="relative">
              <img src="/logo-anma.jpg" alt="ANMA" className="h-14 w-14 rounded-3xl object-cover shadow-lg ring-4 ring-orange-50" />
              <span className="absolute -bottom-1 -left-1 rounded-full bg-emerald-500 p-1.5 ring-2 ring-white" />
            </div>

            <div className="min-w-0 max-w-[160px]">
              <h1 className="truncate text-xl font-black text-slate-900">أنما</h1>
              <p className="truncate text-xs font-semibold text-slate-500">Smart Care Platform</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || location.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`group flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 ${active ? "bg-gradient-to-l from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-600 hover:-translate-x-1 hover:bg-slate-50 hover:text-slate-900"}`}>
                    <Icon className={`h-5 w-5 ${active ? "text-white" : "text-slate-400 group-hover:text-orange-600"}`} />
                    <span className="truncate">{item.label}</span>
                    {active && <span className="mr-auto h-2 w-2 rounded-full bg-white/80" />}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="mb-3 rounded-2xl border border-orange-100 bg-orange-50 p-3 text-xs leading-6 text-orange-800">
              {getRoleNotice(currentRole)}
            </div>

            <button onClick={() => setIsProfileOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-right transition hover:bg-slate-100">
              {profileAvatar ? <img src={profileAvatar} alt={displayName} className="h-11 w-11 shrink-0 rounded-2xl object-cover" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 font-bold text-orange-700">{getInitials(displayName)}</div>}
              <div className="min-w-0 max-w-[140px] flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{role}</p>
              </div>
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-24 items-center justify-between border-b border-slate-200 bg-white/85 px-5 backdrop-blur-xl lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button className="rounded-2xl border border-slate-200 p-2 text-slate-600 lg:hidden"><Menu className="h-5 w-5" /></button>
              <div className="min-w-0">
                <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700"><Sparkles className="h-3.5 w-3.5" />تشغيل ذكي متصل</div>
                <h2 className="truncate text-2xl font-black text-slate-900">{getPageTitle(location)}</h2>
                <p className="truncate text-sm text-slate-500">{getPageDescription(currentRole)}</p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <div className="relative">
                <button onClick={() => setIsNotificationsOpen((value) => !value)} className="relative rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 transition hover:bg-slate-50" title="الإشعارات">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{notifications.length}</span>
                </button>
                {isNotificationsOpen && (
                  <div className="absolute left-0 top-14 z-50 w-80 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between"><h3 className="font-black text-slate-900">الإشعارات</h3><button onClick={() => setIsNotificationsOpen(false)} className="rounded-xl p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
                    <div className="max-h-80 space-y-2 overflow-y-auto">
                      {notifications.map((notification) => (
                        <div key={notification.id} className={`rounded-2xl border p-3 text-sm ${notification.type === "warning" ? "border-red-100 bg-red-50 text-red-700" : notification.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-blue-100 bg-blue-50 text-blue-700"}`}>
                          <p className="font-bold">{notification.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-80">{notification.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={openWhatsAppSupport} className="hidden rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 md:flex" title="WhatsApp"><MessageCircle className="ml-2 h-5 w-5" />واتساب</button>

              <button onClick={() => setIsProfileOpen(true)} className="hidden min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right transition hover:bg-slate-50 sm:flex">
                {profileAvatar ? <img src={profileAvatar} alt={displayName} className="h-10 w-10 rounded-2xl object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 font-bold text-orange-700">{getInitials(displayName)}</div>}
                <div className="hidden min-w-0 max-w-[160px] lg:block"><p className="truncate text-sm font-bold text-slate-900">{displayName}</p><p className="truncate text-xs text-slate-500">{role}</p></div>
              </button>

              <button onClick={handleLogout} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">خروج</button>
            </div>
          </header>

          <section className="w-full p-4 lg:p-6"><div className="animate-[fadeIn_0.35s_ease-out]">{children}</div></section>
        </main>
      </div>

      {isProfileOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between"><div><h2 className="text-2xl font-black text-slate-900">الملف الشخصي</h2><p className="mt-1 text-sm text-slate-500">عدلي الصورة والبيانات وكلمة المرور.</p></div><button onClick={() => setIsProfileOpen(false)} className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
              <div className="flex flex-col items-center gap-3">
                {profileAvatar ? <img src={profileAvatar} alt={profileName} className="h-32 w-32 rounded-[2rem] object-cover shadow-lg" /> : <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] bg-orange-100 text-4xl font-black text-orange-700">{getInitials(profileName)}</div>}
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><Camera className="h-4 w-4" />تغيير الصورة<input type="file" accept="image/*" className="hidden" onChange={(event) => handleAvatarUpload(event.target.files?.[0])} /></label>
              </div>
              <div className="space-y-4">
                <div><label className="mb-2 block text-sm font-bold text-slate-700">الاسم</label><input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500" /></div>
                <div><label className="mb-2 block text-sm font-bold text-slate-700">البريد الإلكتروني</label><input value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500" /></div>
                <div><label className="mb-2 block text-sm font-bold text-slate-700">كلمة مرور جديدة</label><div className="relative"><KeyRound className="absolute right-4 top-3.5 h-5 w-5 text-slate-400" /><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="اتركيها فارغة إذا لا تريدين تغييرها" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none focus:border-orange-500" /></div></div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm leading-7 text-orange-800"><UserRound className="mb-2 h-5 w-5" />التغييرات تحفظ محلياً الآن. عند ربط قاعدة البيانات لاحقاً سنجعلها محفوظة على السيرفر.</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button onClick={() => setIsProfileOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">إلغاء</button><button onClick={handleSaveProfile} className="rounded-2xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700">حفظ التغييرات</button></div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
