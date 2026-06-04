import {
  type InsertAlert,
  type InsertCase,
  type InsertFamilyCompliance,
  type InsertFinancing,
  type InsertImpactMeasurement,
  type InsertOrganization,
  type InsertReport,
  type InsertSession,
  type InsertUser,
} from "../drizzle/schema";

type MockUser = {
  id: number;
  name: string | null;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

type CaseStatus = "جديدة" | "نشطة" | "مكتملة" | "متعثرة";

type MockOrganization = {
  id: number;
  name: string;
  city: string;
  type:
    | "ذوي الإعاقة"
    | "الأيتام"
    | "الطفولة"
    | "التنمية الأسرية"
    | "التوحد"
    | "أخرى";
  managerName: string | null;
  phone: string | null;
  email: string | null;
  status: "نشطة" | "موقوفة" | "تحت المراجعة";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockCase = {
  id: number;
  caseNumber: string;
  childName: string;
  age: number;
  city: string;
  organizationId?: number | null;
  organization: string;
  disorderType: string;
  specialist: string;
  referralType: "تكاملية" | "مساندة" | "لاحقة";
  status: CaseStatus;
  referralDate: Date;
  highRisk: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockSession = {
  id: number;
  caseId: number;
  sessionDate: Date;
  sessionType: string;
  attendance: "حاضر" | "غائب";
  notes: string | null;
  progress: "تحسن" | "ثابت" | "تراجع";
  createdAt: Date;
  updatedAt: Date;
};

type MockImpactMeasurement = {
  id: number;
  caseId: number;
  testName: string;
  valueType: "رقم" | "نسبة مئوية";
  betterDirection: "أعلى أفضل" | "أقل أفضل";
  baseline: string;
  afterValue: string;
  improvementPercentage: string;
  interpretation: string | null;
  measurementDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

type MockFamilyCompliance = {
  id: number;
  caseId: number;
  attendancePercentage: string;
  homeplanImplementation: boolean;
  commitmentLevel: "مرتفع" | "متوسط" | "منخفض";
  barrierType: string | null;
  specialistNotes: string | null;
  complianceDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

type MockFinancing = {
  id: number;
  caseId: number;
  fundingSource: string | null;
  approvedSessionCount: number | null;
  usedSessionCount: number;
  sessionCount: number;
  sessionCost: string;
  totalCost: string;
  financingStatus: "معلق" | "موافق عليه" | "مدفوع" | "مكتمل";
  financeNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockAlert = {
  id: number;
  caseId: number;
  alertType: "غياب" | "حالة حرجة" | "متعثرة" | "أخرى";
  message: string;
  isRead: boolean;
  createdAt: Date;
};

type MockReport = {
  id: number;
  caseId: number | null;
  reportType: "حالات" | "جلسات" | "أثر" | "شامل";
  content: string;
  generatedAt: Date;
  createdAt: Date;
};

let mockUsers: MockUser[] = [
  {
    id: 1,
    name: "Saja",
    email: "admin@test.com",
    passwordHash: "123456",
    role: "admin",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
];

let mockOrganizations: MockOrganization[] = [
  {
    id: 1,
    name: "جمعية إنسان",
    city: "الرياض",
    type: "الأيتام",
    managerName: "مسؤول الجمعية",
    phone: "",
    email: "",
    status: "نشطة",
    notes: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let mockCases: MockCase[] = [
  {
    id: 1,
    caseNumber: "C001",
    childName: "طفل تجريبي",
    age: 5,
    city: "الرياض",
    organizationId: 1,
    organization: "جمعية إنسان",
    disorderType: "توحد",
    specialist: "د. سارة",
    referralType: "تكاملية",
    status: "جديدة",
    referralDate: new Date(),
    highRisk: false,
    notes: "حالة تجريبية",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let mockSessions: MockSession[] = [];
let mockImpactMeasurements: MockImpactMeasurement[] = [];
let mockFamilyCompliances: MockFamilyCompliance[] = [];
let mockFinancings: MockFinancing[] = [];
let mockAlerts: MockAlert[] = [];
let mockReports: MockReport[] = [];

function nextId(items: { id: number }[]) {
  return items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
}

export async function getDb() {
  return null;
}

function calculateSmartStatus(
  caseId: number,
  currentStatus?: CaseStatus
): CaseStatus {
  if (currentStatus === "مكتملة") return "مكتملة";

  const caseSessions = mockSessions.filter((s) => s.caseId === caseId);

  if (caseSessions.length === 0) return "جديدة";

  const absenceCount = caseSessions.filter(
    (s) => s.attendance === "غائب"
  ).length;

  if (absenceCount >= 3) return "متعثرة";

  return "نشطة";
}

function refreshCaseStatus(caseId: number) {
  mockCases = mockCases.map((item) =>
    item.id === caseId
      ? {
          ...item,
          status: calculateSmartStatus(caseId, item.status),
          updatedAt: new Date(),
        }
      : item
  );
}

export async function createUser(user: InsertUser) {
  const newUser: MockUser = {
    id: nextId(mockUsers),
    name: user.name ?? null,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role ?? "user",
    isActive: user.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };

  mockUsers.push(newUser);
  return newUser;
}

export async function updateUser(userId: number, data: Partial<InsertUser>) {
  mockUsers = mockUsers.map((user) =>
    user.id === userId ? { ...user, ...data, updatedAt: new Date() } : user
  );

  return { success: true };
}

export async function getUserById(userId: number) {
  return mockUsers.find((user) => user.id === userId);
}

export async function getUserByEmail(email: string) {
  return mockUsers.find((user) => user.email === email);
}

export async function getAllUsers() {
  return mockUsers;
}

export async function updateLastSignedIn(userId: number) {
  mockUsers = mockUsers.map((user) =>
    user.id === userId
      ? { ...user, lastSignedIn: new Date(), updatedAt: new Date() }
      : user
  );

  return { success: true };
}

export async function getOrganizations() {
  return [...mockOrganizations];
}

export async function getOrganizationById(id: number) {
  return mockOrganizations.find((item) => item.id === id);
}

export async function createOrganization(data: InsertOrganization) {
  const item: MockOrganization = {
    id: nextId(mockOrganizations),
    name: data.name,
    city: data.city,
    type: data.type ?? "أخرى",
    managerName: data.managerName ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    status: data.status ?? "نشطة",
    notes: data.notes ?? "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockOrganizations.push(item);
  return item;
}

export async function getCases() {
  return mockCases;
}

export async function getCaseById(caseId: number) {
  return mockCases.find((item) => item.id === caseId);
}

export async function createCase(data: InsertCase) {
  const item: MockCase = {
    id: nextId(mockCases),
    caseNumber: data.caseNumber,
    childName: data.childName,
    age: data.age,
    city: data.city,
    organizationId: data.organizationId ?? null,
    organization: data.organization ?? "غير محدد",
    disorderType: data.disorderType,
    specialist: data.specialist,
    referralType: data.referralType,
    status: data.status ?? "جديدة",
    referralDate: data.referralDate,
    highRisk: data.highRisk ?? false,
    notes: data.notes ?? "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockCases.push(item);
  return item;
}

/* ✅ هذا الجزء الذي تم إصلاحه */
export async function updateCase(caseId: number, data: Partial<InsertCase>) {
  mockCases = mockCases.map((item): MockCase => {
    if (item.id !== caseId) return item;

    const safeOrganization =
      typeof data.organization === "string" &&
      data.organization.trim() !== ""
        ? data.organization
        : item.organization ?? "غير محدد";

    return {
      ...item,
      ...data,
      organization: safeOrganization,
      updatedAt: new Date(),
    };
  });

  refreshCaseStatus(caseId);

  return { success: true };
}

export async function deleteCase(caseId: number) {
  mockCases = mockCases.filter((item) => item.id !== caseId);
  return { success: true };
}

export async function getSessionsByCase(caseId: number) {
  return mockSessions.filter((item) => item.caseId === caseId);
}

export async function createSession(data: InsertSession) {
  const item: MockSession = {
    id: nextId(mockSessions),
    caseId: data.caseId,
    sessionDate: data.sessionDate,
    sessionType: data.sessionType,
    attendance: data.attendance,
    notes: data.notes ?? "",
    progress: data.progress ?? "ثابت",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockSessions.push(item);
  refreshCaseStatus(data.caseId);
  return item;
}

export async function getAlerts() {
  return mockAlerts;
}

export async function createAlert(data: InsertAlert) {
  const item: MockAlert = {
    id: nextId(mockAlerts),
    caseId: data.caseId,
    alertType: data.alertType,
    message: data.message,
    isRead: data.isRead ?? false,
    createdAt: new Date(),
  };

  mockAlerts.push(item);
  return item;
}

export async function createReport(data: InsertReport) {
  const item: MockReport = {
    id: nextId(mockReports),
    caseId: data.caseId ?? null,
    reportType: data.reportType,
    content: data.content,
    generatedAt: data.generatedAt ?? new Date(),
    createdAt: new Date(),
  };

  mockReports.push(item);
  return item;
}