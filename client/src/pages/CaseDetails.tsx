import { useParams } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Sparkles,
  UserRound,
  CalendarCheck,
  ClipboardCheck,
  Wallet,
  Brain,
  AlertTriangle,
  TrendingUp,
  FileText,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

const lightInputClass = "placeholder:text-muted-foreground/40";


const CASE_SMART_SYNC_STORAGE_KEY = "anma-case-smart-sync";
const CLINICAL_REPORTS_STORAGE_KEY = "anma-clinical-reports";

type SmartLevel = "غير محدد" | "ممتاز" | "متابعة" | "خطر";

type StoredCaseSmartSync = {
  sessionsCount?: number;
  totalSessions?: number;
  attendedSessions?: number;
  absentSessions?: number;
  postponedSessions?: number;
  lastSessionDate?: string;
  smartLevel?: SmartLevel;
  statusKey?: "not_started" | "stable" | "follow_up" | "high_risk";
  reason?: string;
  recommendation?: string;
  suggestedSpecialist?: string;
  attendanceRate?: number;
  improvement?: number;
  reportsCount?: number;
  lastReportDate?: string;
  financingStatus?: string;
  totalFinancing?: number;
  approvedSessionCount?: number;
  usedSessionCount?: number;
  remainingSessions?: number;
  fundingSource?: string;
  needsFollowUp?: boolean;
  isHighRisk?: boolean;
  administrativeAlerts?: string[];
  latestReportTitle?: string;
  latestReportText?: string;
  latestReportDoctor?: string;
  latestReportType?: string;
  clinicalSummary?: string;
  suggestedDiagnosis?: string;
  smartNeed?: string;
  carePriority?: string;
  recommendedSessions?: number;
  expectedSessionCost?: number;
  expectedEvaluationCost?: number;
  expectedCareCost?: number;
  requiredSpecialistLevel?: string;
  requiredServiceType?: string;
  fundingDecision?: string;
  smartDecisionRationale?: string;
  updatedAt?: string;
};

