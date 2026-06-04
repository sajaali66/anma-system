import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Brain, AlertTriangle, Activity, TrendingUp, ShieldCheck, Search } from "lucide-react";

type AILevel = "غير محدد" | "منخفض" | "متوسط" | "مرتفع" | "حرج";

function safeText(value: any) {
  return String(value ?? "").trim();
}

function safeNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getSessionsCount(c: any) {
  return safeNumber(
    c.sessionsCount ||
      c.sessionCount ||
      c.totalSessions ||
      c.usedSessionCount ||
      c.completedSessions ||
      0
  );
}

function getSpecialistSuggestion(c: any) {
  const text = `${c.disabilityType || ""} ${c.disorderType || ""} ${c.notes || ""}`.toLowerCase();

  if (text.includes("نطق") || text.includes("تخاطب") || text.includes("كلام")) {
    return "أخصائي نطق وتخاطب";
  }

  if (text.includes("توحد") || text.includes("تواصل") || text.includes("تفاعل")) {
    return "طبيب نمو وسلوك + أخصائي تعديل سلوك";
  }

  if (text.includes("adhd") || text.includes("فرط") || text.includes("انتباه") || text.includes("تركيز")) {
    return "طبيب نمو وسلوك / أخصائي نفسي";
  }

  if (text.includes("تعلم") || text.includes("قراءة") || text.includes("كتابة")) {
    return "أخصائي صعوبات تعلم";
  }

  return c.specialistSpecialty || c.specialty || "أخصائي نمو وسلوك";
}

