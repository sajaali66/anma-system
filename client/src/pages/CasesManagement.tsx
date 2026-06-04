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
  age: z.number().min(0, "العمر مطلوب").max(100, "العمر غير صحيح"),
  disabilityType: z.string().optional(),
  financialStatus: z.string().optional(),
  organization: z.string().min(1, "اسم الجمعية مطلوب"),
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
  age: number;
  disabilityType?: string;
  financialStatus?: string;
  organization: string;
  notes?: string | null;
  status: "جديدة" | "نشطة" | "مكتملة" | "متعثرة";
  referralDate: string | Date;

  city?: string;
  disorderType?: string;
  specialist?: string;
  specialistName?: string;
  specialistSpecialty?: string;
  specialty?: string;
  referralType?: "تكاملية" | "مساندة" | "لاحقة";

  // حقول اختيارية إذا كان الباكند يرجع عدد الجلسات أو آخر جلسة
  sessionsCount?: number;
  sessionCount?: number;
  totalSessions?: number;
  usedSessionCount?: number;
  completedSessions?: number;
  lastSessionDate?: string | Date;
};

const lightInputClass = "placeholder:text-muted-foreground/40";


const CASE_SMART_SYNC_STORAGE_KEY = "anma-case-smart-sync";

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

type SmartLevel = "غير محدد" | "ممتاز" | "متابعة" | "خطر";

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

