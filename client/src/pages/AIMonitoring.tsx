import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  Brain,
  CalendarCheck,
  Download,
  Eye,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

type RawCase = Record<string, any>;
type RawSession = Record<string, any>;

type SmartLevel = "غير محدد" | "ممتاز" | "متابعة" | "خطر";

type ClinicalReport = {
  id: string;
  caseId: number;
  title: string;
  reportType: string;
  doctorName: string;
  specialty?: string;
  reportDate: string | Date;
  reportText: string;
  recommendations?: string;
  administrativeNotes?: string;
  createdAt: string;
};

type MonitoringCase = {
  id: number;
  caseNumber: string;
  childName: string;
  organization: string;
  diagnosis: string;
  doctorName: string;
  sessionsCount: number;
  attendedSessions: number;
  absentSessions: number;
  postponedSessions: number;
  attendanceRate: number;
  reportsCount: number;
  lastReportDate?: string;
  riskLevel: SmartLevel;
  progressScore: number;
  financingStatus?: string;
  totalFinancing?: number;
  approvedSessionCount?: number;
  usedSessionCount?: number;
  remainingSessions?: number;
  fundingSource?: string;
  latestRecommendation?: string;
  needsCompletion: boolean;
  aiSummary: string;
  strengths: string[];
  weaknesses: string[];
  predictedOutcome: string;
  recommendedCarePlan: string;
  homePlanRecommendations: string[];
  administrativeRecommendations: string[];
  nextAction: string;
};

const CLINICAL_REPORTS_STORAGE_KEY = "anma-clinical-reports";
const CASE_SMART_SYNC_STORAGE_KEY = "anma-case-smart-sync";

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