function readCaseSmartSyncMap(): Record<string, StoredCaseSmartSync> {
  try {
    const raw = localStorage.getItem(CASE_SMART_SYNC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCaseSmartSync(caseId: number, data: StoredCaseSmartSync) {
  if (!caseId) return;

  const oldMap = readCaseSmartSyncMap();
  const nextMap = {
    ...oldMap,
    [String(caseId)]: {
      ...oldMap[String(caseId)],
      ...data,
      updatedAt: new Date().toISOString(),
    },
  };

  localStorage.setItem(CASE_SMART_SYNC_STORAGE_KEY, JSON.stringify(nextMap));
  window.dispatchEvent(new CustomEvent("anma-case-smart-sync-updated", { detail: nextMap[String(caseId)] }));
  window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
  window.dispatchEvent(new CustomEvent("anma-ai-monitoring-updated"));
}

type DoctorOption = {
  id: number;
  name: string;
  specialty: string;
  status?: string;
  professionalRank?: string;
  classification?: string;
  serviceType?: string;
  sessionCost?: number;
  evaluationCost?: number;
  sessionDuration?: number;
};

const sessionFormSchema = z.object({
  sessionDate: z.date(),
  sessionType: z.enum(["فردي", "جماعي"]),
  attendance: z.enum(["حاضر", "غائب", "مؤجل"]),
  progress: z.enum(["تحسن", "ثابت", "تراجع"]).optional(),
  specialistName: z.string().optional(),
  specialistSpecialty: z.string().optional(),
  notes: z.string().optional(),
});

const impactFormSchema = z.object({
  testName: z.string().min(1, "اسم الاختبار مطلوب"),
  valueType: z.enum(["رقم", "نسبة مئوية"]),
  betterDirection: z.enum(["أعلى أفضل", "أقل أفضل"]),
  baseline: z.string().min(1, "القيمة القبلية مطلوبة"),
  after: z.string().min(1, "القيمة البعدية مطلوبة"),
  measurementDate: z.date(),
});

const complianceFormSchema = z.object({
  attendancePercentage: z.string().min(1, "نسبة الحضور مطلوبة"),
  homeplanImplementation: z.boolean(),
  commitmentLevel: z.enum(["مرتفع", "متوسط", "منخفض"]),
  barrierType: z.string().optional(),
  specialistNotes: z.string().optional(),
  complianceDate: z.date(),
});

const financingFormSchema = z.object({
  fundingSource: z.string().optional(),
  approvedSessionCount: z.number().optional(),
  usedSessionCount: z.number().optional(),
  sessionCount: z.number().min(1, "عدد الجلسات مطلوب"),
  sessionCost: z.string().min(1, "تكلفة الجلسة مطلوبة"),
  financingStatus: z.enum(["معلق", "موافق عليه", "مدفوع", "مكتمل"]),
  financeNotes: z.string().optional(),
});

const clinicalReportFormSchema = z.object({
  title: z.string().min(1, "عنوان التقرير مطلوب"),
  reportType: z.enum([
    "تقرير تقييم أولي",
    "تقرير جلسة",
    "تقرير نطق وتخاطب",
    "تقرير علاج وظيفي",
    "تقرير علاج طبيعي",
    "تقرير نفسي",
    "تقرير نمو وسلوك",
    "تقرير تعديل سلوك",
    "تقرير متابعة",
    "تقرير ختامي",
  ]),
  doctorName: z.string().min(1, "اسم المختص مطلوب"),
  specialty: z.string().optional(),
  reportDate: z.date(),
  reportText: z.string().min(1, "نص التقرير مطلوب"),
  reportFileName: z.string().optional(),
  reportFileDataUrl: z.string().optional(),
  recommendations: z.string().optional(),
  administrativeNotes: z.string().optional(),
});

type SessionFormValues = z.infer<typeof sessionFormSchema>;
type ImpactFormValues = z.infer<typeof impactFormSchema>;
type ComplianceFormValues = z.infer<typeof complianceFormSchema>;
type FinancingFormValues = z.infer<typeof financingFormSchema>;
type ClinicalReportFormValues = z.infer<typeof clinicalReportFormSchema>;

type ClinicalReport = ClinicalReportFormValues & {
  id: string;
  caseId: number;
  createdAt: string;
};

type ClinicalReportAnalysis = {
  aiSummary: string;
  strengths: string[];
  weaknesses: string[];
  riskLevel: SmartLevel;
  predictedOutcome: string;
  recommendedCarePlan: string;
  homePlanRecommendations: string[];
  administrativeRecommendations: string[];
  nextAction: string;
  suggestedSpecialist: string;
  suggestedDiagnosis: string;
  progressScore: number;
};

function getNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampPercentage(value: any) {
  const n = getNumber(value);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function getBadgeClass(value: string) {
  if (["حاضر", "نشطة", "تحسن", "مرتفع", "ممتاز"].includes(value)) return "bg-green-100 text-green-800 border-green-200";
  if (["غائب", "تراجع", "منخفض", "خطر"].includes(value)) return "bg-red-100 text-red-800 border-red-200";
  if (["مؤجل", "ثابت", "متوسط", "متابعة", "معلق"].includes(value)) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (["جديدة"].includes(value)) return "bg-blue-100 text-blue-800 border-blue-200";
  if (["غير محدد"].includes(value)) return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function extractSpecialistFromNotes(notes?: string) {
  const text = notes || "";
  const name = text.match(/الأخصائي:\s*(.*)/)?.[1]?.split("\n")?.[0] || "";
  const specialty = text.match(/التخصص:\s*(.*)/)?.[1]?.split("\n")?.[0] || "";
  return { name, specialty };
}

function readClinicalReportsMap(): Record<string, ClinicalReport[]> {
  try {
    const raw = localStorage.getItem(CLINICAL_REPORTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getClinicalReportsByCase(caseId: number): ClinicalReport[] {
  if (!caseId) return [];
  const map = readClinicalReportsMap();
  return Array.isArray(map[String(caseId)]) ? map[String(caseId)] : [];
}

function saveClinicalReportsByCase(caseId: number, reports: ClinicalReport[]) {
  const map = readClinicalReportsMap();
  const nextMap = {
    ...map,
    [String(caseId)]: reports,
  };

  localStorage.setItem(CLINICAL_REPORTS_STORAGE_KEY, JSON.stringify(nextMap));
  writeCaseSmartSync(caseId, {
    reportsCount: reports.length,
    lastReportDate: reports[0]?.reportDate ? new Date(reports[0].reportDate).toISOString() : undefined,
    latestReportTitle: reports[0]?.title,
    latestReportText: reports[0]?.reportText,
    latestReportDoctor: reports[0]?.doctorName,
    latestReportType: reports[0]?.reportType,
  });
  window.dispatchEvent(
    new CustomEvent("anma-clinical-reports-updated", {
      detail: {
        caseId,
        reports,
      },
    })
  );
  window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function analyzeClinicalReports(reports: ClinicalReport[], caseData: any): ClinicalReportAnalysis {
  if (!reports.length) {
    return {
      aiSummary:
        "لا توجد تقارير مختصين مسجلة بعد. أضيفي تقرير مختص حتى يتم بناء خطة أدق للحالة.",
      strengths: [],
      weaknesses: [],
      riskLevel: "غير محدد",
      predictedOutcome: "سيتم توقع المسار بعد توفر تقارير المختصين.",
      recommendedCarePlan: "إضافة تقرير تقييم أولي أو تقرير متابعة من المختص.",
      homePlanRecommendations: ["تسجيل تقرير مختص أولي لتفعيل الخطة المنزلية."],
      administrativeRecommendations: ["استكمال ملف تقارير المختصين داخل الحالة."],
      nextAction: "إضافة أول تقرير مختص.",
      suggestedSpecialist: caseData?.specialist || "يحدد بعد التقرير",
      suggestedDiagnosis: caseData?.disorderType || caseData?.disabilityType || "غير محدد",
      progressScore: 0,
    };
  }

  const combinedText = reports
    .map((report) =>
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
    strengths.push("وجود مؤشرات تحسن أو استجابة أفضل حسب تقارير المختصين.");
  }

  if (includesAny(combinedText, ["تواصل بصري", "النظر", "عين"])) {
    strengths.push("تحسن أو ملاحظة مهمة في التواصل البصري.");
    homePlanRecommendations.push("تدريب يومي قصير على التواصل البصري من خلال اللعب.");
  }

  if (includesAny(combinedText, ["انتباه", "تركيز"])) {
    strengths.push("وجود مؤشرات مرتبطة بالانتباه والتركيز.");
    homePlanRecommendations.push("تمارين انتباه قصيرة ومتكررة داخل المنزل.");
  }

  if (includesAny(combinedText, ["ضعف", "تأخر", "صعوبة", "لا يستطيع", "لم يتحسن"])) {
    weaknesses.push("وجود نقاط ضعف أو صعوبات متكررة مذكورة في التقرير.");
  }

  if (includesAny(combinedText, ["تفاعل اجتماعي", "اجتماعي", "تفاعل"])) {
    weaknesses.push("الحالة تحتاج دعم إضافي في مهارات التفاعل الاجتماعي.");
    homePlanRecommendations.push("أنشطة لعب اجتماعي يومية لمدة 10-15 دقيقة.");
  }

  if (includesAny(combinedText, ["نطق", "تخاطب", "كلام", "لغة"])) {
    weaknesses.push("تحتاج الحالة إلى متابعة جانب اللغة والتخاطب.");
    homePlanRecommendations.push("تمارين تسمية الأشياء وتكرار الكلمات بشكل يومي.");
  }

  if (includesAny(combinedText, ["سلوك", "نوبات", "غضب", "عدوان", "عناد"])) {
    weaknesses.push("توجد مؤشرات سلوكية تحتاج خطة تعديل سلوك.");
    administrativeRecommendations.push("توجيه الأسرة لتوثيق السلوكيات المتكررة ومثيراتها.");
  }

  if (includesAny(combinedText, ["غياب", "عدم حضور", "انقطاع"])) {
    weaknesses.push("يوجد مؤشر التزام يحتاج متابعة.");
    administrativeRecommendations.push("التواصل مع الأسرة لتحسين الالتزام بالحضور.");
  }

  let suggestedDiagnosis =
    caseData?.disabilityType || caseData?.disorderType || caseData?.diagnosis || "غير محدد";
  let suggestedSpecialist = caseData?.specialist || "أخصائي نمو وسلوك";

  if (includesAny(combinedText, ["توحد", "تواصل", "تفاعل"])) {
    suggestedDiagnosis = "اشتباه اضطراب طيف التوحد / اضطراب تواصل";
    suggestedSpecialist = "طبيب نمو وسلوك + أخصائي تعديل سلوك";
  } else if (includesAny(combinedText, ["نطق", "تخاطب", "لغة", "كلام"])) {
    suggestedDiagnosis = "تأخر نطق / اضطراب لغة وتواصل";
    suggestedSpecialist = "أخصائي نطق وتخاطب";
  } else if (includesAny(combinedText, ["فرط", "انتباه", "تركيز", "adhd"])) {
    suggestedDiagnosis = "اشتباه فرط حركة وتشتت انتباه";
    suggestedSpecialist = "طبيب نمو وسلوك / أخصائي نفسي";
  } else if (includesAny(combinedText, ["حركي", "توازن", "مشي", "عضلات"])) {
    suggestedDiagnosis = "تأخر أو صعوبة حركية";
    suggestedSpecialist = "أخصائي علاج طبيعي / علاج وظيفي";
  }

  const negativeSignals = weaknesses.length;
  const positiveSignals = strengths.length;
  const hasRiskWords = includesAny(combinedText, [
    "تدهور",
    "خطر",
    "إحالة عاجلة",
    "حرج",
    "إيذاء",
    "عدوان شديد",
    "انقطاع",
  ]);

  let riskLevel: SmartLevel = "متابعة";
  if (hasRiskWords || negativeSignals >= 4) riskLevel = "خطر";
  else if (positiveSignals >= 2 && negativeSignals === 0) riskLevel = "ممتاز";
  else riskLevel = "متابعة";

  const progressScore =
    riskLevel === "ممتاز"
      ? 80
      : riskLevel === "متابعة"
      ? Math.max(45, 65 - negativeSignals * 5 + positiveSignals * 5)
      : 30;

  const aiSummary =
    riskLevel === "خطر"
      ? "تقارير المختصين تشير إلى وجود مؤشرات تحتاج تدخل عاجل أو مراجعة الخطة العلاجية."
      : riskLevel === "ممتاز"
      ? "تقارير المختصين تشير إلى تقدم جيد واستجابة إيجابية للخطة الحالية."
      : "تقارير المختصين تشير إلى احتياج الحالة لمتابعة منتظمة وخطة علاجية مبنية على نقاط القوة والضعف.";

  const predictedOutcome =
    riskLevel === "خطر"
      ? "قد يتأخر تحقيق أهداف الخطة إذا لم يتم التدخل ومراجعة الالتزام والخطة."
      : riskLevel === "ممتاز"
      ? "من المتوقع استمرار التحسن مع الالتزام بالخطة الحالية."
      : "من المتوقع تحسن تدريجي خلال 6 إلى 8 أسابيع إذا تم الالتزام بالخطة والتوصيات المنزلية.";

  const recommendedCarePlan =
    reports[0]?.recommendations ||
    (riskLevel === "خطر"
      ? "مراجعة الخطة العلاجية بشكل عاجل، تحديد جلسة تقييم، وتكثيف المتابعة مع الأسرة."
      : "الاستمرار بخطة جلسات منتظمة، متابعة القياس، وتفعيل الخطة المنزلية اليومية.");

  if (!homePlanRecommendations.length) {
    homePlanRecommendations.push("تطبيق نشاط منزلي يومي لمدة 15 دقيقة مرتبط بهدف الجلسة.");
  }

  if (!administrativeRecommendations.length) {
    administrativeRecommendations.push("متابعة تحديث تقارير المختصين بشكل دوري كل 4 أسابيع.");
  }

  return {
    aiSummary,
    strengths: strengths.length ? Array.from(new Set(strengths)) : ["لا توجد نقاط قوة واضحة مكتوبة بعد."],
    weaknesses: weaknesses.length ? Array.from(new Set(weaknesses)) : ["لا توجد نقاط ضعف واضحة مكتوبة بعد."],
    riskLevel,
    predictedOutcome,
    recommendedCarePlan,
    homePlanRecommendations: Array.from(new Set(homePlanRecommendations)),
    administrativeRecommendations: Array.from(new Set(administrativeRecommendations)),
    nextAction:
      riskLevel === "خطر"
        ? "جدولة مراجعة عاجلة للخطة العلاجية."
        : "متابعة تنفيذ الخطة وتحديث التقرير بعد الجلسات القادمة.",
    suggestedSpecialist,
    suggestedDiagnosis,
    progressScore,
  };
}

export default function CaseDetails() {
  const { id } = useParams();
  const caseId = parseInt(id || "0");

  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isImpactDialogOpen, setIsImpactDialogOpen] = useState(false);
  const [isComplianceDialogOpen, setIsComplianceDialogOpen] = useState(false);
  const [isFinancingDialogOpen, setIsFinancingDialogOpen] = useState(false);
  const [isClinicalReportDialogOpen, setIsClinicalReportDialogOpen] = useState(false);
  const [clinicalReports, setClinicalReports] = useState<ClinicalReport[]>([]);

  const caseQuery = trpc.cases.getById.useQuery({ id: caseId });
  const sessionsQuery = trpc.sessions.getByCase.useQuery({ caseId });
  const impactQuery = trpc.impact.getByCase.useQuery({ caseId });
  const complianceQuery = trpc.compliance.getByCase.useQuery({ caseId });
  const financingQuery = trpc.financing.getByCase.useQuery({ caseId });
  const doctorsQuery = trpc.doctors.list.useQuery();

  useEffect(() => {
    setClinicalReports(getClinicalReportsByCase(caseId));
  }, [caseId]);

  const specialistOptions = useMemo<DoctorOption[]>(() => {
    return ((doctorsQuery.data || []) as any[])
      .filter((doctor) => doctor.status !== "موقوف")
      .map((doctor) => ({
        id: Number(doctor.id),
        name: String(doctor.name || ""),
        specialty: String(doctor.specialty || ""),
        status: doctor.status,
        professionalRank: String(doctor.professionalRank || doctor.rank || doctor.classification || ""),
        classification: String(doctor.classification || doctor.professionalRank || doctor.rank || ""),
        serviceType: String(doctor.serviceType || doctor.specialty || ""),
        sessionCost: getNumber(doctor.sessionCost || doctor.followUpSessionCost || doctor.pricePerSession),
        evaluationCost: getNumber(doctor.evaluationCost || doctor.assessmentCost || doctor.initialEvaluationCost),
        sessionDuration: getNumber(doctor.sessionDuration || doctor.durationMinutes || 45),
      }));
  }, [doctorsQuery.data]);

  const sessionForm = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: {
      sessionDate: new Date(),
      sessionType: "فردي",
      attendance: "حاضر",
      progress: "تحسن",
      specialistName: "",
      specialistSpecialty: "",
      notes: "",
    },
  });

  const impactForm = useForm<ImpactFormValues>({
    resolver: zodResolver(impactFormSchema),
    defaultValues: {
      testName: "قياس عام",
      valueType: "رقم",
      betterDirection: "أعلى أفضل",
      baseline: "",
      after: "",
      measurementDate: new Date(),
    },
  });

  const complianceForm = useForm<ComplianceFormValues>({
    resolver: zodResolver(complianceFormSchema),
    defaultValues: {
      attendancePercentage: "",
      homeplanImplementation: false,
      commitmentLevel: "متوسط",
      barrierType: "",
      specialistNotes: "",
      complianceDate: new Date(),
    },
  });

  const financingForm = useForm<FinancingFormValues>({
    resolver: zodResolver(financingFormSchema),
    defaultValues: {
      fundingSource: "",
      approvedSessionCount: 8,
      usedSessionCount: 0,
      sessionCount: 8,
      sessionCost: "100",
      financingStatus: "معلق",
      financeNotes: "",
    },
  });

  const clinicalReportForm = useForm<ClinicalReportFormValues>({
    resolver: zodResolver(clinicalReportFormSchema),
    defaultValues: {
      title: "",
      reportType: "تقرير متابعة",
      doctorName: "",
      specialty: "",
      reportDate: new Date(),
      reportText: "",
      reportFileName: "",
      reportFileDataUrl: "",
      recommendations: "",
      administrativeNotes: "",
    },
  });

  const attendanceValue = sessionForm.watch("attendance");



  const createSessionMutation = trpc.sessions.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الجلسة بنجاح");
      void sessionsQuery.refetch();
      void caseQuery.refetch();
      window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
      setIsSessionDialogOpen(false);
      sessionForm.reset({
        sessionDate: new Date(),
        sessionType: "فردي",
        attendance: "حاضر",
        progress: "تحسن",
        specialistName: "",
        specialistSpecialty: "",
        notes: "",
      });
    },
    onError: (error: any) => toast.error(error.message || "حدث خطأ في إضافة الجلسة"),
  });

  const createImpactMutation = trpc.impact.create.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل قياس الأثر بنجاح");
      void impactQuery.refetch();
      window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
      setIsImpactDialogOpen(false);
      impactForm.reset({
        testName: "قياس عام",
        valueType: "رقم",
        betterDirection: "أعلى أفضل",
        baseline: "",
        after: "",
        measurementDate: new Date(),
      });
    },
    onError: (error: any) => toast.error(error.message || "حدث خطأ في تسجيل قياس الأثر"),
  });

  const createComplianceMutation = trpc.compliance.create.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الالتزام بنجاح");
      void complianceQuery.refetch();
      window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
      setIsComplianceDialogOpen(false);
      complianceForm.reset({
        attendancePercentage: "",
        homeplanImplementation: false,
        commitmentLevel: "متوسط",
        barrierType: "",
        specialistNotes: "",
        complianceDate: new Date(),
      });
    },
    onError: (error: any) => toast.error(error.message || "حدث خطأ في تسجيل الالتزام"),
  });

  const createFinancingMutation = trpc.financing.create.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل التمويل بنجاح");
      void financingQuery.refetch();
      window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
      setIsFinancingDialogOpen(false);
      financingForm.reset({
        fundingSource: "",
        approvedSessionCount: 8,
        usedSessionCount: 0,
        sessionCount: 8,
        sessionCost: "100",
        financingStatus: "معلق",
        financeNotes: "",
      });
    },
    onError: (error: any) => toast.error(error.message || "حدث خطأ في تسجيل التمويل"),
  });

  const analysisMutation = trpc.analysis.analyzeCaseProgress.useMutation({
    onError: (error: any) => toast.error(error.message || "حدث خطأ أثناء تحليل الحالة"),
  });

  const caseData: any = caseQuery.data;

  const totalFinancing = useMemo(() => {
    return financingQuery.data?.reduce(
      (sum: number, item: any) =>
        sum + Number(item.totalCost || item.totalFinancing || 0),
      0
    ) || 0;
  }, [financingQuery.data]);

  const latestFinancing = useMemo(() => {
    const financing = financingQuery.data || [];
    return financing[0] || null;
  }, [financingQuery.data]);

  const financingSummary = useMemo(() => {
    const approved = getNumber(latestFinancing?.approvedSessionCount || 0);
    const used = getNumber(latestFinancing?.usedSessionCount || sessionsQuery.data?.length || 0);
    const remaining = Math.max(approved - used, 0);

    return {
      fundingSource: latestFinancing?.fundingSource || "",
      financingStatus: latestFinancing?.financingStatus || "",
      totalFinancing,
      approvedSessionCount: approved,
      usedSessionCount: used,
      remainingSessions: remaining,
    };
  }, [latestFinancing, sessionsQuery.data?.length, totalFinancing]);

  const linkedDoctor = useMemo(() => {
    const doctors = (doctorsQuery.data || []) as any[];
    return (
      doctors.find((doctor) => Number(doctor.id) === Number(caseData?.doctorId)) ||
      doctors.find((doctor) => doctor.name === caseData?.specialist) ||
      null
    );
  }, [doctorsQuery.data, caseData?.doctorId, caseData?.specialist]);

  useEffect(() => {
    if (!caseData) return;

    const currentDoctor = clinicalReportForm.getValues("doctorName");
    const currentSpecialty = clinicalReportForm.getValues("specialty");

    if (!currentDoctor && (linkedDoctor?.name || caseData.specialistName || caseData.specialist)) {
      clinicalReportForm.setValue(
        "doctorName",
        linkedDoctor?.name || caseData.specialistName || caseData.specialist || ""
      );
    }

    if (!currentSpecialty && (linkedDoctor?.specialty || caseData.specialistSpecialty)) {
      clinicalReportForm.setValue(
        "specialty",
        linkedDoctor?.specialty || caseData.specialistSpecialty || ""
      );
    }
  }, [caseData, linkedDoctor, clinicalReportForm]);


  const clinicalReportAnalysis = useMemo(() => {
    return analyzeClinicalReports(clinicalReports, caseData);
  }, [clinicalReports, caseData]);

  const smartStats = useMemo(() => {
    const sessions = sessionsQuery.data || [];
    const impacts = impactQuery.data || [];
    const compliance = complianceQuery.data || [];
    const financing = financingQuery.data || [];

    const totalSessions = sessions.length;
    const attendedSessions = sessions.filter((s: any) => s.attendance === "حاضر").length;
    const absentSessions = sessions.filter((s: any) => s.attendance === "غائب").length;
    const postponedSessions = sessions.filter((s: any) => s.attendance === "مؤجل").length;

    const hasSessions = totalSessions > 0;
    const hasImpacts = impacts.length > 0;
    const hasCompliance = compliance.length > 0;
    const hasAnyAnalysisData = hasSessions || hasImpacts || hasCompliance;

    const attendanceRate = hasSessions ? Math.round((attendedSessions / totalSessions) * 100) : 0;

    const latestImpact = impacts[0];
    const improvement = hasImpacts ? clampPercentage(latestImpact?.improvementPercentage || 0) : 0;

    const latestCompliance = compliance[0];
    const complianceRate = hasCompliance ? clampPercentage(latestCompliance?.attendancePercentage || attendanceRate) : 0;

    const approved = getNumber(financing[0]?.approvedSessionCount || 8);
    const used = getNumber(financing[0]?.usedSessionCount || totalSessions);
    const packageProgress = approved ? Math.min(100, Math.round((used / approved) * 100)) : 0;
    const remaining = Math.max(approved - used, 0);

    const missingSpecialist = !sessions.some((s: any) => {
      const extracted = extractSpecialistFromNotes(s.notes);
      return s.specialistName || s.specialistSpecialty || extracted.name || extracted.specialty;
    });

    const missingPhone = !(caseData?.familyPhone || caseData?.phone || caseData?.beneficiaryPhone);

    const administrativeAlerts: string[] = [];

    if (hasSessions && missingSpecialist) {
      administrativeAlerts.push("لا يوجد مختص مرتبط بالحالة");
    }

    if (missingPhone) {
      administrativeAlerts.push("بيانات التواصل ناقصة");
    }

    let level: SmartLevel = "غير محدد";
    let statusKey: "not_started" | "stable" | "follow_up" | "high_risk" = "not_started";
    let reason = "لا توجد جلسات بعد.";
    let needsFollowUp = false;
    let isHighRisk = false;

    const caseStatus = String(caseData?.status || caseData?.operationalStatus || "").trim();
    const isCriticalCase = caseStatus === "حرجة" || caseStatus === "متعثرة";

    if (!hasSessions) {
      level = "غير محدد";
      statusKey = "not_started";
      reason = "لا توجد جلسات بعد.";
      needsFollowUp = false;
      isHighRisk = false;
    } else if (absentSessions >= 3 || isCriticalCase) {
      level = "خطر";
      statusKey = "high_risk";
      needsFollowUp = true;
      isHighRisk = true;
      reason = absentSessions >= 3
        ? `تم تسجيل ${absentSessions} غيابات أو أكثر.`
        : "الحالة مصنفة كحرجة أو متعثرة وتحتاج مراجعة عاجلة.";
    } else if (absentSessions === 1 || absentSessions === 2 || postponedSessions > 0) {
      level = "متابعة";
      statusKey = "follow_up";
      needsFollowUp = true;
      isHighRisk = false;
      reason = "الحالة تحتاج متابعة بسبب غياب بسيط أو جلسات مؤجلة.";
    } else if (missingSpecialist || missingPhone) {
      level = "متابعة";
      statusKey = "follow_up";
      needsFollowUp = true;
      isHighRisk = false;
      reason = "الحالة مستقرة علاجيًا، لكن تحتاج متابعة إدارية بسبب نقص بيانات.";
    } else {
      level = "ممتاز";
      statusKey = "stable";
      needsFollowUp = false;
      isHighRisk = false;
      reason = "الحالة مستقرة، لديها جلسات ولا توجد غيابات أو مؤشرات خطر.";
    }

    const text = `${caseData?.disorderType || ""} ${caseData?.notes || ""} ${caseData?.description || ""}`;
    let suggestedDisorder = caseData?.disorderType || "غير محدد";
    let recommendedSpecialist = "أخصائي نمو وسلوك";
    let interventionPlan = "تقييم شامل، تحديد أهداف قصيرة، جلسات أسبوعية، متابعة منزلية، وقياس أثر شهري.";

    if (text.includes("نطق") || text.includes("كلام") || text.includes("تخاطب")) {
      suggestedDisorder = "تأخر نطق / اضطراب تواصل";
      recommendedSpecialist = "أخصائي نطق وتخاطب";
      interventionPlan = "جلسات تخاطب، تدريب الأسرة على تمارين التواصل، قياس مفردات الطفل شهريًا.";
    } else if (text.includes("توحد") || text.includes("تواصل") || text.includes("تفاعل")) {
      suggestedDisorder = "اشتباه اضطراب طيف التوحد";
      recommendedSpecialist = "طبيب نمو وسلوك + أخصائي تعديل سلوك";
      interventionPlan = "تقييم نمائي، خطة تعديل سلوك، تدريب مهارات تواصل، وجدولة جلسات منتظمة.";
    } else if (text.includes("ADHD") || text.includes("فرط") || text.includes("انتباه") || text.includes("تركيز")) {
      suggestedDisorder = "اشتباه ADHD";
      recommendedSpecialist = "طبيب نمو وسلوك / أخصائي نفسي";
      interventionPlan = "تقييم الانتباه، خطة تنظيم سلوكي، متابعة المدرسة، وتدريب الأسرة على التعزيز.";
    } else if (text.includes("تعلم") || text.includes("قراءة") || text.includes("كتابة")) {
      suggestedDisorder = "صعوبات تعلم";
      recommendedSpecialist = "أخصائي صعوبات تعلم";
      interventionPlan = "خطة تعليمية فردية، قياس قبلي وبعدي، وتمارين قراءة/كتابة تدريجية.";
    }

    const riskLevel =
      level === "خطر" ? "مرتفع" : level === "متابعة" ? "متوسط" : level === "ممتاز" ? "منخفض" : "غير محدد";

    const aiSummary =
      !hasAnyAnalysisData
        ? "لا توجد بيانات كافية بعد لإصدار ملخص سريري ذكي. أضيفي جلسة أو قياس أثر أو التزام الأسرة لرفع دقة التحليل."
        : level === "خطر"
        ? `تشير البيانات إلى وجود مؤشرات تعثر واضحة. ${reason} تحتاج الحالة إلى تدخل سريع ومراجعة الخطة العلاجية.`
        : level === "متابعة"
        ? `تشير البيانات إلى أن الحالة تحتاج متابعة منظمة. ${reason} يوصى بتقوية الالتزام وتحديث الخطة حسب ملاحظات المختص.`
        : "تشير البيانات إلى أن الحالة مستقرة وتسير بشكل جيد، مع عدم وجود مؤشرات خطر حالية.";

    const predictedOutcome =
      !hasAnyAnalysisData
        ? "سيتم توقع المسار العلاجي بعد تسجيل أول بيانات متابعة."
        : level === "خطر"
        ? "في حال استمرار نفس المؤشرات، قد تتأخر الحالة في تحقيق أهداف الخطة العلاجية."
        : level === "متابعة"
        ? "من المتوقع حدوث تحسن تدريجي إذا تم تحسين الالتزام بالحضور ومتابعة التوصيات."
        : "من المتوقع استمرار التحسن إذا استمر الالتزام الحالي بالخطة والجلسات.";

    const clinicalRecommendation =
      level === "خطر"
        ? "التواصل مع الأسرة، مراجعة الخطة العلاجية، وتحديد جلسة تقييم قريبة مع المختص المسؤول."
        : level === "متابعة"
        ? "زيادة المتابعة الأسبوعية، توثيق ملاحظات المختص، وتفعيل الخطة المنزلية."
        : level === "ممتاز"
        ? "الاستمرار على الخطة الحالية مع قياس أثر دوري."
        : "بدء الجلسات وتسجيل ملاحظات المختص لتفعيل التحليل الذكي.";

    return {
      riskLevel,
      aiSummary,
      predictedOutcome,
      clinicalRecommendation,
      totalSessions,
      attendedSessions,
      absentSessions,
      postponedSessions,
      attendanceRate,
      improvement,
      complianceRate,
      packageProgress,
      remaining,
      level,
      statusKey,
      reason,
      needsFollowUp,
      isHighRisk,
      administrativeAlerts,
      suggestedDisorder,
      recommendedSpecialist,
      interventionPlan,
      hasAnyAnalysisData,
      hasSessions,
      hasImpacts,
      hasCompliance,
    };
  }, [sessionsQuery.data, impactQuery.data, complianceQuery.data, financingQuery.data, caseData]);

  const finalProgressScore = useMemo(() => {
    const impactScore = clampPercentage(smartStats.improvement);
    const attendanceScore = clampPercentage(smartStats.attendanceRate);
    const complianceScore = clampPercentage(smartStats.complianceRate);
    const reportsScore = clinicalReports.length > 0 ? clinicalReportAnalysis.progressScore || 70 : 0;

    return Math.round(
      impactScore * 0.4 +
        attendanceScore * 0.3 +
        complianceScore * 0.2 +
        reportsScore * 0.1
    );
  }, [
    smartStats.improvement,
    smartStats.attendanceRate,
    smartStats.complianceRate,
    clinicalReports.length,
    clinicalReportAnalysis.progressScore,
  ]);

  const smartCareFundingPlan = useMemo(() => {
    const latestReportText = [
      clinicalReports[0]?.reportText,
      clinicalReports[0]?.recommendations,
      caseData?.notes,
      caseData?.disabilityType,
      caseData?.disorderType,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const currentLevel =
      clinicalReportAnalysis.riskLevel === "خطر" || smartStats.level === "خطر"
        ? "أولوية عالية"
        : clinicalReportAnalysis.riskLevel === "متابعة" || smartStats.level === "متابعة"
        ? "أولوية متابعة"
        : clinicalReportAnalysis.riskLevel === "ممتاز" || smartStats.level === "ممتاز"
        ? "مستقر"
        : "يحتاج تقييم أولي";

    const needsEvaluation = clinicalReports.length === 0 || !smartStats.hasSessions;
    const hasHighPriority = currentLevel === "أولوية عالية";
    const hasFollowUpPriority = currentLevel === "أولوية متابعة";

    let recommendedSessions = 4;

    if (hasHighPriority) recommendedSessions = 12;
    else if (hasFollowUpPriority) recommendedSessions = 8;
    else if (currentLevel === "مستقر") recommendedSessions = 4;
    else recommendedSessions = 1;

    let requiredServiceType =
      clinicalReportAnalysis.suggestedSpecialist ||
      smartStats.recommendedSpecialist ||
      linkedDoctor?.specialty ||
      "تقييم شامل";

    if (latestReportText.includes("نطق") || latestReportText.includes("تخاطب") || latestReportText.includes("لغة")) {
      requiredServiceType = "علاج نطق وتخاطب";
    } else if (latestReportText.includes("سلوك") || latestReportText.includes("توحد") || latestReportText.includes("تفاعل")) {
      requiredServiceType = "نمو وسلوك / تعديل سلوك";
    } else if (latestReportText.includes("حرك") || latestReportText.includes("عضلات") || latestReportText.includes("توازن")) {
      requiredServiceType = "علاج طبيعي / علاج وظيفي";
    } else if (latestReportText.includes("نفسي") || latestReportText.includes("قلق") || latestReportText.includes("انتباه")) {
      requiredServiceType = "نفسي / نمو وسلوك";
    }

    const requiredSpecialistLevel =
      hasHighPriority || needsEvaluation
        ? "استشاري أو أخصائي أول"
        : hasFollowUpPriority
        ? "أخصائي أول أو أخصائي"
        : "أخصائي";

    const doctorSessionCost =
      getNumber(linkedDoctor?.sessionCost || linkedDoctor?.pricePerSession) ||
      (requiredSpecialistLevel.includes("استشاري") ? 500 : requiredSpecialistLevel.includes("أخصائي أول") ? 350 : 250);

    const doctorEvaluationCost =
      getNumber(linkedDoctor?.evaluationCost || linkedDoctor?.assessmentCost) ||
      (requiredSpecialistLevel.includes("استشاري") ? 700 : requiredSpecialistLevel.includes("أخصائي أول") ? 500 : 350);

    const expectedCareCost =
      (needsEvaluation ? doctorEvaluationCost : 0) + recommendedSessions * doctorSessionCost;

    const fundingDecision =
      expectedCareCost >= 4000 || hasHighPriority
        ? "يحتاج اعتماد تمويل مرتفع"
        : expectedCareCost >= 2000 || hasFollowUpPriority
        ? "يحتاج اعتماد تمويل متوسط"
        : "احتياج تمويلي منخفض";

    const smartNeed =
      needsEvaluation
        ? "تقييم أولي شامل لتحديد الخطة"
        : hasHighPriority
        ? "تدخل عاجل ومراجعة خطة الرعاية"
        : hasFollowUpPriority
        ? "متابعة علاجية منتظمة مع قياس أثر"
        : "استمرار متابعة دورية";

    const smartDecisionRationale =
      `تم احتساب الاحتياج بناءً على مستوى الأولوية (${currentLevel})، عدد التقارير (${clinicalReports.length})، نسبة الحضور (${smartStats.attendanceRate}%)، ومؤشر التقدم (${finalProgressScore}%).`;

    return {
      smartNeed,
      carePriority: currentLevel,
      recommendedSessions,
      expectedSessionCost: doctorSessionCost,
      expectedEvaluationCost: needsEvaluation ? doctorEvaluationCost : 0,
      expectedCareCost,
      requiredSpecialistLevel,
      requiredServiceType,
      fundingDecision,
      smartDecisionRationale,
      needsEvaluation,
    };
  }, [
    clinicalReports,
    clinicalReportAnalysis.riskLevel,
    clinicalReportAnalysis.suggestedSpecialist,
    caseData,
    smartStats.level,
    smartStats.hasSessions,
    smartStats.recommendedSpecialist,
    smartStats.attendanceRate,
    finalProgressScore,
    linkedDoctor,
  ]);


  const latestSession = sessionsQuery.data?.[0];
  const latestImpact = impactQuery.data?.[0];
  const latestCompliance = complianceQuery.data?.[0];
  const latestReport = clinicalReports[0];

  const safeClinicalReportsForAI = useMemo(() => {
    return clinicalReports.map((report) => ({
      id: report.id,
      caseId: report.caseId,
      title: report.title,
      reportType: report.reportType,
      doctorName: report.doctorName,
      specialty: report.specialty,
      reportDate: report.reportDate,
      reportText: String(report.reportText || "").slice(0, 4000),
      recommendations: String(report.recommendations || "").slice(0, 2000),
      administrativeNotes: String(report.administrativeNotes || "").slice(0, 1000),
      reportFileName: report.reportFileName || "",
    }));
  }, [clinicalReports]);

  const safeSessionsForAI = useMemo(() => {
    return (sessionsQuery.data || []).map((session: any) => ({
      id: session.id,
      caseId: session.caseId,
      sessionDate: session.sessionDate,
      sessionType: session.sessionType,
      attendance: session.attendance,
      progress: session.progress,
      notes: String(session.notes || "").slice(0, 1500),
    }));
  }, [sessionsQuery.data]);

  const safeCaseDataForAI = useMemo(() => {
    if (!caseData) return {};
    return {
      id: caseData.id,
      caseNumber: caseData.caseNumber,
      childName: caseData.childName,
      age: caseData.age,
      gender: caseData.gender,
      city: caseData.city,
      organization: caseData.organization,
      organizationId: caseData.organizationId,
      doctorId: caseData.doctorId,
      specialist: caseData.specialist,
      specialistName: caseData.specialistName,
      specialistSpecialty: caseData.specialistSpecialty,
      disabilityType: caseData.disabilityType,
      disorderType: caseData.disorderType,
      diagnosis: caseData.diagnosis,
      status: caseData.status,
      operationalStatus: caseData.operationalStatus,
      notes: String(caseData.notes || "").slice(0, 2000),
      description: String(caseData.description || "").slice(0, 2000),
    };
  }, [caseData]);

  useEffect(() => {
    if (!caseId) return;

    const sessions = sessionsQuery.data || [];
    const latestSession = sessions[0];

    writeCaseSmartSync(caseId, {
      sessionsCount: smartStats.totalSessions,
      totalSessions: smartStats.totalSessions,
      attendedSessions: smartStats.attendedSessions,
      absentSessions: smartStats.absentSessions,
      postponedSessions: smartStats.postponedSessions,
      lastSessionDate: latestSession?.sessionDate
        ? new Date(latestSession.sessionDate).toISOString()
        : undefined,
      smartLevel: smartStats.level as SmartLevel,
      statusKey: smartStats.statusKey,
      reason: smartStats.reason,
      recommendation: smartStats.interventionPlan,
      suggestedSpecialist: smartStats.recommendedSpecialist,
      attendanceRate: smartStats.attendanceRate,
      improvement: finalProgressScore,
      reportsCount: clinicalReports.length,
      lastReportDate: clinicalReports[0]?.reportDate
        ? new Date(clinicalReports[0].reportDate).toISOString()
        : undefined,
      financingStatus: financingSummary.financingStatus,
      totalFinancing: financingSummary.totalFinancing,
      approvedSessionCount: financingSummary.approvedSessionCount,
      usedSessionCount: financingSummary.usedSessionCount,
      remainingSessions: financingSummary.remainingSessions,
      fundingSource: financingSummary.fundingSource,
      needsFollowUp: smartStats.needsFollowUp,
      isHighRisk: smartStats.isHighRisk,
      administrativeAlerts: smartStats.administrativeAlerts,
      latestReportTitle: clinicalReports[0]?.title,
      latestReportText: clinicalReports[0]?.reportText,
      latestReportDoctor: clinicalReports[0]?.doctorName,
      latestReportType: clinicalReports[0]?.reportType,
      clinicalSummary: clinicalReportAnalysis.aiSummary,
      suggestedDiagnosis: clinicalReportAnalysis.suggestedDiagnosis,
      smartNeed: smartCareFundingPlan.smartNeed,
      carePriority: smartCareFundingPlan.carePriority,
      recommendedSessions: smartCareFundingPlan.recommendedSessions,
      expectedSessionCost: smartCareFundingPlan.expectedSessionCost,
      expectedEvaluationCost: smartCareFundingPlan.expectedEvaluationCost,
      expectedCareCost: smartCareFundingPlan.expectedCareCost,
      requiredSpecialistLevel: smartCareFundingPlan.requiredSpecialistLevel,
      requiredServiceType: smartCareFundingPlan.requiredServiceType,
      fundingDecision: smartCareFundingPlan.fundingDecision,
      smartDecisionRationale: smartCareFundingPlan.smartDecisionRationale,
    });
  }, [
    caseId,
    sessionsQuery.data,
    impactQuery.data,
    complianceQuery.data,
    smartStats.totalSessions,
    smartStats.attendedSessions,
    smartStats.absentSessions,
    smartStats.postponedSessions,
    smartStats.level,
    smartStats.statusKey,
    smartStats.reason,
    smartStats.interventionPlan,
    smartStats.recommendedSpecialist,
    smartStats.attendanceRate,
    smartStats.improvement,
    finalProgressScore,
    clinicalReportAnalysis.progressScore,
    clinicalReports.length,
    clinicalReports,
    financingSummary,
    smartStats.needsFollowUp,
    smartStats.isHighRisk,
    smartStats.administrativeAlerts,
    smartCareFundingPlan,
  ]);

  useEffect(() => {
    if (!caseId || !clinicalReports.length) return;

    writeCaseSmartSync(caseId, {
      smartLevel: clinicalReportAnalysis.riskLevel,
      reason: clinicalReportAnalysis.aiSummary,
      recommendation: clinicalReportAnalysis.recommendedCarePlan,
      suggestedSpecialist: clinicalReportAnalysis.suggestedSpecialist,
      improvement: finalProgressScore,
      reportsCount: clinicalReports.length,
      lastReportDate: clinicalReports[0]?.reportDate
        ? new Date(clinicalReports[0].reportDate).toISOString()
        : undefined,
      financingStatus: financingSummary.financingStatus,
      totalFinancing: financingSummary.totalFinancing,
      approvedSessionCount: financingSummary.approvedSessionCount,
      usedSessionCount: financingSummary.usedSessionCount,
      remainingSessions: financingSummary.remainingSessions,
      fundingSource: financingSummary.fundingSource,
      needsFollowUp: clinicalReportAnalysis.riskLevel !== "ممتاز",
      isHighRisk: clinicalReportAnalysis.riskLevel === "خطر",
      latestReportTitle: clinicalReports[0]?.title,
      latestReportText: clinicalReports[0]?.reportText,
      latestReportDoctor: clinicalReports[0]?.doctorName,
      latestReportType: clinicalReports[0]?.reportType,
      clinicalSummary: clinicalReportAnalysis.aiSummary,
      suggestedDiagnosis: clinicalReportAnalysis.suggestedDiagnosis,
      smartNeed: smartCareFundingPlan.smartNeed,
      carePriority: smartCareFundingPlan.carePriority,
      recommendedSessions: smartCareFundingPlan.recommendedSessions,
      expectedSessionCost: smartCareFundingPlan.expectedSessionCost,
      expectedEvaluationCost: smartCareFundingPlan.expectedEvaluationCost,
      expectedCareCost: smartCareFundingPlan.expectedCareCost,
      requiredSpecialistLevel: smartCareFundingPlan.requiredSpecialistLevel,
      requiredServiceType: smartCareFundingPlan.requiredServiceType,
      fundingDecision: smartCareFundingPlan.fundingDecision,
      smartDecisionRationale: smartCareFundingPlan.smartDecisionRationale,
    });

    window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
  }, [caseId, clinicalReports.length, clinicalReports, clinicalReportAnalysis, financingSummary, finalProgressScore, smartCareFundingPlan]);

  const handleSessionSubmit = (data: SessionFormValues) => {
    const extraNotes = [
      data.specialistName ? `الأخصائي: ${data.specialistName}` : "",
      data.specialistSpecialty ? `التخصص: ${data.specialistSpecialty}` : "",
      data.notes || "",
    ]
      .filter(Boolean)
      .join("\n");

    createSessionMutation.mutate({
      caseId,
      sessionDate: data.sessionDate,
      sessionType: data.sessionType,
      attendance: data.attendance,
      progress: data.attendance === "غائب" || data.attendance === "مؤجل" ? "ثابت" : data.progress ?? "ثابت",
      notes: extraNotes,
    });
  };

  const handleImpactSubmit = (data: ImpactFormValues) => createImpactMutation.mutate({ ...data, caseId });
  const handleComplianceSubmit = (data: ComplianceFormValues) => {
    createComplianceMutation.mutate({
      ...data,
      caseId,
      attendancePercentage: String(clampPercentage(data.attendancePercentage)),
    });
  };
  const handleFinancingSubmit = (data: FinancingFormValues) => {
    const approved = getNumber(data.approvedSessionCount || data.sessionCount || 0);
    const used = getNumber(data.usedSessionCount || 0);
    const total = getNumber(data.sessionCount) * getNumber(data.sessionCost);

    writeCaseSmartSync(caseId, {
      financingStatus: data.financingStatus,
      totalFinancing: total,
      approvedSessionCount: approved,
      usedSessionCount: used,
      remainingSessions: Math.max(approved - used, 0),
      fundingSource: data.fundingSource || "",
    });

    createFinancingMutation.mutate({ ...data, caseId });
  };

  const handleClinicalReportSubmit = (data: ClinicalReportFormValues) => {
    const cleanedData: ClinicalReportFormValues = {
      ...data,
      doctorName: data.doctorName === "__none" ? "غير محدد" : data.doctorName,
    };

    const report: ClinicalReport = {
      ...cleanedData,
      id: `${caseId}-${Date.now()}`,
      caseId,
      createdAt: new Date().toISOString(),
    };

    const nextReports = [report, ...clinicalReports];
    setClinicalReports(nextReports);
    saveClinicalReportsByCase(caseId, nextReports);

    const nextAnalysis = analyzeClinicalReports(nextReports, caseData);
    writeCaseSmartSync(caseId, {
      smartLevel: nextAnalysis.riskLevel,
      reason: nextAnalysis.aiSummary,
      recommendation: nextAnalysis.recommendedCarePlan,
      suggestedSpecialist: nextAnalysis.suggestedSpecialist,
      improvement: finalProgressScore,
      reportsCount: nextReports.length,
      lastReportDate: nextReports[0]?.reportDate ? new Date(nextReports[0].reportDate).toISOString() : undefined,
      needsFollowUp: nextAnalysis.riskLevel !== "ممتاز",
      isHighRisk: nextAnalysis.riskLevel === "خطر",
      latestReportTitle: nextReports[0]?.title,
      latestReportText: nextReports[0]?.reportText,
      latestReportDoctor: nextReports[0]?.doctorName,
      latestReportType: nextReports[0]?.reportType,
      clinicalSummary: nextAnalysis.aiSummary,
      suggestedDiagnosis: nextAnalysis.suggestedDiagnosis,
    });

    toast.success("تم حفظ تقرير المختص وتحديث إدارة الحالات والمراقبة الذكية");
    setIsClinicalReportDialogOpen(false);
    clinicalReportForm.reset({
      title: "",
      reportType: "تقرير متابعة",
      doctorName: "",
      specialty: "",
      reportDate: new Date(),
      reportText: "",
      reportFileName: "",
      reportFileDataUrl: "",
      recommendations: "",
      administrativeNotes: "",
    });
  };

  const deleteClinicalReport = (reportId: string) => {
    const confirmed = confirm("هل أنت متأكدة من حذف تقرير المختص؟");
    if (!confirmed) return;

    const nextReports = clinicalReports.filter((report) => report.id !== reportId);
    setClinicalReports(nextReports);
    saveClinicalReportsByCase(caseId, nextReports);
    const nextAnalysis = analyzeClinicalReports(nextReports, caseData);
    writeCaseSmartSync(caseId, {
      smartLevel: nextAnalysis.riskLevel,
      reason: nextAnalysis.aiSummary,
      recommendation: nextAnalysis.recommendedCarePlan,
      improvement: finalProgressScore,
      reportsCount: nextReports.length,
      lastReportDate: nextReports[0]?.reportDate ? new Date(nextReports[0].reportDate).toISOString() : undefined,
      latestReportTitle: nextReports[0]?.title,
      latestReportText: nextReports[0]?.reportText,
      latestReportDoctor: nextReports[0]?.doctorName,
      latestReportType: nextReports[0]?.reportType,
      clinicalSummary: nextAnalysis.aiSummary,
      suggestedDiagnosis: nextAnalysis.suggestedDiagnosis,
    });
    toast.success("تم حذف التقرير وتحديث البيانات");
  };

  const downloadCarePlan = () => {
    const content = `
خطة الحالة - ${caseData?.childName || "حالة"}

رقم الحالة: ${caseData?.caseNumber || "-"}
الجمعية: ${caseData?.organization || "-"}
نوع الاضطراب: ${caseData?.disorderType || caseData?.disabilityType || "-"}
المختص: ${linkedDoctor?.name || caseData?.specialist || "-"}

التصنيف الذكي: ${clinicalReportAnalysis.riskLevel || smartStats.level}
مؤشر التقدم: ${finalProgressScore}%

قرار الرعاية والتمويل:
الاحتياج: ${smartCareFundingPlan.smartNeed}
الأولوية: ${smartCareFundingPlan.carePriority}
المختص المطلوب: ${smartCareFundingPlan.requiredSpecialistLevel} - ${smartCareFundingPlan.requiredServiceType}
عدد الجلسات المقترح: ${smartCareFundingPlan.recommendedSessions}
التكلفة المتوقعة: ${smartCareFundingPlan.expectedCareCost} ريال
قرار التمويل: ${smartCareFundingPlan.fundingDecision}
مبررات القرار: ${smartCareFundingPlan.smartDecisionRationale}

الملخص:
${clinicalReportAnalysis.aiSummary || smartStats.aiSummary}

الخطة المقترحة:
${clinicalReportAnalysis.recommendedCarePlan || smartStats.interventionPlan}

الخطة المنزلية:
${clinicalReportAnalysis.homePlanRecommendations.map((item) => `- ${item}`).join("\n")}

التوصيات الإدارية:
${clinicalReportAnalysis.administrativeRecommendations.map((item) => `- ${item}`).join("\n")}

آخر تقرير:
${latestReport ? `${latestReport.title} - ${latestReport.doctorName}` : "لا يوجد"}

تم التوليد: ${new Date().toLocaleString("ar-SA")}
    `.trim();

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");

    element.href = url;
    element.download = `anma-care-plan-${caseId}-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);

    toast.success("تم تحميل خطة الحالة");
  };

  if (!caseQuery.data) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                  {caseData.caseNumber || "بدون رقم"}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getBadgeClass(caseData.status)}`}>
                  {caseData.status || "غير محدد"}
                </span>
              </div>

              <h1 className="truncate text-2xl font-black text-slate-900">
                {caseData.childName}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {caseData.organization || "غير محدد"} · {caseData.disorderType || caseData.disabilityType || "غير محدد"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:w-[760px]">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">العمر</p>
                <p className="mt-2 text-xl font-black">{caseData.age || "-"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">الحضور</p>
                <p className="mt-2 text-xl font-black">{smartStats.attendanceRate}%</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">الجلسات</p>
                <p className="mt-2 text-xl font-black">{smartStats.totalSessions}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">التقارير</p>
                <p className="mt-2 text-xl font-black">{clinicalReports.length}</p>
              </div>

              <div className="rounded-2xl bg-green-50 p-4">
                <p className="text-xs text-slate-500">التمويل</p>
                <p className="mt-2 text-xl font-black text-green-700">
                  {smartCareFundingPlan.expectedCareCost.toLocaleString("ar-SA")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="border-slate-200 bg-white shadow-sm xl:col-span-2">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">الأولوية</p>
                  <p className="mt-1 font-black text-orange-700">{smartCareFundingPlan.carePriority}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">الاحتياج</p>
                  <p className="mt-1 font-bold text-slate-900">{smartCareFundingPlan.smartNeed}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">جلسات مقترحة</p>
                  <p className="mt-1 font-black text-slate-900">{smartCareFundingPlan.recommendedSessions}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">المختص المقترح</p>
                  <p className="mt-1 font-bold text-slate-900">{smartCareFundingPlan.requiredServiceType}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs text-slate-500">المختص المسؤول</p>
              <p className="mt-1 font-black text-slate-900">
                {linkedDoctor?.name || caseData.specialist || "غير محدد"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                  {linkedDoctor?.specialty || "غير محدد"}
                </span>
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                  {(getNumber(linkedDoctor?.sessionCost || linkedDoctor?.pricePerSession) || smartCareFundingPlan.expectedSessionCost).toLocaleString("ar-SA")} ريال / جلسة
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-wrap gap-2 rounded-3xl border bg-white p-4 shadow-sm">
          <Button className="rounded-2xl bg-slate-900 hover:bg-slate-800" onClick={() => setIsSessionDialogOpen(true)}>
            <Plus className="ml-2 h-4 w-4" />
            جلسة
          </Button>

          <Button variant="outline" className="rounded-2xl" onClick={() => setIsClinicalReportDialogOpen(true)}>
            <FileText className="ml-2 h-4 w-4" />
            تقرير
          </Button>

          <Button variant="outline" className="rounded-2xl" onClick={() => setIsFinancingDialogOpen(true)}>
            <Wallet className="ml-2 h-4 w-4" />
            تمويل
          </Button>

          <Button variant="outline" className="rounded-2xl" onClick={downloadCarePlan}>
            <ClipboardCheck className="ml-2 h-4 w-4" />
            خطة الحالة
          </Button>
        </section>

        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl border bg-white p-1 md:grid-cols-6">
            <TabsTrigger className="rounded-xl py-3" value="analysis">النظرة العامة</TabsTrigger>
            <TabsTrigger className="rounded-xl py-3" value="clinicalReports">التقارير</TabsTrigger>
            <TabsTrigger className="rounded-xl py-3" value="sessions">الجلسات</TabsTrigger>
            <TabsTrigger className="rounded-xl py-3" value="financing">التمويل</TabsTrigger>
            <TabsTrigger className="rounded-xl py-3" value="impact">الأثر</TabsTrigger>
            <TabsTrigger className="rounded-xl py-3" value="compliance">الالتزام</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-orange-600" /> سجل الجلسات</CardTitle>
                  <CardDescription>كل جلسة مستقلة بحضور وتقييم وأخصائي خاص بها</CardDescription>
                </div>

                <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 ml-2" /> إضافة جلسة</Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>إضافة جلسة جديدة</DialogTitle></DialogHeader>
                    <Form {...sessionForm}>
                      <form onSubmit={sessionForm.handleSubmit(handleSessionSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={sessionForm.control} name="sessionDate" render={({ field }) => (
                            <FormItem>
                              <FormLabel>تاريخ الجلسة</FormLabel>
                              <FormControl><Input type="date" value={field.value?.toISOString().split("T")[0]} onChange={(e) => field.onChange(new Date(e.target.value))} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={sessionForm.control} name="sessionType" render={({ field }) => (
                            <FormItem>
                              <FormLabel>نوع الجلسة</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="اختر نوع الجلسة" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="فردي">فردي</SelectItem>
                                  <SelectItem value="جماعي">جماعي</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={sessionForm.control} name="specialistName" render={({ field }) => (
                            <FormItem>
                              <FormLabel>اسم الأخصائي / الدكتور</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  const selected = specialistOptions.find((s) => s.name === value);
                                  sessionForm.setValue("specialistSpecialty", selected?.specialty || "");
                                }}
                                value={field.value}
                              >
                                <FormControl><SelectTrigger><SelectValue placeholder="اختاري الأخصائي" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {specialistOptions.length === 0 ? (
                                    <SelectItem value="غير محدد">لا يوجد مختصون مسجلون</SelectItem>
                                  ) : (
                                    specialistOptions.map((s) => (
                                      <SelectItem key={s.id} value={s.name}>
                                        {s.name} — {s.specialty}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={sessionForm.control} name="specialistSpecialty" render={({ field }) => (
                            <FormItem>
                              <FormLabel>تخصص الأخصائي</FormLabel>
                              <FormControl><Input placeholder="يظهر تلقائيًا أو اكتبيه" className={lightInputClass} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={sessionForm.control} name="attendance" render={({ field }) => (
                            <FormItem>
                              <FormLabel>الحضور</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  if (value === "غائب" || value === "مؤجل") sessionForm.setValue("progress", "ثابت");
                                  else if (!sessionForm.getValues("progress")) sessionForm.setValue("progress", "تحسن");
                                }}
                                value={field.value}
                              >
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="حاضر">حاضر</SelectItem>
                                  <SelectItem value="غائب">غائب</SelectItem>
                                  <SelectItem value="مؤجل">مؤجل</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />

                          {attendanceValue === "حاضر" && (
                            <FormField control={sessionForm.control} name="progress" render={({ field }) => (
                              <FormItem>
                                <FormLabel>التقدم</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="اختر مستوى التقدم" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="تحسن">تحسن</SelectItem>
                                    <SelectItem value="ثابت">ثابت</SelectItem>
                                    <SelectItem value="تراجع">تراجع</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                          )}
                        </div>

                        <FormField control={sessionForm.control} name="notes" render={({ field }) => (
                          <FormItem>
                            <FormLabel>ملاحظات</FormLabel>
                            <FormControl><textarea placeholder="ملاحظات عن الجلسة..." className="w-full px-3 py-2 border border-input rounded-md min-h-[100px]" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={createSessionMutation.isPending}>
                          {createSessionMutation.isPending ? "جاري الإضافة..." : "إضافة الجلسة"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {sessionsQuery.data?.map((session: any) => {
                    const specialist = extractSpecialistFromNotes(session.notes);
                    return (
                      <div key={session.id} className="p-4 border border-border rounded-xl bg-white">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                          <div>
                            <p className="font-semibold">{session.sessionType}</p>
                            <p className="text-sm text-muted-foreground">{new Date(session.sessionDate).toLocaleDateString("ar-SA")}</p>
                            {(specialist.name || specialist.specialty) && (
                              <p className="text-sm mt-2 flex items-center gap-2 text-muted-foreground">
                                <Stethoscope className="w-4 h-4" />
                                {specialist.name || "-"} — {specialist.specialty || "-"}
                              </p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full border text-sm ${getBadgeClass(session.attendance)}`}>{session.attendance}</span>
                        </div>

                        {session.attendance === "حاضر" && session.progress && (
                          <p className="text-sm mt-2 text-muted-foreground">التقدم: {session.progress}</p>
                        )}

                        {session.notes && (
                          <p className="text-sm mt-3 whitespace-pre-line bg-slate-50 p-3 rounded-lg">
                            {String(session.notes).replace(/الأخصائي:.*\n?/g, "").replace(/التخصص:.*\n?/g, "").trim() || "لا توجد ملاحظات إضافية"}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {!sessionsQuery.data?.length && <p className="text-center text-muted-foreground py-8">لا توجد جلسات مسجلة</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="impact" className="space-y-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-orange-600" /> قياس الأثر</CardTitle>
                  <CardDescription>تسجيل الاختبارات والقياسات القبلية والبعدية</CardDescription>
                </div>
                <Dialog open={isImpactDialogOpen} onOpenChange={setIsImpactDialogOpen}>
                  <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 ml-2" /> إضافة قياس</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>إضافة قياس أثر</DialogTitle></DialogHeader>
                    <Form {...impactForm}>
                      <form onSubmit={impactForm.handleSubmit(handleImpactSubmit)} className="space-y-4">
                        <FormField control={impactForm.control} name="testName" render={({ field }) => (
                          <FormItem><FormLabel>اسم الاختبار / المقياس</FormLabel><FormControl><Input placeholder="مثال: CARS / Vineland / Speech" className={lightInputClass} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={impactForm.control} name="valueType" render={({ field }) => (
                            <FormItem><FormLabel>نوع القيمة</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="رقم">رقم</SelectItem><SelectItem value="نسبة مئوية">نسبة مئوية</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={impactForm.control} name="betterDirection" render={({ field }) => (
                            <FormItem><FormLabel>اتجاه التحسن</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="أعلى أفضل">أعلى أفضل</SelectItem><SelectItem value="أقل أفضل">أقل أفضل</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={impactForm.control} name="baseline" render={({ field }) => (
                            <FormItem><FormLabel>القيمة القبلية {impactForm.watch("valueType") === "نسبة مئوية" ? "%" : ""}</FormLabel><FormControl><Input type="number" min={impactForm.watch("valueType") === "نسبة مئوية" ? 0 : undefined} max={impactForm.watch("valueType") === "نسبة مئوية" ? 100 : undefined} placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={impactForm.control} name="after" render={({ field }) => (
                            <FormItem><FormLabel>القيمة البعدية {impactForm.watch("valueType") === "نسبة مئوية" ? "%" : ""}</FormLabel><FormControl><Input type="number" min={impactForm.watch("valueType") === "نسبة مئوية" ? 0 : undefined} max={impactForm.watch("valueType") === "نسبة مئوية" ? 100 : undefined} placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <FormField control={impactForm.control} name="measurementDate" render={({ field }) => (
                          <FormItem><FormLabel>تاريخ القياس</FormLabel><FormControl><Input type="date" value={field.value?.toISOString().split("T")[0]} onChange={(e) => field.onChange(new Date(e.target.value))} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={createImpactMutation.isPending}>{createImpactMutation.isPending ? "جاري الإضافة..." : "إضافة القياس"}</Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {impactQuery.data?.map((impact: any) => (
                    <div key={impact.id} className="p-4 border border-border rounded-xl">
                      <p className="font-semibold">{impact.testName || "قياس عام"}</p>
                      <p className="text-sm text-muted-foreground">نوع القيمة: {impact.valueType} | الاتجاه: {impact.betterDirection}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div><p className="text-sm text-muted-foreground">قبلي</p><p className="text-lg font-semibold">{impact.baseline}{impact.valueType === "نسبة مئوية" ? "%" : ""}</p></div>
                        <div><p className="text-sm text-muted-foreground">بعدي</p><p className="text-lg font-semibold">{impact.afterValue}{impact.valueType === "نسبة مئوية" ? "%" : ""}</p></div>
                        <div><p className="text-sm text-muted-foreground">التحسن</p><p className="text-lg font-semibold text-green-600">{clampPercentage(impact.improvementPercentage)}%</p></div>
                        <div><p className="text-sm text-muted-foreground">التفسير</p><p className="text-lg font-semibold">{impact.interpretation || "-"}</p></div>
                      </div>
                    </div>
                  ))}
                  {!impactQuery.data?.length && <p className="text-center text-muted-foreground py-8">لم يتم تسجيل قياسات بعد</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-orange-600" /> التزام الأسرة</CardTitle>
                  <CardDescription>متابعة التزام الأسرة بالخطة العلاجية</CardDescription>
                </div>
                <Dialog open={isComplianceDialogOpen} onOpenChange={setIsComplianceDialogOpen}>
                  <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 ml-2" /> تسجيل التزام</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>تسجيل التزام الأسرة</DialogTitle></DialogHeader>
                    <Form {...complianceForm}>
                      <form onSubmit={complianceForm.handleSubmit(handleComplianceSubmit)} className="space-y-4">
                        <FormField control={complianceForm.control} name="attendancePercentage" render={({ field }) => (
                          <FormItem><FormLabel>نسبة الحضور %</FormLabel><FormControl><Input type="number" min={0} max={100} placeholder="85" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={complianceForm.control} name="homeplanImplementation" render={({ field }) => (
                            <FormItem><FormLabel>تطبيق الخطة المنزلية</FormLabel><Select onValueChange={(value) => field.onChange(value === "true")} value={field.value ? "true" : "false"}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="true">نعم</SelectItem><SelectItem value="false">لا</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={complianceForm.control} name="commitmentLevel" render={({ field }) => (
                            <FormItem><FormLabel>مستوى الالتزام</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="مرتفع">مرتفع</SelectItem><SelectItem value="متوسط">متوسط</SelectItem><SelectItem value="منخفض">منخفض</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                          )} />
                        </div>
                        <FormField control={complianceForm.control} name="barrierType" render={({ field }) => (
                          <FormItem><FormLabel>العائق أو السبب</FormLabel><FormControl><Input placeholder="مثال: صعوبة في الحضور / لا يوجد" className={lightInputClass} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={complianceForm.control} name="specialistNotes" render={({ field }) => (
                          <FormItem><FormLabel>ملاحظات المختص</FormLabel><FormControl><textarea placeholder="ملاحظات عن التزام الأسرة..." className="w-full px-3 py-2 border border-input rounded-md min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={complianceForm.control} name="complianceDate" render={({ field }) => (
                          <FormItem><FormLabel>تاريخ التسجيل</FormLabel><FormControl><Input type="date" value={field.value?.toISOString().split("T")[0]} onChange={(e) => field.onChange(new Date(e.target.value))} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={createComplianceMutation.isPending}>{createComplianceMutation.isPending ? "جاري الإضافة..." : "تسجيل الالتزام"}</Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {complianceQuery.data?.map((compliance: any) => (
                    <div key={compliance.id} className="p-4 border border-border rounded-xl">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><p className="text-sm text-muted-foreground">نسبة الحضور</p><p className="text-lg font-semibold">{clampPercentage(compliance.attendancePercentage)}%</p></div>
                        <div><p className="text-sm text-muted-foreground">الخطة المنزلية</p><p className="text-lg font-semibold">{compliance.homeplanImplementation ? "نعم" : "لا"}</p></div>
                        <div><p className="text-sm text-muted-foreground">مستوى الالتزام</p><p className={`inline-flex px-3 py-1 rounded-full border text-sm ${getBadgeClass(compliance.commitmentLevel)}`}>{compliance.commitmentLevel}</p></div>
                        <div><p className="text-sm text-muted-foreground">العائق</p><p className="text-lg font-semibold">{compliance.barrierType || "-"}</p></div>
                      </div>
                      {compliance.specialistNotes && <p className="text-sm mt-3 text-muted-foreground bg-slate-50 p-3 rounded-lg">{compliance.specialistNotes}</p>}
                    </div>
                  ))}
                  {!complianceQuery.data?.length && <p className="text-center text-muted-foreground py-8">لم يتم تسجيل بيانات التزام بعد</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financing" className="space-y-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-orange-600" /> التمويل</CardTitle>
                  <CardDescription>حساب وتتبع تكاليف الجلسات بدون حد 100 للمبالغ</CardDescription>
                </div>
                <Dialog open={isFinancingDialogOpen} onOpenChange={setIsFinancingDialogOpen}>
                  <DialogTrigger asChild><Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 ml-2" /> إضافة تمويل</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>إضافة بيانات التمويل</DialogTitle></DialogHeader>
                    <Form {...financingForm}>
                      <form onSubmit={financingForm.handleSubmit(handleFinancingSubmit)} className="space-y-4">
                        <FormField control={financingForm.control} name="fundingSource" render={({ field }) => (
                          <FormItem><FormLabel>جهة التمويل</FormLabel><FormControl><Input placeholder="مثال: جمعية / دعم ذاتي / راعٍ" className={lightInputClass} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={financingForm.control} name="approvedSessionCount" render={({ field }) => (
                            <FormItem><FormLabel>الجلسات المعتمدة</FormLabel><FormControl><Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={financingForm.control} name="usedSessionCount" render={({ field }) => (
                            <FormItem><FormLabel>الجلسات المستخدمة</FormLabel><FormControl><Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={financingForm.control} name="sessionCount" render={({ field }) => (
                            <FormItem><FormLabel>عدد الجلسات الحالية</FormLabel><FormControl><Input type="number" value={field.value} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={financingForm.control} name="sessionCost" render={({ field }) => (
                            <FormItem><FormLabel>تكلفة الجلسة الواحدة</FormLabel><FormControl><Input type="number" placeholder="100" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <FormField control={financingForm.control} name="financingStatus" render={({ field }) => (
                          <FormItem><FormLabel>حالة التمويل</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="معلق">معلق</SelectItem><SelectItem value="موافق عليه">موافق عليه</SelectItem><SelectItem value="مدفوع">مدفوع</SelectItem><SelectItem value="مكتمل">مكتمل</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={financingForm.control} name="financeNotes" render={({ field }) => (
                          <FormItem><FormLabel>ملاحظات مالية</FormLabel><FormControl><textarea placeholder="أي ملاحظات عن التمويل..." className="w-full px-3 py-2 border border-input rounded-md min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={createFinancingMutation.isPending}>{createFinancingMutation.isPending ? "جاري الإضافة..." : "إضافة التمويل"}</Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {financingQuery.data?.map((financing: any) => {
                    const remainingSessions = Number(financing.approvedSessionCount || 0) - Number(financing.usedSessionCount || 0);
                    return (
                      <div key={financing.id} className="p-4 border border-border rounded-xl">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div><p className="text-sm text-muted-foreground">جهة التمويل</p><p className="text-lg font-semibold">{financing.fundingSource || "-"}</p></div>
                          <div><p className="text-sm text-muted-foreground">المعتمدة</p><p className="text-lg font-semibold">{financing.approvedSessionCount || "-"}</p></div>
                          <div><p className="text-sm text-muted-foreground">المستخدمة</p><p className="text-lg font-semibold">{financing.usedSessionCount || 0}</p></div>
                          <div><p className="text-sm text-muted-foreground">المتبقية</p><p className="text-lg font-semibold">{remainingSessions}</p></div>
                          <div><p className="text-sm text-muted-foreground">الإجمالي</p><p className="text-lg font-bold text-green-700">{financing.totalCost || 0} ريال</p></div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full border text-sm ${getBadgeClass(financing.financingStatus)}`}>{financing.financingStatus}</span>
                          {financing.financeNotes && <span className="text-sm text-muted-foreground">{financing.financeNotes}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {!financingQuery.data?.length && <p className="text-center text-muted-foreground py-8">لم يتم تسجيل بيانات تمويل بعد</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinicalReports" className="space-y-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    تقارير المختصين
                  </CardTitle>
                  <CardDescription>
                    ملف تقارير لكل مريض؛ يستخدمه الذكاء الاصطناعي لبناء خطة أدق وتحديث إدارة الحالات تلقائياً.
                  </CardDescription>
                </div>

                <Dialog open={isClinicalReportDialogOpen} onOpenChange={setIsClinicalReportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-orange-600 hover:bg-orange-700">
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة تقرير
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>إضافة تقرير مختص</DialogTitle>
                    </DialogHeader>

                    <Form {...clinicalReportForm}>
                      <form onSubmit={clinicalReportForm.handleSubmit(handleClinicalReportSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <FormField control={clinicalReportForm.control} name="title" render={({ field }) => (
                            <FormItem>
                              <FormLabel>عنوان التقرير</FormLabel>
                              <FormControl><Input placeholder="مثال: تقرير متابعة التخاطب" className={lightInputClass} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={clinicalReportForm.control} name="reportType" render={({ field }) => (
                            <FormItem>
                              <FormLabel>نوع التقرير</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="تقرير تقييم أولي">تقرير تقييم أولي</SelectItem>
                                  <SelectItem value="تقرير جلسة">تقرير جلسة</SelectItem>
                                  <SelectItem value="تقرير نطق وتخاطب">تقرير نطق وتخاطب</SelectItem>
                                  <SelectItem value="تقرير علاج وظيفي">تقرير علاج وظيفي</SelectItem>
                                  <SelectItem value="تقرير علاج طبيعي">تقرير علاج طبيعي</SelectItem>
                                  <SelectItem value="تقرير نفسي">تقرير نفسي</SelectItem>
                                  <SelectItem value="تقرير نمو وسلوك">تقرير نمو وسلوك</SelectItem>
                                  <SelectItem value="تقرير تعديل سلوك">تقرير تعديل سلوك</SelectItem>
                                  <SelectItem value="تقرير متابعة">تقرير متابعة</SelectItem>
                                  <SelectItem value="تقرير ختامي">تقرير ختامي</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={clinicalReportForm.control} name="doctorName" render={({ field }) => (
                            <FormItem>
                              <FormLabel>اسم المختص</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  const safeValue = value === "__none" ? "غير محدد" : value;
                                  field.onChange(safeValue);
                                  const selected = specialistOptions.find((item) => item.name === safeValue);
                                  clinicalReportForm.setValue("specialty", selected?.specialty || "");
                                }}
                                value={field.value || "__none"}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختاري المختص" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none">غير محدد</SelectItem>
                                  {specialistOptions.map((doctor) => (
                                    <SelectItem key={doctor.id} value={doctor.name}>
                                      {doctor.name} — {doctor.specialty}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={clinicalReportForm.control} name="specialty" render={({ field }) => (
                            <FormItem>
                              <FormLabel>التخصص</FormLabel>
                              <FormControl><Input placeholder="مثال: تخاطب / علاج وظيفي" className={lightInputClass} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={clinicalReportForm.control} name="reportDate" render={({ field }) => (
                            <FormItem>
                              <FormLabel>تاريخ التقرير</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  value={field.value?.toISOString().split("T")[0]}
                                  onChange={(e) => field.onChange(new Date(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        <FormField control={clinicalReportForm.control} name="reportText" render={({ field }) => (
                          <FormItem>
                            <FormLabel>نص التقرير</FormLabel>
                            <FormControl>
                              <textarea
                                placeholder="اكتبي تقرير المختص هنا..."
                                className="w-full px-3 py-2 border border-input rounded-md min-h-[140px]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={clinicalReportForm.control} name="reportFileDataUrl" render={() => (
                          <FormItem>
                            <FormLabel>ملف التقرير PDF / Word <span className="text-xs text-muted-foreground">(اختياري)</span></FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                accept=".pdf,.doc,.docx"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];

                                  if (!file) {
                                    clinicalReportForm.setValue("reportFileName", "");
                                    clinicalReportForm.setValue("reportFileDataUrl", "");
                                    return;
                                  }

                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    clinicalReportForm.setValue("reportFileName", file.name);
                                    clinicalReportForm.setValue("reportFileDataUrl", String(reader.result || ""));
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={clinicalReportForm.control} name="recommendations" render={({ field }) => (
                          <FormItem>
                            <FormLabel>توصيات المختص</FormLabel>
                            <FormControl>
                              <textarea
                                placeholder="التوصيات العلاجية أو المنزلية..."
                                className="w-full px-3 py-2 border border-input rounded-md min-h-[100px]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={clinicalReportForm.control} name="administrativeNotes" render={({ field }) => (
                          <FormItem>
                            <FormLabel>ملاحظات إدارية</FormLabel>
                            <FormControl><Input placeholder="اختياري" className={lightInputClass} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">
                          حفظ التقرير وتحديث التحليل
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Brain className="w-4 h-4 text-orange-600" />
                    تحليل تقارير المختصين
                  </h3>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-white p-3 border">
                      <p className="text-xs text-muted-foreground">الملخص</p>
                      <p className="mt-1 text-sm leading-7">{clinicalReportAnalysis.aiSummary}</p>
                    </div>

                    <div className="rounded-xl bg-white p-3 border">
                      <p className="text-xs text-muted-foreground">مستوى الخطورة</p>
                      <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getBadgeClass(clinicalReportAnalysis.riskLevel)}`}>
                        {clinicalReportAnalysis.riskLevel}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">مؤشر التقدم النهائي: {finalProgressScore}%</p>
                    </div>

                    <div className="rounded-xl bg-white p-3 border">
                      <p className="text-xs text-muted-foreground">التوقع القادم</p>
                      <p className="mt-1 text-sm leading-7">{clinicalReportAnalysis.predictedOutcome}</p>
                    </div>

                    <div className="rounded-xl bg-white p-3 border">
                      <p className="text-xs text-muted-foreground">نقاط القوة</p>
                      <ul className="mt-2 list-disc space-y-1 pr-5 text-sm">
                        {clinicalReportAnalysis.strengths.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>

                    <div className="rounded-xl bg-white p-3 border">
                      <p className="text-xs text-muted-foreground">نقاط الضعف</p>
                      <ul className="mt-2 list-disc space-y-1 pr-5 text-sm">
                        {clinicalReportAnalysis.weaknesses.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>

                    <div className="rounded-xl bg-white p-3 border">
                      <p className="text-xs text-muted-foreground">الخطة المقترحة</p>
                      <p className="mt-1 text-sm leading-7">{clinicalReportAnalysis.recommendedCarePlan}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border bg-white p-3 text-sm leading-7 text-slate-600">
                    <b>الربط التلقائي:</b> بعد حفظ التقرير يتم تحديث مؤشر التقدم، التصنيف الذكي، آخر تقرير، الخطة المقترحة، والتنبيهات في إدارة الحالات والمراقبة الذكية والتقارير.
                  </div>
                </div>

                <div className="space-y-3">
                  {clinicalReports.map((report) => (
                    <div key={report.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900">{report.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {report.reportType} — {report.doctorName} {report.specialty ? `— ${report.specialty}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(report.reportDate).toLocaleDateString("ar-SA")}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteClinicalReport(report.id)}
                        >
                          حذف
                        </Button>
                      </div>

                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-7 whitespace-pre-line">
                        {report.reportText}
                      </div>

                      {report.reportFileDataUrl && (
                        <a
                          href={report.reportFileDataUrl}
                          download={report.reportFileName || "clinical-report"}
                          className="mt-3 inline-flex rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                        >
                          تحميل ملف التقرير
                        </a>
                      )}

                      {report.recommendations && (
                        <div className="mt-3 rounded-xl bg-orange-50 p-3 text-sm leading-7">
                          <b>توصيات المختص:</b> {report.recommendations}
                        </div>
                      )}
                    </div>
                  ))}

                  {!clinicalReports.length && (
                    <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                      لا توجد تقارير مختصين حتى الآن.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                      <Sparkles className="h-5 w-5 text-orange-600" />
                      النظرة العامة
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      ملخص سريع للحالة والمؤشرات الحالية.
                    </p>
                  </div>

                  <div className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getBadgeClass(smartStats.level)}`}>
                    {smartStats.level}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl border bg-slate-50 p-4 xl:col-span-2">
                    <p className="text-xs font-bold text-slate-500">ملخص الحالة</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      {smartStats.aiSummary}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-orange-50 p-4">
                    <p className="text-xs font-bold text-orange-700">الإجراء التالي</p>
                    <p className="mt-2 text-sm leading-7 text-slate-800">
                      {clinicalReportAnalysis.nextAction || smartStats.clinicalRecommendation}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs text-slate-500">الخطورة</p>
                    <p className="mt-2 text-lg font-black text-slate-900">{smartStats.riskLevel}</p>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs text-slate-500">الحضور</p>
                    <p className="mt-2 text-lg font-black text-slate-900">{smartStats.attendanceRate}%</p>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs text-slate-500">التقدم</p>
                    <p className="mt-2 text-lg font-black text-slate-900">{finalProgressScore}%</p>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs text-slate-500">التقارير</p>
                    <p className="mt-2 text-lg font-black text-slate-900">{clinicalReports.length}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs font-bold text-slate-500">الخطة المقترحة</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      {smartStats.interventionPlan}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs font-bold text-slate-500">التوقع القادم</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      {smartStats.predictedOutcome}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-black text-slate-900">التنبيهات</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {!smartStats.hasAnyAnalysisData && (
                      <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                        لا توجد بيانات كافية بعد. أضيفي جلسة أو تقرير.
                      </div>
                    )}

                    {smartStats.hasSessions && smartStats.absentSessions >= 2 && (
                      <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                        غياب متكرر: {smartStats.absentSessions} جلسات.
                      </div>
                    )}

                    {smartStats.hasSessions && smartStats.attendanceRate < 80 && (
                      <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                        الحضور أقل من المطلوب: {smartStats.attendanceRate}%.
                      </div>
                    )}

                    {smartStats.hasImpacts && smartStats.improvement < 50 && (
                      <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                        التحسن منخفض ويحتاج مراجعة.
                      </div>
                    )}

                    {smartStats.hasSessions && smartStats.remaining <= 2 && (
                      <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                        المتبقي من الجلسات قليل.
                      </div>
                    )}

                    {smartStats.hasAnyAnalysisData &&
                      smartStats.absentSessions < 2 &&
                      (!smartStats.hasSessions || smartStats.attendanceRate >= 80) &&
                      (!smartStats.hasImpacts || smartStats.improvement >= 50) && (
                        <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                          لا توجد تنبيهات عالية حاليًا.
                        </div>
                      )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    className="rounded-2xl bg-orange-600 hover:bg-orange-700"
                    disabled={analysisMutation.isPending}
                    onClick={() =>
                      analysisMutation.mutate({
                        caseId,
                        useOpenAI: true,
                        caseData: safeCaseDataForAI,
                        sessions: safeSessionsForAI,
                        clinicalReports: safeClinicalReportsForAI,
                      })
                    }
                  >
                    <Sparkles className="ml-2 h-4 w-4" />
                    {analysisMutation.isPending ? "جاري التحليل..." : "تشغيل التحليل"}
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={downloadCarePlan}
                  >
                    <FileText className="ml-2 h-4 w-4" />
                    تحميل الخطة
                  </Button>
                </div>

                {analysisMutation.data && (
                  <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          (analysisMutation.data as any)?.usedOpenAI
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {(analysisMutation.data as any)?.usedOpenAI ? "OpenAI" : "تحليل محلي"}
                      </span>
                    </div>

                    <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                      {String(
                        (analysisMutation.data as any)?.aiSummary ||
                          (analysisMutation.data as any)?.analysis ||
                          JSON.stringify(analysisMutation.data, null, 2)
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
