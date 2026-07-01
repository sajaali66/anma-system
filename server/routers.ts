import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { router, publicProcedure } from "./_core/trpc";

/* =========================================================
   ANMA MOCK DATABASE
   ملاحظة: هذا ملف تجريبي يعتمد على Mock Data داخل الذاكرة.
   عند إعادة تشغيل السيرفر سترجع البيانات الافتراضية.
========================================================= */

type UserRole =
  | "super_admin"
  | "admin"
  | "organization"
  | "doctor"
  | "case_manager";

let mockOrganizations: any[] = [
  {
    id: 1,
    name: "جمعية إنماء",
    city: "الرياض",
    contactPerson: "محمد العتيبي",
    phone: "0500000000",
    email: "info@anmaa.sa",
    status: "نشطة",
    notes: "",
    createdAt: new Date(),
  },
];

let mockDoctors: any[] = [
  {
    id: 1,
    name: "د. خالد الرفاعي",
    specialty: "تخاطب",
    organizationId: 1,
    organization: "جمعية إنماء",
    phone: "0500000000",
    email: "speech@anma.sa",
    status: "نشط",
    notes: "",
    createdAt: new Date(),
  },
  {
    id: 2,
    name: "د. شهد الخليفة",
    specialty: "علاج وظيفي",
    organizationId: 1,
    organization: "جمعية إنماء",
    phone: "0500000001",
    email: "ot@anma.sa",
    status: "نشط",
    notes: "",
    createdAt: new Date(),
  },
];

let mockCases: any[] = [
  {
    id: 1,
    caseNumber: "C001",
    childName: "أحمد محمد",
    guardianName: "",
    familyPhone: "",
    beneficiaryPhone: "",
    phone: "",
    age: 5,
    gender: "غير محدد",
    city: "الرياض",
    organization: "جمعية إنماء",
    organizationId: 1,
    doctorId: 1,
    referralReason: "",
    hasPreviousDiagnosis: "غير محدد",
    previousDiagnosis: "",
    referralSource: "",
    disabilityType: "توحد",
    disorderType: "توحد",
    specialist: "د. خالد الرفاعي",
    specialistName: "د. خالد الرفاعي",
    specialistSpecialty: "تخاطب",
    referralType: "تكاملية",
    status: "نشطة",
    referralDate: new Date(),
    treatmentPlan: "خطة تدخل تخاطب وسلوك لمدة 8 جلسات",
    financialStatus: "",
    notes: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let mockSessions: any[] = [];
let mockImpact: any[] = [];
let mockCompliance: any[] = [];
let mockFinancing: any[] = [];
let mockReports: any[] = [];
let mockAlerts: any[] = [];

let mockDiseases: any[] = [
  {
    id: 1,
    name: "اضطراب طيف التوحد",
    category: "نمائي",
    defaultSpecialist: "طبيب نمو وسلوك + أخصائي تعديل سلوك",
    organization: "كل الجمعيات",
    organizationId: null,
    doctorId: null,
    priority: "مرتفع",
    status: "نشط",
    notes: "يحتاج متابعة دورية وتقارير مختصين دقيقة.",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: "تأخر نطق / اضطراب لغة",
    category: "نطق وتخاطب",
    defaultSpecialist: "أخصائي نطق وتخاطب",
    organization: "كل الجمعيات",
    organizationId: null,
    doctorId: null,
    priority: "متوسط",
    status: "نشط",
    notes: "يرتبط بخطة جلسات تخاطب وقياس مفردات.",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    name: "فرط حركة وتشتت انتباه ADHD",
    category: "نفسي / سلوكي",
    defaultSpecialist: "طبيب نمو وسلوك / أخصائي نفسي",
    organization: "كل الجمعيات",
    organizationId: null,
    doctorId: null,
    priority: "متوسط",
    status: "نشط",
    notes: "يحتاج متابعة سلوكية ومدرسية.",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 4,
    name: "صعوبات تعلم",
    category: "تعليمي",
    defaultSpecialist: "أخصائي صعوبات تعلم",
    organization: "كل الجمعيات",
    organizationId: null,
    doctorId: null,
    priority: "متوسط",
    status: "نشط",
    notes: "يحتاج خطة تعليمية فردية.",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let mockUsers: any[] = [
  {
    id: 1,
    name: "سجا علي الأمير",
    email: "admin@anma.sa",
    password: "123456",
    role: "super_admin" as UserRole,
    organizationId: null,
    doctorId: null,
    status: "نشط",
    createdAt: new Date(),
  },
  {
    id: 2,
    name: "حساب الجمعية",
    email: "org@test.com",
    password: "123456",
    role: "organization" as UserRole,
    organizationId: 1,
    doctorId: null,
    status: "نشط",
    createdAt: new Date(),
  },
  {
    id: 3,
    name: "د. خالد الرفاعي",
    email: "doctor@test.com",
    password: "123456",
    role: "doctor" as UserRole,
    organizationId: 1,
    doctorId: 1,
    status: "نشط",
    createdAt: new Date(),
  },
];

let currentUserId: number | null = 1;

/* =========================================================
   LOCAL FILE DATABASE
   نسخة سريعة للديمو بدون MySQL
   تحفظ البيانات في: data/anma-demo-db.json
========================================================= */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "anma-demo-db.json");

function serializeLocalDb() {
  return {
    organizations: mockOrganizations,
    doctors: mockDoctors,
    cases: mockCases,
    sessions: mockSessions,
    impact: mockImpact,
    compliance: mockCompliance,
    financing: mockFinancing,
    reports: mockReports,
    alerts: mockAlerts,
    diseases: mockDiseases,
    users: mockUsers,
    currentUserId,
    savedAt: new Date().toISOString(),
  };
}

function saveLocalDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(serializeLocalDb(), null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save local DB:", error);
  }
}

function loadLocalDb() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      saveLocalDb();
      return;
    }

    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);

    if (Array.isArray(data.organizations)) mockOrganizations = data.organizations;
    if (Array.isArray(data.doctors)) mockDoctors = data.doctors;
    if (Array.isArray(data.cases)) mockCases = data.cases;
    if (Array.isArray(data.sessions)) mockSessions = data.sessions;
    if (Array.isArray(data.impact)) mockImpact = data.impact;
    if (Array.isArray(data.compliance)) mockCompliance = data.compliance;
    if (Array.isArray(data.financing)) mockFinancing = data.financing;
    if (Array.isArray(data.reports)) mockReports = data.reports;
    if (Array.isArray(data.alerts)) mockAlerts = data.alerts;
    if (Array.isArray(data.diseases)) mockDiseases = data.diseases;
    if (Array.isArray(data.users)) mockUsers = data.users;
    if (data.currentUserId) currentUserId = data.currentUserId;

    const hasMainAdmin = mockUsers.some(
      (user) => String(user.email || "").toLowerCase() === "admin@anma.sa"
    );

    if (!hasMainAdmin) {
      mockUsers.unshift({
        id: nextId(mockUsers),
        name: "سجا علي الأمير",
        email: "admin@anma.sa",
        password: "123456",
        role: "super_admin" as UserRole,
        organizationId: null,
        doctorId: null,
        status: "نشط",
        createdAt: new Date(),
      });
      saveLocalDb();
    }
  } catch (error) {
    console.error("Failed to load local DB:", error);
    saveLocalDb();
  }
}

