import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Download,
  FileText,
  BarChart3,
  Sparkles,
  Users,
  CalendarDays,
  ShieldAlert,
  Gauge,
  Building2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

const CASE_SMART_SYNC_STORAGE_KEY = "anma-case-smart-sync";
const CLINICAL_REPORTS_STORAGE_KEY = "anma-clinical-reports";

function readJsonMap(key: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function getNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getStoredSmart(caseId?: number | string) {
  if (!caseId) return {};
  return readJsonMap(CASE_SMART_SYNC_STORAGE_KEY)[String(caseId)] || {};
}

function getClinicalReportsByCase(caseId?: number | string) {
  if (!caseId) return [];
  const reports = readJsonMap(CLINICAL_REPORTS_STORAGE_KEY)[String(caseId)];
  return Array.isArray(reports) ? reports : [];
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToPrintHtml(markdown: string) {
  const lines = markdown.split("\n");

  return lines
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) return "<br />";

      if (trimmed.startsWith("# ")) {
        return `<h1>${escapeHtml(trimmed.replace("# ", ""))}</h1>`;
      }

      if (trimmed.startsWith("## ")) {
        return `<h2>${escapeHtml(trimmed.replace("## ", ""))}</h2>`;
      }

      if (trimmed.startsWith("### ")) {
        return `<h3>${escapeHtml(trimmed.replace("### ", ""))}</h3>`;
      }

      if (trimmed === "---") {
        return "<hr />";
      }

      if (trimmed.startsWith("- ")) {
        return `<div class="bullet">• ${escapeHtml(trimmed.replace("- ", ""))}</div>`;
      }

      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .join("\n");
}

function downloadTextFile(content: string, reportType: string) {
  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const element = document.createElement("a");

  element.href = url;
  element.download = `anma-report-${reportType}-${Date.now()}.txt`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);

  URL.revokeObjectURL(url);
}

