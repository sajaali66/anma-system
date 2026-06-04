import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertCircle,
  Bell,
  Brain,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

type RawCase = Record<string, any>;

type SmartAlert = {
  id: string;
  caseId: string | number;
  childName: string;
  organization: string;
  severity: "high" | "medium" | "info";
  title: string;
  message: string;
  recommendation: string;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function toArray(data: unknown): RawCase[] {
  const result = data as any;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.cases)) return result.cases;
  return [];
}

function getSessionsArray(c: RawCase): RawCase[] {
  const possible =
    c.sessions ||
    c.caseSessions ||
    c.appointments ||
    c.visits ||
    c.sessionList ||
    [];

  return Array.isArray(possible) ? possible : [];
}

function getSessionStatus(s: RawCase): string {
  return text(s.attendanceStatus || s.status || s.sessionStatus || s.attendance);
}

function getSessionsCount(c: RawCase): number {
  const embedded = getSessionsArray(c);
  if (embedded.length > 0) return embedded.length;

  return num(
    c.sessionsCount ||
      c.sessionCount ||
      c.totalSessions ||
      c.completedSessions ||
      c.usedSessionCount ||
      0
  );
}

function getAbsentSessions(c: RawCase): number {
  const embedded = getSessionsArray(c);

  if (embedded.length > 0) {
    return embedded.filter((s) => {
      const status = getSessionStatus(s);
      return (
        status === "غائب" ||
        status === "فائتة" ||
        status === "missed" ||
        status === "absent" ||
        status === "no-show"
      );
    }).length;
  }

  return num(
    c.absentSessions ||
      c.missedAppointments ||
      c.noShowCount ||
      c.missedSessions ||
      0
  );
}

function getPostponedSessions(c: RawCase): number {
  const embedded = getSessionsArray(c);

  if (embedded.length > 0) {
    return embedded.filter((s) => {
      const status = getSessionStatus(s);
      return status === "مؤجل" || status === "مؤجلة" || status === "postponed";
    }).length;
  }

  return num(c.postponedSessions || c.delayedSessions || 0);
}

function getStatus(c: RawCase): string {
  const status = text(c.status || c.operationalStatus);

  if (status === "متعثرة" || status === "حرجة") return "حرجة";
  if (status === "مكتملة") return "مكتملة";
  if (status === "نشطة" || status === "متابعة" || status === "قيد المتابعة") {
    return "نشطة";
  }

  return status || "جديدة";
}

function getCaseName(c: RawCase): string {
  return text(c.childName || c.caseName || c.name || c.beneficiaryName || "حالة بدون اسم");
}

function getOrganization(c: RawCase): string {
  return text(c.organizationName || c.organization || c.associationName || "بدون جمعية");
}

