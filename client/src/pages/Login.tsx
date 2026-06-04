import { useState } from "react";
import { LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      if (email === "admin@test.com" && password === "123456") {
        localStorage.setItem(
          "anma_demo_user",
          JSON.stringify({
            name: "Saja",
            email: "admin@test.com",
            role: "admin",
          })
        );

        window.location.href = "/dashboard";
        return;
      }

      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      setLoading(false);
    }, 500);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0B2A3A] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="hidden flex-col justify-center px-14 lg:flex relative">
          <div className="absolute top-10 left-10 h-52 w-52 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />

          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
            <Sparkles className="h-4 w-4 text-orange-400" />
            Smart Management Platform
          </div>

          <h1 className="mt-6 text-5xl font-bold leading-tight">
            نظام أنما الذكي
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
            منصة احترافية لإدارة الحالات والجلسات والتقارير الذكية ولوحات
            التحكم والتنبيهات المباشرة.
          </p>
        </section>

        <section className="flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-slate-900 shadow-2xl">
            <div className="text-center">
              <img
                src="/logo-anma.jpg"
                alt="Anma"
                className="mx-auto mb-5 h-24 w-24 rounded-3xl object-cover shadow-lg"
              />

              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-1 text-xs font-bold text-orange-700">
                <ShieldCheck className="h-4 w-4" />
                Demo Admin Access
              </div>

              <h2 className="text-3xl font-bold">تسجيل الدخول</h2>

              <p className="mt-2 text-sm text-slate-500">
                استخدمي بيانات العرض للوصول للنظام
              </p>
            </div>

            <div className="mt-5 rounded-xl bg-orange-50 p-3 text-sm text-orange-700">
              البريد: admin@test.com <br />
              كلمة المرور: 123456
            </div>

            {error && (
              <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  البريد الإلكتروني
                </label>

                <div className="relative">
                  <Mail className="absolute right-3 top-3.5 h-5 w-5 text-slate-400" />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border bg-slate-50 px-4 py-3 pr-11 outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  كلمة المرور
                </label>

                <div className="relative">
                  <LockKeyhole className="absolute right-3 top-3.5 h-5 w-5 text-slate-400" />

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border bg-slate-50 px-4 py-3 pr-11 outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {loading ? "جاري الدخول..." : "دخول"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}