function downloadPdfByPrint(content: string, title: string) {
  const win = window.open("", "_blank");

  if (!win) {
    toast.error("المتصفح منع فتح نافذة PDF. اسمحي بالنوافذ المنبثقة ثم جربي مرة أخرى.");
    return;
  }

  const html = `
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Tahoma, sans-serif;
            direction: rtl;
            color: #111827;
            padding: 34px;
            line-height: 1.8;
          }
          .header {
            border-bottom: 4px solid #ea580c;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .brand {
            color: #ea580c;
            font-weight: 900;
            font-size: 18px;
          }
          h1 {
            font-size: 26px;
            margin: 12px 0;
            color: #111827;
          }
          h2 {
            font-size: 19px;
            margin: 24px 0 8px;
            color: #1f2937;
            border-right: 4px solid #ea580c;
            padding-right: 10px;
          }
          h3 {
            font-size: 16px;
            margin: 18px 0 8px;
            color: #374151;
          }
          .bullet {
            padding: 5px 0;
          }
          p {
            margin: 6px 0;
          }
          hr {
            border: 0;
            border-top: 1px solid #e5e7eb;
            margin: 18px 0;
          }
          .footer {
            margin-top: 34px;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
            color: #6b7280;
            font-size: 12px;
          }
          @media print {
            body { padding: 18px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">منصة أنما</div>
          <h1>${escapeHtml(title)}</h1>
          <p>تاريخ التوليد: ${new Date().toLocaleString("ar-SA")}</p>
        </div>

        ${markdownToPrintHtml(content)}

        <div class="footer">
          هذا التقرير مولد من بيانات منصة أنما، ويستخدم لأغراض المتابعة الإدارية والتشغيلية.
        </div>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
  }, 500);
}

export default function Reports() {
  const [reportType, setReportType] = useState("summary");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportContent, setReportContent] = useState("");

  const casesQuery = trpc.cases.list.useQuery();

  const caseQuery = trpc.cases.getById.useQuery(
    { id: selectedCaseId || 0 },
    { enabled: Boolean(selectedCaseId) }
  );

  const sessionsQuery = trpc.sessions.getByCase.useQuery(
    { caseId: selectedCaseId || 0 },
    { enabled: Boolean(selectedCaseId) }
  );

  const impactQuery = trpc.impact.getByCase.useQuery(
    { caseId: selectedCaseId || 0 },
    { enabled: Boolean(selectedCaseId) }
  );

  const complianceQuery = trpc.compliance.getByCase.useQuery(
    { caseId: selectedCaseId || 0 },
    { enabled: Boolean(selectedCaseId) }
  );

  const financingQuery = trpc.financing.getByCase.useQuery(
    { caseId: selectedCaseId || 0 },
    { enabled: Boolean(selectedCaseId) }
  );

  const smartSummaryQuery = trpc.smart.caseSummary.useQuery(
    { caseId: selectedCaseId || 0 },
    { enabled: Boolean(selectedCaseId) }
  );

  const dashboardSummaryQuery = trpc.smart.dashboardSummary.useQuery();

  const selectedCase = caseQuery.data as any;
  const cases = (casesQuery.data || []) as any[];
  const sessions = (sessionsQuery.data || []) as any[];
  const impacts = (impactQuery.data || []) as any[];
  const compliances = (complianceQuery.data || []) as any[];
  const financings = (financingQuery.data || []) as any[];
  const smartSummary = smartSummaryQuery.data as any;
  const dashboardSummary = dashboardSummaryQuery.data as any;

  const organizations = useMemo(() => {
    return Array.from(
      new Set(
        cases
          .map((item) => safeText(item.organization || item.organizationName))
          .filter(Boolean)
      )
    ).sort();
  }, [cases]);

  const filteredOrganizationCases = useMemo(() => {
    if (selectedOrganization === "all") return cases;

    return cases.filter(
      (item) => safeText(item.organization || item.organizationName) === selectedOrganization
    );
  }, [cases, selectedOrganization]);

  const attendanceRate = useMemo(() => {
    if (!sessions.length) return 0;
    const present = sessions.filter((s) => s.attendance === "حاضر").length;
    return Math.round((present / sessions.length) * 100);
  }, [sessions]);

  const averageImprovement = useMemo(() => {
    if (!impacts.length) return 0;
    const total = impacts.reduce(
      (sum, item) => sum + Number(item.improvementPercentage || 0),
      0
    );
    return Math.round(total / impacts.length);
  }, [impacts]);

  const totalFinancing = useMemo(() => {
    return financings.reduce(
      (sum, item) => sum + Number(item.totalCost || 0),
      0
    );
  }, [financings]);

  const allClinicalReportsCount = useMemo(() => {
    const map = readJsonMap(CLINICAL_REPORTS_STORAGE_KEY);
    return Object.values(map).reduce((sum, item) => {
      return sum + (Array.isArray(item) ? item.length : 0);
    }, 0);
  }, [reportContent, cases.length]);

  const reportTypeLabel =
    reportType === "executive"
      ? "التقرير التنفيذي"
      : reportType === "summary"
      ? "ملخص الحالة"
      : reportType === "impact"
      ? "تقرير الأثر"
      : reportType === "sessions"
      ? "تقرير الجلسات"
      : reportType === "organization"
      ? "تقرير الجمعية"
      : reportType === "financing"
      ? "تقرير التمويل"
      : "تقرير الالتزام";

  const generateExecutiveReport = async () => {
    await Promise.all([casesQuery.refetch(), dashboardSummaryQuery.refetch()]);

    const totalCases =
      dashboardSummary?.totalCases ??
      dashboardSummary?.totalPatients ??
      cases.length ??
      0;

    const activeCases =
      dashboardSummary?.activeCases ??
      cases.filter((item) =>
        ["نشطة", "متابعة", "قيد المتابعة"].includes(item.status)
      ).length;

    const criticalCases =
      dashboardSummary?.criticalCases ??
      dashboardSummary?.highRiskCases ??
      cases.filter((item) =>
        ["حرجة", "متعثرة", "خطر"].includes(item.status)
      ).length;

    const followUpCases =
      dashboardSummary?.followUpCases ??
      dashboardSummary?.casesNeedingFollowUp ??
      cases.filter((item) =>
        ["متابعة", "قيد المتابعة", "نشطة"].includes(item.status)
      ).length;

    const stableCases =
      dashboardSummary?.stableCases ??
      Math.max(totalCases - criticalCases - followUpCases, 0);

    const totalSessions =
      dashboardSummary?.totalSessions ??
      dashboardSummary?.sessionsCount ??
      0;

    const completedSessions =
      dashboardSummary?.completedSessions ??
      dashboardSummary?.attendedSessions ??
      0;

    const missedSessions =
      dashboardSummary?.missedSessions ??
      dashboardSummary?.absentSessions ??
      0;

    const postponedSessions =
      dashboardSummary?.postponedSessions ??
      dashboardSummary?.delayedSessions ??
      0;

    const averageRiskScore =
      dashboardSummary?.averageRiskScore ??
      dashboardSummary?.riskScore ??
      0;

    const text = `
# التقرير التنفيذي لمنصة أنما

## 1. ملخص عام
- إجمالي الحالات: ${totalCases}
- الحالات النشطة: ${activeCases}
- الحالات الحرجة: ${criticalCases}
- الحالات المستقرة: ${stableCases}
- الحالات التي تحتاج متابعة: ${followUpCases}
- تقارير المختصين المسجلة: ${allClinicalReportsCount}

---

## 2. الجلسات
- إجمالي الجلسات: ${totalSessions}
- الجلسات المكتملة: ${completedSessions}
- الجلسات الغائبة: ${missedSessions}
- الجلسات المؤجلة: ${postponedSessions}

---

## 3. الذكاء والتنبيهات
- متوسط نسبة الخطر: ${averageRiskScore}%
- الحالات التي تحتاج متابعة: ${followUpCases}
- الحالات الحرجة: ${criticalCases}

---

## 4. قراءة تنفيذية
${
  criticalCases > 0
    ? `- يوجد ${criticalCases} حالة حرجة تحتاج مراجعة عاجلة.`
    : "- لا توجد حالات حرجة حالياً."
}
${
  followUpCases > 0
    ? `- يوجد ${followUpCases} حالة تحتاج متابعة تشغيلية أو علاجية.`
    : "- لا توجد حالات تحتاج متابعة حالياً."
}
${
  missedSessions > 0
    ? `- تم تسجيل ${missedSessions} جلسة غائبة أو فائتة.`
    : "- لا توجد جلسات غائبة حالياً."
}
${
  allClinicalReportsCount > 0
    ? `- يوجد ${allClinicalReportsCount} تقرير مختص يمكن استخدامه لتحسين دقة الخطط.`
    : "- لا توجد تقارير مختصين مسجلة حتى الآن."
}

---

تم إنشاء التقرير بتاريخ: ${new Date().toLocaleString("ar-SA")}
    `.trim();

    return text;
  };

  const generateOrganizationReport = async () => {
    await casesQuery.refetch();

    const orgCases = filteredOrganizationCases;
    const title =
      selectedOrganization === "all"
        ? "تقرير جميع الجمعيات"
        : `تقرير جمعية: ${selectedOrganization}`;

    const diagnosisStats = Array.from(
      orgCases.reduce((map: Map<string, number>, item: any) => {
        const diagnosis = safeText(item.disabilityType || item.disorderType || item.diagnosis || "غير محدد");
        map.set(diagnosis, (map.get(diagnosis) || 0) + 1);
        return map;
      }, new Map<string, number>())
    )
      .map(([name, count]) => `- ${name}: ${count}`)
      .join("\n");

    const riskStats = orgCases.reduce(
      (stats, item: any) => {
        const stored = getStoredSmart(item.id);
        const level = safeText(stored.smartLevel || item.riskLevel || item.status || "غير محدد");

        if (level.includes("خطر") || level.includes("متعثرة")) stats.high += 1;
        else if (level.includes("متابعة")) stats.follow += 1;
        else if (level.includes("ممتاز") || level.includes("نشطة")) stats.stable += 1;
        else stats.undefined += 1;

        return stats;
      },
      { high: 0, follow: 0, stable: 0, undefined: 0 }
    );

    const text = `
# ${title}

## 1. ملخص الحالات
- عدد الحالات: ${orgCases.length}
- حالات خطر / متعثرة: ${riskStats.high}
- حالات تحتاج متابعة: ${riskStats.follow}
- حالات مستقرة: ${riskStats.stable}
- حالات غير محددة: ${riskStats.undefined}

---

## 2. توزيع الأمراض / أنواع الإعاقة
${diagnosisStats || "- لا توجد بيانات كافية"}

---

## 3. الحالات
${
  orgCases.length
    ? orgCases
        .map((item: any) => {
          const stored = getStoredSmart(item.id);
          return `- ${item.childName || "-"} | ${item.caseNumber || "-"} | ${item.disabilityType || item.disorderType || "-"} | المختص: ${item.specialistName || item.specialist || "-"} | التصنيف: ${stored.smartLevel || item.status || "-"}`;
        })
        .join("\n")
    : "- لا توجد حالات"
}

---

## 4. توصيات إدارية
- متابعة الحالات التي لا تحتوي على مختص مرتبط.
- استكمال تقارير المختصين للحالات التي لم يتم توثيق تقاريرها.
- مراجعة حالات الخطر والمتابعة أسبوعياً.
- استخدام التقرير كأساس لتقرير شهري للجمعية.

---

تم إنشاء التقرير بتاريخ: ${new Date().toLocaleString("ar-SA")}
    `.trim();

    return text;
  };

  const generateCaseReport = async () => {
    if (!selectedCaseId) {
      toast.error("يرجى اختيار حالة");
      return "";
    }

    if (!selectedCase) {
      toast.error("لم يتم تحميل بيانات الحالة بعد");
      return "";
    }

    await Promise.all([
      caseQuery.refetch(),
      sessionsQuery.refetch(),
      impactQuery.refetch(),
      complianceQuery.refetch(),
      financingQuery.refetch(),
      smartSummaryQuery.refetch(),
    ]);

    const presentSessions = sessions.filter((s) => s.attendance === "حاضر").length;
    const absentSessions = sessions.filter((s) => s.attendance === "غائب").length;
    const postponedSessions = sessions.filter((s) => s.attendance === "مؤجل").length;
    const stored = getStoredSmart(selectedCaseId);
    const clinicalReports = getClinicalReportsByCase(selectedCaseId);

    const text = `
# ${reportTypeLabel}

## 1. معلومات الحالة
- اسم الطفل: ${selectedCase.childName || "-"}
- رقم الحالة: ${selectedCase.caseNumber || "-"}
- العمر: ${selectedCase.age || "-"}
- المدينة: ${selectedCase.city || "-"}
- الجمعية: ${selectedCase.organization || selectedCase.organizationName || "-"}
- نوع الاضطراب: ${selectedCase.disorderType || selectedCase.disabilityType || selectedCase.diagnosis || "-"}
- المختص: ${selectedCase.specialist || selectedCase.specialistName || "-"}
- الحالة الحالية: ${selectedCase.status || "-"}

---

## 2. الملخص الذكي
- التصنيف الذكي: ${stored.smartLevel || smartSummary?.status || smartSummary?.level || "-"}
- مؤشر التقدم: ${stored.improvement || 0}%
- نسبة الحضور: ${stored.attendanceRate || attendanceRate}%
- عدد التنبيهات: ${smartSummary?.alerts?.length ?? 0}
- عدد التوصيات: ${smartSummary?.recommendations?.length ?? 0}

### سبب التصنيف
- ${stored.reason || "لا يوجد سبب مسجل بعد"}

### التوصية الذكية
- ${stored.recommendation || "الاستمرار في المتابعة"}

---

## 3. تقارير المختصين
- عدد التقارير: ${clinicalReports.length}
${
  clinicalReports.length
    ? clinicalReports
        .map((report: any) => `- ${report.title || report.reportType || "تقرير"} | ${report.doctorName || "-"} | ${new Date(report.reportDate || report.createdAt).toLocaleDateString("ar-SA")}`)
        .join("\n")
    : "- لا توجد تقارير مختصين"
}

---

## 4. الجلسات
- عدد الجلسات: ${sessions.length}
- نسبة الحضور: ${attendanceRate}%
- عدد الحضور: ${presentSessions}
- عدد الغياب: ${absentSessions}
- عدد الجلسات المؤجلة: ${postponedSessions}

---

## 5. قياس الأثر
- عدد القياسات: ${impacts.length}
- متوسط التحسن: ${averageImprovement}%

---

## 6. التزام الأسرة
- عدد سجلات الالتزام: ${compliances.length}
${
  compliances[0]
    ? `- آخر مستوى التزام: ${compliances[0].commitmentLevel || "-"}`
    : "- لا توجد سجلات التزام"
}

---

## 7. التمويل
- عدد سجلات التمويل: ${financings.length}
- إجمالي التمويل: ${totalFinancing} ريال
- حالة التمويل: ${stored.financingStatus || financings[0]?.financingStatus || "-"}
- الجلسات المعتمدة: ${stored.approvedSessionCount || financings[0]?.approvedSessionCount || "-"}
- الجلسات المستخدمة: ${stored.usedSessionCount || financings[0]?.usedSessionCount || sessions.length}
- الجلسات المتبقية: ${stored.remainingSessions || "-"}

---

## 8. التوصية النهائية
${
  stored.smartLevel === "خطر"
    ? "- تحتاج الحالة مراجعة عاجلة للخطة العلاجية والتواصل مع الأسرة."
    : stored.smartLevel === "متابعة"
    ? "- تحتاج الحالة متابعة منتظمة وتحديث تقرير المختص."
    : "- الاستمرار بالخطة الحالية مع قياس أثر دوري."
}

---

تم إنشاء التقرير بتاريخ: ${new Date().toLocaleString("ar-SA")}
    `.trim();

    return text;
  };

  const generateFinancingReport = async () => {
    await casesQuery.refetch();

    const rows = filteredOrganizationCases.map((item: any) => {
      const stored = getStoredSmart(item.id);

      return {
        name: item.childName || "-",
        caseNumber: item.caseNumber || "-",
        organization: item.organization || item.organizationName || "-",
        fundingSource: stored.fundingSource || "-",
        status: stored.financingStatus || "-",
        total: getNumber(stored.totalFinancing),
        approved: getNumber(stored.approvedSessionCount),
        used: getNumber(stored.usedSessionCount),
        remaining: getNumber(stored.remainingSessions),
      };
    });

    const total = rows.reduce((sum, item) => sum + item.total, 0);

    const text = `
# تقرير التمويل

## 1. ملخص التمويل
- نطاق التقرير: ${selectedOrganization === "all" ? "جميع الجمعيات" : selectedOrganization}
- عدد الحالات: ${rows.length}
- إجمالي التمويل: ${total} ريال

---

## 2. تفاصيل الحالات
${
  rows.length
    ? rows
        .map(
          (item) =>
            `- ${item.name} | ${item.caseNumber} | ${item.organization} | الحالة: ${item.status} | الإجمالي: ${item.total} ريال | المعتمدة: ${item.approved} | المستخدمة: ${item.used} | المتبقية: ${item.remaining}`
        )
        .join("\n")
    : "- لا توجد بيانات تمويل"
}

---

## 3. توصيات
- مراجعة الحالات التي لا تحتوي على بيانات تمويل.
- مطابقة عدد الجلسات المستخدمة مع الجلسات الفعلية.
- تجهيز تقرير شهري للجهات الداعمة.

---

تم إنشاء التقرير بتاريخ: ${new Date().toLocaleString("ar-SA")}
    `.trim();

    return text;
  };

  const generateReport = async () => {
    setIsGenerating(true);

    try {
      const text =
        reportType === "executive"
          ? await generateExecutiveReport()
          : reportType === "organization"
          ? await generateOrganizationReport()
          : reportType === "financing"
          ? await generateFinancingReport()
          : await generateCaseReport();

      if (!text) return;

      setReportContent(text);
      toast.success("تم توليد التقرير بنجاح");
    } catch {
      toast.error("حدث خطأ في توليد التقرير");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadReport = () => {
    if (!reportContent) return;
    downloadTextFile(reportContent, reportType);
    toast.success("تم تحميل التقرير النصي");
  };

  const downloadPdf = () => {
    if (!reportContent) return;
    downloadPdfByPrint(reportContent, reportTypeLabel);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                <Sparkles className="h-4 w-4" />
                Smart Reports
              </div>

              <h1 className="text-2xl font-black text-slate-900">
                التقارير الذكية
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                إنشاء وتصدير التقارير التشغيلية والسريرية والتمويلية.
              </p>
            </div>

            <Button
              onClick={generateReport}
              disabled={isGenerating}
              className="h-11 gap-2 rounded-2xl bg-orange-600 px-5 font-bold hover:bg-orange-700"
            >
              <FileText className="h-4 w-4" />
              {isGenerating ? "جاري التوليد..." : "توليد التقرير"}
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Executive Report",
              subtitle: "ملخص الإدارة والمؤشرات",
              value: "executive",
              icon: BarChart3,
            },
            {
              title: "Clinical AI Report",
              subtitle: "تحليل الحالة وتقارير المختصين",
              value: "summary",
              icon: Sparkles,
            },
            {
              title: "Funding Report",
              subtitle: "التمويل والجلسات والتكلفة",
              value: "financing",
              icon: Wallet,
            },
            {
              title: "Organization Report",
              subtitle: "أداء الجمعية والحالات",
              value: "organization",
              icon: Building2,
            },
          ].map((item) => {
            const Icon = item.icon;
            const active = reportType === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setReportType(item.value)}
                className={`rounded-3xl border p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  active
                    ? "border-orange-200 bg-orange-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <Icon className={`mb-4 h-6 w-6 ${active ? "text-orange-600" : "text-slate-400"}`} />
                <p className="text-base font-black text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
              </button>
            );
          })}
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-black text-slate-900">إعدادات التقرير</h2>
            <p className="mt-1 text-xs text-slate-500">
              اختاري النطاق المطلوب ثم اضغطي توليد التقرير.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="rounded-2xl bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="executive">التقرير التنفيذي</SelectItem>
                <SelectItem value="organization">تقرير الجمعية</SelectItem>
                <SelectItem value="financing">تقرير التمويل</SelectItem>
                <SelectItem value="summary">ملخص الحالة</SelectItem>
                <SelectItem value="impact">تقرير الأثر</SelectItem>
                <SelectItem value="sessions">تقرير الجلسات</SelectItem>
                <SelectItem value="compliance">تقرير الالتزام</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedOrganization}
              onValueChange={setSelectedOrganization}
              disabled={reportType !== "organization" && reportType !== "financing"}
            >
              <SelectTrigger className="rounded-2xl bg-slate-50">
                <SelectValue placeholder="اختاري الجمعية" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">كل الجمعيات</SelectItem>
                {organizations.map((organization) => (
                  <SelectItem key={organization} value={organization}>
                    {organization}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedCaseId?.toString() || ""}
              onValueChange={(value) => setSelectedCaseId(Number(value))}
              disabled={
                reportType === "executive" ||
                reportType === "organization" ||
                reportType === "financing"
              }
            >
              <SelectTrigger className="rounded-2xl bg-slate-50">
                <SelectValue
                  placeholder={
                    reportType === "executive" ||
                    reportType === "organization" ||
                    reportType === "financing"
                      ? "لا يحتاج اختيار حالة"
                      : "اختاري الحالة"
                  }
                />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {casesQuery.data?.map((item: any) => (
                  <SelectItem key={item.id} value={item.id.toString()}>
                    {item.childName} ({item.caseNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={generateReport}
              disabled={isGenerating}
              className="h-11 gap-2 rounded-2xl bg-orange-600 font-bold hover:bg-orange-700"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "جاري التوليد..." : "Generate Report"}
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">الحالات</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {dashboardSummary?.totalCases ?? dashboardSummary?.totalPatients ?? cases.length ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">الجلسات</p>
            <p className="mt-2 text-2xl font-black text-blue-700">
              {dashboardSummary?.totalSessions ?? dashboardSummary?.sessionsCount ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border bg-red-50 p-4 shadow-sm">
            <p className="text-xs text-red-700">الحالات الحرجة</p>
            <p className="mt-2 text-2xl font-black text-red-700">
              {dashboardSummary?.criticalCases ?? dashboardSummary?.highRiskCases ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">الجمعيات</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {organizations.length}
            </p>
          </div>

          <div className="rounded-2xl border bg-green-50 p-4 shadow-sm">
            <p className="text-xs text-green-700">تقارير المختصين</p>
            <p className="mt-2 text-2xl font-black text-green-700">
              {allClinicalReportsCount}
            </p>
          </div>
        </section>

        {reportContent ? (
          <section className="rounded-3xl border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">معاينة التقرير</h2>
                <p className="mt-1 text-xs text-slate-500">
                  راجعي التقرير ثم حمليه بصيغة PDF أو TXT.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={downloadReport} variant="outline" className="gap-2 rounded-2xl">
                  <Download className="h-4 w-4" />
                  TXT
                </Button>

                <Button onClick={downloadPdf} className="gap-2 rounded-2xl bg-orange-600 hover:bg-orange-700">
                  <Wallet className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="p-5">
              <div className="max-h-[640px] overflow-y-auto rounded-2xl border bg-slate-50 p-5 leading-8">
                <Streamdown>{reportContent}</Streamdown>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm">
            <FileText className="mx-auto h-10 w-10 text-orange-500" />
            <h2 className="mt-4 text-lg font-black text-slate-900">
              لا يوجد تقرير مولد بعد
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              اختاري نوع التقرير ثم اضغطي توليد التقرير لعرض المعاينة هنا.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
