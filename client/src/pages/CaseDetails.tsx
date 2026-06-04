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
  needsFollowUp?: boolean;
  isHighRisk?: boolean;
  administrativeAlerts?: string[];
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
}

const specialistOptions = [
  { name: "د. أحمد العتيبي", specialty: "طبيب نمو وسلوك" },
  { name: "أ. سارة القحطاني", specialty: "أخصائي نطق وتخاطب" },
  { name: "أ. نورة الحربي", specialty: "أخصائي علاج وظيفي" },
  { name: "أ. محمد السبيعي", specialty: "أخصائي تعديل سلوك" },
  { name: "أ. ريم المطيري", specialty: "أخصائي صعوبات تعلم" },
];

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

type SessionFormValues = z.infer<typeof sessionFormSchema>;
type ImpactFormValues = z.infer<typeof impactFormSchema>;
type ComplianceFormValues = z.infer<typeof complianceFormSchema>;
type FinancingFormValues = z.infer<typeof financingFormSchema>;

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

export default function CaseDetails() {
  const { id } = useParams();
  const caseId = parseInt(id || "0");

  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isImpactDialogOpen, setIsImpactDialogOpen] = useState(false);
  const [isComplianceDialogOpen, setIsComplianceDialogOpen] = useState(false);
  const [isFinancingDialogOpen, setIsFinancingDialogOpen] = useState(false);

  const caseQuery = trpc.cases.getById.useQuery({ id: caseId });
  const sessionsQuery = trpc.sessions.getByCase.useQuery({ caseId });
  const impactQuery = trpc.impact.getByCase.useQuery({ caseId });
  const complianceQuery = trpc.compliance.getByCase.useQuery({ caseId });
  const financingQuery = trpc.financing.getByCase.useQuery({ caseId });

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

  const attendanceValue = sessionForm.watch("attendance");

  const createSessionMutation = trpc.sessions.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الجلسة بنجاح");
      void sessionsQuery.refetch();
      void caseQuery.refetch();
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
    onError: (error) => toast.error(error.message || "حدث خطأ في إضافة الجلسة"),
  });

  const createImpactMutation = trpc.impact.create.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل قياس الأثر بنجاح");
      void impactQuery.refetch();
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
    onError: (error) => toast.error(error.message || "حدث خطأ في تسجيل قياس الأثر"),
  });

  const createComplianceMutation = trpc.compliance.create.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الالتزام بنجاح");
      void complianceQuery.refetch();
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
    onError: (error) => toast.error(error.message || "حدث خطأ في تسجيل الالتزام"),
  });

  const createFinancingMutation = trpc.financing.create.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل التمويل بنجاح");
      void financingQuery.refetch();
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
    onError: (error) => toast.error(error.message || "حدث خطأ في تسجيل التمويل"),
  });

  const analysisMutation = trpc.analysis.analyzeCaseProgress.useMutation({
    onError: (error) => toast.error(error.message || "حدث خطأ أثناء تحليل الحالة"),
  });

  const caseData: any = caseQuery.data;

  const totalFinancing = useMemo(() => {
    return financingQuery.data?.reduce((sum: number, item: any) => sum + Number(item.totalCost || 0), 0) || 0;
  }, [financingQuery.data]);

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

    return {
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
      improvement: smartStats.improvement,
      needsFollowUp: smartStats.needsFollowUp,
      isHighRisk: smartStats.isHighRisk,
      administrativeAlerts: smartStats.administrativeAlerts,
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
    smartStats.needsFollowUp,
    smartStats.isHighRisk,
    smartStats.administrativeAlerts,
  ]);

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
  const handleFinancingSubmit = (data: FinancingFormValues) => createFinancingMutation.mutate({ ...data, caseId });

  if (!caseQuery.data) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-orange-50/50 to-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="border-orange-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">تفاصيل الحالة</p>
                <h1 className="text-3xl font-bold text-foreground">{caseData.childName}</h1>
                <p className="text-muted-foreground mt-2">رقم الحالة: {caseData.caseNumber}</p>
              </div>
              <div className={`px-4 py-2 rounded-full border text-sm font-semibold ${getBadgeClass(caseData.status)}`}>
                {caseData.status}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserRound className="w-4 h-4" /> العمر</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-orange-600">{caseData.age || "-"}</div></CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">المدينة</CardTitle></CardHeader>
            <CardContent><div className="text-lg font-semibold">{caseData.city || "-"}</div></CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">نوع الاضطراب</CardTitle></CardHeader>
            <CardContent><div className="text-lg font-semibold">{caseData.disorderType || "-"}</div></CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">إجمالي التمويل</CardTitle></CardHeader>
            <CardContent><div className="text-lg font-bold text-green-700">{totalFinancing} ريال</div></CardContent>
          </Card>
        </div>

        <Card className="border-orange-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-orange-600" />
              التحليل الذكي للحالة
            </CardTitle>
            <CardDescription>تحليل مبني على الحضور، التحسن، الالتزام، ووصف الحالة</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-slate-50">
              <p className="text-sm text-muted-foreground">تصنيف الحالة</p>
              <div className={`inline-flex mt-2 px-3 py-1 rounded-full border font-semibold ${getBadgeClass(smartStats.level)}`}>{smartStats.level}</div>
              <p className="text-sm mt-3 text-muted-foreground">{smartStats.reason}</p>
            </div>
            <div className="p-4 rounded-xl border bg-slate-50">
              <p className="text-sm text-muted-foreground">الاضطراب المحتمل</p>
              <p className="text-lg font-bold mt-2">{smartStats.suggestedDisorder}</p>
              <p className="text-sm text-muted-foreground mt-2">المختص المناسب: {smartStats.recommendedSpecialist}</p>
            </div>
            <div className="p-4 rounded-xl border bg-slate-50">
              <p className="text-sm text-muted-foreground">خطة تدخل مقترحة</p>
              <p className="text-sm mt-2 leading-7">{smartStats.interventionPlan}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">الحضور</p><p className="text-2xl font-bold">{smartStats.attendanceRate}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">نسبة التحسن</p><p className="text-2xl font-bold">{smartStats.improvement}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">إنجاز البكج</p><p className="text-2xl font-bold">{smartStats.packageProgress}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">المتبقي من الجلسات</p><p className="text-2xl font-bold">{smartStats.remaining}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white border">
            <TabsTrigger value="sessions">الجلسات</TabsTrigger>
            <TabsTrigger value="impact">قياس الأثر</TabsTrigger>
            <TabsTrigger value="compliance">الالتزام</TabsTrigger>
            <TabsTrigger value="financing">التمويل</TabsTrigger>
            <TabsTrigger value="analysis">التحليل</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
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
                                  {specialistOptions.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
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
            <Card>
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
            <Card>
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
            <Card>
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

          <TabsContent value="analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-orange-600" /> التحليل والتوصيات</CardTitle>
                <CardDescription>تحليل ذكي لا يذكر خطر إلا بسبب واضح</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-orange-100 bg-gradient-to-l from-orange-50 to-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        <Brain className="w-4 h-4 text-orange-600" />
                        AI Case Intelligence Tool
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        يقرأ الجلسات، الحضور، القياسات، الالتزام، ووصف الحالة ثم يطلع توصية موحدة تظهر في إدارة الحالات والداشبورد.
                      </p>
                    </div>
                    <div className={`self-start rounded-full border px-3 py-1 text-sm font-semibold ${getBadgeClass(smartStats.level)}`}>
                      {smartStats.level}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-white p-3 border">
                      <p className="text-xs text-muted-foreground">سبب القرار</p>
                      <p className="mt-1 text-sm leading-6">{smartStats.reason}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border">
                      <p className="text-xs text-muted-foreground">المختص المقترح</p>
                      <p className="mt-1 text-sm font-semibold">{smartStats.recommendedSpecialist}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border">
                      <p className="text-xs text-muted-foreground">الخطة المقترحة</p>
                      <p className="mt-1 text-sm leading-6">{smartStats.interventionPlan}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl bg-slate-50">
                    <h3 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> التنبيهات</h3>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      {!smartStats.hasAnyAnalysisData && (
                        <li>لا توجد بيانات كافية للتحليل حتى الآن. أضيفي أول جلسة أو قياس للحالة.</li>
                      )}

                      {smartStats.hasSessions && smartStats.absentSessions >= 2 && (
                        <li>يوجد غياب متكرر: {smartStats.absentSessions} جلسات.</li>
                      )}

                      {smartStats.hasSessions && smartStats.attendanceRate < 80 && (
                        <li>نسبة الحضور أقل من المطلوب: {smartStats.attendanceRate}%.</li>
                      )}

                      {smartStats.hasImpacts && smartStats.improvement < 50 && (
                        <li>نسبة التحسن منخفضة وتحتاج مراجعة الخطة.</li>
                      )}

                      {smartStats.hasSessions && smartStats.remaining <= 2 && (
                        <li>تبقى عدد قليل من جلسات البكج، يفضل تجهيز تقييم ختامي.</li>
                      )}

                      {smartStats.hasAnyAnalysisData &&
                        smartStats.absentSessions < 2 &&
                        (!smartStats.hasSessions || smartStats.attendanceRate >= 80) &&
                        (!smartStats.hasImpacts || smartStats.improvement >= 50) && (
                          <li>لا توجد تنبيهات عالية حاليًا.</li>
                        )}
                    </ul>
                  </div>

                  <div className="p-4 border rounded-xl bg-slate-50">
                    <h3 className="font-bold mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> ملخص تنفيذي</h3>
                    <p className="text-sm leading-7 text-muted-foreground">
                      الحالة مصنفة حاليًا: <b>{smartStats.level}</b>. السبب: {smartStats.reason}
                      {" "}التوصية: {smartStats.recommendedSpecialist}. خطة التدخل: {smartStats.interventionPlan}
                    </p>
                  </div>
                </div>

                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={analysisMutation.isPending}
                  onClick={() => analysisMutation.mutate({ caseId })}
                >
                  <Sparkles className="w-4 h-4 ml-2" />
                  {analysisMutation.isPending ? "جاري التحليل..." : "تشغيل تحليل النظام"}
                </Button>

                {analysisMutation.data && (
                  <div className="p-4 border rounded-xl bg-orange-50 whitespace-pre-line">
                    {String((analysisMutation.data as any)?.analysis || JSON.stringify(analysisMutation.data, null, 2))}
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