function readJson(key: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getClinicalReportsByCase(caseId: number): ClinicalReport[] {
  const map = readJson(CLINICAL_REPORTS_STORAGE_KEY);
  const reports = map[String(caseId)];
  return Array.isArray(reports) ? reports : [];
}

function getStoredSmart(caseId: number) {
  return readJson(CASE_SMART_SYNC_STORAGE_KEY)[String(caseId)] || {};
}

function getLatestRecommendation(stored: Record<string, any>, reports: ClinicalReport[]) {
  const latestReport = reports[0];

  return (
    stored.recommendation ||
    latestReport?.recommendations ||
    latestReport?.reportText ||
    ""
  );
}

function getCompletionWarnings(caseItem: RawCase, reports: ClinicalReport[], stored: Record<string, any>) {
  const warnings: string[] = [];

  if (!text(caseItem.doctorName || caseItem.specialistName || caseItem.specialist)) {
    warnings.push("لا يوجد مختص مرتبط");
  }

  if (!text(caseItem.disabilityType || caseItem.disorderType || caseItem.diagnosis)) {
    warnings.push("نوع المرض / الإعاقة غير محدد");
  }

  if (!text(caseItem.organization || caseItem.organizationName)) {
    warnings.push("الجمعية غير محددة");
  }

  if (!reports.length) {
    warnings.push("لا يوجد تقرير مختص");
  }

  if (!stored.financingStatus && !stored.totalFinancing) {
    warnings.push("بيانات التمويل غير مكتملة");
  }

  return warnings;
}

function includesAny(source: string, words: string[]) {
  return words.some((word) => source.includes(word));
}

function getDiagnosis(caseItem: RawCase) {
  return text(
    caseItem.disabilityType ||
      caseItem.disorderType ||
      caseItem.diagnosis ||
      "غير محدد"
  );
}

function getOrganization(caseItem: RawCase) {
  return text(caseItem.organization || caseItem.organizationName || "غير محدد");
}

function getDoctor(caseItem: RawCase) {
  return text(
    caseItem.doctorName ||
      caseItem.specialistName ||
      caseItem.specialist ||
      "غير محدد"
  );
}

function getSessionsStats(caseItem: RawCase, sessions: RawSession[]) {
  const stored = getStoredSmart(Number(caseItem.id));

  const sessionsCount = Math.max(
    sessions.length,
    getNumber(caseItem.sessionsCount),
    getNumber(caseItem.totalSessions),
    getNumber(stored.sessionsCount),
    getNumber(stored.totalSessions)
  );

  const attendedSessions =
    sessions.filter((session: RawSession) => session.attendance === "حاضر").length ||
    getNumber(stored.attendedSessions);

  const absentSessions =
    sessions.filter((session: RawSession) => session.attendance === "غائب").length ||
    getNumber(stored.absentSessions);

  const postponedSessions =
    sessions.filter((session: RawSession) => session.attendance === "مؤجل").length ||
    getNumber(stored.postponedSessions);

  const attendanceRate =
    sessionsCount > 0 ? Math.round((attendedSessions / sessionsCount) * 100) : 0;

  return {
    sessionsCount,
    attendedSessions,
    absentSessions,
    postponedSessions,
    attendanceRate,
  };
}

function analyzeReports(
  caseItem: RawCase,
  sessions: RawSession[],
  reports: ClinicalReport[]
): MonitoringCase {
  const stats = getSessionsStats(caseItem, sessions);
  const stored = getStoredSmart(Number(caseItem.id));
  const completionWarnings = getCompletionWarnings(caseItem, reports, stored);
  const latestRecommendation = getLatestRecommendation(stored, reports);

  const combinedText = reports
    .map((report: ClinicalReport) =>
      [
        report.title,
        report.reportType,
        report.doctorName,
        report.specialty,
        report.reportText,
        report.recommendations,
        report.administrativeNotes,
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ")
    .toLowerCase();

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const homePlanRecommendations: string[] = [];
  const administrativeRecommendations: string[] = [];

  if (includesAny(combinedText, ["تحسن", "أفضل", "استجابة", "تطور", "تقدم"])) {
    strengths.push("توجد مؤشرات تحسن أو استجابة إيجابية في تقارير المختصين.");
  }

  if (includesAny(combinedText, ["تواصل بصري", "النظر", "عين"])) {
    strengths.push("تحسن أو ملاحظة مهمة في التواصل البصري.");
    homePlanRecommendations.push("تمارين تواصل بصري يومية من خلال اللعب لمدة 10 دقائق.");
  }

  if (includesAny(combinedText, ["انتباه", "تركيز"])) {
    strengths.push("وجود مؤشرات مرتبطة بالانتباه والتركيز.");
    homePlanRecommendations.push("تمارين انتباه قصيرة ومتكررة داخل المنزل.");
  }

  if (includesAny(combinedText, ["ضعف", "تأخر", "صعوبة", "لا يستطيع", "لم يتحسن"])) {
    weaknesses.push("توجد نقاط ضعف أو صعوبات متكررة في تقارير المختصين.");
  }

  if (includesAny(combinedText, ["تفاعل اجتماعي", "اجتماعي", "تفاعل"])) {
    weaknesses.push("الحالة تحتاج دعم إضافي في مهارات التفاعل الاجتماعي.");
    homePlanRecommendations.push("أنشطة لعب اجتماعي يومية لمدة 15 دقيقة.");
  }

  if (includesAny(combinedText, ["نطق", "تخاطب", "كلام", "لغة"])) {
    weaknesses.push("تحتاج الحالة إلى متابعة جانب اللغة والتخاطب.");
    homePlanRecommendations.push("تمارين تسمية الأشياء وتكرار الكلمات يومياً.");
  }

  if (includesAny(combinedText, ["سلوك", "غضب", "نوبات", "عدوان", "عناد"])) {
    weaknesses.push("توجد مؤشرات سلوكية تحتاج خطة تعديل سلوك.");
    administrativeRecommendations.push("توجيه الأسرة لتوثيق السلوكيات المتكررة ومثيراتها.");
  }

  if (stats.absentSessions >= 2 || includesAny(combinedText, ["غياب", "انقطاع", "عدم حضور"])) {
    weaknesses.push("يوجد مؤشر التزام يحتاج متابعة إدارية.");
    administrativeRecommendations.push("التواصل مع الأسرة لتحسين الالتزام بالحضور.");
  }

  let riskLevel: SmartLevel = "غير محدد";

  if (reports.length === 0 && stats.sessionsCount === 0) {
    riskLevel = "غير محدد";
  } else if (
    stats.absentSessions >= 3 ||
    includesAny(combinedText, ["خطر", "حرج", "تدهور", "إحالة عاجلة", "عدوان شديد"])
  ) {
    riskLevel = "خطر";
  } else if (weaknesses.length > 0 || stats.absentSessions > 0 || stats.postponedSessions > 0) {
    riskLevel = "متابعة";
  } else if (strengths.length > 0 || stats.sessionsCount > 0) {
    riskLevel = "ممتاز";
  }

  if (stored.smartLevel && stored.smartLevel !== "غير محدد") {
    riskLevel = stored.smartLevel as SmartLevel;
  }

  const progressScore =
    getNumber(stored.improvement) > 0
      ? getNumber(stored.improvement)
      : riskLevel === "ممتاز"
      ? 80
      : riskLevel === "متابعة"
      ? Math.max(45, 65 - weaknesses.length * 5 + strengths.length * 5)
      : riskLevel === "خطر"
      ? 30
      : 0;

  const aiSummary =
    reports.length === 0
      ? "لا توجد تقارير مختصين مرتبطة بهذه الحالة بعد. دقة التحليل سترتفع عند إضافة تقارير مختصين، وتظهر الحالة كحالة تحتاج استكمال."
      : riskLevel === "خطر"
      ? "تقارير المختصين والجلسات تشير إلى مؤشرات خطر أو تعثر تحتاج مراجعة عاجلة."
      : riskLevel === "متابعة"
      ? "تقارير المختصين تشير إلى احتياج الحالة لمتابعة منظمة وخطة مبنية على نقاط القوة والضعف."
      : "تقارير المختصين والجلسات تشير إلى مسار جيد مع إمكانية الاستمرار على الخطة الحالية.";

  const predictedOutcome =
    riskLevel === "خطر"
      ? "قد يتأخر تحقيق أهداف الخطة إذا لم تتم مراجعة الخطة والالتزام."
      : riskLevel === "متابعة"
      ? "من المتوقع تحسن تدريجي خلال 6 إلى 8 أسابيع إذا تم الالتزام بالتوصيات."
      : riskLevel === "ممتاز"
      ? "من المتوقع استمرار التحسن مع الالتزام بالخطة الحالية."
      : "لا يمكن إصدار توقع دقيق قبل توفر تقارير أو جلسات.";

  const recommendedCarePlan =
    latestRecommendation ||
    (riskLevel === "خطر"
      ? "مراجعة الخطة العلاجية بشكل عاجل، تحديد جلسة تقييم، وتكثيف المتابعة مع الأسرة."
      : riskLevel === "متابعة"
      ? "الاستمرار بجلسات منتظمة مع خطة منزلية يومية ومراجعة بعد 4 أسابيع."
      : riskLevel === "ممتاز"
      ? "الاستمرار على الخطة الحالية مع قياس أثر دوري."
      : "إضافة تقرير تقييم أولي أو جلسة متابعة لتفعيل التحليل الذكي.");

  if (!homePlanRecommendations.length) {
    homePlanRecommendations.push("تطبيق نشاط منزلي يومي لمدة 15 دقيقة مرتبط بهدف الجلسة.");
  }

  completionWarnings.forEach((warning) => {
    administrativeRecommendations.push(`استكمال: ${warning}`);
  });

  if (stored.financingStatus || stored.totalFinancing) {
    administrativeRecommendations.push(
      `متابعة التمويل: ${stored.financingStatus || "غير محدد"} - إجمالي ${stored.totalFinancing || 0} ريال`
    );
  }

  if (!administrativeRecommendations.length) {
    administrativeRecommendations.push("تحديث تقارير المختصين بشكل دوري وربطها بملف الحالة.");
  }

  const latestReport = reports[0];

  return {
    id: Number(caseItem.id),
    caseNumber: text(caseItem.caseNumber || `#${caseItem.id}`),
    childName: text(caseItem.childName || caseItem.name || "حالة بدون اسم"),
    organization: getOrganization(caseItem),
    diagnosis: getDiagnosis(caseItem),
    doctorName: getDoctor(caseItem),
    sessionsCount: stats.sessionsCount,
    attendedSessions: stats.attendedSessions,
    absentSessions: stats.absentSessions,
    postponedSessions: stats.postponedSessions,
    attendanceRate: stats.attendanceRate,
    reportsCount: Math.max(reports.length, getNumber(stored.reportsCount)),
    lastReportDate: latestReport?.reportDate
      ? new Date(latestReport.reportDate).toLocaleDateString("ar-SA")
      : stored.lastReportDate
      ? new Date(stored.lastReportDate).toLocaleDateString("ar-SA")
      : undefined,
    riskLevel,
    progressScore,
    financingStatus: stored.financingStatus || "",
    totalFinancing: getNumber(stored.totalFinancing),
    approvedSessionCount: getNumber(stored.approvedSessionCount),
    usedSessionCount: getNumber(stored.usedSessionCount),
    remainingSessions: getNumber(stored.remainingSessions),
    fundingSource: stored.fundingSource || "",
    latestRecommendation,
    needsCompletion: completionWarnings.length > 0,
    aiSummary,
    strengths: strengths.length ? Array.from(new Set(strengths)) : ["لا توجد نقاط قوة واضحة مكتوبة بعد."],
    weaknesses: weaknesses.length ? Array.from(new Set(weaknesses)) : ["لا توجد نقاط ضعف واضحة مكتوبة بعد."],
    predictedOutcome,
    recommendedCarePlan,
    homePlanRecommendations: Array.from(new Set(homePlanRecommendations)),
    administrativeRecommendations: Array.from(new Set(administrativeRecommendations)),
    nextAction:
      riskLevel === "خطر"
        ? "جدولة مراجعة عاجلة للخطة العلاجية."
        : "متابعة تنفيذ الخطة وتحديث التقرير بعد الجلسات القادمة.",
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCarePlanHtml(item: MonitoringCase) {
  const strengths = item.strengths.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  const weaknesses = item.weaknesses.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  const homePlan = item.homePlanRecommendations
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("");
  const adminPlan = item.administrativeRecommendations
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("");

  return `
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>خطة متابعة - ${escapeHtml(item.childName)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, "Tahoma", sans-serif;
            direction: rtl;
            padding: 32px;
            color: #111827;
            line-height: 1.8;
          }
          .header {
            border-bottom: 3px solid #ea580c;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .brand {
            color: #ea580c;
            font-weight: 800;
            font-size: 20px;
          }
          h1 { margin: 8px 0 0; font-size: 26px; }
          h2 {
            font-size: 18px;
            margin: 24px 0 8px;
            color: #1f2937;
            border-right: 4px solid #ea580c;
            padding-right: 10px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .box {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 14px;
            background: #f9fafb;
          }
          .badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 999px;
            background: #fff7ed;
            color: #c2410c;
            font-weight: 700;
          }
          ul { margin-top: 8px; }
          .footer {
            margin-top: 30px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
          }
          @media print {
            body { padding: 16px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">منصة أنما الذكية</div>
          <h1>خطة المتابعة المقترحة</h1>
          <p>تم توليد هذه الخطة بناءً على بيانات الحالة، الجلسات، وتقارير المختصين.</p>
        </div>

        <h2>بيانات الحالة</h2>
        <div class="grid">
          <div class="box"><b>اسم المستفيد:</b> ${escapeHtml(item.childName)}</div>
          <div class="box"><b>رقم الحالة:</b> ${escapeHtml(item.caseNumber)}</div>
          <div class="box"><b>الجمعية:</b> ${escapeHtml(item.organization)}</div>
          <div class="box"><b>نوع الإعاقة / المرض:</b> ${escapeHtml(item.diagnosis)}</div>
          <div class="box"><b>المختص:</b> ${escapeHtml(item.doctorName)}</div>
          <div class="box"><b>مستوى الخطورة:</b> <span class="badge">${escapeHtml(item.riskLevel)}</span></div>
          <div class="box"><b>عدد الجلسات:</b> ${escapeHtml(item.sessionsCount)}</div>
          <div class="box"><b>نسبة الحضور:</b> ${escapeHtml(item.attendanceRate)}%</div>
          <div class="box"><b>عدد تقارير المختصين:</b> ${escapeHtml(item.reportsCount)}</div>
          <div class="box"><b>مؤشر التقدم:</b> ${escapeHtml(item.progressScore)}%</div>
          <div class="box"><b>حالة التمويل:</b> ${escapeHtml(item.financingStatus || "غير محدد")}</div>
          <div class="box"><b>إجمالي التمويل:</b> ${escapeHtml(item.totalFinancing || 0)} ريال</div>
          <div class="box"><b>الجلسات المعتمدة:</b> ${escapeHtml(item.approvedSessionCount || 0)}</div>
          <div class="box"><b>الجلسات المتبقية:</b> ${escapeHtml(item.remainingSessions || 0)}</div>
        </div>

        <h2>ملخص الذكاء الاصطناعي</h2>
        <div class="box">${escapeHtml(item.aiSummary)}</div>

        <h2>نقاط القوة</h2>
        <div class="box"><ul>${strengths}</ul></div>

        <h2>نقاط الضعف</h2>
        <div class="box"><ul>${weaknesses}</ul></div>

        <h2>الخطة العلاجية المقترحة</h2>
        <div class="box">${escapeHtml(item.recommendedCarePlan)}</div>

        <h2>الخطة المنزلية</h2>
        <div class="box"><ul>${homePlan}</ul></div>

        <h2>التوصيات الإدارية</h2>
        <div class="box"><ul>${adminPlan}</ul></div>

        <h2>التوقع المستقبلي</h2>
        <div class="box">${escapeHtml(item.predictedOutcome)}</div>

        <h2>الإجراء التالي</h2>
        <div class="box">${escapeHtml(item.nextAction)}</div>

        <div class="footer">
          ملاحظة: هذا التحليل مساعد إداري/سريري ولا يغني عن قرار المختص المعتمد.
          <br />
          تاريخ التوليد: ${new Date().toLocaleDateString("ar-SA")}
        </div>
      </body>
    </html>
  `;
}

function downloadCarePlan(item: MonitoringCase) {
  const html = buildCarePlanHtml(item);
  const win = window.open("", "_blank");

  if (!win) {
    alert("المتصفح منع فتح نافذة التحميل. اسمحي بالنوافذ المنبثقة ثم جربي مرة أخرى.");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
  }, 500);
}

function getRiskClass(level: SmartLevel) {
  if (level === "خطر") return "border-red-200 bg-red-50 text-red-700";
  if (level === "متابعة") return "border-amber-200 bg-amber-50 text-amber-700";
  if (level === "ممتاز") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function AIMonitoring() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [reportFilter, setReportFilter] = useState("all");
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<MonitoringCase | null>(null);

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

  useEffect(() => {
    const handler = () => {
      setRefreshTick((value) => value + 1);
      void casesQuery.refetch();
      void Promise.all(sessionsQueries.map((query: any) => query.refetch()));
    };

    window.addEventListener("anma-clinical-reports-updated", handler);
    window.addEventListener("anma-dashboard-data-updated", handler);
    window.addEventListener("anma-case-smart-sync-updated", handler);
    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener("anma-clinical-reports-updated", handler);
      window.removeEventListener("anma-dashboard-data-updated", handler);
      window.removeEventListener("anma-case-smart-sync-updated", handler);
      window.removeEventListener("storage", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases.length]);

  const monitoredCases = useMemo(() => {
    void refreshTick;

    return cases.map((caseItem: RawCase, index: number) => {
      const query = sessionsQueries[index];
      const sessions = Array.isArray(query?.data) ? (query.data as RawSession[]) : [];
      const reports = getClinicalReportsByCase(Number(caseItem.id));
      return analyzeReports(caseItem, sessions, reports);
    });
  }, [cases, sessionsQueries, refreshTick]);

  const filteredCases = monitoredCases.filter((item: MonitoringCase) => {
    const searchValue = search.trim().toLowerCase();

    const matchesSearch =
      !searchValue ||
      [
        item.childName,
        item.caseNumber,
        item.organization,
        item.diagnosis,
        item.doctorName,
        item.aiSummary,
        item.recommendedCarePlan,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue);

    const matchesRisk = riskFilter === "all" || item.riskLevel === riskFilter;

    const matchesReports =
      reportFilter === "all" ||
      (reportFilter === "withReports" && item.reportsCount > 0) ||
      (reportFilter === "withoutReports" && item.reportsCount === 0);

    return matchesSearch && matchesRisk && matchesReports;
  });

  const totalCases = filteredCases.length;
  const withReports = filteredCases.filter((item: MonitoringCase) => item.reportsCount > 0).length;
  const withoutReports = filteredCases.filter((item: MonitoringCase) => item.reportsCount === 0).length;
  const needsCompletion = filteredCases.filter((item: MonitoringCase) => item.needsCompletion).length;
  const totalFinancing = filteredCases.reduce((sum: number, item: MonitoringCase) => sum + getNumber(item.totalFinancing), 0);
  const highRisk = filteredCases.filter((item: MonitoringCase) => item.riskLevel === "خطر").length;
  const followUp = filteredCases.filter((item: MonitoringCase) => item.riskLevel === "متابعة").length;
  const averageProgress =
    filteredCases.length > 0
      ? Math.round(
          filteredCases.reduce((sum: number, item: MonitoringCase) => sum + item.progressScore, 0) /
            filteredCases.length
        )
      : 0;

  const priorityCases = filteredCases
    .filter(
      (item: MonitoringCase) =>
        item.riskLevel === "خطر" ||
        item.riskLevel === "متابعة" ||
        item.reportsCount === 0 ||
        item.needsCompletion
    )
    .slice(0, 6);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                <Brain className="h-4 w-4" />
                Smart Monitoring
              </div>

              <h1 className="text-2xl font-black text-slate-900">
                المراقبة الذكية
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                ملخص تنفيذي للحالات، الأولويات، التقارير، والتمويل.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setRefreshTick((value) => value + 1);
                void casesQuery.refetch();
                void Promise.all(sessionsQueries.map((query: any) => query.refetch()));
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-700"
            >
              <RefreshCw className="h-4 w-4" />
              تحديث
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">الحالات</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{totalCases}</p>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">لديها تقارير</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{withReports}</p>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">تحتاج تقرير</p>
            <p className="mt-2 text-2xl font-black text-amber-600">{withoutReports}</p>
          </div>

          <div className="rounded-2xl border bg-red-50 p-4 shadow-sm">
            <p className="text-xs text-red-700">أولوية عالية</p>
            <p className="mt-2 text-2xl font-black text-red-700">{highRisk}</p>
          </div>

          <div className="rounded-2xl border bg-amber-50 p-4 shadow-sm">
            <p className="text-xs text-amber-700">متابعة</p>
            <p className="mt-2 text-2xl font-black text-amber-700">{followUp}</p>
          </div>

          <div className="rounded-2xl border bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs text-emerald-700">متوسط التقدم</p>
            <p className="mt-2 text-2xl font-black text-emerald-700">{averageProgress}%</p>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="بحث باسم الحالة، الجمعية، التشخيص..."
                className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 pr-10 text-sm outline-none focus:border-orange-400"
              />
            </div>

            <select
              className="rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value)}
            >
              <option value="all">كل الأولويات</option>
              <option value="غير محدد">غير محدد</option>
              <option value="ممتاز">مستقر</option>
              <option value="متابعة">متابعة</option>
              <option value="خطر">أولوية عالية</option>
            </select>

            <select
              className="rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
              value={reportFilter}
              onChange={(event) => setReportFilter(event.target.value)}
            >
              <option value="all">كل الحالات</option>
              <option value="withReports">لديها تقارير</option>
              <option value="withoutReports">تحتاج تقارير</option>
            </select>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border bg-white p-5 shadow-sm xl:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">الحالات ذات الأولوية</h2>
                <p className="mt-1 text-xs text-slate-500">أهم الحالات التي تحتاج قرارًا أو استكمال بيانات.</p>
              </div>
              <Sparkles className="h-5 w-5 text-orange-600" />
            </div>

            <div className="space-y-3">
              {priorityCases.map((item: MonitoringCase) => (
                <div key={item.id} className="rounded-2xl border bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate font-black text-slate-900">{item.childName}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.organization} · {item.diagnosis}
                      </p>
                    </div>

                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getRiskClass(item.riskLevel)}`}>
                      {item.riskLevel === "خطر" ? "أولوية عالية" : item.riskLevel}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-[11px] text-slate-500">تقارير</p>
                      <p className="font-black">{item.reportsCount}</p>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-[11px] text-slate-500">حضور</p>
                      <p className="font-black">{item.attendanceRate}%</p>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-[11px] text-slate-500">تقدم</p>
                      <p className="font-black">{item.progressScore}%</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedPlan(item)}
                      className="rounded-xl bg-orange-600 p-3 text-xs font-bold text-white hover:bg-orange-700"
                    >
                      عرض القرار
                    </button>
                  </div>

                  <p className="mt-3 line-clamp-2 text-xs leading-6 text-slate-600">
                    {item.nextAction}
                  </p>
                </div>
              ))}

              {!priorityCases.length && (
                <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                  لا توجد حالات ذات أولوية حسب الفلاتر الحالية.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">جودة البيانات</h2>
            <p className="mt-1 text-xs text-slate-500">كلما زادت التقارير زادت دقة القرار الذكي.</p>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border bg-orange-50 p-4">
                <p className="text-xs text-orange-700">تحتاج إضافة تقرير</p>
                <p className="mt-2 text-3xl font-black text-orange-700">{withoutReports}</p>
              </div>

              <div className="rounded-2xl border bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">ملفات مكتملة جزئيًا</p>
                <p className="mt-2 text-3xl font-black text-emerald-700">{withReports}</p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-500">إجمالي التمويل المسجل</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {totalFinancing.toLocaleString("ar-SA")} ريال
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">كل الحالات</h2>
              <p className="text-xs text-slate-500">عرض مختصر للقرارات والمؤشرات.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-xs text-slate-500">
                  <th className="px-4 py-3 text-right">الحالة</th>
                  <th className="px-4 py-3 text-right">الجمعية</th>
                  <th className="px-4 py-3 text-right">التشخيص</th>
                  <th className="px-4 py-3 text-right">المختص</th>
                  <th className="px-4 py-3 text-right">تقارير</th>
                  <th className="px-4 py-3 text-right">حضور</th>
                  <th className="px-4 py-3 text-right">تقدم</th>
                  <th className="px-4 py-3 text-right">الأولوية</th>
                  <th className="px-4 py-3 text-right">الإجراء</th>
                </tr>
              </thead>

              <tbody>
                {filteredCases.map((item: MonitoringCase) => (
                  <tr key={item.id} className="border-b last:border-b-0 hover:bg-orange-50/40">
                    <td className="px-4 py-3">
                      <div className="font-black text-slate-900">{item.childName}</div>
                      <div className="text-xs text-slate-400">{item.caseNumber}</div>
                    </td>

                    <td className="px-4 py-3">{item.organization}</td>
                    <td className="px-4 py-3">{item.diagnosis}</td>
                    <td className="px-4 py-3">{item.doctorName}</td>
                    <td className="px-4 py-3">{item.reportsCount}</td>
                    <td className="px-4 py-3">{item.attendanceRate}%</td>

                    <td className="px-4 py-3">
                      <div className="flex min-w-[110px] items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-orange-500"
                            style={{ width: `${Math.min(item.progressScore, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold">{item.progressScore}%</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getRiskClass(item.riskLevel)}`}>
                        {item.riskLevel === "خطر" ? "أولوية عالية" : item.riskLevel}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPlan(item)}
                          className="rounded-xl border bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          عرض
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadCarePlan(item)}
                          className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700"
                        >
                          تحميل
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredCases.length && (
              <div className="py-10 text-center text-sm text-slate-500">
                لا توجد حالات مطابقة للفلاتر الحالية.
              </div>
            )}
          </div>
        </section>

        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">
                    خطة المتابعة المقترحة
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedPlan.childName} — {selectedPlan.organization}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">المرض</p>
                  <p className="mt-1 font-bold">{selectedPlan.diagnosis}</p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">الخطورة</p>
                  <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getRiskClass(selectedPlan.riskLevel)}`}>
                    {selectedPlan.riskLevel}
                  </span>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">الجلسات</p>
                  <p className="mt-1 font-bold">{selectedPlan.sessionsCount}</p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">الحضور</p>
                  <p className="mt-1 font-bold">{selectedPlan.attendanceRate}%</p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">التمويل</p>
                  <p className="mt-1 font-bold">{selectedPlan.financingStatus || "-"}</p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">إجمالي التمويل</p>
                  <p className="mt-1 font-bold">{selectedPlan.totalFinancing || 0} ريال</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border bg-orange-50 p-4">
                  <h3 className="font-bold text-orange-800">ملخص الذكاء الاصطناعي</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{selectedPlan.aiSummary}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-4">
                    <h3 className="font-bold text-slate-900">نقاط القوة</h3>
                    <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-slate-600">
                      {selectedPlan.strengths.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <h3 className="font-bold text-slate-900">نقاط الضعف</h3>
                    <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-slate-600">
                      {selectedPlan.weaknesses.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <h3 className="font-bold text-slate-900">الخطة العلاجية المقترحة</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {selectedPlan.recommendedCarePlan}
                  </p>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <h3 className="font-bold text-slate-900">الخطة المنزلية</h3>
                  <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-slate-600">
                    {selectedPlan.homePlanRecommendations.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <h3 className="font-bold text-slate-900">التوصيات الإدارية</h3>
                  <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-slate-600">
                    {selectedPlan.administrativeRecommendations.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <h3 className="font-bold text-slate-900">التوقع المستقبلي</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {selectedPlan.predictedOutcome}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  إغلاق
                </button>

                <button
                  type="button"
                  onClick={() => downloadCarePlan(selectedPlan)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700"
                >
                  <Download className="h-4 w-4" />
                  تحميل PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}