function CaseFields({ form }: { form: UseFormReturn<CaseFormValues> }) {
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
          name="organization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>اسم الجمعية</FormLabel>
              <FormControl>
                <Input
                  list="organizations-list"
                  placeholder="اكتب أو اختر اسم الجمعية"
                  className={lightInputClass}
                  {...field}
                />
              </FormControl>
              <datalist id="organizations-list">
                {organizationOptions.map((org) => (
                  <option key={org} value={org} />
                ))}
              </datalist>
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
              <FormLabel>العمر</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  className={lightInputClass}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(Number(e.target.value))}
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
              <FormLabel>نوع الإعاقة</FormLabel>
              <FormControl>
                <Input placeholder="نوع الإعاقة" className={lightInputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="financialStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الحالة المادية</FormLabel>
              <FormControl>
                <Input placeholder="مثال: محتاج / متوسط / ميسور" className={lightInputClass} {...field} />
              </FormControl>
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
  const [smartLevelFilter, setSmartLevelFilter] = useState("all");
  const [smartSyncTick, setSmartSyncTick] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [, navigate] = useLocation();

  const casesQuery = trpc.cases.list.useQuery(undefined, {
    refetchInterval: 3000,
  });

  useEffect(() => {
    const refreshSmartSync = () => setSmartSyncTick((value) => value + 1);
    window.addEventListener("anma-case-smart-sync-updated", refreshSmartSync as EventListener);
    window.addEventListener("storage", refreshSmartSync);

    const interval = window.setInterval(refreshSmartSync, 3000);

    return () => {
      window.removeEventListener("anma-case-smart-sync-updated", refreshSmartSync as EventListener);
      window.removeEventListener("storage", refreshSmartSync);
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

  const createCaseMutation = trpc.cases.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الحالة بنجاح");
      void casesQuery.refetch();
      setIsCreateDialogOpen(false);
      createForm.reset(defaultValues);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ في إضافة الحالة");
    },
  });

  const updateCaseMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الحالة بنجاح");
      void casesQuery.refetch();
      setIsEditDialogOpen(false);
      setSelectedCase(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ في تعديل الحالة");
    },
  });

  const deleteCaseMutation = trpc.cases.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الحالة وجميع بياناتها المرتبطة");
      void casesQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ في حذف الحالة");
    },
  });

  const buildCasePayload = (values: Partial<CaseFormValues>, index?: number) => {
    const familyPhone = safePhone(values.familyPhone);
    const beneficiaryPhone = safePhone(values.beneficiaryPhone);
    const caseNumber = selectedCase?.caseNumber || `CASE-${Date.now()}-${index ?? 0}`;

    return {
      caseNumber,
      childName: safeText(values.childName) || "غير محدد",
      familyPhone,
      beneficiaryPhone,
      phone: familyPhone || beneficiaryPhone,
      gender: values.gender || "غير محدد",
      birthDate: values.birthDate,
      age: Number(values.age || 0),
      disabilityType: safeText(values.disabilityType),
      financialStatus: safeText(values.financialStatus),
      organization: safeText(values.organization) || "غير محدد",
      notes: safeText(values.notes),

      city: selectedCase?.city || "غير محدد",
      disorderType: safeText(values.disabilityType) || selectedCase?.disorderType || "غير محدد",
      specialist: selectedCase?.specialist || "غير محدد",
      referralType: selectedCase?.referralType || "تكاملية",
      referralDate: selectedCase?.referralDate || new Date(),
      status: selectedCase?.status || "جديدة",
    };
  };

  const allCases = useMemo(() => {
    void smartSyncTick;
    return ((casesQuery.data || []) as CaseItem[]).map((item) => {
      const stored = getStoredCaseSmartSync(item.id);
      if (!stored) return item;

      const storedCount = Number(stored.sessionsCount ?? stored.totalSessions ?? 0);

      return {
        ...item,
        sessionsCount: Math.max(Number(item.sessionsCount || 0), Number.isFinite(storedCount) ? storedCount : 0),
        totalSessions: Math.max(Number(item.totalSessions || 0), Number.isFinite(storedCount) ? storedCount : 0),
        lastSessionDate: item.lastSessionDate || stored.lastSessionDate,
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

      rows.forEach((row, index) => {
        const birthDate = excelDateToJSDate(row["تاريخ الميلاد"]);

        const payload = buildCasePayload(
          {
            childName: safeText(row["الاسم"] || row.name || row.childName),
            familyPhone: safePhone(row["رقم جوال الأسرة"] || row["رقم جوال الأسرة"] || row.familyPhone),
            beneficiaryPhone: safePhone(row["رقم جوال المستفيد"] || row["رقم جوال المستفيد"] || row.beneficiaryPhone),
            gender: normalizeGender(row["الجنس"] || row.gender),
            birthDate,
            age: Number(row["العمر"] || row.age || calculateAgeFromBirthDate(birthDate)),
            disabilityType: safeText(row["نوع الإعاقة"] || row.disabilityType),
            financialStatus: safeText(row["الحالة المادية"] || row.financialStatus),
            notes: safeText(row["ملاحظات"] || row.notes),
            organization: safeText(row["اسم الجمعية"] || row["الجمعية"] || row.organization) || "غير محدد",
          },
          index
        );

        createCaseMutation.mutate(payload);
      });

      toast.success(`تم استيراد ${rows.length} حالة من Excel`);
    } catch (error) {
      console.error("Excel upload error:", error);
      toast.error("حدث خطأ أثناء قراءة ملف Excel");
    }
  };

  const downloadTemplate = () => {
    const casesSheet = [
      {
        الاسم: "محمد أحمد علي",
        "رقم جوال الأسرة": "05XXXXXXXX",
        "رقم جوال المستفيد": "05XXXXXXXX",
        الجنس: "ذكر",
        "تاريخ الميلاد": "2018-03-29",
        العمر: 6,
        "نوع الإعاقة": "إعاقة سمعية",
        "الحالة المادية": "متوسط",
        ملاحظات: "ملاحظات إضافية",
        "اسم الجمعية": "جمعية إنماء",
      },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(casesSheet), "الحالات");
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
        العمر: item.age,
        "نوع الإعاقة": item.disabilityType || item.disorderType || "",
        "الحالة المادية": item.financialStatus || "",
        ملاحظات: item.notes || "",
        "اسم الجمعية": item.organization,
        "اسم الأخصائي": item.specialistName || item.specialist || "",
        "تخصص الأخصائي": item.specialistSpecialty || item.specialty || "",
        "الحالة التشغيلية": getOperationalStatus(item),
        "عدد الجلسات": getCaseSessionsCount(item),
        "التصنيف الذكي": smart.level,
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
    createCaseMutation.mutate(buildCasePayload(values));
  };

  const onEditSubmit = (values: CaseFormValues) => {
    if (!selectedCase) return;

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
    const fromCases = allCases.map((item) => item.organization).filter(Boolean);
    return Array.from(new Set([...organizationOptions, ...fromCases]));
  }, [allCases]);

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
    const searchableText = [
      item.childName,
      item.familyPhone,
      item.beneficiaryPhone,
      item.phone,
      item.organization,
      item.disabilityType,
      item.disorderType,
      item.financialStatus,
      item.notes,
      item.status,
    ]
      .map((value) => safeText(value).toLowerCase())
      .join(" ");

    const matchesSearch = !search || searchableText.includes(search);
    const matchesOrganization =
      organizationFilter === "all" || item.organization === organizationFilter;

    const smartAssessment = getSmartCaseAssessment(item);
    const matchesSmartLevel =
      smartLevelFilter === "all" || smartAssessment.level === smartLevelFilter;

    return matchesSearch && matchesOrganization && matchesSmartLevel;
  });

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-[#1F2937]">إدارة الحالات</h1>
            <p className="text-muted-foreground">
              نظام ذكي لإدارة الحالات يشبه أنظمة المستشفيات: فرز، متابعة، تنبيهات، وتصدير منظم
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

            <Button variant="outline" onClick={downloadTemplate}>
              <FileSpreadsheet className="ml-2 h-4 w-4" />
              تحميل قالب Excel
            </Button>

            <Button
              variant="outline"
              onClick={() => document.getElementById("excelUpload")?.click()}
            >
              <Upload className="ml-2 h-4 w-4" />
              استيراد Excel
            </Button>

            <Button variant="outline" onClick={exportCasesExcel}>
              <Download className="ml-2 h-4 w-4" />
              تصدير Excel
            </Button>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-orange-600 text-white hover:bg-orange-700">
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة حالة
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة حالة جديدة</DialogTitle>
                  <DialogDescription>
                    أدخل بيانات الحالة حسب ملف Excel المعتمد
                  </DialogDescription>
                </DialogHeader>

                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <CaseFields form={createForm} />

                    <Button
                      type="submit"
                      className="w-full bg-orange-600 hover:bg-orange-700"
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

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل الحالة</DialogTitle>
              <DialogDescription>عدلي بيانات الحالة ثم احفظي التغييرات</DialogDescription>
            </DialogHeader>

            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <CaseFields form={editForm} />

                <Button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  disabled={updateCaseMutation.isPending}
                >
                  {updateCaseMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-orange-600" />
                إجمالي الحالات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{allCases.length}</div>
              <p className="mt-1 text-sm text-muted-foreground">حالة مسجلة في النظام</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-orange-600" />
                عدد الجمعيات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {organizationStats.length}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                جمعيات لديها مستفيدون
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">نتائج البحث الحالية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{filteredCases.length}</div>
              <p className="mt-1 text-sm text-muted-foreground">حالة حسب الفلترة</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                عاجلة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{hospitalSmartStats.urgentCount}</div>
              <p className="mt-1 text-sm text-muted-foreground">لا تظهر إلا بسبب واضح</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock3 className="h-5 w-5 text-amber-600" />
                متابعة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{hospitalSmartStats.followUpCount}</div>
              <p className="mt-1 text-sm text-muted-foreground">تحتاج استكمال أو متابعة</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-5 w-5 text-slate-600" />
                غير محدد
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-600">{hospitalSmartStats.undefinedCount}</div>
              <p className="mt-1 text-sm text-muted-foreground">لم تبدأ أو بلا بيانات كافية</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-orange-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-orange-600" />
              لوحة فرز ذكية للحالات
            </CardTitle>
            <CardDescription>
              النظام لا يصنف الحالة كخطر إلا عند وجود سبب واضح، والحالات الجديدة تبقى غير محددة حتى تبدأ بيانات الجلسات أو المتابعة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  اكتمال البيانات
                </div>
                <div className="mt-2 text-2xl font-bold text-[#1F2937]">{hospitalSmartStats.averageCompleteness}%</div>
                <p className="mt-1 text-xs text-muted-foreground">متوسط اكتمال ملفات الحالات</p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCheck className="h-4 w-4" />
                  تحتاج استكمال بيانات
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-600">{hospitalSmartStats.incompleteDataCount}</div>
                <p className="mt-1 text-xs text-muted-foreground">حالات ناقصة رقم/أخصائي/نوع إعاقة</p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Brain className="h-4 w-4" />
                  قاعدة التصنيف
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  بدون جلسات أو بيانات متابعة = غير محدد. لا يتم احتسابها خطر إلا إذا كانت متعثرة أو توجد مؤشرات واضحة.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5 text-orange-600" /> البحث والفلترة الذكية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث بالاسم، الجوال، نوع الإعاقة، الجمعية..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="فلترة حسب الجمعية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الجمعيات</SelectItem>
                  {availableOrganizations.map((org) => (
                    <SelectItem key={org} value={org}>
                      {org}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={smartLevelFilter} onValueChange={setSmartLevelFilter}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="فلترة حسب التصنيف" />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>قاعدة بيانات الحالات</CardTitle>
            <CardDescription>عدد الحالات: {filteredCases.length}</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-right">الاسم</th>
                    <th className="px-4 py-3 text-right">رقم جوال الأسرة</th>
                    <th className="px-4 py-3 text-right">رقم جوال المستفيد</th>
                    <th className="px-4 py-3 text-right">الجنس</th>
                    <th className="px-4 py-3 text-right">تاريخ الميلاد</th>
                    <th className="px-4 py-3 text-right">العمر</th>
                    <th className="px-4 py-3 text-right">نوع الإعاقة</th>
                    <th className="px-4 py-3 text-right">الحالة المادية</th>
                    <th className="px-4 py-3 text-right">اسم الجمعية</th>
                    <th className="px-4 py-3 text-right">التصنيف الذكي</th>
                    <th className="px-4 py-3 text-right">اكتمال الملف</th>
                    <th className="px-4 py-3 text-right">الحالة</th>
                    <th className="px-4 py-3 text-right">الجلسات</th>
                    <th className="px-4 py-3 text-right">ملاحظات</th>
                    <th className="px-4 py-3 text-right">الإجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCases.map((caseItem) => {
                    const smart = getSmartCaseAssessment(caseItem);
                    const operationalStatus = getOperationalStatus(caseItem);
                    const sessionsCount = getCaseSessionsCount(caseItem);

                    return (
                    <tr key={caseItem.id} className="border-b hover:bg-orange-50/40">
                      <td className="px-4 py-3 font-medium">{caseItem.childName}</td>
                      <td className="px-4 py-3">{safePhone(caseItem.familyPhone || caseItem.phone) || "-"}</td>
                      <td className="px-4 py-3">{safePhone(caseItem.beneficiaryPhone) || "-"}</td>
                      <td className="px-4 py-3">{caseItem.gender || "-"}</td>
                      <td className="px-4 py-3">
                        {caseItem.birthDate
                          ? new Date(caseItem.birthDate).toLocaleDateString("ar-SA")
                          : "-"}
                      </td>
                      <td className="px-4 py-3">{caseItem.age}</td>
                      <td className="px-4 py-3">
                        {caseItem.disabilityType || caseItem.disorderType || "-"}
                      </td>
                      <td className="px-4 py-3">{caseItem.financialStatus || "-"}</td>
                      <td className="px-4 py-3">{caseItem.organization}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSmartLevelBadgeClass(smart.level)}`}>
                            {smart.level}
                          </span>
                          <div className="max-w-[260px] text-xs leading-5 text-muted-foreground">
                            {smart.reason}
                          </div>
                          <div className="text-xs text-orange-700">
                            التوصية: {smart.suggestedSpecialist}
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
                          <span className="text-xs font-semibold">{smart.completeness}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(operationalStatus)}`}>
                          {operationalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {sessionsCount > 0 ? `${sessionsCount} جلسة` : "لا توجد"}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px] truncate">{caseItem.notes || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => navigate(`/cases/${caseItem.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-600 hover:text-orange-700"
                            onClick={() => openEditDialog(caseItem)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
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
                <div className="py-8 text-center text-muted-foreground">
                  لا توجد حالات تطابق معايير البحث
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}