function getRiskStyle(level: AILevel) {
  switch (level) {
    case "حرج":
      return "border-red-300 bg-red-50 text-red-700";
    case "مرتفع":
      return "border-orange-300 bg-orange-50 text-orange-700";
    case "متوسط":
      return "border-amber-300 bg-amber-50 text-amber-700";
    case "منخفض":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
}

function analyzeCasePredictively(c: any) {
  const sessions = getSessionsCount(c);
  const hasSessions = sessions > 0;

  const hasSpecialist = Boolean(
    safeText(c.specialistName || c.specialist || c.doctorName)
  );

  const hasDisability = Boolean(
    safeText(c.disabilityType || c.disorderType)
  );

  const hasPhone = Boolean(
    safeText(c.familyPhone || c.phone || c.beneficiaryPhone)
  );

  const status = safeText(c.status);

  let riskScore = 0;
  const reasons: string[] = [];
  const actions: string[] = [];

  if (!hasSessions) {
    return {
      level: "غير محدد" as AILevel,
      riskScore: 0,
      prediction: "لا يمكن التنبؤ بالخطر قبل وجود جلسة أو تقييم أولي.",
      reason: "لا توجد جلسات أو قياسات كافية للتحليل.",
      action: "إضافة أول جلسة أو تقييم أولي للحالة.",
      specialist: getSpecialistSuggestion(c),
      plan: "ابدئي بتقييم أولي، تحديد المختص المناسب، ثم إضافة جلسة متابعة أسبوعية.",
      needsThisWeek: true,
    };
  }

  if (status === "متعثرة") {
    riskScore += 35;
    reasons.push("الحالة مسجلة كمتعثرة.");
    actions.push("مراجعة الحالة إداريًا وعلاجيًا خلال هذا الأسبوع.");
  }

  if (!hasSpecialist) {
    riskScore += 20;
    reasons.push("لا يوجد أخصائي أو دكتور مرتبط بالحالة.");
    actions.push("تعيين مختص مناسب للحالة.");
  }

  if (!hasDisability) {
    riskScore += 15;
    reasons.push("نوع الإعاقة أو الاضطراب غير مكتمل.");
    actions.push("استكمال نوع الإعاقة أو التشخيص المبدئي.");
  }

  if (!hasPhone) {
    riskScore += 10;
    reasons.push("بيانات التواصل ناقصة.");
    actions.push("استكمال رقم التواصل لتقليل فقدان المتابعة.");
  }

  if (sessions >= 1 && sessions < 3) {
    riskScore += 10;
    reasons.push("عدد الجلسات قليل، والتحسن قد لا يكون واضحًا بعد.");
    actions.push("جدولة جلسات متابعة إضافية.");
  }

  if (sessions >= 8 && status !== "مكتملة") {
    riskScore += 15;
    reasons.push("تم الوصول لعدد جلسات قريب من البكج دون إغلاق واضح.");
    actions.push("إجراء تقييم نهائي أو تحديث خطة التدخل.");
  }

  let level: AILevel = "منخفض";
  if (riskScore >= 75) level = "حرج";
  else if (riskScore >= 50) level = "مرتفع";
  else if (riskScore >= 25) level = "متوسط";

  return {
    level,
    riskScore,
    prediction:
      level === "حرج"
        ? "احتمال عالي جدًا للتعثر إذا لم يتم التدخل."
        : level === "مرتفع"
        ? "يوجد احتمال تعثر خلال الفترة القادمة."
        : level === "متوسط"
        ? "تحتاج الحالة متابعة منظمة لمنع التعثر."
        : "الخطر منخفض حاليًا مع استمرار المتابعة.",
    reason: reasons.length ? reasons.join(" ") : "لا توجد مؤشرات خطورة عالية حاليًا.",
    action: actions.length ? actions.join(" ") : "الاستمرار على الخطة الحالية ومراقبة التحسن.",
    specialist: getSpecialistSuggestion(c),
    plan:
      level === "حرج" || level === "مرتفع"
        ? "تدخل عاجل: مراجعة الخطة، تحديد جلسة قريبة، التواصل مع الأسرة، وتعيين مختص مسؤول."
        : "خطة متابعة: جلسات منتظمة، قياس أثر شهري، وتحديث ملاحظات المختص.",
    needsThisWeek: level === "حرج" || level === "مرتفع" || !hasSpecialist,
  };
}

export default function AIMonitoring() {
  const [searchTerm, setSearchTerm] = useState("");
  const casesQuery = trpc.cases.list.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const results = useMemo(() => {
    return (casesQuery.data || []).map((c: any) => ({
      ...c,
      ai: analyzeCasePredictively(c),
    }));
  }, [casesQuery.data]);

  const filteredResults = results.filter((c: any) => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return true;

    return [
      c.childName,
      c.caseNumber,
      c.organization,
      c.disabilityType,
      c.disorderType,
      c.status,
      c.ai.level,
      c.ai.specialist,
    ]
      .map((v) => safeText(v).toLowerCase())
      .join(" ")
      .includes(search);
  });

  const urgent = results.filter((r: any) => r.ai.level === "حرج" || r.ai.level === "مرتفع");
  const thisWeek = results.filter((r: any) => r.ai.needsThisWeek);
  const undefinedCases = results.filter((r: any) => r.ai.level === "غير محدد");

  const averageRisk = results.length
    ? Math.round(results.reduce((sum: number, c: any) => sum + c.ai.riskScore, 0) / results.length)
    : 0;

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1F2937]">
            AI Patient Monitoring System
          </h1>
          <p className="mt-2 text-muted-foreground">
            نظام مراقبة ذكي يتوقع الحالات المعرضة للتعثر بناءً على الجلسات، اكتمال البيانات، المختص، والحالة التشغيلية.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              إجمالي الحالات
            </div>
            <div className="mt-2 text-3xl font-bold">{results.length}</div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              خطر مرتفع/حرج
            </div>
            <div className="mt-2 text-3xl font-bold text-red-600">{urgent.length}</div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              تحتاج تدخل هذا الأسبوع
            </div>
            <div className="mt-2 text-3xl font-bold text-orange-600">{thisWeek.length}</div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              متوسط الخطر
            </div>
            <div className="mt-2 text-3xl font-bold">{averageRisk}%</div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            الحالات التي تحتاج تدخل سريع
          </h2>

          {urgent.length === 0 ? (
            <p className="text-muted-foreground">لا توجد حالات عالية الخطورة حاليًا.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {urgent.map((c: any) => (
                <div key={c.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{c.childName}</h3>
                      <p className="text-sm text-muted-foreground">{c.organization || "بدون جمعية"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getRiskStyle(c.ai.level)}`}>
                      {c.ai.level} - {c.ai.riskScore}%
                    </span>
                  </div>
                  <p className="mt-3 text-sm">السبب: {c.ai.reason}</p>
                  <p className="mt-2 text-sm font-semibold text-red-700">الإجراء: {c.ai.action}</p>
                  <p className="mt-2 text-sm">المختص المقترح: {c.ai.specialist}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="h-5 w-5 text-orange-600" />
            حالات لم تبدأ بعد
          </h2>

          {undefinedCases.length === 0 ? (
            <p className="text-muted-foreground">كل الحالات لديها بيانات متابعة مبدئية.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {undefinedCases.slice(0, 6).map((c: any) => (
                <div key={c.id} className="rounded-xl border bg-slate-50 p-4">
                  <h3 className="font-bold">{c.childName}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.ai.reason}</p>
                  <p className="mt-2 text-sm text-orange-700">{c.ai.action}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-bold">تحليل جميع الحالات</h2>

            <div className="relative w-full md:w-80">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full rounded-md border bg-white px-3 py-2 pr-10"
                placeholder="بحث بالاسم، الجمعية، التصنيف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-3 text-right">الحالة</th>
                  <th className="px-4 py-3 text-right">الجمعية</th>
                  <th className="px-4 py-3 text-right">الجلسات</th>
                  <th className="px-4 py-3 text-right">الخطر المتوقع</th>
                  <th className="px-4 py-3 text-right">سبب التوقع</th>
                  <th className="px-4 py-3 text-right">المختص المقترح</th>
                  <th className="px-4 py-3 text-right">خطة التدخل</th>
                </tr>
              </thead>

              <tbody>
                {filteredResults.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-orange-50/40">
                    <td className="px-4 py-3 font-semibold">{c.childName}</td>
                    <td className="px-4 py-3">{c.organization || "-"}</td>
                    <td className="px-4 py-3">{getSessionsCount(c)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getRiskStyle(c.ai.level)}`}>
                        {c.ai.level} - {c.ai.riskScore}%
                      </span>
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-sm">{c.ai.reason}</td>
                    <td className="px-4 py-3 text-sm">{c.ai.specialist}</td>
                    <td className="max-w-[320px] px-4 py-3 text-sm">{c.ai.plan}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredResults.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                لا توجد نتائج مطابقة للبحث
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}