function buildAlerts(cases: RawCase[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  cases.forEach((c) => {
    const caseId = c.id || `${getCaseName(c)}-${Math.random()}`;
    const childName = getCaseName(c);
    const organization = getOrganization(c);
    const status = getStatus(c);
    const sessionsCount = getSessionsCount(c);
    const absentSessions = getAbsentSessions(c);
    const postponedSessions = getPostponedSessions(c);

    const hasSpecialist = Boolean(text(c.specialistName || c.specialist || c.doctorName));
    const hasPhone = Boolean(text(c.familyPhone || c.phone || c.beneficiaryPhone));

    if (sessionsCount === 0) {
      alerts.push({
        id: `${caseId}-no-sessions`,
        caseId,
        childName,
        organization,
        severity: "info",
        title: "الحالة لم تبدأ بعد",
        message: "لا توجد جلسات مسجلة لهذه الحالة، لذلك لا يتم تصنيفها كخطر.",
        recommendation: "إضافة أول جلسة أو تقييم مبدئي للحالة.",
      });
      return;
    }

    if (status === "حرجة") {
      alerts.push({
        id: `${caseId}-critical`,
        caseId,
        childName,
        organization,
        severity: "high",
        title: "حالة حرجة",
        message: "الحالة مصنفة كحرجة ولديها بيانات متابعة.",
        recommendation: "مراجعة الخطة العلاجية وتحديد موعد قريب مع المختص.",
      });
    }

    if (absentSessions >= 2) {
      alerts.push({
        id: `${caseId}-absence-high`,
        caseId,
        childName,
        organization,
        severity: "high",
        title: "غياب متكرر",
        message: `تم تسجيل ${absentSessions} جلسات غائبة أو فائتة.`,
        recommendation: "التواصل مع الأسرة وإعادة جدولة الجلسات.",
      });
    } else if (absentSessions === 1) {
      alerts.push({
        id: `${caseId}-absence-medium`,
        caseId,
        childName,
        organization,
        severity: "medium",
        title: "غياب عن جلسة",
        message: "تم تسجيل جلسة غائبة واحدة.",
        recommendation: "متابعة سبب الغياب وتأكيد الموعد القادم.",
      });
    }

    if (postponedSessions > 0) {
      alerts.push({
        id: `${caseId}-postponed`,
        caseId,
        childName,
        organization,
        severity: "medium",
        title: "جلسات مؤجلة",
        message: `يوجد ${postponedSessions} جلسة مؤجلة.`,
        recommendation: "إعادة جدولة الجلسات المؤجلة خلال هذا الأسبوع.",
      });
    }

    if (!hasSpecialist) {
      alerts.push({
        id: `${caseId}-no-specialist`,
        caseId,
        childName,
        organization,
        severity: "medium",
        title: "لا يوجد مختص",
        message: "الحالة لديها جلسات ولكن لا يوجد مختص مرتبط بها.",
        recommendation: "تعيين مختص أو دكتور مسؤول عن الحالة.",
      });
    }

    if (!hasPhone) {
      alerts.push({
        id: `${caseId}-no-phone`,
        caseId,
        childName,
        organization,
        severity: "info",
        title: "بيانات التواصل ناقصة",
        message: "رقم التواصل غير مكتمل أو غير موجود.",
        recommendation: "استكمال رقم تواصل الأسرة أو المستفيد.",
      });
    }
  });

  return alerts;
}

function getAlertStyle(severity: SmartAlert["severity"]) {
  if (severity === "high") return "border-red-200 bg-red-50";
  if (severity === "medium") return "border-orange-200 bg-orange-50";
  return "border-blue-200 bg-blue-50";
}

function getAlertIcon(severity: SmartAlert["severity"]) {
  if (severity === "high") return <ShieldAlert className="h-5 w-5 text-red-600" />;
  if (severity === "medium") return <TriangleAlert className="h-5 w-5 text-orange-600" />;
  return <AlertCircle className="h-5 w-5 text-blue-600" />;
}

export default function Alerts() {
  const casesQuery = trpc.cases.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const cases = toArray(casesQuery.data);

  const alerts = useMemo(() => buildAlerts(cases), [cases]);

  const highAlerts = alerts.filter((a) => a.severity === "high");
  const mediumAlerts = alerts.filter((a) => a.severity === "medium");
  const infoAlerts = alerts.filter((a) => a.severity === "info");

  const handleRefresh = async () => {
    await casesQuery.refetch();
  };

  return (
    <div dir="rtl" className="min-h-full space-y-6">
      <section className="rounded-3xl bg-[#0B2A3A] p-6 text-white shadow-sm">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
          <Brain className="h-4 w-4 text-orange-400" />
          AI Alerts
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">التنبيهات الذكية</h1>
            <p className="mt-2 text-sm text-white/70">
              تنبيهات مبنية على الحالات والجلسات والغياب واكتمال البيانات.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={casesQuery.isFetching}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-orange-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${casesQuery.isFetching ? "animate-spin" : ""}`}
            />
            تحديث التنبيهات
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="text-sm text-red-900">تنبيهات حرجة</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{highAlerts.length}</p>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
          <p className="text-sm text-orange-900">تنبيهات متابعة</p>
          <p className="mt-2 text-3xl font-bold text-orange-600">{mediumAlerts.length}</p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-sm text-blue-900">تنبيهات معلومات</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{infoAlerts.length}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-slate-500">إجمالي التنبيهات</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{alerts.length}</p>
        </div>
      </section>

      {casesQuery.isLoading && (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
          جاري تحميل التنبيهات...
        </div>
      )}

      {!casesQuery.isLoading && alerts.length === 0 && (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
          <p className="text-lg font-bold">لا توجد تنبيهات حالياً</p>
          <p className="mt-2 text-sm text-slate-500">جميع الحالات مستقرة حسب البيانات الحالية.</p>
        </div>
      )}

      {!casesQuery.isLoading && alerts.length > 0 && (
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-bold">قائمة التنبيهات</h2>
          </div>

          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-2xl border p-4 ${getAlertStyle(alert.severity)}`}
              >
                <div className="flex items-start gap-3">
                  {getAlertIcon(alert.severity)}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <p className="font-bold text-slate-900">{alert.title}</p>
                      <span className="text-xs text-slate-500">
                        حالة رقم #{alert.caseId}
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {alert.childName}
                    </p>

                    <p className="text-xs text-slate-500">{alert.organization}</p>

                    <p className="mt-3 text-sm text-slate-700">{alert.message}</p>

                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 p-3 text-sm text-slate-800">
                      <Activity className="h-4 w-4 text-orange-600" />
                      {alert.recommendation}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}