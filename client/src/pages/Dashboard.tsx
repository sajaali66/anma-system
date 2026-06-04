import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { analyzeCaseAI, getSessionStats } from "@/aiEngine";
import {
  Activity,
  AlertTriangle,
  Bell,
  Brain,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileWarning,
  Filter,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RawCase = Record<string, any>;
type RawSession = Record<string, any>;

type ExecutiveCase = {
  id: string | number;
  caseNumber: string;
  childName: string;
  status: string;
  diagnosis: string;
  sessionsCount: number;
  completedSessions: number;
  absentSessions: number;
  postponedSessions: number;
  attendanceRate: number;
  riskScore: number;
  riskLevel: "لا توجد جلسات بعد" | "مستقر" | "متابعة" | "خطر";
  needsFollowUp: boolean;
  isHighRisk: boolean;
  administrativeAlerts: string[];
  aiReason: string;
  aiAction: string;
};

type ChartItem = {
  name: string;
  value: number;
  color: string;
};

type KpiItem = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone: "default" | "blue" | "green" | "amber" | "red" | "slate";
  description: string;
};

const COLORS = {
  orange: "#EA580C",
  blue: "#2563EB",
  green: "#16A34A",
  amber: "#D97706",
  red: "#DC2626",
  slate: "#64748B",
};

function toArray(data: unknown): RawCase[] {
  const result = data as any;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.cases)) return result.cases;
  return [];
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function getDiagnosis(c: RawCase) {
  return text(c.disabilityType || c.disorderType || c.diagnosis || "غير محدد");
}

function getCaseStatus(c: RawCase) {
  const status = text(c.status || c.operationalStatus);
  if (status === "متعثرة" || status === "حرجة") return "حرجة";
  if (status === "مكتملة") return "مكتملة";
  if (status === "نشطة" || status === "متابعة" || status === "قيد المتابعة") return "نشطة";
  return status || "جديدة";
}

function normalizeLevel(level: string): ExecutiveCase["riskLevel"] {
  if (level === "خطر") return "خطر";
  if (level === "متابعة") return "متابعة";
  if (level === "لا توجد جلسات بعد" || level === "غير محدد") return "لا توجد جلسات بعد";
  return "مستقر";
}

function kpiStyle(tone: KpiItem["tone"]) {
  if (tone === "red") return "border-red-100 bg-red-50";
  if (tone === "green") return "border-green-100 bg-green-50";
  if (tone === "amber") return "border-orange-100 bg-orange-50";
  if (tone === "blue") return "border-blue-100 bg-blue-50";
  if (tone === "slate") return "border-slate-200 bg-slate-50";
  return "border-slate-200 bg-white";
}

function chartPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export default function Dashboard() {
  const [diagnosisFilter, setDiagnosisFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const casesQuery = trpc.cases.list.useQuery(undefined, {
    refetchInterval: 8000,
  });

  const cases = toArray(casesQuery.data);

  const sessionsQueries = trpc.useQueries((t) =>
    cases.map((caseItem: RawCase) =>
      t.sessions.getByCase({
        caseId: Number(caseItem.id),
      })
    )
  );

  const sessionsByCase = useMemo(() => {
    const map = new Map<number, RawSession[]>();

    cases.forEach((caseItem: RawCase, index: number) => {
      const query = sessionsQueries[index];
      const sessions = Array.isArray(query?.data) ? (query.data as RawSession[]) : [];
      map.set(Number(caseItem.id), sessions);
    });

    return map;
  }, [cases, sessionsQueries]);

  const refetchDashboard = async () => {
    await casesQuery.refetch();
    await Promise.all(sessionsQueries.map((query) => query.refetch()));
    setLastUpdated(new Date());
  };

  useEffect(() => {
    const handler = () => {
      void refetchDashboard();
    };

    window.addEventListener("anma-dashboard-data-updated", handler);
    window.addEventListener("anma-case-smart-sync-updated", handler);

    return () => {
      window.removeEventListener("anma-dashboard-data-updated", handler);
      window.removeEventListener("anma-case-smart-sync-updated", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases.length]);

  const executiveCases = useMemo<ExecutiveCase[]>(() => {
    return cases.map((caseItem: RawCase) => {
      const sessions = sessionsByCase.get(Number(caseItem.id)) || [];
      const caseWithSessions = {
        ...caseItem,
        sessions,
        sessionsCount: sessions.length,
      };

      const ai = analyzeCaseAI(caseWithSessions);
      const stats = getSessionStats(caseWithSessions);

      return {
        id: caseItem.id,
        caseNumber: text(caseItem.caseNumber || `#${caseItem.id}`),
        childName: text(caseItem.childName || caseItem.name || "حالة بدون اسم"),
        status: getCaseStatus(caseItem),
        diagnosis: getDiagnosis(caseItem),
        sessionsCount: stats.sessionsCount,
        completedSessions: stats.attendedSessions,
        absentSessions: stats.absentSessions,
        postponedSessions: stats.postponedSessions,
        attendanceRate: stats.attendanceRate,
        riskScore: ai.riskScore,
        riskLevel: normalizeLevel(ai.level),
        needsFollowUp: ai.needsAttention,
        isHighRisk: ai.isHighRisk,
        administrativeAlerts: ai.administrativeAlerts || [],
        aiReason: ai.reason,
        aiAction: ai.action,
      };
    });
  }, [cases, sessionsByCase]);

  const diagnoses = useMemo(() => {
    return Array.from(new Set(executiveCases.map((item) => item.diagnosis).filter(Boolean)));
  }, [executiveCases]);

  const filteredCases = executiveCases.filter((item) => {
    const matchDiagnosis = diagnosisFilter === "all" || item.diagnosis === diagnosisFilter;
    const matchRisk = riskFilter === "all" || item.riskLevel === riskFilter;
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    return matchDiagnosis && matchRisk && matchStatus;
  });

  const totalCases = filteredCases.length;
  const highRiskCases = filteredCases.filter((item) => item.riskLevel === "خطر").length;
  const followUpCases = filteredCases.filter((item) => item.riskLevel === "متابعة").length;
  const stableCases = filteredCases.filter((item) => item.riskLevel === "مستقر").length;
  const notStartedCases = filteredCases.filter((item) => item.riskLevel === "لا توجد جلسات بعد").length;

  const totalSessions = filteredCases.reduce((sum, item) => sum + item.sessionsCount, 0);
  const completedSessions = filteredCases.reduce((sum, item) => sum + item.completedSessions, 0);
  const missedSessions = filteredCases.reduce((sum, item) => sum + item.absentSessions, 0);
  const postponedSessions = filteredCases.reduce((sum, item) => sum + item.postponedSessions, 0);
  const adminAlertsCount = filteredCases.reduce((sum, item) => sum + item.administrativeAlerts.length, 0);

  const startedCases = filteredCases.filter((item) => item.riskLevel !== "لا توجد جلسات بعد");
  const averageRiskScore = startedCases.length
    ? Math.round(startedCases.reduce((sum, item) => sum + item.riskScore, 0) / startedCases.length)
    : 0;

  const attendanceRate = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const riskDistribution: ChartItem[] = [
    { name: "مستقر", value: stableCases, color: COLORS.green },
    { name: "متابعة", value: followUpCases, color: COLORS.amber },
    { name: "خطر", value: highRiskCases, color: COLORS.red },
    { name: "لا توجد جلسات بعد", value: notStartedCases, color: COLORS.slate },
  ];

  const casesByDiagnosis: ChartItem[] = diagnoses.map((diagnosis) => ({
    name: diagnosis,
    value: filteredCases.filter((item) => item.diagnosis === diagnosis).length,
    color: COLORS.orange,
  }));

  const alertDistribution: ChartItem[] = [
    { name: "خطر", value: highRiskCases, color: COLORS.red },
    { name: "متابعة", value: followUpCases, color: COLORS.amber },
    { name: "إدارية", value: adminAlertsCount, color: COLORS.blue },
  ];

  const followUpList = filteredCases
    .filter((item) => item.riskLevel === "خطر" || item.riskLevel === "متابعة" || item.administrativeAlerts.length > 0)
    .slice(0, 6);

  const kpis: KpiItem[] = [
    { title: "إجمالي الحالات", value: totalCases, icon: Users, tone: "default", description: "كل الحالات المسجلة" },
    { title: "حالات خطر", value: highRiskCases, icon: ShieldAlert, tone: "red", description: "3 غيابات أو حالة حرجة" },
    { title: "تحتاج متابعة", value: followUpCases, icon: Clock3, tone: "amber", description: "1-2 غياب أو تأجيل" },
    { title: "لا توجد جلسات بعد", value: notStartedCases, icon: FileWarning, tone: "slate", description: "غير مصنفة كخطر" },
    { title: "إجمالي الجلسات", value: totalSessions, icon: CalendarCheck, tone: "blue", description: "من البيانات الفعلية" },
    { title: "الجلسات المكتملة", value: completedSessions, icon: CheckCircle2, tone: "green", description: "حضور فعلي" },
    { title: "الغيابات", value: missedSessions, icon: AlertTriangle, tone: "red", description: "3+ تحول الحالة إلى خطر" },
    { title: "التنبيهات الإدارية", value: adminAlertsCount, icon: Bell, tone: "blue", description: "لا ترفع مستوى الخطر" },
    { title: "متوسط الخطر", value: `${averageRiskScore}%`, icon: Activity, tone: "amber", description: "للحالات التي بدأت" },
  ];

  return (
    <div dir="rtl" className="min-h-full space-y-5">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              <Brain className="h-4 w-4" />
              Executive AI Dashboard
            </div>
            <h1 className="text-3xl font-bold text-slate-900">لوحة المؤشرات الذكية</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
              مرتبطة بالحالات والجلسات الفعلية. لا يتم تصنيف الحالة كخطر إلا عند 3 غيابات أو أكثر أو حالة حرجة.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">
              آخر تحديث: {lastUpdated.toLocaleTimeString("ar-SA")}
            </div>

            <button
              type="button"
              onClick={refetchDashboard}
              disabled={casesQuery.isFetching || sessionsQueries.some((query) => query.isFetching)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${casesQuery.isFetching || sessionsQueries.some((query) => query.isFetching) ? "animate-spin" : ""}`} />
              تحديث البيانات
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Filter className="h-4 w-4 text-orange-600" />
          الفلاتر الذكية
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select className="rounded-xl border bg-white px-3 py-2 text-sm" value={diagnosisFilter} onChange={(event) => setDiagnosisFilter(event.target.value)}>
            <option value="all">كل التشخيصات</option>
            {diagnoses.map((diagnosis) => <option key={diagnosis} value={diagnosis}>{diagnosis}</option>)}
          </select>

          <select className="rounded-xl border bg-white px-3 py-2 text-sm" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="all">كل التصنيفات</option>
            <option value="مستقر">مستقر</option>
            <option value="متابعة">متابعة</option>
            <option value="خطر">خطر</option>
            <option value="لا توجد جلسات بعد">لا توجد جلسات بعد</option>
          </select>

          <select className="rounded-xl border bg-white px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">كل الحالات</option>
            <option value="جديدة">جديدة</option>
            <option value="نشطة">نشطة / متابعة</option>
            <option value="حرجة">حرجة</option>
            <option value="مكتملة">مكتملة</option>
          </select>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className={`rounded-2xl border p-5 shadow-sm ${kpiStyle(item.tone)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-600">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                </div>
                <Icon className="h-5 w-5 shrink-0 text-orange-600" />
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-900">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
            <Brain className="h-5 w-5 text-orange-600" />
            ملخص الذكاء
          </h2>
          <div className="space-y-3">
            <div className="rounded-2xl bg-orange-50 p-4 text-sm leading-7">
              {highRiskCases > 0 ? `يوجد ${highRiskCases} حالة خطر تحتاج تدخل عاجل.` : "لا توجد حالات خطر حالياً."}
            </div>
            <div className="rounded-2xl bg-blue-50 p-4 text-sm leading-7">
              {followUpCases > 0 ? `يوجد ${followUpCases} حالة تحتاج متابعة.` : "لا توجد حالات متابعة حالياً."}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-7">
              نسبة الحضور الحالية {attendanceRate}% من إجمالي الجلسات.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-slate-900">الحالات التي تحتاج متابعة الآن</h2>
          {followUpList.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">لا توجد حالات تحتاج متابعة حالياً.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-500">
                    <th className="px-3 py-3 text-right">الحالة</th>
                    <th className="px-3 py-3 text-right">التشخيص</th>
                    <th className="px-3 py-3 text-right">التصنيف</th>
                    <th className="px-3 py-3 text-right">الغياب</th>
                    <th className="px-3 py-3 text-right">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {followUpList.map((item) => (
                    <tr key={String(item.id)} className="border-b last:border-b-0">
                      <td className="px-3 py-3"><div className="font-semibold text-slate-900">{item.childName}</div><div className="text-xs text-slate-400">{item.caseNumber}</div></td>
                      <td className="px-3 py-3">{item.diagnosis}</td>
                      <td className="px-3 py-3"><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{item.riskLevel}</span></td>
                      <td className="px-3 py-3">{item.absentSessions}</td>
                      <td className="px-3 py-3 text-slate-500">{item.aiAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">توزيع التصنيفات</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={riskDistribution} dataKey="value" nameKey="name" outerRadius={90} label>
                {riskDistribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [`${value} (${chartPercent(value, totalCases)}%)`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">التنبيهات حسب النوع</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={alertDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {alertDistribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">الحالات حسب التشخيص</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={casesByDiagnosis}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS.orange} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
