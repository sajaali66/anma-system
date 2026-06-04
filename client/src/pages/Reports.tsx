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
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function Reports() {
  const [reportType, setReportType] = useState("summary");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
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

  const reportTypeLabel =
    reportType === "executive"
      ? "التقرير التنفيذي"
      : reportType === "summary"
      ? "ملخص الحالة"
      : reportType === "impact"
      ? "تقرير الأثر"
      : reportType === "sessions"
      ? "تقرير الجلسات"
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

    const aiAlertsCount =
      dashboardSummary?.aiAlertsCount ??
      dashboardSummary?.alertsCount ??
      0;

    const text = `
# التقرير التنفيذي لمنصة أنما

## 1. ملخص عام
- إجمالي الحالات: ${totalCases}
- الحالات النشطة: ${activeCases}
- الحالات الحرجة: ${criticalCases}
- الحالات المستقرة: ${stableCases}
- الحالات التي تحتاج متابعة: ${followUpCases}

---

## 2. الجلسات
- إجمالي الجلسات: ${totalSessions}
- الجلسات المكتملة: ${completedSessions}
- الجلسات الغائبة: ${missedSessions}
- الجلسات المؤجلة: ${postponedSessions}

---

## 3. الذكاء والتنبيهات
- متوسط نسبة الخطر: ${averageRiskScore}%
- عدد تنبيهات الذكاء: ${aiAlertsCount}

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
  postponedSessions > 0
    ? `- يوجد ${postponedSessions} جلسة مؤجلة تحتاج إعادة جدولة.`
    : "- لا توجد جلسات مؤجلة حالياً."
}

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

    const text = `
# ${reportTypeLabel}

## 1. معلومات الحالة
- اسم الطفل: ${selectedCase.childName || "-"}
- رقم الحالة: ${selectedCase.caseNumber || "-"}
- العمر: ${selectedCase.age || "-"}
- المدينة: ${selectedCase.city || "-"}
- الجمعية: ${selectedCase.organization || selectedCase.organizationName || "-"}
- نوع الاضطراب: ${selectedCase.disorderType || selectedCase.diagnosis || "-"}
- المختص: ${selectedCase.specialist || selectedCase.specialistName || "-"}
- الحالة الحالية: ${selectedCase.status || "-"}

---

## 2. الملخص الذكي
- درجة الحالة الذكية: ${smartSummary?.score ?? 0}/100
- التصنيف الذكي: ${smartSummary?.status ?? smartSummary?.level ?? "-"}
- عدد التنبيهات: ${smartSummary?.alerts?.length ?? 0}
- عدد التوصيات: ${smartSummary?.recommendations?.length ?? 0}

### التنبيهات
${
  smartSummary?.alerts?.length
    ? smartSummary.alerts.map((item: string) => `- ${item}`).join("\n")
    : "- لا توجد تنبيهات حالية"
}

### التوصيات
${
  smartSummary?.recommendations?.length
    ? smartSummary.recommendations.map((item: string) => `- ${item}`).join("\n")
    : "- الاستمرار في المتابعة"
}

---

## 3. الجلسات
- عدد الجلسات: ${sessions.length}
- نسبة الحضور: ${attendanceRate}%
- عدد الحضور: ${presentSessions}
- عدد الغياب: ${absentSessions}
- عدد الجلسات المؤجلة: ${postponedSessions}

---

## 4. قياس الأثر
- عدد القياسات: ${impacts.length}
- متوسط التحسن: ${averageImprovement}%

---

## 5. التزام الأسرة
- عدد سجلات الالتزام: ${compliances.length}

---

## 6. التمويل
- عدد سجلات التمويل: ${financings.length}
- إجمالي التمويل: ${totalFinancing}

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

    const blob = new Blob([reportContent], {
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
    toast.success("تم تحميل التقرير");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            التقارير والتحليلات
          </h1>
          <p className="text-muted-foreground">
            توليد تقارير ذكية وشاملة عن الحالات والأثر والجلسات والالتزام
          </p>
        </div>

        <Card className="mb-8 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-600" />
              توليد تقرير ذكي جديد
            </CardTitle>
            <CardDescription>
              اختر نوع التقرير، وسيتم توليد تقرير شامل تلقائيًا من البيانات الحية
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="executive">التقرير التنفيذي</SelectItem>
                  <SelectItem value="summary">ملخص الحالة</SelectItem>
                  <SelectItem value="impact">تقرير الأثر</SelectItem>
                  <SelectItem value="sessions">تقرير الجلسات</SelectItem>
                  <SelectItem value="compliance">تقرير الالتزام</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={selectedCaseId?.toString() || ""}
                onValueChange={(value) => setSelectedCaseId(Number(value))}
                disabled={reportType === "executive"}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      reportType === "executive"
                        ? "لا يحتاج اختيار حالة"
                        : "اختر حالة"
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
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                {isGenerating ? "جاري التوليد..." : "توليد التقرير"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="bg-white">
            <CardContent className="p-5">
              <Users className="mb-2 h-5 w-5 text-orange-600" />
              <p className="text-sm text-muted-foreground">إجمالي الحالات</p>
              <p className="text-2xl font-bold">
                {dashboardSummary?.totalCases ?? dashboardSummary?.totalPatients ?? cases.length ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-5">
              <CalendarDays className="mb-2 h-5 w-5 text-blue-600" />
              <p className="text-sm text-muted-foreground">إجمالي الجلسات</p>
              <p className="text-2xl font-bold">
                {dashboardSummary?.totalSessions ?? dashboardSummary?.sessionsCount ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-5">
              <ShieldAlert className="mb-2 h-5 w-5 text-red-600" />
              <p className="text-sm text-muted-foreground">الحالات الحرجة</p>
              <p className="text-2xl font-bold">
                {dashboardSummary?.criticalCases ?? dashboardSummary?.highRiskCases ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-5">
              <Gauge className="mb-2 h-5 w-5 text-green-600" />
              <p className="text-sm text-muted-foreground">متوسط الخطر</p>
              <p className="text-2xl font-bold">
                {dashboardSummary?.averageRiskScore ?? dashboardSummary?.riskScore ?? 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {reportContent && (
          <Card className="bg-white">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-600" />
                    معاينة التقرير
                  </CardTitle>
                  <CardDescription>
                    يمكنك مراجعة التقرير ثم تحميله
                  </CardDescription>
                </div>

                <Button onClick={downloadReport} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  تحميل التقرير
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-2xl border bg-white p-5 leading-8">
                <Streamdown>{reportContent}</Streamdown>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}