loadLocalDb();

setInterval(saveLocalDb, 1500);

process.on("SIGINT", () => {
  saveLocalDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  saveLocalDb();
  process.exit(0);
});


/* =========================================================
   HELPERS
========================================================= */

function nextId(items: any[]) {
  return items.length ? Math.max(...items.map((item) => Number(item.id) || 0)) + 1 : 1;
}

function safeText(value: any) {
  return String(value ?? "").trim();
}

function safeNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function publicUser(user: any) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function getCurrentUser() {
  return mockUsers.find((user) => user.id === currentUserId) ?? null;
}

function canSeeCase(user: any, caseItem: any) {
  if (!user) return false;

  if (user.role === "super_admin" || user.role === "admin" || user.role === "case_manager") {
    return true;
  }

  if (user.role === "organization") {
    return Number(caseItem.organizationId) === Number(user.organizationId);
  }

  if (user.role === "doctor") {
    return (
      Number(caseItem.doctorId) === Number(user.doctorId) ||
      caseItem.specialist === user.name ||
      caseItem.specialistName === user.name
    );
  }

  return false;
}

function ensureOrganizationExists(input: any) {
  const organizationName = input.organization || "غير محدد";
  if (organizationName === "غير محدد") return;

  const existingOrg = mockOrganizations.find((org) => org.name === organizationName);
  if (existingOrg) return;

  mockOrganizations.unshift({
    id: nextId(mockOrganizations),
    name: organizationName,
    city: input.city || "غير محدد",
    contactPerson: input.guardianName || "",
    phone: input.phone || input.familyPhone || "",
    email: "",
    status: "نشطة",
    notes: "تمت إضافتها تلقائيًا من بيانات الحالات",
    createdAt: new Date(),
  });
}

function getDoctorByCase(caseData: any) {
  if (!caseData) return null;

  if (caseData.doctorId) {
    return mockDoctors.find((doctor) => doctor.id === caseData.doctorId) ?? null;
  }

  if (caseData.specialist || caseData.specialistName) {
    return (
      mockDoctors.find(
        (doctor) =>
          doctor.name === caseData.specialist ||
          doctor.name === caseData.specialistName
      ) ?? null
    );
  }

  return null;
}

function refreshCaseOperationalStatus(caseId: number) {
  const sessions = mockSessions.filter((item) => item.caseId === caseId);
  const caseItem = mockCases.find((item) => item.id === caseId);

  if (!caseItem) return;

  if (caseItem.status === "مكتملة") return;

  if (sessions.length === 0) {
    caseItem.status = "جديدة";
    return;
  }

  const absentCount = sessions.filter((item) => item.attendance === "غائب").length;

  if (absentCount >= 3) {
    caseItem.status = "متعثرة";
  } else {
    caseItem.status = "نشطة";
  }

  caseItem.updatedAt = new Date();
}

