import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Eye,
  Building2,
  Users,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Clock3,
  Brain,
  Activity,
  Filter,
  ShieldCheck,
  UserCheck,
  Settings2,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const caseFormSchema = z.object({
  childName: z.string().min(1, "الاسم مطلوب"),
  familyPhone: z.string().optional(),
  beneficiaryPhone: z.string().optional(),
  gender: z.enum(["ذكر", "أنثى", "غير محدد"]),
  birthDate: z.date().optional(),
  age: z.number().min(0, "العمر غير صحيح").max(100, "العمر غير صحيح").optional(),
  disabilityType: z.string().optional(),
  financialStatus: z.string().optional(),
  organization: z.string().optional(),
  organizationId: z.number().nullable().optional(),
  specialistName: z.string().optional(),
  doctorId: z.number().nullable().optional(),
  notes: z.string().optional(),
});

type CaseFormValues = z.infer<typeof caseFormSchema>;

type CaseItem = {
  id: number;
  caseNumber: string;
  childName: string;
  familyPhone?: string;
  beneficiaryPhone?: string;
  phone?: string;
  gender?: "ذكر" | "أنثى" | "غير محدد";
  birthDate?: string | Date;
  age?: number;
  disabilityType?: string;
  financialStatus?: string;
  organization: string;
  organizationId?: number | null;
  notes?: string | null;
  status: "جديدة" | "نشطة" | "مكتملة" | "متعثرة";
  referralDate: string | Date;

  city?: string;
  disorderType?: string;
  doctorId?: number | null;
  specialist?: string;
  specialistName?: string;
  specialistSpecialty?: string;
  specialty?: string;
  referralType?: "تكاملية" | "مساندة" | "لاحقة";

  reportsCount?: number;
  lastReportDate?: string | Date;
  progressScore?: number;
  smartRecommendation?: string;
  riskLevel?: SmartLevel;
  approvedSessionCount?: number;
  remainingSessions?: number;
  financingStatus?: string;
  totalFinancing?: number;

  sessionsCount?: number;
  sessionCount?: number;
  totalSessions?: number;
  usedSessionCount?: number;
  completedSessions?: number;
  lastSessionDate?: string | Date;
};

const lightInputClass = "placeholder:text-muted-foreground/40";

const CASE_SMART_SYNC_STORAGE_KEY = "anma-case-smart-sync";
const DISEASE_OPTIONS_STORAGE_KEY = "anma-disease-options";
const CLINICAL_REPORTS_STORAGE_KEY = "anma-clinical-reports";

type SmartLevel = "غير محدد" | "ممتاز" | "متابعة" | "خطر";

type StoredCaseSmartSync = {
  sessionsCount?: number;
  totalSessions?: number;
  lastSessionDate?: string;
  smartLevel?: SmartLevel;
  reason?: string;
  recommendation?: string;
  suggestedSpecialist?: string;
  attendanceRate?: number;
  improvement?: number;
  updatedAt?: string;
};

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

type DoctorOption = {
  id: number;
  name: string;
  specialty?: string;
  status?: string;
  organizationId?: number | null;
  organization?: string;
};

type OrganizationOption = {
  id: number;
  name: string;
  city?: string;
  status?: string;
};

