import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Users,
  BarChart3,
  AlertCircle,
  FileText,
  HeartPulse,
  Sparkles,
  ShieldCheck,
  Languages,
} from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();
  const [lang, setLang] = useState<"ar" | "en">("ar");

  const isArabic = lang === "ar";

  const features = [
    {
      icon: Users,
      ar: "إدارة الحالات",
      en: "Case Management",
      descAr: "إضافة الحالات وتتبع بيانات الطفل والجمعية والمختص.",
      descEn: "Add and manage child, association, and specialist records.",
    },
    {
      icon: HeartPulse,
      ar: "متابعة الجلسات",
      en: "Sessions Tracking",
      descAr: "ربط الجلسات بكل حالة وتسجيل الحضور والتقدم.",
      descEn: "Track sessions, attendance, and progress.",
    },
    {
      icon: BarChart3,
      ar: "قياس الأثر",
      en: "Impact Measurement",
      descAr: "قياس التحسن قبل وبعد بشكل ذكي.",
      descEn: "Measure progress before and after treatment.",
    },
    {
      icon: AlertCircle,
      ar: "تنبيهات ذكية",
      en: "Smart Alerts",
      descAr: "تنبيهات للحالات التي تحتاج متابعة.",
      descEn: "Alerts for cases needing attention.",
    },
    {
      icon: FileText,
      ar: "تقارير جاهزة",
      en: "Ready Reports",
      descAr: "توليد تقارير حالة وتقارير عامة قابلة للطباعة والتصدير",
      descEn: "Generate PDF and Excel reports instantly.",
    },
    {
      icon: ShieldCheck,
      ar: "لوحة الإدارة",
      en: "Admin Dashboard",
      descAr: "مؤشرات وإحصائيات لحظية.",
      descEn: "Live KPIs and analytics dashboard.",
    },
  ];

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-[#0B2A3A] text-white transition-all"
    >
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B2A3A]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-anma.jpg"
              className="h-12 w-12 rounded-2xl object-cover shadow-lg"
            />

            <div>
              <h1 className="text-xl font-bold">
                {isArabic ? "نظام أنما الذكي" : "Anma Smart System"}
              </h1>

              <p className="text-xs text-white/60">
                Smart Care Management
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() =>
                setLang(isArabic ? "en" : "ar")
              }
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <Languages className="h-4 w-4" />
              {isArabic ? "English" : "العربية"}
            </Button>

            <Button
              onClick={() => navigate("/login")}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isArabic ? "تسجيل الدخول" : "Login"}
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 py-20 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4 text-orange-400" />
              {isArabic
                ? "منصة ذكية متكاملة"
                : "Smart Integrated Platform"}
            </div>

            <h2 className="text-5xl font-bold leading-tight md:text-6xl">
              {isArabic
                ? "إدارة احترافية للحالات"
                : "Professional Case Management"}
            </h2>

            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
              {isArabic
                ? "نظام متكامل يساعد على متابعة الحالات، الجلسات، قياس الأثر، الالتزام، والتنبيهات الذكية من مكان واحد"
                : "Complete system for associations, sessions, reports and smart alerts."}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => navigate("/login")}
                size="lg"
                className="bg-orange-600 px-8 hover:bg-orange-700"
              >
                {isArabic ? "ابدأ الآن" : "Get Started"}
              </Button>
            </div>
          </div>

          {/* CARD */}
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
            <img
              src="/logo-anma.jpg"
              className="mx-auto mb-6 h-28 w-28 rounded-3xl object-cover"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white p-5 text-slate-900">
                <p className="font-bold text-orange-600">
                  {isArabic ? "تحليل ذكي" : "Smart Analytics"}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 text-slate-900">
                <p className="font-bold text-cyan-600">
                  {isArabic ? "تقارير جاهزة" : "Ready Reports"}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 text-slate-900">
                <p className="font-bold text-emerald-600">
                  {isArabic ? "ذكاء اصطناعي" : "Artificial intelligence"}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 text-slate-900">
                <p className="font-bold text-purple-600">
                  {isArabic ? "تنبيهات ذكية" : "Smart Alerts"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-white py-16 text-slate-900">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-10 text-center">
            <h3 className="text-3xl font-bold">
              {isArabic ? "مميزات النظام" : "Features"}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <div
                key={item.ar}
                className="rounded-3xl bg-slate-50 p-6 hover:shadow-xl"
              >
                <item.icon className="mb-4 h-8 w-8 text-orange-600" />

                <h4 className="text-xl font-bold">
                  {isArabic ? item.ar : item.en}
                </h4>

                <p className="mt-3 text-slate-500">
                  {isArabic ? item.descAr : item.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-orange-600 py-16 text-center">
        <h3 className="text-3xl font-bold">
          {isArabic
            ? "جاهز للبدء؟"
            : "Ready to Start?"}
        </h3>

        <Button
          onClick={() => navigate("/login")}
          className="mt-8 bg-white px-8 text-orange-600 hover:bg-orange-50"
        >
          {isArabic ? "تسجيل الدخول" : "Login Now"}
        </Button>
      </section>

      <footer className="bg-[#071D29] py-6 text-center text-sm text-white/60">
        © 2026 {isArabic ? "نظام إنماء الذكي" : "Anma Smart System"}
      </footer>
    </div>
  );
}