function getCaseSmartAnalysis(caseId: number) {
  const MAX_SESSIONS = 8;

  const caseData = mockCases.find((item) => item.id === caseId);
  const doctor = getDoctorByCase(caseData);

  const sessions = mockSessions.filter((item) => item.caseId === caseId);
  const impacts = mockImpact.filter((item) => item.caseId === caseId);
  const compliances = mockCompliance.filter((item) => item.caseId === caseId);
  const financing = mockFinancing.filter((item) => item.caseId === caseId);

  const totalSessions = sessions.length;
  const presentCount = sessions.filter((item) => item.attendance === "حاضر").length;
  const absentCount = sessions.filter((item) => item.attendance === "غائب").length;
  const postponedCount = sessions.filter((item) => item.attendance === "مؤجل").length;
  const improvedCount = sessions.filter((item) => item.progress === "تحسن").length;
  const declinedCount = sessions.filter((item) => item.progress === "تراجع").length;

  const lastSession = sessions.length
    ? sessions
        .slice()
        .sort(
          (a, b) =>
            new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
        )[0]
    : null;

  const daysSinceLastSession = lastSession
    ? Math.floor(
        (Date.now() - new Date(lastSession.sessionDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const attendanceRate = totalSessions ? (presentCount / totalSessions) * 100 : 0;
  const improvementRate = totalSessions ? (improvedCount / totalSessions) * 100 : 0;

  const latestImpact = impacts[0];
  const impactRate = safeNumber(latestImpact?.improvementPercentage);

  const latestCompliance = compliances[0];
  const complianceRate = safeNumber(latestCompliance?.attendancePercentage);

  const latestFinancing = financing[0];
  const approvedSessionCount = safeNumber(latestFinancing?.approvedSessionCount || MAX_SESSIONS);
  const usedSessionCount = safeNumber(latestFinancing?.usedSessionCount || totalSessions);
  const completionRate = approvedSessionCount
    ? Math.min(100, (usedSessionCount / approvedSessionCount) * 100)
    : 0;

  const alerts: string[] = [];
  const recommendations: string[] = [];

  if (!caseData?.phone && !caseData?.familyPhone && !caseData?.beneficiaryPhone) {
    alerts.push("بيانات التواصل ناقصة");
  }

  if (!doctor) {
    alerts.push("لا يوجد مختص مرتبط بالحالة");
  }

  if (!caseData?.disabilityType && !caseData?.disorderType) {
    alerts.push("نوع الإعاقة / المرض غير محدد");
  }

  let riskLevel: "غير محدد" | "ممتاز" | "متابعة" | "خطر" = "غير محدد";
  let riskScore = 0;
  let aiSummary = "لا توجد بيانات كافية بعد للتحليل.";
  let predictedOutcome = "سيتم توقع المسار بعد تسجيل جلسات وتقارير.";
  let clinicalRecommendation = "إضافة جلسات وتقارير مختصين لتفعيل التحليل الذكي.";

  if (totalSessions === 0) {
    riskLevel = "غير محدد";
    riskScore = 0;
    aiSummary = "الحالة لم تبدأ جلسات بعد.";
    recommendations.push("إضافة أول جلسة أو تقرير مختص للحالة.");
  } else if (absentCount >= 3 || caseData?.status === "متعثرة") {
    riskLevel = "خطر";
    riskScore = 90;
    aiSummary = "توجد مؤشرات تعثر واضحة بسبب الغياب أو حالة تشغيلية متعثرة.";
    predictedOutcome = "قد يتأخر تحقيق أهداف الخطة إذا لم يتم التدخل.";
    clinicalRecommendation = "مراجعة الخطة والتواصل مع الأسرة بشكل عاجل.";
    recommendations.push("جدولة مراجعة عاجلة للحالة.");
  } else if (absentCount > 0 || postponedCount > 0 || alerts.length > 0) {
    riskLevel = "متابعة";
    riskScore = 60;
    aiSummary = "الحالة تحتاج متابعة بسبب غياب/تأجيل أو نقص بيانات.";
    predictedOutcome = "من المتوقع تحسن تدريجي عند تحسين الالتزام.";
    clinicalRecommendation = "استكمال البيانات ومتابعة الالتزام بالجلسات.";
    recommendations.push("متابعة الالتزام واستكمال البيانات الناقصة.");
  } else {
    riskLevel = "ممتاز";
    riskScore = 20;
    aiSummary = "الحالة مستقرة ولا توجد مؤشرات خطر حالية.";
    predictedOutcome = "من المتوقع استمرار التحسن مع الالتزام بالخطة.";
    clinicalRecommendation = "الاستمرار على الخطة الحالية مع قياس أثر دوري.";
    recommendations.push("الاستمرار بالخطة الحالية.");
  }

  return {
    caseId,
    caseData,
    doctor,
    totalSessions,
    presentCount,
    absentCount,
    postponedCount,
    improvedCount,
    declinedCount,
    attendanceRate: Math.round(attendanceRate),
    improvementRate: Math.round(improvementRate),
    impactRate: Math.round(impactRate),
    complianceRate: Math.round(complianceRate),
    completionRate: Math.round(completionRate),
    daysSinceLastSession,
    lastSessionDate: lastSession?.sessionDate ?? null,
    alerts,
    recommendations,
    riskLevel,
    riskScore,
    aiSummary,
    predictedOutcome,
    clinicalRecommendation,
    suggestedSpecialist: doctor?.specialty || "يحدد بعد التقييم",
    suggestedDiagnosis: caseData?.disabilityType || caseData?.disorderType || "غير محدد",
    timestamp: new Date(),
  };
}

function getDashboardSummary(cases: any[]) {
  const sessions = mockSessions.filter((session) =>
    cases.some((caseItem) => caseItem.id === session.caseId)
  );

  const smartResults = cases.map((caseItem) => getCaseSmartAnalysis(caseItem.id));

  const totalCases = cases.length;
  const activeCases = cases.filter((item) =>
    ["نشطة", "متابعة", "قيد المتابعة"].includes(item.status)
  ).length;
  const completedCases = cases.filter((item) => item.status === "مكتملة").length;
  const highRiskCases = smartResults.filter((item) => item.riskLevel === "خطر").length;
  const followUpCases = smartResults.filter((item) => item.riskLevel === "متابعة").length;
  const noSessionCases = smartResults.filter((item) => item.totalSessions === 0).length;

  const averageRiskScore = smartResults.length
    ? Math.round(
        smartResults.reduce((sum, item) => sum + item.riskScore, 0) /
          smartResults.length
      )
    : 0;

  const presentSessions = sessions.filter((item) => item.attendance === "حاضر").length;
  const attendanceRate = sessions.length
    ? Math.round((presentSessions / sessions.length) * 100)
    : 0;

  const diagnoses = new Map<string, number>();
  const organizations = new Map<string, number>();
  const doctors = new Map<string, number>();

  cases.forEach((caseItem) => {
    const diagnosis = caseItem.disabilityType || caseItem.disorderType || "غير محدد";
    diagnoses.set(diagnosis, (diagnoses.get(diagnosis) || 0) + 1);

    const organization = caseItem.organization || "غير محدد";
    organizations.set(organization, (organizations.get(organization) || 0) + 1);

    const doctor = caseItem.specialistName || caseItem.specialist || "غير محدد";
    doctors.set(doctor, (doctors.get(doctor) || 0) + 1);
  });

  return {
    totalCases,
    totalPatients: totalCases,
    activeCases,
    completedCases,
    highRiskCases,
    criticalCases: highRiskCases,
    followUpCases,
    casesNeedingFollowUp: followUpCases,
    noSessionCases,
    totalSessions: sessions.length,
    sessionsCount: sessions.length,
    completedSessions: presentSessions,
    missedSessions: sessions.filter((item) => item.attendance === "غائب").length,
    postponedSessions: sessions.filter((item) => item.attendance === "مؤجل").length,
    averageRiskScore,
    riskScore: averageRiskScore,
    attendanceRate,
    diagnoses: Array.from(diagnoses.entries()).map(([name, value]) => ({ name, value })),
    organizations: Array.from(organizations.entries()).map(([name, value]) => ({ name, value })),
    doctors: Array.from(doctors.entries()).map(([name, value]) => ({ name, value })),
    timestamp: new Date(),
  };
}


function syncDiseaseFromCase(input: any) {
  const name = safeText(input.disabilityType || input.disorderType || input.diagnosis);
  if (!name || name === "غير محدد") return;

  const exists = mockDiseases.some(
    (item) => safeText(item.name).toLowerCase() === name.toLowerCase()
  );

  if (exists) return;

  mockDiseases.unshift({
    id: nextId(mockDiseases),
    name,
    category: "أخرى",
    defaultSpecialist: input.specialistSpecialty || input.specialist || "",
    organization: input.organization || "كل الجمعيات",
    organizationId: input.organizationId ?? null,
    doctorId: input.doctorId ?? null,
    priority: "متوسط",
    status: "نشط",
    notes: "تمت إضافته تلقائيًا من إدارة الحالات.",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function getDiseaseUsage(name: string) {
  return mockCases.filter(
    (caseItem) =>
      safeText(caseItem.disabilityType || caseItem.disorderType || caseItem.diagnosis) ===
      safeText(name)
  ).length;
}



function parseOpenAIJson(outputText: string) {
  const cleaned = String(outputText || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first >= 0 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }

    throw new Error("OpenAI response was not valid JSON");
  }
}

async function callOpenAIClinicalAnalysis(payload: {
  caseData: any;
  sessions: any[];
  clinicalReports: any[];
  localAnalysis: any;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("OpenAI Key Loaded:", apiKey ? apiKey.slice(0, 12) : "undefined");

  if (!apiKey || apiKey === "your_key_here") {
    return {
      usedOpenAI: false,
      error: "OPENAI_API_KEY غير مضاف في ملف .env",
      data: null,
    };
  }

  const systemPrompt = `
أنت مساعد طبي تشغيلي داخل منصة أنما.
مهمتك تحليل بيانات الحالة وتقارير المختصين لإنتاج خطة رعاية وتمويل.
لا تشخص تشخيصًا نهائيًا، بل اكتب "اشتباه/مؤشرات" عند الحاجة.
اكتب بالعربية المهنية المختصرة.
أرجع JSON فقط بدون Markdown.
`;

  const userPrompt = `
حلل الحالة التالية وارجع JSON بنفس المفاتيح:

{
  "aiSummary": "ملخص الحالة",
  "riskLevel": "غير محدد | ممتاز | متابعة | خطر",
  "carePriority": "يحتاج تقييم أولي | مستقر | أولوية متابعة | أولوية عالية",
  "suggestedDiagnosis": "التشخيص/الاشتباه الأقرب",
  "suggestedSpecialist": "المختص المناسب",
  "requiredServiceType": "نوع الخدمة المطلوبة",
  "requiredSpecialistLevel": "أخصائي | أخصائي أول | استشاري أو أخصائي أول",
  "recommendedSessions": 0,
  "expectedSessionCost": 0,
  "expectedEvaluationCost": 0,
  "expectedCareCost": 0,
  "fundingDecision": "احتياج تمويلي منخفض | يحتاج اعتماد تمويل متوسط | يحتاج اعتماد تمويل مرتفع",
  "recommendedCarePlan": "خطة رعاية وتشغيل",
  "homePlanRecommendations": ["توصية منزلية"],
  "administrativeRecommendations": ["توصية إدارية"],
  "strengths": ["نقطة قوة"],
  "weaknesses": ["نقطة ضعف"],
  "predictedOutcome": "التوقع القادم",
  "nextAction": "الإجراء التالي",
  "smartDecisionRationale": "مبررات القرار",
  "reportQualityScore": 0
}

بيانات الحالة:
${JSON.stringify(payload.caseData || {}, null, 2)}

الجلسات:
${JSON.stringify(payload.sessions || [], null, 2)}

تقارير المختصين:
${JSON.stringify(payload.clinicalReports || [], null, 2)}

التحليل المحلي الحالي:
${JSON.stringify(payload.localAnalysis || {}, null, 2)}
`;

  try {
    console.log("Calling OpenAI for clinical analysis...");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.2,
        max_output_tokens: 1800,
      }),
    });

    console.log("OpenAI Response Status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log("OpenAI Error Body:", errorText);
      return {
        usedOpenAI: false,
        error: `OpenAI Error ${response.status}: ${errorText}`,
        data: null,
      };
    }

    const result: any = await response.json();
    const outputText =
      result.output_text ||
      result.output?.[0]?.content?.[0]?.text ||
      "";

    if (!outputText) {
      return {
        usedOpenAI: false,
        error: "OpenAI رجع استجابة فارغة",
        data: null,
      };
    }

    console.log("OpenAI analysis completed successfully.");

    return {
      usedOpenAI: true,
      error: null,
      data: parseOpenAIJson(outputText),
      raw: outputText,
    };
  } catch (error: any) {
    console.log("OpenAI Catch Error:", error?.message || error);

    return {
      usedOpenAI: false,
      error: error?.message || "حدث خطأ غير معروف أثناء الاتصال بـ OpenAI",
      data: null,
    };
  }
}

/* =========================================================
   ROUTERS
========================================================= */

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(() => {
      return publicUser(getCurrentUser());
    }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(({ input }) => {
        const user = mockUsers.find(
          (item) =>
            item.email.toLowerCase() === input.email.trim().toLowerCase() &&
            item.password === input.password.trim() &&
            item.status === "نشط"
        );

        if (!user) {
          throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        }

        currentUserId = user.id;

        return {
          success: true,
          user: publicUser(user),
        };
      }),

    logout: publicProcedure.mutation(() => {
      currentUserId = null;
      return { success: true };
    }),

    permissions: publicProcedure.query(() => {
      const user = getCurrentUser();

      return {
        user: publicUser(user),
        canManageUsers:
          user?.role === "super_admin" || user?.role === "admin",
        canSeeAllCases:
          user?.role === "super_admin" ||
          user?.role === "admin" ||
          user?.role === "case_manager",
        canManageCases:
          user?.role === "super_admin" ||
          user?.role === "admin" ||
          user?.role === "case_manager",
        canAddReports:
          user?.role === "super_admin" ||
          user?.role === "admin" ||
          user?.role === "case_manager" ||
          user?.role === "doctor",
      };
    }),
  }),

  users: router({
    list: publicProcedure.query(() => {
      return mockUsers.map(publicUser);
    }),

    create: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          password: z.string().min(4),
          role: z.enum([
            "super_admin",
            "admin",
            "organization",
            "doctor",
            "case_manager",
          ]),
          organizationId: z.number().nullable().optional(),
          doctorId: z.number().nullable().optional(),
          status: z.enum(["نشط", "موقوف"]).default("نشط"),
        })
      )
      .mutation(({ input }) => {
        const exists = mockUsers.some(
          (user) => user.email.toLowerCase() === input.email.toLowerCase()
        );

        if (exists) {
          throw new Error("هذا البريد مستخدم مسبقاً");
        }

        const newUser = {
          id: nextId(mockUsers),
          name: input.name,
          email: input.email,
          password: input.password,
          role: input.role,
          organizationId: input.organizationId ?? null,
          doctorId: input.doctorId ?? null,
          status: input.status,
          createdAt: new Date(),
        };

        mockUsers.unshift(newUser);

        return {
          success: true,
          user: publicUser(newUser),
        };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.any(),
        })
      )
      .mutation(({ input }) => {
        const cleanData = { ...input.data };

        if (typeof cleanData.password === "string" && cleanData.password.trim() === "") {
          delete cleanData.password;
        }

        mockUsers = mockUsers.map((user) =>
          user.id === input.id
            ? {
                ...user,
                ...cleanData,
                id: user.id,
              }
            : user
        );

        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        if (input.id === 1) {
          throw new Error("لا يمكن حذف المستخدم الرئيسي");
        }

        mockUsers = mockUsers.filter((user) => user.id !== input.id);

        if (currentUserId === input.id) {
          currentUserId = 1;
        }

        return { success: true };
      }),
  }),

  doctors: router({
    list: publicProcedure.query(() => {
      return mockDoctors.map((doctor) => {
        const linkedCases = mockCases.filter(
          (caseItem) =>
            caseItem.doctorId === doctor.id ||
            caseItem.specialist === doctor.name ||
            caseItem.specialistName === doctor.name
        );

        const linkedCaseIds = linkedCases.map((item) => item.id);

        const linkedSessions = mockSessions.filter((session) =>
          linkedCaseIds.includes(session.caseId)
        );

        return {
          ...doctor,
          casesCount: linkedCases.length,
          activeCases: linkedCases.length,
          sessionsCount: linkedSessions.length,
          totalSessions: linkedSessions.length,
        };
      });
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        return mockDoctors.find((item) => item.id === input.id) ?? null;
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const org = mockOrganizations.find(
        (item) =>
          item.id === Number(input.organizationId) ||
          item.name === input.organization
      );

      const newDoctor = {
        id: nextId(mockDoctors),
        name: input.name || "",
        specialty: input.specialty || "",
        organizationId: org?.id ?? Number(input.organizationId) ?? null,
        organization: org?.name ?? input.organization ?? "غير محدد",
        phone: input.phone || "",
        email: input.email || "",
        status: input.status || "نشط",
        notes: input.notes || "",
        createdAt: new Date(),
      };

      mockDoctors.unshift(newDoctor);

      return { success: true, data: newDoctor, ...newDoctor };
    }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(({ input }) => {
        const oldDoctor = mockDoctors.find((item) => item.id === input.id);

        mockDoctors = mockDoctors.map((doctor) =>
          doctor.id === input.id
            ? {
                ...doctor,
                ...input.data,
                id: doctor.id,
              }
            : doctor
        );

        const updatedDoctor = mockDoctors.find((item) => item.id === input.id);

        if (oldDoctor && updatedDoctor) {
          mockCases = mockCases.map((caseItem) =>
            caseItem.doctorId === updatedDoctor.id ||
            caseItem.specialist === oldDoctor.name ||
            caseItem.specialistName === oldDoctor.name
              ? {
                  ...caseItem,
                  doctorId: updatedDoctor.id,
                  specialist: updatedDoctor.name,
                  specialistName: updatedDoctor.name,
                  specialistSpecialty: updatedDoctor.specialty,
                  updatedAt: new Date(),
                }
              : caseItem
          );
        }

        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const doctor = mockDoctors.find((item) => item.id === input.id);

        mockDoctors = mockDoctors.filter((item) => item.id !== input.id);

        if (doctor) {
          mockCases = mockCases.map((caseItem) =>
            caseItem.doctorId === doctor.id
              ? {
                  ...caseItem,
                  doctorId: null,
                  specialist: "غير محدد",
                  specialistName: "غير محدد",
                  specialistSpecialty: "",
                  updatedAt: new Date(),
                }
              : caseItem
          );
        }

        return { success: true };
      }),
  }),

  organizations: router({
    list: publicProcedure.query(() => {
      return mockOrganizations.map((org) => {
        const linkedCases = mockCases.filter(
          (caseItem) =>
            caseItem.organizationId === org.id || caseItem.organization === org.name
        );

        return {
          ...org,
          casesCount: linkedCases.length,
        };
      });
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        const organization = mockOrganizations.find((item) => item.id === input.id);

        if (!organization) return null;

        const cases = mockCases.filter(
          (caseItem) =>
            caseItem.organizationId === organization.id ||
            caseItem.organization === organization.name
        );

        return {
          ...organization,
          cases,
          casesCount: cases.length,
        };
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const newOrganization = {
        id: nextId(mockOrganizations),
        name: input.name || "",
        city: input.city || "",
        contactPerson: input.contactPerson || input.managerName || "",
        phone: input.phone || "",
        email: input.email || "",
        status: input.status || "نشطة",
        notes: input.notes || "",
        createdAt: new Date(),
      };

      mockOrganizations.unshift(newOrganization);

      return { success: true, data: newOrganization, ...newOrganization };
    }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(({ input }) => {
        const oldOrg = mockOrganizations.find((item) => item.id === input.id);

        mockOrganizations = mockOrganizations.map((org) =>
          org.id === input.id
            ? {
                ...org,
                ...input.data,
                id: org.id,
              }
            : org
        );

        const updatedOrg = mockOrganizations.find((item) => item.id === input.id);

        if (oldOrg && updatedOrg) {
          mockCases = mockCases.map((caseItem) =>
            caseItem.organizationId === updatedOrg.id ||
            caseItem.organization === oldOrg.name
              ? {
                  ...caseItem,
                  organizationId: updatedOrg.id,
                  organization: updatedOrg.name,
                  updatedAt: new Date(),
                }
              : caseItem
          );
        }

        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        mockOrganizations = mockOrganizations.filter((item) => item.id !== input.id);
        return { success: true };
      }),
  }),

  cases: router({
    list: publicProcedure.query(() => {
      const user = getCurrentUser();
      return mockCases
        .filter((caseItem) => canSeeCase(user, caseItem))
        .map((caseItem) => {
          const sessions = mockSessions.filter((session) => session.caseId === caseItem.id);
          const smart = getCaseSmartAnalysis(caseItem.id);

          return {
            ...caseItem,
            sessionsCount: sessions.length,
            totalSessions: sessions.length,
            completedSessions: sessions.filter((s) => s.attendance === "حاضر").length,
            lastSessionDate: sessions[0]?.sessionDate ?? null,
            smartLevel: smart.riskLevel,
          };
        });
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        const user = getCurrentUser();
        const caseItem = mockCases.find((item) => item.id === input.id);

        if (!caseItem || !canSeeCase(user, caseItem)) return null;

        const doctor = getDoctorByCase(caseItem);

        return {
          ...caseItem,
          doctor,
          specialistName: caseItem.specialistName || doctor?.name || caseItem.specialist,
          specialistSpecialty: caseItem.specialistSpecialty || doctor?.specialty || "",
        };
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      ensureOrganizationExists(input);

      const organization = mockOrganizations.find(
        (item) => item.name === input.organization || item.id === Number(input.organizationId)
      );

      const doctor = mockDoctors.find(
        (item) =>
          item.id === Number(input.doctorId) ||
          item.name === input.specialist ||
          item.name === input.specialistName
      );

      const newCaseId = nextId(mockCases);

      const newCase = {
        id: newCaseId,
        caseNumber: input.caseNumber || `CASE-${newCaseId}`,
        childName: input.childName || "غير محدد",
        guardianName: input.guardianName || "",
        familyPhone: input.familyPhone || "",
        beneficiaryPhone: input.beneficiaryPhone || "",
        phone: input.phone || input.familyPhone || input.beneficiaryPhone || "",
        age: safeNumber(input.age),
        gender: input.gender || "غير محدد",
        city: input.city || "غير محدد",
        organization: organization?.name || input.organization || "غير محدد",
        organizationId: organization?.id || input.organizationId || null,
        doctorId: doctor?.id || input.doctorId || null,
        referralReason: input.referralReason || "",
        hasPreviousDiagnosis: input.hasPreviousDiagnosis || "غير محدد",
        previousDiagnosis: input.previousDiagnosis || "",
        referralSource: input.referralSource || "",
        disabilityType: input.disabilityType || input.disorderType || "",
        disorderType: input.disorderType || input.disabilityType || "غير محدد",
        specialist: doctor?.name || input.specialist || input.specialistName || "غير محدد",
        specialistName: doctor?.name || input.specialistName || input.specialist || "غير محدد",
        specialistSpecialty: doctor?.specialty || input.specialistSpecialty || "",
        referralType: input.referralType || "تكاملية",
        status: input.status || "جديدة",
        referralDate: input.referralDate || new Date(),
        treatmentPlan: input.treatmentPlan || "",
        financialStatus: input.financialStatus || "",
        notes: input.notes || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCases.unshift(newCase);
      syncDiseaseFromCase(newCase);

      return { success: true, data: newCase, ...newCase };
    }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(({ input }) => {
        mockCases = mockCases.map((caseItem) =>
          caseItem.id === input.id
            ? {
                ...caseItem,
                ...input.data,
                id: caseItem.id,
                disabilityType: input.data.disabilityType ?? input.data.disorderType ?? caseItem.disabilityType,
                disorderType: input.data.disorderType ?? input.data.disabilityType ?? caseItem.disorderType,
                updatedAt: new Date(),
              }
            : caseItem
        );

        const updatedCase = mockCases.find((item) => item.id === input.id);
        if (updatedCase) syncDiseaseFromCase(updatedCase);

        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        mockCases = mockCases.filter((item) => item.id !== input.id);
        mockSessions = mockSessions.filter((item) => item.caseId !== input.id);
        mockImpact = mockImpact.filter((item) => item.caseId !== input.id);
        mockCompliance = mockCompliance.filter((item) => item.caseId !== input.id);
        mockFinancing = mockFinancing.filter((item) => item.caseId !== input.id);
        return { success: true };
      }),
  }),

  sessions: router({
    list: publicProcedure.query(() => mockSessions),

    getByCase: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return mockSessions
          .filter((item) => item.caseId === input.caseId)
          .sort(
            (a, b) =>
              new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
          );
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const caseItem = mockCases.find((item) => item.id === input.caseId);
      const doctor = getDoctorByCase(caseItem);

      const newSession = {
        id: nextId(mockSessions),
        caseId: input.caseId,
        doctorId: input.doctorId || doctor?.id || caseItem?.doctorId || null,
        sessionDate: input.sessionDate || new Date(),
        sessionType: input.sessionType || "فردي",
        attendance: input.attendance || "حاضر",
        progress: input.progress || "ثابت",
        notes: input.notes || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessions.unshift(newSession);
      refreshCaseOperationalStatus(input.caseId);

      return { success: true, data: newSession, ...newSession };
    }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(({ input }) => {
        const oldSession = mockSessions.find((item) => item.id === input.id);

        mockSessions = mockSessions.map((session) =>
          session.id === input.id
            ? {
                ...session,
                ...input.data,
                id: session.id,
                updatedAt: new Date(),
              }
            : session
        );

        if (oldSession) refreshCaseOperationalStatus(oldSession.caseId);

        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const oldSession = mockSessions.find((item) => item.id === input.id);
        mockSessions = mockSessions.filter((item) => item.id !== input.id);

        if (oldSession) refreshCaseOperationalStatus(oldSession.caseId);

        return { success: true };
      }),
  }),

  impact: router({
    getByCase: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return mockImpact.filter((item) => item.caseId === input.caseId);
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const baseline = safeNumber(input.baseline);
      const afterValue = safeNumber(input.after || input.afterValue);
      const improvementPercentage =
        baseline > 0 ? Math.round(((afterValue - baseline) / baseline) * 100) : 0;

      const item = {
        id: nextId(mockImpact),
        ...input,
        afterValue,
        improvementPercentage: input.improvementPercentage ?? improvementPercentage,
        measurementDate: input.measurementDate || new Date(),
        createdAt: new Date(),
      };

      mockImpact.unshift(item);
      return { success: true, data: item, ...item };
    }),
  }),

  compliance: router({
    getByCase: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return mockCompliance.filter((item) => item.caseId === input.caseId);
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const item = {
        id: nextId(mockCompliance),
        ...input,
        complianceDate: input.complianceDate || new Date(),
        createdAt: new Date(),
      };

      mockCompliance.unshift(item);
      return { success: true, data: item, ...item };
    }),
  }),

  financing: router({
    getByCase: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return mockFinancing.filter((item) => item.caseId === input.caseId);
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const sessionCount = safeNumber(input.sessionCount);
      const sessionCost = safeNumber(input.sessionCost);
      const totalCost = input.totalCost ?? sessionCount * sessionCost;

      const item = {
        id: nextId(mockFinancing),
        ...input,
        sessionCount,
        sessionCost,
        totalCost,
        usedSessionCount: input.usedSessionCount ?? 0,
        financingStatus: input.financingStatus || "معلق",
        createdAt: new Date(),
      };

      mockFinancing.unshift(item);
      return { success: true, data: item, ...item };
    }),
  }),

  alerts: router({
    list: publicProcedure.query(() => mockAlerts),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const item = {
        id: nextId(mockAlerts),
        ...input,
        isRead: input.isRead ?? false,
        createdAt: new Date(),
      };

      mockAlerts.unshift(item);
      return { success: true, data: item, ...item };
    }),
  }),

  reports: router({
    list: publicProcedure.query(() => mockReports),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const item = {
        id: nextId(mockReports),
        ...input,
        generatedAt: new Date(),
        createdAt: new Date(),
      };

      mockReports.unshift(item);
      return { success: true, data: item, ...item };
    }),
  }),

  smart: router({
    caseSummary: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return getCaseSmartAnalysis(input.caseId);
      }),

    dashboardSummary: publicProcedure.query(() => {
      const user = getCurrentUser();
      const visibleCases = mockCases.filter((caseItem) => canSeeCase(user, caseItem));
      return getDashboardSummary(visibleCases);
    }),
  }),

  analysis: router({

    testOpenAI: publicProcedure.query(async () => {
      const openAIResult = await callOpenAIClinicalAnalysis({
        caseData: {
          childName: "اختبار",
          age: 5,
          disorderType: "تأخر نطق",
          notes: "هذا اختبار للتأكد من عمل OpenAI داخل منصة أنما.",
        },
        sessions: [
          {
            sessionDate: new Date(),
            attendance: "حاضر",
            progress: "تحسن",
            notes: "تحسن بسيط في الاستجابة.",
          },
        ],
        clinicalReports: [
          {
            title: "تقرير اختبار",
            reportType: "تقرير متابعة",
            reportText:
              "يوجد تأخر في النطق مع تحسن بسيط. يوصى بجلسات نطق أسبوعية وخطة منزلية.",
            recommendations: "جلسات نطق وتخاطب لمدة 8 أسابيع.",
          },
        ],
        localAnalysis: {
          riskLevel: "متابعة",
          aiSummary: "اختبار تحليل محلي.",
          attendanceRate: 100,
          totalSessions: 1,
        },
      });

      return {
        ok: Boolean(openAIResult.usedOpenAI),
        usedOpenAI: openAIResult.usedOpenAI,
        openAIStatus: openAIResult.usedOpenAI ? "success" : "fallback",
        error: openAIResult.error,
        data: openAIResult.data,
      };
    }),


    analyzeCaseProgress: publicProcedure
      .input(
        z.object({
          caseId: z.number(),
          clinicalReports: z.array(z.any()).optional(),
          sessions: z.array(z.any()).optional(),
          caseData: z.any().optional(),
          useOpenAI: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const localAnalysis = getCaseSmartAnalysis(input.caseId);
        const caseData =
          input.caseData ||
          localAnalysis.caseData ||
          mockCases.find((item) => item.id === input.caseId) ||
          {};
        const sessions =
          input.sessions ||
          mockSessions.filter((item) => item.caseId === input.caseId);
        const clinicalReports = input.clinicalReports || [];

        const openAIResult = await callOpenAIClinicalAnalysis({
          caseData,
          sessions,
          clinicalReports,
          localAnalysis,
        });

        if (openAIResult.usedOpenAI && openAIResult.data) {
          return {
            ...localAnalysis,
            ...openAIResult.data,
            analysis: openAIResult.data.aiSummary || localAnalysis.aiSummary,
            usedOpenAI: true,
            openAIStatus: "success",
            rawLocalAnalysis: localAnalysis,
          };
        }

        return {
          ...localAnalysis,
          analysis: localAnalysis.aiSummary,
          usedOpenAI: false,
          openAIStatus: "fallback",
          openAIError: openAIResult.error,
          rawLocalAnalysis: localAnalysis,
        };
      }),

    analyzeClinicalReports: publicProcedure
      .input(
        z.object({
          caseId: z.number(),
          clinicalReports: z.array(z.any()).optional(),
          sessions: z.array(z.any()).optional(),
          caseData: z.any().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const localAnalysis = getCaseSmartAnalysis(input.caseId);
        const reports = input.clinicalReports || [];
        const sessions =
          input.sessions ||
          mockSessions.filter((item) => item.caseId === input.caseId);
        const caseData =
          input.caseData ||
          localAnalysis.caseData ||
          mockCases.find((item) => item.id === input.caseId) ||
          {};

        const openAIResult = await callOpenAIClinicalAnalysis({
          caseData,
          sessions,
          clinicalReports: reports,
          localAnalysis,
        });

        if (openAIResult.usedOpenAI && openAIResult.data) {
          return {
            ...openAIResult.data,
            usedOpenAI: true,
            openAIStatus: "success",
            rawLocalAnalysis: localAnalysis,
          };
        }

        const combinedText = reports
          .map((report) =>
            [
              report.title,
              report.reportType,
              report.reportText,
              report.recommendations,
              report.administrativeNotes,
            ]
              .filter(Boolean)
              .join(" ")
          )
          .join(" ");

        const hasReports = reports.length > 0;

        return {
          aiSummary: hasReports
            ? `تم تحليل ${reports.length} تقرير مختص محليًا. ${localAnalysis.aiSummary}`
            : localAnalysis.aiSummary,
          strengths: combinedText.includes("تحسن")
            ? ["وجود مؤشرات تحسن حسب تقارير المختصين"]
            : ["تحتاج الحالة إلى توثيق نقاط القوة بشكل أوضح"],
          weaknesses:
            combinedText.includes("ضعف") || combinedText.includes("صعوبة")
              ? ["توجد نقاط ضعف مذكورة في تقارير المختصين"]
              : ["لا توجد نقاط ضعف واضحة مكتوبة بعد"],
          progressIndicators: [
            `نسبة الحضور ${localAnalysis.attendanceRate}%`,
            `عدد الجلسات ${localAnalysis.totalSessions}`,
          ],
          riskLevel: localAnalysis.riskLevel,
          predictedOutcome: localAnalysis.predictedOutcome,
          recommendedCarePlan: localAnalysis.clinicalRecommendation,
          homePlanRecommendations: [
            "تنفيذ نشاط منزلي يومي لمدة 15 دقيقة مرتبط بهدف الجلسة",
          ],
          administrativeRecommendations: localAnalysis.recommendations,
          nextAction:
            localAnalysis.riskLevel === "خطر"
              ? "جدولة مراجعة عاجلة للخطة العلاجية"
              : "متابعة الخطة وتحديث التقرير بعد الجلسات القادمة",
          suggestedSpecialist: localAnalysis.suggestedSpecialist,
          suggestedDiagnosis: localAnalysis.suggestedDiagnosis,
          reportQualityScore: hasReports ? 85 : 40,
          usedOpenAI: false,
          openAIStatus: "fallback",
          openAIError: openAIResult.error,
          rawLocalAnalysis: localAnalysis,
        };
      }),
  }),


  diseases: router({
    list: publicProcedure.query(() => {
      return mockDiseases.map((disease) => {
        const organization = mockOrganizations.find(
          (item) => Number(item.id) === Number(disease.organizationId)
        );

        const doctor = mockDoctors.find(
          (item) => Number(item.id) === Number(disease.doctorId)
        );

        return {
          ...disease,
          organization: organization?.name || disease.organization || "كل الجمعيات",
          defaultSpecialist: doctor?.specialty || disease.defaultSpecialist || "",
          doctorName: doctor?.name || "",
          casesCount: getDiseaseUsage(disease.name),
        };
      });
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        return mockDiseases.find((item) => Number(item.id) === Number(input.id)) ?? null;
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const name = safeText(input.name);

      if (!name) {
        throw new Error("اسم المرض أو نوع الإعاقة مطلوب");
      }

      const exists = mockDiseases.some(
        (item) => safeText(item.name).toLowerCase() === name.toLowerCase()
      );

      if (exists) {
        throw new Error("هذا المرض أو نوع الإعاقة موجود مسبقاً");
      }

      const organization = mockOrganizations.find(
        (item) =>
          Number(item.id) === Number(input.organizationId) ||
          item.name === input.organization
      );

      const doctor = mockDoctors.find(
        (item) => Number(item.id) === Number(input.doctorId)
      );

      const newDisease = {
        id: nextId(mockDiseases),
        name,
        category: input.category || "أخرى",
        defaultSpecialist: doctor?.specialty || input.defaultSpecialist || "",
        organization: organization?.name || input.organization || "كل الجمعيات",
        organizationId: organization?.id ?? input.organizationId ?? null,
        doctorId: doctor?.id ?? input.doctorId ?? null,
        priority: input.priority || "متوسط",
        status: input.status || "نشط",
        notes: input.notes || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDiseases.unshift(newDisease);

      return { success: true, data: newDisease, ...newDisease };
    }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.any() }))
      .mutation(({ input }) => {
        const oldDisease = mockDiseases.find((item) => Number(item.id) === Number(input.id));

        const organization = mockOrganizations.find(
          (item) =>
            Number(item.id) === Number(input.data?.organizationId) ||
            item.name === input.data?.organization
        );

        const doctor = mockDoctors.find(
          (item) => Number(item.id) === Number(input.data?.doctorId)
        );

        mockDiseases = mockDiseases.map((disease) =>
          Number(disease.id) === Number(input.id)
            ? {
                ...disease,
                ...input.data,
                id: disease.id,
                organization:
                  organization?.name ||
                  input.data?.organization ||
                  disease.organization ||
                  "كل الجمعيات",
                organizationId:
                  organization?.id ??
                  input.data?.organizationId ??
                  disease.organizationId ??
                  null,
                doctorId: doctor?.id ?? input.data?.doctorId ?? disease.doctorId ?? null,
                defaultSpecialist:
                  doctor?.specialty ||
                  input.data?.defaultSpecialist ||
                  disease.defaultSpecialist ||
                  "",
                updatedAt: new Date(),
              }
            : disease
        );

        const updatedDisease = mockDiseases.find((item) => Number(item.id) === Number(input.id));

        if (oldDisease && updatedDisease && oldDisease.name !== updatedDisease.name) {
          mockCases = mockCases.map((caseItem) => {
            const currentDisease = safeText(
              caseItem.disabilityType || caseItem.disorderType || caseItem.diagnosis
            );

            if (currentDisease !== safeText(oldDisease.name)) return caseItem;

            return {
              ...caseItem,
              disabilityType: updatedDisease.name,
              disorderType: updatedDisease.name,
              updatedAt: new Date(),
            };
          });
        }

        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const disease = mockDiseases.find((item) => Number(item.id) === Number(input.id));

        if (!disease) {
          return { success: true };
        }

        const usageCount = getDiseaseUsage(disease.name);

        if (usageCount > 0) {
          mockDiseases = mockDiseases.map((item) =>
            Number(item.id) === Number(input.id)
              ? { ...item, status: "موقوف", updatedAt: new Date() }
              : item
          );

          return {
            success: true,
            disabledInsteadOfDeleted: true,
            message: "المرض مستخدم في حالات، لذلك تم إيقافه بدلاً من حذفه.",
          };
        }

        mockDiseases = mockDiseases.filter((item) => Number(item.id) !== Number(input.id));

        return { success: true };
      }),
  }),

  system: router({
    health: publicProcedure
      .input(z.object({ timestamp: z.number().optional() }).optional())
      .query(() => ({ ok: true })),
  }),
});

export type AppRouter = typeof appRouter;