function readClinicalReportsMap(): Record<string, ClinicalReport[]> {
  try {
    const raw = localStorage.getItem(CLINICAL_REPORTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getClinicalReportsByCase(caseId?: number): ClinicalReport[] {
  if (!caseId) return [];
  const map = readClinicalReportsMap();
  const reports = map[String(caseId)];
  return Array.isArray(reports) ? reports : [];
}

function getLatestReportRecommendation(caseId?: number) {
  const reports = getClinicalReportsByCase(caseId);
  return reports[0]?.recommendations || reports[0]?.reportText || "";
}

function getLatestReportDate(caseId?: number) {
  const reports = getClinicalReportsByCase(caseId);
  return reports[0]?.reportDate;
}

function getCaseFundingSummary(caseItem: CaseItem) {
  const approved = Number(caseItem.approvedSessionCount || 0);
  const used = Number(caseItem.usedSessionCount || caseItem.sessionsCount || caseItem.totalSessions || 0);
  const remaining = Math.max(approved - used, 0);

  if (caseItem.financingStatus) return caseItem.financingStatus;
  if (approved > 0) return `${used}/${approved} جلسة - متبقي ${remaining}`;
  if (caseItem.totalFinancing) return `${caseItem.totalFinancing} ريال`;
  return "";
}

function normalizeName(value: any) {
  return safeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

function getDuplicateReason(newCase: Partial<CaseFormValues>, existingCases: CaseItem[], excludeCaseId?: number) {
  const newName = normalizeName(newCase.childName);
  const newFamilyPhone = safePhone(newCase.familyPhone);
  const newBeneficiaryPhone = safePhone(newCase.beneficiaryPhone);
  const newBirthDate = newCase.birthDate ? toDateInputValue(newCase.birthDate) : "";
  const newOrganization = safeText(newCase.organization);

  if (!newName) return "";

  for (const item of existingCases) {
    if (excludeCaseId && item.id === excludeCaseId) continue;

    const itemName = normalizeName(item.childName);
    const itemFamilyPhone = safePhone(item.familyPhone || item.phone);
    const itemBeneficiaryPhone = safePhone(item.beneficiaryPhone);
    const itemBirthDate = item.birthDate ? toDateInputValue(item.birthDate) : "";
    const itemOrganization = safeText(item.organization);

    const sameName = itemName === newName;
    const sameFamilyPhone = Boolean(newFamilyPhone && itemFamilyPhone && newFamilyPhone === itemFamilyPhone);
    const sameBeneficiaryPhone = Boolean(newBeneficiaryPhone && itemBeneficiaryPhone && newBeneficiaryPhone === itemBeneficiaryPhone);
    const sameBirthDate = Boolean(newBirthDate && itemBirthDate && newBirthDate === itemBirthDate);
    const sameOrganization = Boolean(newOrganization && itemOrganization && newOrganization === itemOrganization);

    if (sameName && (sameFamilyPhone || sameBeneficiaryPhone)) {
      return "يوجد مستفيد بنفس الاسم ورقم الجوال. لا يمكن إضافة الحالة مرتين.";
    }

    if (sameName && sameBirthDate) {
      return "يوجد مستفيد بنفس الاسم وتاريخ الميلاد. لا يمكن إضافة الحالة مرتين.";
    }

    if (sameName && sameOrganization) {
      return "قد تكون هذه الحالة مكررة داخل نفس الجمعية.";
    }
  }

  return "";
}

const defaultDiseaseOptions = [
  "توحد",
  "تأخر نطق",
  "فرط حركة وتشتت انتباه",
  "صعوبات تعلم",
  "إعاقة سمعية",
  "إعاقة بصرية",
  "إعاقة حركية",
  "تأخر نمائي",
  "اضطراب سلوكي",
  "اضطراب تواصل",
  "متلازمة داون",
  "شلل دماغي",
  "تأخر لغوي",
  "اضطراب نمائي",
  "أخرى",
];

const financialStatusOptions = ["محتاج", "متوسط", "ميسور"];

const organizationOptions = [
  "جمعية إنماء",
  "جمعية الأشخاص ذوي الإعاقة بالأحساء",
  "جمعية رعاية الطفولة",
  "جمعية ذوي الإعاقة الخيرية جذا",
  "جمعية طفولة آمنة",
  "جمعية إسناد",
  "جمعية ذوي اضطراب طيف التوحد لدن",
  "جمعية خطى التوحد",
  "جمعية التدخل المبكر",
  "جمعية الأطفال المعوقين",
  "جمعية عزم",
  "جمعية همم لأسر ذوي الإعاقة",
];

function readDiseaseOptions() {
  try {
    const raw = localStorage.getItem(DISEASE_OPTIONS_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(stored) ? stored : [];
    return Array.from(new Set([...defaultDiseaseOptions, ...list].filter(Boolean)));
  } catch {
    return defaultDiseaseOptions;
  }
}

function saveDiseaseOptions(options: string[]) {
  const cleaned = Array.from(new Set(options.map((item) => safeText(item)).filter(Boolean)));
  localStorage.setItem(DISEASE_OPTIONS_STORAGE_KEY, JSON.stringify(cleaned));
  window.dispatchEvent(new CustomEvent("anma-disease-options-updated", { detail: cleaned }));
  window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
}

function readCaseSmartSyncMap(): Record<string, StoredCaseSmartSync> {
  try {
    const raw = localStorage.getItem(CASE_SMART_SYNC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getStoredCaseSmartSync(caseId?: number): StoredCaseSmartSync | undefined {
  if (!caseId) return undefined;
  return readCaseSmartSyncMap()[String(caseId)];
}

function getStoredSessionCount(caseId?: number) {
  const stored = getStoredCaseSmartSync(caseId);
  const count = Number(stored?.sessionsCount ?? stored?.totalSessions ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function safeText(value: any) {
  return String(value ?? "").trim();
}

function safePhone(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\.0$/, "").trim();
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "جديدة":
      return "bg-blue-100 text-blue-800";
    case "نشطة":
    case "قيد المتابعة":
      return "bg-green-100 text-green-800";
    case "مكتملة":
      return "bg-gray-100 text-gray-800";
    case "متعثرة":
      return "bg-red-100 text-red-800";
    default:
      return "bg-muted text-foreground";
  }
}

function getSmartLevelBadgeClass(level: SmartLevel) {
  switch (level) {
    case "خطر":
      return "border-red-200 bg-red-50 text-red-700";
    case "متابعة":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ممتاز":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "غير محدد":
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getCaseSessionsCount(caseItem: CaseItem) {
  const possibleValues = [
    caseItem.sessionsCount,
    caseItem.sessionCount,
    caseItem.totalSessions,
    caseItem.usedSessionCount,
    caseItem.completedSessions,
  ];

  const found = possibleValues.find(
    (value) => typeof value === "number" && Number.isFinite(value)
  );

  const backendCount = Number(found || 0);
  const storedCount = getStoredSessionCount(caseItem.id);

  return Math.max(backendCount, storedCount);
}

function getOperationalStatus(caseItem: CaseItem) {
  const sessionsCount = getCaseSessionsCount(caseItem);

  if ((caseItem.status === "جديدة" || !caseItem.status) && sessionsCount > 0) {
    return "قيد المتابعة";
  }

  return caseItem.status || "جديدة";
}

function getCaseCompleteness(caseItem: CaseItem) {
  const requiredFields = [
    caseItem.childName,
    caseItem.familyPhone || caseItem.phone,
    caseItem.gender,
    caseItem.age,
    caseItem.disabilityType || caseItem.disorderType,
    caseItem.organization,
    caseItem.specialistName || caseItem.specialist,
  ];

  const completed = requiredFields.filter(
    (field) => safeText(field) && safeText(field) !== "غير محدد"
  ).length;

  return Math.round((completed / requiredFields.length) * 100);
}

function getSmartCaseAssessment(caseItem: CaseItem) {
  const completeness = getCaseCompleteness(caseItem);
  const text = `${caseItem.disabilityType || ""} ${caseItem.disorderType || ""} ${caseItem.notes || ""}`.toLowerCase();
  const hasSpecialist =
    Boolean(safeText(caseItem.specialistName || caseItem.specialist)) &&
    safeText(caseItem.specialistName || caseItem.specialist) !== "غير محدد";
  const hasPhone = Boolean(safePhone(caseItem.familyPhone || caseItem.phone || caseItem.beneficiaryPhone));
  const hasDisability =
    Boolean(safeText(caseItem.disabilityType || caseItem.disorderType)) &&
    safeText(caseItem.disabilityType || caseItem.disorderType) !== "غير محدد";
  const sessionsCount = getCaseSessionsCount(caseItem);
  const operationalStatus = getOperationalStatus(caseItem);
  const storedSmart = getStoredCaseSmartSync(caseItem.id);
  const hasStoredAnalysis = Boolean(storedSmart?.smartLevel && storedSmart.smartLevel !== "غير محدد");
  const hasOperationalData = sessionsCount > 0 || hasStoredAnalysis || (operationalStatus && operationalStatus !== "جديدة");

  let level: SmartLevel = "غير محدد";
  let reason = "الحالة لم تبدأ بعد أو لا توجد بيانات جلسات/تقييم كافية، لذلك لا يتم تصنيفها كخطر.";
  let recommendation = "استكمال بيانات الحالة ثم إضافة أول جلسة أو تقييم داخل تفاصيل الحالة.";
  let suggestedSpecialist = caseItem.specialistSpecialty || caseItem.specialty || "يحدد بعد التقييم";

  if (!hasOperationalData) {
    level = "غير محدد";
  } else if (operationalStatus === "متعثرة") {
    level = "خطر";
    reason = "الحالة مسجلة كمتعثرة في النظام، وتحتاج مراجعة إدارية أو علاجية.";
    recommendation = "فتح تفاصيل الحالة ومراجعة الجلسات والغياب والتمويل وخطة التدخل.";
  } else if (!hasPhone || !hasDisability || !hasSpecialist || completeness < 70) {
    level = "متابعة";
    reason = "توجد بيانات ناقصة قد تؤثر على المتابعة أو التواصل أو ربط الحالة بالمختص.";
    recommendation = "استكمال رقم التواصل، نوع الإعاقة، الجمعية، والأخصائي المسؤول.";
  } else if (operationalStatus === "مكتملة") {
    level = "ممتاز";
    reason = "الحالة مكتملة حسب الحالة التشغيلية الحالية.";
    recommendation = "تجهيز تقرير ختامي وحفظ التقييم النهائي.";
  } else if (operationalStatus === "نشطة" || operationalStatus === "قيد المتابعة") {
    level = "متابعة";
    reason = sessionsCount > 0
      ? "تم تسجيل جلسة أو أكثر للحالة، لذلك تحولت من جديدة إلى قيد المتابعة."
      : "الحالة نشطة وتحتاج متابعة دورية حتى تظهر نتائج الجلسات والتقييم.";
    recommendation = "متابعة الحضور، إضافة تقييمات الجلسات، وقياس التحسن بشكل دوري.";
  }

  if (text.includes("نطق") || text.includes("تخاطب") || text.includes("كلام")) {
    suggestedSpecialist = "أخصائي نطق وتخاطب";
  } else if (text.includes("توحد") || text.includes("تواصل") || text.includes("تفاعل")) {
    suggestedSpecialist = "طبيب نمو وسلوك + أخصائي تعديل سلوك";
  } else if (text.includes("adhd") || text.includes("فرط") || text.includes("انتباه") || text.includes("تركيز")) {
    suggestedSpecialist = "طبيب نمو وسلوك / أخصائي نفسي";
  } else if (text.includes("تعلم") || text.includes("قراءة") || text.includes("كتابة")) {
    suggestedSpecialist = "أخصائي صعوبات تعلم";
  }

  if (storedSmart?.smartLevel) {
    level = storedSmart.smartLevel;
    reason = storedSmart.reason || reason;
    recommendation = storedSmart.recommendation || recommendation;
    suggestedSpecialist = storedSmart.suggestedSpecialist || suggestedSpecialist;
  }

  return {
    level,
    reason,
    recommendation,
    suggestedSpecialist,
    completeness,
    hasPhone,
    hasSpecialist,
    hasDisability,
  };
}

function getUniqueCaseKey(item: CaseItem) {
  const phone = safePhone(item.familyPhone || item.phone || item.beneficiaryPhone);
  if (phone) return `phone-${phone}`;
  return `name-${safeText(item.childName).toLowerCase()}-${safeText(item.organization).toLowerCase()}`;
}

function uniqueCasesByBeneficiary(cases: CaseItem[]) {
  const map = new Map<string, CaseItem>();
  cases.forEach((item) => {
    const key = getUniqueCaseKey(item);
    if (!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
}

function excelDateToJSDate(value: any) {
  if (!value) return undefined;

  if (value instanceof Date) return value;

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeGender(value: any): "ذكر" | "أنثى" | "غير محدد" {
  const text = safeText(value);
  if (["ذكر", "male", "Male", "M", "m"].includes(text)) return "ذكر";
  if (["أنثى", "انثى", "female", "Female", "F", "f"].includes(text)) return "أنثى";
  return "غير محدد";
}

function calculateAgeFromBirthDate(date?: Date) {
  if (!date) return 0;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }

  return Math.max(age, 0);
}

function toDateInputValue(value?: Date | string) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function getRowValue(row: any, keys: string[]) {
  for (const key of keys) {
    const value = safeText(row[key]);
    if (value) return value;
  }
  return "";
}

function isSameNormalized(a: any, b: any) {
  return Boolean(normalizeName(a) && normalizeName(a) === normalizeName(b));
}


type CaseFieldsProps = {
  form: UseFormReturn<CaseFormValues>;
  diseaseOptions: string[];
  specialistOptions: DoctorOption[];
  organizationOptionsList: OrganizationOption[];
};

function CaseFields({ form, diseaseOptions, specialistOptions, organizationOptionsList }: CaseFieldsProps) {
  const selectedOrganizationId = form.watch("organizationId");
  const filteredSpecialists = selectedOrganizationId
    ? specialistOptions.filter(
        (doctor) =>
          !doctor.organizationId ||
          Number(doctor.organizationId) === Number(selectedOrganizationId)
      )
    : specialistOptions;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="childName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الاسم</FormLabel>
              <FormControl>
                <Input placeholder="اسم المستفيد" className={lightInputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organizationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>اسم الجمعية</FormLabel>
              <Select
                value={field.value ? String(field.value) : "__none"}
                onValueChange={(value) => {
                  if (value === "__none") {
                    field.onChange(null);
                    form.setValue("doctorId", null);
                    form.setValue("specialistName", "");
                    return;
                  }

                  const selectedOrganization = organizationOptionsList.find(
                    (organization) => String(organization.id) === value
                  );

                  field.onChange(Number(value));
                  form.setValue("organization", selectedOrganization?.name || "");
                  form.setValue("doctorId", null);
                  form.setValue("specialistName", "");
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختاري الجمعية" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none">غير محدد</SelectItem>
                  {organizationOptionsList.map((organization) => (
                    <SelectItem key={organization.id} value={String(organization.id)}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="familyPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>رقم جوال الأسرة</FormLabel>
              <FormControl>
                <Input placeholder="05XXXXXXXX" className={lightInputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="beneficiaryPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>رقم جوال المستفيد</FormLabel>
              <FormControl>
                <Input placeholder="05XXXXXXXX" className={lightInputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الجنس</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "غير محدد"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الجنس" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ذكر">ذكر</SelectItem>
                  <SelectItem value="أنثى">أنثى</SelectItem>
                  <SelectItem value="غير محدد">غير محدد</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>تاريخ الميلاد</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  value={toDateInputValue(field.value)}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    field.onChange(date);
                    form.setValue("age", calculateAgeFromBirthDate(date));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel>العمر <span className="text-xs text-muted-foreground">(اختياري)</span></FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: 6"
                  className={lightInputClass}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, "");
                    field.onChange(value ? Number(value) : 0);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="disabilityType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>نوع الإعاقة / المرض</FormLabel>
              <Select
                value={field.value || "__none"}
                onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختاري نوع الإعاقة أو المرض" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none">غير محدد</SelectItem>
                  {diseaseOptions.map((disease) => (
                    <SelectItem key={disease} value={disease}>
                      {disease}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="financialStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الحالة المادية <span className="text-xs text-muted-foreground">(اختياري)</span></FormLabel>
              <Select
                value={field.value || "__none"}
                onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختياري" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none">غير محدد</SelectItem>
                  {financialStatusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="doctorId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>المختص المسؤول <span className="text-xs text-muted-foreground">(اختياري)</span></FormLabel>
              <Select
                value={field.value ? String(field.value) : "__none"}
                onValueChange={(value) => {
                  if (value === "__none") {
                    field.onChange(null);
                    form.setValue("specialistName", "");
                    return;
                  }

                  const selected = specialistOptions.find(
                    (doctor) => String(doctor.id) === value
                  );

                  field.onChange(Number(value));
                  form.setValue("specialistName", selected?.name || "");
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختاري المختص أو اتركيه بدون مختص" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none">بدون مختص</SelectItem>
                  {filteredSpecialists.map((doctor) => (
                    <SelectItem key={doctor.id} value={String(doctor.id)}>
                      {doctor.name}{doctor.specialty ? ` - ${doctor.specialty}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>ملاحظات</FormLabel>
            <FormControl>
              <textarea
                placeholder="أي ملاحظات إضافية..."
                className="w-full rounded-md border border-input px-3 py-2 placeholder:text-muted-foreground/40"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export default function CasesManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [disabilityFilter, setDisabilityFilter] = useState("all");
  const [smartLevelFilter, setSmartLevelFilter] = useState("all");
  const [specialistFilter, setSpecialistFilter] = useState("all");
  const [diseaseOptions, setDiseaseOptions] = useState<string[]>(() => readDiseaseOptions());
  const [newDisease, setNewDisease] = useState("");
  const [smartSyncTick, setSmartSyncTick] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [, navigate] = useLocation();

  const casesQuery = trpc.cases.list.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const doctorsQuery = trpc.doctors.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const organizationsQuery = trpc.organizations.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  useEffect(() => {
    const refreshSmartSync = () => setSmartSyncTick((value) => value + 1);
    const refreshDiseaseOptions = () => setDiseaseOptions(readDiseaseOptions());

    window.addEventListener("anma-case-smart-sync-updated", refreshSmartSync as EventListener);
    window.addEventListener("anma-disease-options-updated", refreshDiseaseOptions as EventListener);
    window.addEventListener("anma-clinical-reports-updated", refreshSmartSync as EventListener);
    window.addEventListener("storage", refreshSmartSync);
    window.addEventListener("storage", refreshDiseaseOptions);

    const interval = window.setInterval(refreshSmartSync, 3000);

    return () => {
      window.removeEventListener("anma-case-smart-sync-updated", refreshSmartSync as EventListener);
      window.removeEventListener("anma-disease-options-updated", refreshDiseaseOptions as EventListener);
      window.removeEventListener("anma-clinical-reports-updated", refreshSmartSync as EventListener);
      window.removeEventListener("storage", refreshSmartSync);
      window.removeEventListener("storage", refreshDiseaseOptions);
      window.clearInterval(interval);
    };
  }, []);

  const defaultValues: CaseFormValues = {
    childName: "",
    familyPhone: "",
    beneficiaryPhone: "",
    gender: "غير محدد",
    birthDate: undefined,
    age: 0,
    disabilityType: "",
    financialStatus: "",
    organization: "",
    organizationId: null,
    specialistName: "",
    doctorId: null,
    notes: "",
  };

  const createForm = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues,
  });

  const editForm = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues,
  });

  const organizationOptionsList = useMemo<OrganizationOption[]>(() => {
    const fromBackend = ((organizationsQuery.data || []) as any[])
      .map((organization) => ({
        id: Number(organization.id),
        name: String(organization.name || ""),
        city: String(organization.city || ""),
        status: organization.status,
      }))
      .filter((organization) => organization.name && organization.status !== "موقوفة");

    if (fromBackend.length) return fromBackend;

    return organizationOptions.map((name, index) => ({
      id: index + 1,
      name,
      city: "",
      status: "نشطة",
    }));
  }, [organizationsQuery.data]);

  const specialistOptions = useMemo<DoctorOption[]>(() => {
    return ((doctorsQuery.data || []) as any[])
      .filter((doctor) => doctor.status !== "موقوف")
      .map((doctor) => ({
        id: Number(doctor.id),
        name: String(doctor.name || ""),
        specialty: String(doctor.specialty || ""),
        status: doctor.status,
        organizationId: doctor.organizationId ? Number(doctor.organizationId) : null,
        organization: String(doctor.organization || ""),
      }))
      .filter((doctor) => doctor.name);
  }, [doctorsQuery.data]);

  const notifyDashboard = () => {
    window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
  };

  const createCaseMutation = trpc.cases.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الحالة بنجاح");
      void casesQuery.refetch();
      notifyDashboard();
      setIsCreateDialogOpen(false);
      createForm.reset(defaultValues);
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ في إضافة الحالة");
    },
  });

  const updateCaseMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الحالة بنجاح");
      void casesQuery.refetch();
      notifyDashboard();
      setIsEditDialogOpen(false);
      setSelectedCase(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ في تعديل الحالة");
    },
  });

  const deleteCaseMutation = trpc.cases.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الحالة وجميع بياناتها المرتبطة");
      void casesQuery.refetch();
      notifyDashboard();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ في حذف الحالة");
    },
  });

  const addDiseaseOption = () => {
    const value = safeText(newDisease);

    if (!value) {
      toast.error("اكتبي اسم المرض أو نوع الإعاقة");
      return;
    }

    if (diseaseOptions.includes(value)) {
      toast.error("هذا المرض موجود مسبقاً");
      return;
    }

    const next = [...diseaseOptions, value];
    setDiseaseOptions(next);
    saveDiseaseOptions(next);
    setNewDisease("");
    toast.success("تمت إضافة المرض للقائمة");
  };

  const buildCasePayload = (values: Partial<CaseFormValues>, index?: number) => {
    const familyPhone = safePhone(values.familyPhone);
    const beneficiaryPhone = safePhone(values.beneficiaryPhone);
    const caseNumber = selectedCase?.caseNumber || `CASE-${Date.now()}-${index ?? 0}`;
    const disability = safeText(values.disabilityType);
    const selectedOrganization = organizationOptionsList.find(
      (organization) => Number(organization.id) === Number(values.organizationId)
    );

    const selectedDoctor = specialistOptions.find(
      (doctor) =>
        Number(doctor.id) === Number(values.doctorId) ||
        doctor.name === safeText(values.specialistName)
    );

    const selectedOrganizationName =
      selectedOrganization?.name || safeText(values.organization) || "";
    const rawChildName = safeText(values.childName);

    const safeChildName =
      rawChildName && !isSameNormalized(rawChildName, selectedOrganizationName)
        ? rawChildName
        : selectedCase?.childName || "غير محدد";

    return {
      caseNumber,
      childName: safeChildName,
      familyPhone,
      beneficiaryPhone,
      phone: familyPhone || beneficiaryPhone,
      gender: values.gender || "غير محدد",
      birthDate: values.birthDate,
      age: Number(values.age || 0),
      disabilityType: disability,
      financialStatus: safeText(values.financialStatus),
      organization: selectedOrganization?.name || safeText(values.organization) || "غير محدد",
      organizationId: selectedOrganization?.id ?? values.organizationId ?? selectedCase?.organizationId ?? null,
      notes: safeText(values.notes),

      city: selectedCase?.city || selectedOrganization?.city || "غير محدد",
      disorderType: disability || selectedCase?.disorderType || "غير محدد",
      doctorId: selectedDoctor?.id ?? values.doctorId ?? selectedCase?.doctorId ?? null,
      specialist: selectedDoctor?.name || safeText(values.specialistName) || selectedCase?.specialist || "غير محدد",
      specialistName: selectedDoctor?.name || safeText(values.specialistName) || selectedCase?.specialistName || "غير محدد",
      specialistSpecialty: selectedDoctor?.specialty || selectedCase?.specialistSpecialty || "",
      referralType: selectedCase?.referralType || "تكاملية",
      referralDate: selectedCase?.referralDate || new Date(),
      status: selectedCase?.status || "جديدة",
    };
  };

  const allCases = useMemo(() => {
    void smartSyncTick;
    return ((casesQuery.data || []) as CaseItem[]).map((item) => {
      const stored = getStoredCaseSmartSync(item.id);
      const reports = getClinicalReportsByCase(item.id);
      const storedCount = Number(stored?.sessionsCount ?? stored?.totalSessions ?? 0);
      const latestRecommendation = getLatestReportRecommendation(item.id);

      return {
        ...item,
        sessionsCount: Math.max(Number(item.sessionsCount || 0), Number.isFinite(storedCount) ? storedCount : 0),
        totalSessions: Math.max(Number(item.totalSessions || 0), Number.isFinite(storedCount) ? storedCount : 0),
        lastSessionDate: item.lastSessionDate || stored?.lastSessionDate,
        reportsCount: reports.length,
        lastReportDate: getLatestReportDate(item.id),
        progressScore: Number(stored?.improvement ?? item.progressScore ?? 0),
        smartRecommendation: latestRecommendation || stored?.recommendation || item.smartRecommendation || "",
        riskLevel: stored?.smartLevel || item.riskLevel,
        financingStatus: getCaseFundingSummary(item) || item.financingStatus,
        remainingSessions: Number(item.remainingSessions || 0),
      };
    });
  }, [casesQuery.data, smartSyncTick]);

  const handleExcelUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheet =
        workbook.Sheets["الحالات"] ||
        workbook.Sheets["Cases"] ||
        workbook.Sheets[workbook.SheetNames[0]];

      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });

      if (!rows.length) {
        toast.error("ملف Excel فارغ");
        return;
      }

      const pendingCases: CaseItem[] = [...allCases];
      const newDiseaseSet = new Set(diseaseOptions);
      let importedCount = 0;
      let skippedCount = 0;

      for (const row of rows) {
        const birthDate = excelDateToJSDate(row["تاريخ الميلاد"]);
        const disability = safeText(
          row["نوع الإعاقة"] ||
            row["المرض"] ||
            row["التشخيص"] ||
            row.disabilityType
        );

        if (disability) newDiseaseSet.add(disability);

        const organizationName = getRowValue(row, [
          "اسم الجمعية",
          "الجمعية",
          "جمعية",
          "organization",
        ]);

        const matchedOrganization = organizationOptionsList.find(
          (organization) =>
            normalizeName(organization.name) === normalizeName(organizationName)
        );

        const specialistName = getRowValue(row, [
          "اسم المختص",
          "الأخصائي",
          "الاخصائي",
          "المختص",
          "specialistName",
          "specialist",
        ]);

        const matchedDoctor = specialistOptions.find((doctor) => {
          const sameName = normalizeName(doctor.name) === normalizeName(specialistName);
          const sameOrganization =
            !matchedOrganization?.id ||
            !doctor.organizationId ||
            Number(doctor.organizationId) === Number(matchedOrganization.id);

          return sameName && sameOrganization;
        });

        const payload = buildCasePayload({
          childName: getRowValue(row, [
            "اسم المستفيد",
            "اسم الطفل",
            "اسم الحالة",
            "الطفل",
            "المستفيد",
            "الاسم",
            "name",
            "childName",
          ]),
          familyPhone: safePhone(row["رقم جوال الأسرة"] || row.familyPhone),
          beneficiaryPhone: safePhone(row["رقم جوال المستفيد"] || row.beneficiaryPhone),
          gender: normalizeGender(row["الجنس"] || row.gender),
          birthDate,
          age: Number(row["العمر"] || row.age || calculateAgeFromBirthDate(birthDate)),
          disabilityType: disability,
          financialStatus: safeText(row["الحالة المادية"] || row.financialStatus),
          organization: matchedOrganization?.name || organizationName || "غير محدد",
          organizationId: matchedOrganization?.id ?? null,
          specialistName: matchedDoctor?.name || specialistName,
          doctorId: matchedDoctor?.id ?? null,
          notes: safeText(row["ملاحظات"] || row.notes),
        }, importedCount);

        if (!safeText(payload.childName) || payload.childName === "غير محدد") {
          skippedCount += 1;
          console.warn("Skipped case without child name:", row);
          continue;
        }

        if (isSameNormalized(payload.childName, payload.organization)) {
          skippedCount += 1;
          console.warn("Skipped row because child name equals organization:", row);
          continue;
        }

        const duplicateReason = getDuplicateReason(payload, pendingCases);

        if (duplicateReason) {
          skippedCount += 1;
          console.warn("Skipped duplicate case:", payload.childName, duplicateReason);
          continue;
        }

        pendingCases.push({
          ...payload,
          id: Date.now() + importedCount,
          status: payload.status || "جديدة",
          referralDate: payload.referralDate || new Date(),
        } as CaseItem);

        createCaseMutation.mutate(payload);
        importedCount += 1;
      }

      const nextDiseases = Array.from(newDiseaseSet);
      setDiseaseOptions(nextDiseases);
      saveDiseaseOptions(nextDiseases);

      if (importedCount > 0) {
        toast.success(`تم استيراد ${importedCount} حالة، وتم تجاهل ${skippedCount} حالة مكررة`);
      } else {
        toast.error(`لم يتم استيراد حالات جديدة. تم تجاهل ${skippedCount} حالة مكررة`);
      }

      notifyDashboard();
    } catch (error) {
      console.error("Excel upload error:", error);
      toast.error("حدث خطأ أثناء قراءة ملف Excel");
    }
  };

  const downloadTemplate = () => {
    const casesSheet = [
      {
        "اسم المستفيد": "محمد أحمد علي",
        "رقم جوال الأسرة": "05XXXXXXXX",
        "رقم جوال المستفيد": "05XXXXXXXX",
        الجنس: "ذكر",
        "تاريخ الميلاد": "2018-03-29",
        العمر: 6,
        "نوع الإعاقة": "إعاقة سمعية",
        "الحالة المادية": "متوسط",
        "اسم المختص": "د. خالد الرفاعي",
        ملاحظات: "ملاحظات إضافية",
        "اسم الجمعية": "جمعية إنماء",
      },
    ];

    const diseasesSheet = diseaseOptions.map((item) => ({ "الأمراض / أنواع الإعاقة": item }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(casesSheet), "الحالات");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(diseasesSheet), "قائمة الأمراض");
    XLSX.writeFile(workbook, "Anma_Cases_Template.xlsx");
  };

  const exportCasesExcel = () => {
    const uniqueCases = uniqueCasesByBeneficiary(filteredCases);

    const casesSheet = uniqueCases.map((item) => {
      const smart = getSmartCaseAssessment(item);

      return {
        الاسم: item.childName,
        "رقم جوال الأسرة": safePhone(item.familyPhone || item.phone),
        "رقم جوال المستفيد": safePhone(item.beneficiaryPhone),
        الجنس: item.gender || "غير محدد",
        "تاريخ الميلاد": item.birthDate ? new Date(item.birthDate).toLocaleDateString("ar-SA") : "",
        العمر: item.age || "",
        "نوع الإعاقة": item.disabilityType || item.disorderType || "",
        "الحالة المادية": item.financialStatus || "",
        ملاحظات: item.notes || "",
        "اسم الجمعية": item.organization,
        "اسم الأخصائي": item.specialistName || item.specialist || "",
        "تخصص الأخصائي": item.specialistSpecialty || item.specialty || "",
        "عدد تقارير المختصين": item.reportsCount || 0,
        "مؤشر التقدم": item.progressScore ? `${item.progressScore}%` : "",
        "التمويل": item.financingStatus || "",
        "آخر توصية": item.smartRecommendation || smart.recommendation,
        "الحالة التشغيلية": getOperationalStatus(item),
        "عدد الجلسات": getCaseSessionsCount(item),
        "التصنيف الذكي": item.riskLevel || smart.level,
        "سبب التصنيف": smart.reason,
        "التوصية": smart.recommendation,
        "اكتمال البيانات": `${smart.completeness}%`,
      };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(casesSheet), "الحالات");
    XLSX.writeFile(workbook, `Anma_Cases_Smart_${Date.now()}.xlsx`);
  };

  const onCreateSubmit = (values: CaseFormValues) => {
    const duplicateReason = getDuplicateReason(values, allCases);

    if (duplicateReason.includes("لا يمكن")) {
      toast.error(duplicateReason);
      return;
    }

    if (duplicateReason) {
      const proceed = confirm(`${duplicateReason}\nهل تريدين المتابعة رغم احتمال التكرار؟`);
      if (!proceed) return;
    }

    createCaseMutation.mutate(buildCasePayload(values));
  };

  const onEditSubmit = (values: CaseFormValues) => {
    if (!selectedCase) return;

    const duplicateReason = getDuplicateReason(values, allCases, selectedCase.id);

    if (duplicateReason.includes("لا يمكن")) {
      toast.error(duplicateReason);
      return;
    }

    if (duplicateReason) {
      const proceed = confirm(`${duplicateReason}\nهل تريدين حفظ التعديل رغم احتمال التكرار؟`);
      if (!proceed) return;
    }

    updateCaseMutation.mutate({
      id: selectedCase.id,
      data: buildCasePayload(values),
    });
  };

  const openEditDialog = (caseItem: CaseItem) => {
    setSelectedCase(caseItem);

    editForm.reset({
      childName: caseItem.childName,
      familyPhone: caseItem.familyPhone || caseItem.phone || "",
      beneficiaryPhone: caseItem.beneficiaryPhone || "",
      gender: caseItem.gender || "غير محدد",
      birthDate: caseItem.birthDate ? new Date(caseItem.birthDate) : undefined,
      age: Number(caseItem.age || 0),
      disabilityType: caseItem.disabilityType || caseItem.disorderType || "",
      financialStatus: caseItem.financialStatus || "",
      organization: caseItem.organization || "",
      organizationId: caseItem.organizationId ?? null,
      specialistName: caseItem.specialistName || caseItem.specialist || "",
      doctorId: caseItem.doctorId ?? null,
      notes: caseItem.notes || "",
    });

    setIsEditDialogOpen(true);
  };

  const handleDelete = (caseId: number) => {
    const confirmDelete = confirm(
      "هل أنت متأكد من حذف الحالة؟ سيتم حذف الحالة وجميع بياناتها المرتبطة من النظام."
    );

    if (!confirmDelete) return;
    deleteCaseMutation.mutate({ id: caseId });
  };

  const availableOrganizations = useMemo(() => {
    const fromBackend = organizationOptionsList.map((item) => item.name).filter(Boolean);
    const fromCases = allCases.map((item) => item.organization).filter(Boolean);
    return Array.from(new Set([...fromBackend, ...fromCases]));
  }, [allCases, organizationOptionsList]);

  const availableSpecialists = useMemo(() => {
    const fromDoctors = specialistOptions.map((item) => item.name).filter(Boolean);
    const fromCases = allCases
      .map((item) => item.specialistName || item.specialist)
      .filter(Boolean)
      .map((item) => safeText(item));

    return Array.from(new Set([...fromDoctors, ...fromCases].filter(Boolean)));
  }, [allCases, specialistOptions]);

  const availableDiseases = useMemo(() => {
    const fromCases = allCases
      .map((item) => item.disabilityType || item.disorderType)
      .filter(Boolean)
      .map((item) => safeText(item));

    return Array.from(new Set([...diseaseOptions, ...fromCases].filter(Boolean)));
  }, [allCases, diseaseOptions]);

  const organizationStats = useMemo(() => {
    const statsMap = new Map<string, number>();

    allCases.forEach((item) => {
      const organization = item.organization || "غير محدد";
      const current = statsMap.get(organization) || 0;
      statsMap.set(organization, current + 1);
    });

    return Array.from(statsMap.entries()).map(([organization, count]) => ({
      organization,
      count,
    }));
  }, [allCases]);

  const diseaseStats = useMemo(() => {
    const statsMap = new Map<string, number>();

    allCases.forEach((item) => {
      const disease = item.disabilityType || item.disorderType || "غير محدد";
      const current = statsMap.get(disease) || 0;
      statsMap.set(disease, current + 1);
    });

    return Array.from(statsMap.entries()).map(([disease, count]) => ({
      disease,
      count,
    }));
  }, [allCases]);

  const hospitalSmartStats = useMemo(() => {
    const assessments = allCases.map(getSmartCaseAssessment);

    return {
      undefinedCount: assessments.filter((item) => item.level === "غير محدد").length,
      followUpCount: assessments.filter((item) => item.level === "متابعة").length,
      urgentCount: assessments.filter((item) => item.level === "خطر").length,
      excellentCount: assessments.filter((item) => item.level === "ممتاز").length,
      incompleteDataCount: assessments.filter((item) => item.completeness < 70).length,
      averageCompleteness: assessments.length
        ? Math.round(assessments.reduce((sum, item) => sum + item.completeness, 0) / assessments.length)
        : 0,
    };
  }, [allCases]);

  const filteredCases = allCases.filter((item) => {
    const search = searchTerm.trim().toLowerCase();
    const disability = item.disabilityType || item.disorderType || "غير محدد";

    const searchableText = [
      item.childName,
      item.familyPhone,
      item.beneficiaryPhone,
      item.phone,
      item.organization,
      item.specialistName,
      item.specialist,
      disability,
      item.financialStatus,
      item.notes,
      item.status,
    ]
      .map((value) => safeText(value).toLowerCase())
      .join(" ");

    const matchesSearch = !search || searchableText.includes(search);
    const matchesOrganization =
      organizationFilter === "all" || item.organization === organizationFilter;

    const matchesDisability =
      disabilityFilter === "all" || disability === disabilityFilter;

    const smartAssessment = getSmartCaseAssessment(item);
    const specialistName = safeText(item.specialistName || item.specialist || "بدون مختص");
    const matchesSpecialist =
      specialistFilter === "all" ||
      (specialistFilter === "__none" && (!specialistName || specialistName === "غير محدد" || specialistName === "بدون مختص")) ||
      specialistName === specialistFilter;

    const matchesSmartLevel =
      smartLevelFilter === "all" || smartAssessment.level === smartLevelFilter;

    return matchesSearch && matchesOrganization && matchesDisability && matchesSpecialist && matchesSmartLevel;
  });

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                <Users className="h-4 w-4" />
                Case Management
              </div>

              <h1 className="text-2xl font-black text-slate-900">
                إدارة الحالات
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                متابعة الحالات، المختصين، التقارير، الجلسات، والتمويل من مكان واحد.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                id="excelUpload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    void handleExcelUpload(e.target.files[0]);
                    e.target.value = "";
                  }
                }}
              />

              <Button variant="outline" className="rounded-2xl" onClick={downloadTemplate}>
                <FileSpreadsheet className="ml-2 h-4 w-4" />
                قالب Excel
              </Button>

              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => document.getElementById("excelUpload")?.click()}
              >
                <Upload className="ml-2 h-4 w-4" />
                استيراد
              </Button>

              <Button variant="outline" className="rounded-2xl" onClick={exportCasesExcel}>
                <Download className="ml-2 h-4 w-4" />
                تصدير
              </Button>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-2xl bg-orange-600 font-bold text-white hover:bg-orange-700">
                    <Plus className="ml-2 h-4 w-4" />
                    حالة جديدة
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة حالة جديدة</DialogTitle>
                    <DialogDescription>
                      أدخلي البيانات الأساسية للحالة وربطها بالجمعية والمختص.
                    </DialogDescription>
                  </DialogHeader>

                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                      <CaseFields
                        form={createForm}
                        diseaseOptions={availableDiseases}
                        specialistOptions={specialistOptions}
                        organizationOptionsList={organizationOptionsList}
                      />

                      <Button
                        type="submit"
                        className="w-full rounded-2xl bg-orange-600 hover:bg-orange-700"
                        disabled={createCaseMutation.isPending}
                      >
                        {createCaseMutation.isPending ? "جاري الإضافة..." : "حفظ الحالة"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل الحالة</DialogTitle>
              <DialogDescription>عدلي بيانات الحالة ثم احفظي التغييرات.</DialogDescription>
            </DialogHeader>

            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <CaseFields
                  form={editForm}
                  diseaseOptions={availableDiseases}
                  specialistOptions={specialistOptions}
                  organizationOptionsList={organizationOptionsList}
                />

                <Button
                  type="submit"
                  className="w-full rounded-2xl bg-orange-600 hover:bg-orange-700"
                  disabled={updateCaseMutation.isPending}
                >
                  {updateCaseMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { title: "الحالات", value: allCases.length, tone: "bg-white text-slate-900", icon: Users },
            { title: "الجمعيات", value: organizationStats.length, tone: "bg-blue-50 text-blue-700", icon: Building2 },
            { title: "الأمراض", value: diseaseStats.length, tone: "bg-white text-slate-900", icon: Activity },
            { title: "أولوية عالية", value: hospitalSmartStats.urgentCount, tone: "bg-red-50 text-red-700", icon: AlertTriangle },
            { title: "متابعة", value: hospitalSmartStats.followUpCount, tone: "bg-amber-50 text-amber-700", icon: Clock3 },
            { title: "اكتمال البيانات", value: `${hospitalSmartStats.averageCompleteness}%`, tone: "bg-green-50 text-green-700", icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className={`rounded-2xl border p-4 shadow-sm ${item.tone}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold opacity-75">{item.title}</p>
                  <Icon className="h-4 w-4 opacity-75" />
                </div>
                <p className="mt-2 text-2xl font-black">{item.value}</p>
              </div>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border bg-white p-5 shadow-sm xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">جاهزية الحالات</h2>
                <p className="mt-1 text-xs text-slate-500">مؤشرات مختصرة لجودة البيانات والتقارير.</p>
              </div>
              <Brain className="h-5 w-5 text-orange-600" />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-500">مرتبطة بمختص</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {allCases.filter((item) => safeText(item.specialistName || item.specialist) && safeText(item.specialistName || item.specialist) !== "غير محدد").length}
                </p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-500">بدون مختص</p>
                <p className="mt-2 text-2xl font-black text-amber-600">
                  {allCases.filter((item) => !safeText(item.specialistName || item.specialist) || safeText(item.specialistName || item.specialist) === "غير محدد").length}
                </p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-500">لديها تقارير</p>
                <p className="mt-2 text-2xl font-black text-emerald-600">
                  {allCases.filter((item) => Number(item.reportsCount || 0) > 0).length}
                </p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-500">تحتاج استكمال</p>
                <p className="mt-2 text-2xl font-black text-orange-600">
                  {hospitalSmartStats.incompleteDataCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">إضافة مرض/إعاقة</h2>
            <p className="mt-1 text-xs text-slate-500">تظهر القائمة في إضافة الحالة والفلاتر.</p>

            <div className="mt-4 flex gap-2">
              <Input
                placeholder="مثال: تأخر حركي"
                value={newDisease}
                onChange={(e) => setNewDisease(e.target.value)}
                className="rounded-2xl bg-slate-50"
              />

              <Button
                type="button"
                onClick={addDiseaseOption}
                className="rounded-2xl bg-orange-600 text-white hover:bg-orange-700"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {availableDiseases.slice(0, 12).map((disease) => (
                <span
                  key={disease}
                  className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700"
                >
                  {disease}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="ابحث بالاسم، الجوال، المرض، الجمعية..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-2xl bg-slate-50 pr-10"
              />
            </div>

            <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
              <SelectTrigger className="rounded-2xl bg-slate-50">
                <SelectValue placeholder="الجمعية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الجمعيات</SelectItem>
                {availableOrganizations.map((org) => (
                  <SelectItem key={org} value={org}>{org}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={disabilityFilter} onValueChange={setDisabilityFilter}>
              <SelectTrigger className="rounded-2xl bg-slate-50">
                <SelectValue placeholder="المرض / الإعاقة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأمراض</SelectItem>
                {availableDiseases.map((disease) => (
                  <SelectItem key={disease} value={disease}>{disease}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={specialistFilter} onValueChange={setSpecialistFilter}>
              <SelectTrigger className="rounded-2xl bg-slate-50">
                <SelectValue placeholder="المختص" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المختصين</SelectItem>
                <SelectItem value="__none">بدون مختص</SelectItem>
                {availableSpecialists.map((specialist) => (
                  <SelectItem key={specialist} value={specialist}>{specialist}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={smartLevelFilter} onValueChange={setSmartLevelFilter}>
              <SelectTrigger className="rounded-2xl bg-slate-50">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                <SelectItem value="غير محدد">غير محدد</SelectItem>
                <SelectItem value="متابعة">متابعة</SelectItem>
                <SelectItem value="خطر">خطر</SelectItem>
                <SelectItem value="ممتاز">ممتاز</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="rounded-3xl border bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">قائمة الحالات</h2>
              <p className="mt-1 text-xs text-slate-500">عدد الحالات: {filteredCases.length}</p>
            </div>
          </div>

          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-xs text-slate-500">
                  <th className="px-4 py-3 text-right">الحالة</th>
                  <th className="px-4 py-3 text-right">الجمعية</th>
                  <th className="px-4 py-3 text-right">المختص</th>
                  <th className="px-4 py-3 text-right">التقارير</th>
                  <th className="px-4 py-3 text-right">الجلسات</th>
                  <th className="px-4 py-3 text-right">التقدم</th>
                  <th className="px-4 py-3 text-right">التمويل</th>
                  <th className="px-4 py-3 text-right">التصنيف</th>
                  <th className="px-4 py-3 text-right">الملف</th>
                  <th className="px-4 py-3 text-right">الإجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filteredCases.map((caseItem) => {
                  const smart = getSmartCaseAssessment(caseItem);
                  const operationalStatus = getOperationalStatus(caseItem);
                  const sessionsCount = getCaseSessionsCount(caseItem);
                  const disability = caseItem.disabilityType || caseItem.disorderType || "-";
                  const specialist = caseItem.specialistName || caseItem.specialist || "";
                  const initials =
                    caseItem.childName
                      ?.split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("") || "ح";

                  return (
                    <tr key={caseItem.id} className="border-b last:border-b-0 hover:bg-orange-50/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-sm font-black text-orange-700">
                            {initials}
                          </div>

                          <div className="min-w-0">
                            <div className="font-black text-slate-900">{caseItem.childName}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {caseItem.caseNumber} · {disability} · {caseItem.age || "-"} سنوات
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {safePhone(caseItem.familyPhone || caseItem.phone || caseItem.beneficiaryPhone) || "لا يوجد جوال"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700">{caseItem.organization}</div>
                        <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(operationalStatus)}`}>
                          {operationalStatus}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {specialist && specialist !== "غير محدد" ? (
                          <div>
                            <div className="font-bold text-slate-800">{specialist}</div>
                            {(caseItem.specialistSpecialty || caseItem.specialty) && (
                              <div className="text-xs text-slate-400">
                                {caseItem.specialistSpecialty || caseItem.specialty}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                            بدون مختص
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${caseItem.reportsCount ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {caseItem.reportsCount ? `${caseItem.reportsCount} تقرير` : "لا يوجد"}
                        </span>
                        {caseItem.lastReportDate && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            {new Date(caseItem.lastReportDate).toLocaleDateString("ar-SA")}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {sessionsCount > 0 ? `${sessionsCount} جلسة` : "لا توجد"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex min-w-[110px] items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(Number(caseItem.progressScore || 0), 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold">{caseItem.progressScore ? `${caseItem.progressScore}%` : "-"}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {caseItem.financingStatus || caseItem.totalFinancing ? (
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                            {caseItem.financingStatus || `${caseItem.totalFinancing} ريال`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">غير محدد</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getSmartLevelBadgeClass(smart.level)}`}>
                            {smart.level}
                          </span>
                          <div className="line-clamp-2 max-w-[220px] text-xs leading-5 text-slate-500">
                            {caseItem.smartRecommendation || smart.recommendation}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex min-w-[120px] items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-orange-500"
                              style={{ width: `${smart.completeness}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold">{smart.completeness}%</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-blue-600"
                            onClick={() => navigate(`/cases/${caseItem.id}`)}
                          >
                            <Eye className="ml-1 h-4 w-4" />
                            عرض
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-orange-600 hover:text-orange-700"
                            onClick={() => openEditDialog(caseItem)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(caseItem.id)}
                            disabled={deleteCaseMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredCases.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-500">
                لا توجد حالات تطابق معايير البحث.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
