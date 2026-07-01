import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileWarning,
  FileText,
  Filter,
  Building2,
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

type SmartLevel = "لا توجد جلسات بعد" | "مستقر" | "متابعة" | "خطر";

type ExecutiveCase = {
  id: string | number;
  caseNumber: string;
  childName: string;
  organization: string;
  doctorName: string;
  status: string;
  diagnosis: string;
  sessionsCount: number;
  attendedSessions: number;
  absentSessions: number;
  postponedSessions: number;
  attendanceRate: number;
  riskScore: number;
  riskLevel: SmartLevel;
  needsFollowUp: boolean;
  isHighRisk: boolean;
  administrativeAlerts: string[];
  aiReason: string;
  aiAction: string;
  reportsCount: number;
  progressScore: number;
  financingStatus: string;
  totalFinancing: number;
  remainingSessions: number;
  latestRecommendation: string;
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
  green: "#4C1D95",
  amber: "#6B7280",
  red: "#DC2626",
  slate: "#D1D5DB",
  purple: "#7C3AED",
};

const CASE_SMART_SYNC_STORAGE_KEY = "anma-case-smart-sync";
const DISEASE_OPTIONS_STORAGE_KEY = "anma-disease-options";
const CLINICAL_REPORTS_STORAGE_KEY = "anma-clinical-reports";

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

function getNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function readJsonMap(key: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readDiseaseOptions(): string[] {
  try {
    const raw = localStorage.getItem(DISEASE_OPTIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getStoredSmart(caseId: string | number) {
  return readJsonMap(CASE_SMART_SYNC_STORAGE_KEY)[String(caseId)] || {};
}

function getClinicalReportsByCase(caseId: string | number) {
  const reports = readJsonMap(CLINICAL_REPORTS_STORAGE_KEY)[String(caseId)];
  return Array.isArray(reports) ? reports : [];
}

function getLatestClinicalRecommendation(caseId: string | number) {
  const reports = getClinicalReportsByCase(caseId);
  return reports[0]?.recommendations || reports[0]?.reportText || "";
}

function getFundingStatus(caseItem: RawCase, stored: Record<string, any>) {
  const status = text(
    stored.financingStatus ||
      caseItem.financingStatus ||
      caseItem.financeStatus ||
      ""
  );

  const total = getNumber(stored.totalFinancing || caseItem.totalFinancing || caseItem.totalCost);
  const approved = getNumber(caseItem.approvedSessionCount || stored.approvedSessionCount);
  const used = getNumber(caseItem.usedSessionCount || stored.usedSessionCount || caseItem.sessionsCount || stored.sessionsCount);
  const remaining = Math.max(approved - used, 0);

  if (status && status !== "غير محدد") return status;
  if (approved > 0) return `${used}/${approved} جلسة - متبقي ${remaining}`;
  if (total > 0) return `${total} ريال`;
  return "غير محدد";
}

function getDiagnosis(c: RawCase) {
  return text(c.disabilityType || c.disorderType || c.diagnosis || "غير محدد");
}

function getOrganization(c: RawCase) {
  return text(c.organization || c.organizationName || "غير محدد");
}

function getDoctorName(c: RawCase) {
  return text(c.doctorName || c.specialistName || c.specialist || "غير محدد");
}

function getCaseStatus(c: RawCase) {
  const status = text(c.status || c.operationalStatus);
  if (status === "متعثرة" || status === "حرجة") return "حرجة";
  if (status === "مكتملة") return "مكتملة";
  if (status === "نشطة" || status === "متابعة" || status === "قيد المتابعة") return "نشطة";
  return status || "جديدة";
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

function sessionStats(caseItem: RawCase, sessions: RawSession[]) {
  const stored = getStoredSmart(caseItem.id);
  const storedCount = Number(stored.sessionsCount ?? stored.totalSessions ?? 0);

  const sessionsCount = Math.max(
    sessions.length,
    Number(caseItem.sessionsCount || 0),
    Number(caseItem.totalSessions || 0),
    Number.isFinite(storedCount) ? storedCount : 0
  );

  const attendedSessions =
    sessions.filter((s) => s.attendance === "حاضر").length ||
    Number(stored.attendedSessions || 0);

  const absentSessions =
    sessions.filter((s) => s.attendance === "غائب").length ||
    Number(stored.absentSessions || 0);

  const postponedSessions =
    sessions.filter((s) => s.attendance === "مؤجل").length ||
    Number(stored.postponedSessions || 0);

  const attendanceRate =
    sessionsCount > 0
      ? Math.round((attendedSessions / sessionsCount) * 100)
      : Number(stored.attendanceRate || 0);

  return {
    sessionsCount,
    attendedSessions,
    absentSessions,
    postponedSessions,
    attendanceRate,
  };
}

function analyzeCase(caseItem: RawCase, sessions: RawSession[]) {
  const stored = getStoredSmart(caseItem.id);
  const stats = sessionStats(caseItem, sessions);
  const status = getCaseStatus(caseItem);

  let riskLevel: SmartLevel = "لا توجد جلسات بعد";
  let riskScore = 0;
  let aiReason = "لا توجد جلسات مسجلة بعد، لذلك لا يتم تصنيف الحالة كخطر.";
  let aiAction = "إضافة أول جلسة أو متابعة الحالة من صفحة التفاصيل.";
  let administrativeAlerts: string[] = [];

  const hasPhone = Boolean(text(caseItem.familyPhone || caseItem.phone || caseItem.beneficiaryPhone));
  const hasDiagnosis = Boolean(text(caseItem.disabilityType || caseItem.disorderType || caseItem.diagnosis));
  const hasSpecialist = Boolean(text(caseItem.doctorName || caseItem.specialistName || caseItem.specialist));

  if (!hasPhone) administrativeAlerts.push("بيانات التواصل ناقصة");
  if (!hasDiagnosis) administrativeAlerts.push("نوع الإعاقة / المرض غير محدد");
  if (!hasSpecialist) administrativeAlerts.push("لا يوجد مختص مرتبط");

  if (stored.smartLevel && stored.smartLevel !== "غير محدد") {
    riskLevel =
      stored.smartLevel === "ممتاز"
        ? "مستقر"
        : stored.smartLevel === "خطر"
        ? "خطر"
        : stored.smartLevel === "متابعة"
        ? "متابعة"
        : "لا توجد جلسات بعد";

    aiReason = stored.reason || aiReason;
    aiAction = stored.recommendation || aiAction;
  } else if (stats.sessionsCount === 0) {
    riskLevel = "لا توجد جلسات بعد";
  } else if (stats.absentSessions >= 3 || status === "حرجة") {
    riskLevel = "خطر";
    aiReason =
      stats.absentSessions >= 3
        ? `تم تسجيل ${stats.absentSessions} غيابات أو أكثر.`
        : "الحالة مصنفة كحرجة أو متعثرة.";
    aiAction = "التواصل مع الأسرة ومراجعة الخطة العلاجية فوراً.";
  } else if (stats.absentSessions >= 1 || stats.postponedSessions > 0 || administrativeAlerts.length > 0) {
    riskLevel = "متابعة";
    aiReason = "الحالة تحتاج متابعة بسبب غياب/تأجيل أو نقص بيانات إدارية.";
    aiAction = "استكمال البيانات ومتابعة الالتزام بالجلسات.";
  } else {
    riskLevel = "مستقر";
    aiReason = "الحالة لديها جلسات ولا توجد مؤشرات خطر حالية.";
    aiAction = "الاستمرار على الخطة الحالية مع قياس أثر دوري.";
  }

  if (riskLevel === "خطر") riskScore = 90;
  else if (riskLevel === "متابعة") riskScore = 65;
  else if (riskLevel === "مستقر") riskScore = 25;
  else riskScore = 0;

  return {
    ...stats,
    riskLevel,
    riskScore,
    needsFollowUp: riskLevel === "متابعة" || riskLevel === "خطر" || administrativeAlerts.length > 0,
    isHighRisk: riskLevel === "خطر",
    administrativeAlerts,
    aiReason,
    aiAction,
  };
}

function exportCsv(rows: ExecutiveCase[]) {
  const headers = [
    "اسم الحالة",
    "رقم الحالة",
    "الجمعية",
    "نوع الإعاقة / المرض",
    "المختص",
    "الحالة",
    "التصنيف",
    "عدد الجلسات",
    "الحضور",
    "الغياب",
    "نسبة الحضور",
    "تقارير المختصين",
    "مؤشر التقدم",
    "حالة التمويل",
    "إجمالي التمويل",
    "الإجراء المقترح",
  ];

  const body = rows.map((item) => [
    item.childName,
    item.caseNumber,
    item.organization,
    item.diagnosis,
    item.doctorName,
    item.status,
    item.riskLevel,
    item.sessionsCount,
    item.attendedSessions,
    item.absentSessions,
    `${item.attendanceRate}%`,
    item.reportsCount,
    `${item.progressScore}%`,
    item.financingStatus,
    item.totalFinancing,
    item.latestRecommendation || item.aiAction,
  ]);

  const csv = [headers, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `anma-dashboard-report-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [diagnosisFilter, setDiagnosisFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [diseaseRefreshKey, setDiseaseRefreshKey] = useState(0);

  const casesQuery = trpc.cases.list.useQuery(undefined, {
    refetchInterval: 8000,
  });

  const cases = toArray(casesQuery.data);

  const sessionsQueries = trpc.useQueries((t: any) =>
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
    await Promise.all(sessionsQueries.map((query: any) => query.refetch()));
    setLastUpdated(new Date());
    setDiseaseRefreshKey((value) => value + 1);
  };

  useEffect(() => {
    const handler = () => {
      void refetchDashboard();
    };

    window.addEventListener("anma-dashboard-data-updated", handler);
    window.addEventListener("anma-case-smart-sync-updated", handler);
    window.addEventListener("anma-disease-options-updated", handler);
    window.addEventListener("anma-clinical-reports-updated", handler);
    window.addEventListener("anma-ai-monitoring-updated", handler);
    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener("anma-dashboard-data-updated", handler);
      window.removeEventListener("anma-case-smart-sync-updated", handler);
      window.removeEventListener("anma-disease-options-updated", handler);
      window.removeEventListener("anma-clinical-reports-updated", handler);
      window.removeEventListener("anma-ai-monitoring-updated", handler);
      window.removeEventListener("storage", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases.length]);

  const executiveCases = useMemo<ExecutiveCase[]>(() => {
    return cases.map((caseItem: RawCase) => {
      const sessions = sessionsByCase.get(Number(caseItem.id)) || [];
      const ai = analyzeCase(caseItem, sessions);
      const stored = getStoredSmart(caseItem.id);
      const reports = getClinicalReportsByCase(caseItem.id);
      const latestReportRecommendation = getLatestClinicalRecommendation(caseItem.id);

      return {
        id: caseItem.id,
        caseNumber: text(caseItem.caseNumber || `#${caseItem.id}`),
        childName: text(caseItem.childName || caseItem.name || "حالة بدون اسم"),
        organization: getOrganization(caseItem),
        doctorName: getDoctorName(caseItem),
        status: getCaseStatus(caseItem),
        diagnosis: getDiagnosis(caseItem),
        sessionsCount: ai.sessionsCount,
        attendedSessions: ai.attendedSessions,
        absentSessions: ai.absentSessions,
        postponedSessions: ai.postponedSessions,
        attendanceRate: ai.attendanceRate,
        riskScore: ai.riskScore,
        riskLevel: ai.riskLevel,
        needsFollowUp: ai.needsFollowUp,
        isHighRisk: ai.isHighRisk,
        administrativeAlerts: ai.administrativeAlerts,
        aiReason: ai.aiReason,
        aiAction: ai.aiAction,
        reportsCount: Math.max(getNumber(stored.reportsCount), reports.length, getNumber(caseItem.reportsCount)),
        progressScore: getNumber(stored.improvement || caseItem.progressScore),
        financingStatus: getFundingStatus(caseItem, stored),
        totalFinancing: getNumber(stored.totalFinancing || caseItem.totalFinancing || caseItem.totalCost),
        remainingSessions: getNumber(stored.remainingSessions || caseItem.remainingSessions),
        latestRecommendation: text(latestReportRecommendation || stored.recommendation || caseItem.smartRecommendation || ai.aiAction),
      };
    });
  }, [cases, sessionsByCase]);

  const organizations = useMemo(() => {
    return Array.from(new Set(executiveCases.map((item) => item.organization).filter(Boolean))).sort();
  }, [executiveCases]);

  const diagnoses = useMemo(() => {
    void diseaseRefreshKey;
    return Array.from(
      new Set([
        ...readDiseaseOptions(),
        ...executiveCases.map((item) => item.diagnosis).filter(Boolean),
      ])
    ).filter(Boolean);
  }, [executiveCases, diseaseRefreshKey]);

  const statuses = useMemo(() => {
    return Array.from(new Set(executiveCases.map((item) => item.status).filter(Boolean))).sort();
  }, [executiveCases]);

  const doctors = useMemo(() => {
    return Array.from(
      new Set(executiveCases.map((item) => item.doctorName).filter(Boolean))
    ).sort();
  }, [executiveCases]);

  const filteredCases = executiveCases.filter((item) => {
    const matchOrganization = organizationFilter === "all" || item.organization === organizationFilter;
    const matchDiagnosis = diagnosisFilter === "all" || item.diagnosis === diagnosisFilter;
    const matchRisk = riskFilter === "all" || item.riskLevel === riskFilter;
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    const matchDoctor = doctorFilter === "all" || item.doctorName === doctorFilter;

    return matchOrganization && matchDiagnosis && matchRisk && matchStatus && matchDoctor;
  });

  const totalCases = filteredCases.length;
  const highRiskCases = filteredCases.filter((item) => item.riskLevel === "خطر").length;
  const followUpCases = filteredCases.filter((item) => item.riskLevel === "متابعة").length;
  const stableCases = filteredCases.filter((item) => item.riskLevel === "مستقر").length;
  const notStartedCases = filteredCases.filter((item) => item.riskLevel === "لا توجد جلسات بعد").length;

  const totalSessions = filteredCases.reduce((sum, item) => sum + item.sessionsCount, 0);
  const totalReports = filteredCases.reduce((sum, item) => sum + item.reportsCount, 0);
  const totalFinancing = filteredCases.reduce((sum, item) => sum + item.totalFinancing, 0);
  const casesWithoutReports = filteredCases.filter((item) => item.reportsCount === 0).length;
  const completedSessions = filteredCases.reduce((sum, item) => sum + item.attendedSessions, 0);
  const missedSessions = filteredCases.reduce((sum, item) => sum + item.absentSessions, 0);
  const postponedSessions = filteredCases.reduce((sum, item) => sum + item.postponedSessions, 0);

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

  const casesByDiagnosis: ChartItem[] = diagnoses
    .map((diagnosis) => ({
      name: diagnosis,
      value: filteredCases.filter((item) => item.diagnosis === diagnosis).length,
      color: COLORS.orange,
    }))
    .filter((item) => item.value > 0);

  const casesByOrganization: ChartItem[] = organizations
    .map((organization) => ({
      name: organization,
      value: filteredCases.filter((item) => item.organization === organization).length,
      color: COLORS.blue,
    }))
    .filter((item) => item.value > 0);

  const casesByDoctor: ChartItem[] = Array.from(new Set(filteredCases.map((item) => item.doctorName).filter(Boolean)))
    .map((doctor) => ({
      name: doctor,
      value: filteredCases.filter((item) => item.doctorName === doctor).length,
      color: COLORS.purple,
    }))
    .filter((item) => item.name !== "غير محدد")
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const followUpList = filteredCases
    .filter((item) => item.riskLevel === "خطر" || item.riskLevel === "متابعة" || item.administrativeAlerts.length > 0)
    .slice(0, 8);

  const kpis: KpiItem[] = [
    { title: "إجمالي الحالات", value: totalCases, icon: Users, tone: "default", description: "حسب الفلاتر الحالية" },
    { title: "حالات خطر", value: highRiskCases, icon: ShieldAlert, tone: "red", description: "3 غيابات أو حالة حرجة" },
    { title: "تحتاج متابعة", value: followUpCases, icon: Clock3, tone: "amber", description: "غياب/تأجيل أو نقص بيانات" },
    { title: "لا توجد جلسات بعد", value: notStartedCases, icon: FileWarning, tone: "slate", description: "غير مصنفة كخطر" },
    { title: "إجمالي الجلسات", value: totalSessions, icon: CalendarCheck, tone: "blue", description: "من بيانات الجلسات" },
    { title: "تقارير المختصين", value: totalReports, icon: FileWarning, tone: "blue", description: "تقارير محفوظة داخل الحالات" },
    { title: "بلا تقارير", value: casesWithoutReports, icon: FileWarning, tone: "slate", description: "تحتاج استكمال ملف التقرير" },
    { title: "إجمالي التمويل", value: `${totalFinancing} ريال`, icon: Activity, tone: "green", description: "من تفاصيل الحالة" },
    { title: "الجلسات المكتملة", value: completedSessions, icon: CheckCircle2, tone: "green", description: "حضور فعلي" },
    { title: "الغيابات", value: missedSessions, icon: AlertTriangle, tone: "red", description: "تؤثر على التصنيف" },
    { title: "المؤجلة", value: postponedSessions, icon: Clock3, tone: "amber", description: "جلسات مؤجلة" },
    { title: "متوسط الخطر", value: `${averageRiskScore}%`, icon: Activity, tone: "amber", description: "للحالات التي بدأت" },
  ];

  return (
    <div dir="rtl" className="min-h-full space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              <Brain className="h-4 w-4" />
              Executive Dashboard
            </div>

            <h1 className="text-2xl font-black text-slate-900">لوحة التحكم</h1>

            <p className="mt-1 text-sm text-slate-500">
              ملخص تشغيلي للحالات، الجلسات، التقارير، والتمويل.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-2xl border bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">
              آخر تحديث: {lastUpdated.toLocaleTimeString("ar-SA")}
            </div>

            <button
              type="button"
              onClick={refetchDashboard}
              disabled={casesQuery.isFetching || sessionsQueries.some((query: any) => query.isFetching)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${casesQuery.isFetching || sessionsQueries.some((query: any) => query.isFetching) ? "animate-spin" : ""}`} />
              تحديث
            </button>

            <button
              type="button"
              onClick={() => exportCsv(filteredCases)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              تصدير
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <select className="rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400" value={organizationFilter} onChange={(event) => setOrganizationFilter(event.target.value)}>
            <option value="all">كل الجمعيات</option>
            {organizations.map((organization) => <option key={organization} value={organization}>{organization}</option>)}
          </select>

          <select className="rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400" value={diagnosisFilter} onChange={(event) => setDiagnosisFilter(event.target.value)}>
            <option value="all">كل الأمراض / الإعاقات</option>
            {diagnoses.map((diagnosis) => <option key={diagnosis} value={diagnosis}>{diagnosis}</option>)}
          </select>

          <select className="rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="all">كل التصنيفات</option>
            <option value="مستقر">مستقر</option>
            <option value="متابعة">متابعة</option>
            <option value="خطر">خطر</option>
            <option value="لا توجد جلسات بعد">لا توجد جلسات بعد</option>
          </select>

          <select className="rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">كل الحالات</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>

          <select className="rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400" value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}>
            <option value="all">كل المختصين</option>
            {doctors.map((doctor) => <option key={doctor} value={doctor}>{doctor}</option>)}
          </select>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {[
          { title: "الحالات", value: totalCases, tone: "bg-white text-slate-900" },
          { title: "أولوية عالية", value: highRiskCases, tone: "bg-red-50 text-red-700" },
          { title: "متابعة", value: followUpCases, tone: "bg-amber-50 text-amber-700" },
          { title: "الجلسات", value: totalSessions, tone: "bg-blue-50 text-blue-700" },
          { title: "التقارير", value: totalReports, tone: "bg-white text-slate-900" },
          { title: "التمويل", value: `${totalFinancing.toLocaleString("ar-SA")} ريال`, tone: "bg-green-50 text-green-700" },
        ].map((item) => (
          <div key={item.title} className={`rounded-2xl border p-4 shadow-sm ${item.tone}`}>
            <p className="text-xs font-semibold opacity-75">{item.title}</p>
            <p className="mt-2 text-2xl font-black">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900">توزيع التصنيف</h2>
            <BarChart3 className="h-5 w-5 text-orange-600" />
          </div>

          <div className="relative h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={4}
                >
                  {riskDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} (${chartPercent(value, totalCases)}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-black text-[#4C1D95]">{totalCases}</div>
              <div className="text-xs font-semibold text-slate-500">حالة</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-black text-slate-900">أكثر الأمراض</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={casesByDiagnosis.slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS.orange} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-black text-slate-900">حسب الجمعية</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={casesByOrganization.slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS.blue} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-black text-slate-900">حسب المختص</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={casesByDoctor.slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS.purple} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Brain className="h-5 w-5 text-orange-600" />
            ملخص تنفيذي
          </h2>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-orange-50 p-4 text-sm leading-7 text-slate-700">
              {highRiskCases > 0 ? `يوجد ${highRiskCases} حالة أولوية عالية تحتاج تدخل.` : "لا توجد حالات أولوية عالية حاليًا."}
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              نسبة الحضور الحالية {attendanceRate}% من إجمالي الجلسات.
            </div>

            <div className="rounded-2xl bg-green-50 p-4 text-sm leading-7 text-slate-700">
              إجمالي التمويل المسجل {totalFinancing.toLocaleString("ar-SA")} ريال.
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">تحتاج متابعة الآن</h2>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              {followUpList.length} حالة
            </span>
          </div>

          {followUpList.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              لا توجد حالات تحتاج متابعة حالياً.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs text-slate-500">
                    <th className="px-3 py-3 text-right">الحالة</th>
                    <th className="px-3 py-3 text-right">الجمعية</th>
                    <th className="px-3 py-3 text-right">التصنيف</th>
                    <th className="px-3 py-3 text-right">غياب</th>
                    <th className="px-3 py-3 text-right">تقارير</th>
                    <th className="px-3 py-3 text-right">الإجراء</th>
                  </tr>
                </thead>

                <tbody>
                  {followUpList.map((item) => (
                    <tr key={String(item.id)} className="border-b last:border-b-0 hover:bg-orange-50/40">
                      <td className="px-3 py-3">
                        <div className="font-black text-slate-900">{item.childName}</div>
                        <div className="text-xs text-slate-400">{item.caseNumber}</div>
                      </td>
                      <td className="px-3 py-3">{item.organization}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                          {item.riskLevel}
                        </span>
                      </td>
                      <td className="px-3 py-3">{item.absentSessions}</td>
                      <td className="px-3 py-3">{item.reportsCount || 0}</td>
                      <td className="px-3 py-3">
                        <div className="line-clamp-2 max-w-[320px] text-xs leading-5 text-slate-500">
                          {item.latestRecommendation || item.aiAction}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
