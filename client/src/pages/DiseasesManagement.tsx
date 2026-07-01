import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Activity,
  Building2,
  Stethoscope,
  FileSpreadsheet,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

type DiseaseStatus = "نشط" | "موقوف";
type PriorityLevel = "منخفض" | "متوسط" | "مرتفع";

type DiseaseItem = {
  id: string;
  name: string;
  category: string;
  defaultSpecialist: string;
  organization: string;
  organizationId?: number | null;
  doctorId?: number | null;
  priority: PriorityLevel;
  status: DiseaseStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type OrganizationItem = {
  id: number;
  name: string;
};

type DoctorItem = {
  id: number;
  name: string;
  specialty?: string;
  organizationId?: number | null;
};

const DISEASE_OPTIONS_STORAGE_KEY = "anma-disease-options";
const DISEASE_MANAGEMENT_STORAGE_KEY = "anma-diseases-management";

const defaultDiseases: DiseaseItem[] = [
  {
    id: "autism",
    name: "اضطراب طيف التوحد",
    category: "نمائي",
    defaultSpecialist: "طبيب نمو وسلوك + أخصائي تعديل سلوك",
    organization: "كل الجمعيات",
    organizationId: null,
    doctorId: null,
    priority: "مرتفع",
    status: "نشط",
    notes: "يحتاج متابعة دورية وتقارير مختصين دقيقة.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "speech-delay",
    name: "تأخر نطق / اضطراب لغة",
    category: "نطق وتخاطب",
    defaultSpecialist: "أخصائي نطق وتخاطب",
    organization: "كل الجمعيات",
    organizationId: null,
    doctorId: null,
    priority: "متوسط",
    status: "نشط",
    notes: "يرتبط بخطة جلسات تخاطب وقياس مفردات.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "adhd",
    name: "فرط حركة وتشتت انتباه ADHD",
    category: "نفسي / سلوكي",
    defaultSpecialist: "طبيب نمو وسلوك / أخصائي نفسي",
    organization: "كل الجمعيات",
    organizationId: null,
    doctorId: null,
    priority: "متوسط",
    status: "نشط",
    notes: "يحتاج متابعة سلوكية ومدرسية.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "learning-difficulties",
    name: "صعوبات تعلم",
    category: "تعليمي",
    defaultSpecialist: "أخصائي صعوبات تعلم",
    organization: "كل الجمعيات",
    organizationId: null,
    doctorId: null,
    priority: "متوسط",
    status: "نشط",
    notes: "يحتاج خطة تعليمية فردية.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const categoryOptions = [
  "نمائي",
  "نطق وتخاطب",
  "علاج وظيفي",
  "علاج طبيعي",
  "نفسي / سلوكي",
  "تعليمي",
  "سمعي",
  "حركي",
  "أخرى",
];

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function readDiseaseOptions(): string[] {
  try {
    const raw = localStorage.getItem(DISEASE_OPTIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveDiseaseOptions(options: string[]) {
  const unique = Array.from(new Set(options.map(safeText).filter(Boolean)));
  localStorage.setItem(DISEASE_OPTIONS_STORAGE_KEY, JSON.stringify(unique));
  window.dispatchEvent(new CustomEvent("anma-disease-options-updated", { detail: unique }));
  window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
}

function readManagedDiseases(): DiseaseItem[] {
  try {
    const raw = localStorage.getItem(DISEASE_MANAGEMENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (Array.isArray(parsed) && parsed.length) {
      return parsed;
    }

    const simpleOptions = readDiseaseOptions();
    const fromSimpleOptions = simpleOptions.map((name) => ({
      id: `custom-${name}`,
      name,
      category: "أخرى",
      defaultSpecialist: "",
      organization: "كل الجمعيات",
      organizationId: null,
      doctorId: null,
      priority: "متوسط" as PriorityLevel,
      status: "نشط" as DiseaseStatus,
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const merged = [...defaultDiseases, ...fromSimpleOptions].filter(
      (item, index, array) =>
        array.findIndex((current) => current.name === item.name) === index
    );

    return merged;
  } catch {
    return defaultDiseases;
  }
}

function saveManagedDiseases(items: DiseaseItem[]) {
  const unique = items.filter(
    (item, index, array) =>
      array.findIndex((current) => current.name === item.name) === index
  );

  localStorage.setItem(DISEASE_MANAGEMENT_STORAGE_KEY, JSON.stringify(unique));
  saveDiseaseOptions(unique.filter((item) => item.status === "نشط").map((item) => item.name));
}

function getPriorityClass(priority: PriorityLevel) {
  if (priority === "مرتفع") return "bg-red-50 text-red-700 border-red-200";
  if (priority === "متوسط") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function getStatusClass(status: DiseaseStatus) {
  return status === "نشط"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-slate-100 text-slate-600";
}

export default function DiseasesManagement() {
  const [diseases, setDiseases] = useState<DiseaseItem[]>(() => readManagedDiseases());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDisease, setEditingDisease] = useState<DiseaseItem | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "أخرى",
    defaultSpecialist: "",
    organization: "كل الجمعيات",
    organizationId: "",
    doctorId: "",
    priority: "متوسط" as PriorityLevel,
    status: "نشط" as DiseaseStatus,
    notes: "",
  });

  const organizationsQuery = trpc.organizations.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const doctorsQuery = trpc.doctors.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const casesQuery = trpc.cases.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const organizations = ((organizationsQuery.data || []) as OrganizationItem[]);
  const doctors = ((doctorsQuery.data || []) as DoctorItem[]);
  const cases = ((casesQuery.data || []) as Record<string, any>[]);

  const stats = useMemo(() => {
    return {
      total: diseases.length,
      active: diseases.filter((item) => item.status === "نشط").length,
      highPriority: diseases.filter((item) => item.priority === "مرتفع").length,
      categories: new Set(diseases.map((item) => item.category)).size,
    };
  }, [diseases]);

  const filteredDiseases = diseases.filter((item) => {
    const searchableText = [
      item.name,
      item.category,
      item.defaultSpecialist,
      item.organization,
      item.priority,
      item.status,
      item.notes,
    ]
      .map((value) => safeText(value).toLowerCase())
      .join(" ");

    const matchesSearch = !search.trim() || searchableText.includes(search.trim().toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
  });

  const diseaseUsage = useMemo(() => {
    const map = new Map<string, number>();

    cases.forEach((caseItem) => {
      const disease = safeText(
        caseItem.disabilityType ||
          caseItem.disorderType ||
          caseItem.diagnosis ||
          "غير محدد"
      );

      if (!disease) return;
      map.set(disease, (map.get(disease) || 0) + 1);
    });

    return map;
  }, [cases]);

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingDisease(null);
    setForm({
      name: "",
      category: "أخرى",
      defaultSpecialist: "",
      organization: "كل الجمعيات",
      organizationId: "",
      doctorId: "",
      priority: "متوسط",
      status: "نشط",
      notes: "",
    });
  };

  const openCreateDialog = () => {
    setEditingDisease(null);
    setForm({
      name: "",
      category: "أخرى",
      defaultSpecialist: "",
      organization: "كل الجمعيات",
      organizationId: "",
      doctorId: "",
      priority: "متوسط",
      status: "نشط",
      notes: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (disease: DiseaseItem) => {
    setEditingDisease(disease);
    setForm({
      name: disease.name,
      category: disease.category,
      defaultSpecialist: disease.defaultSpecialist,
      organization: disease.organization,
      organizationId: disease.organizationId ? String(disease.organizationId) : "",
      doctorId: disease.doctorId ? String(disease.doctorId) : "",
      priority: disease.priority,
      status: disease.status,
      notes: disease.notes,
    });
    setIsDialogOpen(true);
  };

  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === form.doctorId);

  const handleDoctorChange = (doctorId: string) => {
    const doctor = doctors.find((item) => String(item.id) === doctorId);

    setForm((current) => ({
      ...current,
      doctorId: doctorId === "__none" ? "" : doctorId,
      defaultSpecialist: doctor?.specialty || current.defaultSpecialist,
      organizationId:
        doctor && doctor.organizationId
          ? String(doctor.organizationId)
          : current.organizationId,
    }));
  };

  const validateForm = () => {
    const name = safeText(form.name);

    if (!name) {
      toast.error("اسم المرض أو نوع الإعاقة مطلوب");
      return false;
    }

    const exists = diseases.some(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        item.id !== editingDisease?.id
    );

    if (exists) {
      toast.error("هذا المرض أو نوع الإعاقة موجود مسبقًا");
      return false;
    }

    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const organization = organizations.find(
      (item) => String(item.id) === form.organizationId
    );

    const item: DiseaseItem = {
      id: editingDisease?.id || `disease-${Date.now()}`,
      name: safeText(form.name),
      category: form.category,
      defaultSpecialist:
        safeText(form.defaultSpecialist) || selectedDoctor?.specialty || "",
      organization: organization?.name || form.organization || "كل الجمعيات",
      organizationId: form.organizationId ? Number(form.organizationId) : null,
      doctorId: form.doctorId ? Number(form.doctorId) : null,
      priority: form.priority,
      status: form.status,
      notes: safeText(form.notes),
      createdAt: editingDisease?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const next = editingDisease
      ? diseases.map((current) => (current.id === editingDisease.id ? item : current))
      : [item, ...diseases];

    setDiseases(next);
    saveManagedDiseases(next);

    toast.success(editingDisease ? "تم تعديل المرض" : "تم إضافة المرض");
    closeDialog();
  };

  const handleDelete = (disease: DiseaseItem) => {
    const usageCount = diseaseUsage.get(disease.name) || 0;

    if (usageCount > 0) {
      const confirmed = confirm(
        `هذا المرض مستخدم في ${usageCount} حالة. الأفضل إيقافه بدل حذفه. هل تريدين حذفه فعلاً؟`
      );
      if (!confirmed) return;
    } else {
      const confirmed = confirm(`هل أنت متأكدة من حذف: ${disease.name}؟`);
      if (!confirmed) return;
    }

    const next = diseases.filter((item) => item.id !== disease.id);
    setDiseases(next);
    saveManagedDiseases(next);
    toast.success("تم حذف المرض من القائمة");
  };

  const toggleStatus = (disease: DiseaseItem) => {
    const nextStatus: DiseaseStatus = disease.status === "نشط" ? "موقوف" : "نشط";

    const next = diseases.map((item) =>
      item.id === disease.id
        ? {
            ...item,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          }
        : item
    );

    setDiseases(next);
    saveManagedDiseases(next);
    toast.success(nextStatus === "نشط" ? "تم تفعيل المرض" : "تم إيقاف المرض");
  };

  const downloadTemplate = () => {
    const rows = [
      {
        "اسم المرض / الإعاقة": "اضطراب طيف التوحد",
        التصنيف: "نمائي",
        "المختص الافتراضي": "طبيب نمو وسلوك + أخصائي تعديل سلوك",
        الجمعية: "كل الجمعيات",
        الأولوية: "مرتفع",
        الحالة: "نشط",
        ملاحظات: "مثال فقط",
      },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "الأمراض");
    XLSX.writeFile(workbook, "Anma_Diseases_Template.xlsx");
  };

  const exportDiseases = () => {
    const rows = diseases.map((item) => ({
      "اسم المرض / الإعاقة": item.name,
      التصنيف: item.category,
      "المختص الافتراضي": item.defaultSpecialist,
      الجمعية: item.organization,
      الأولوية: item.priority,
      الحالة: item.status,
      "عدد الحالات": diseaseUsage.get(item.name) || 0,
      ملاحظات: item.notes,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "الأمراض");
    XLSX.writeFile(workbook, `Anma_Diseases_${Date.now()}.xlsx`);
  };

  const handleExcelUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheet = workbook.Sheets["الأمراض"] || workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
      });

      if (!rows.length) {
        toast.error("ملف Excel فارغ");
        return;
      }

      const imported: DiseaseItem[] = rows
        .map((row) => {
          const name = safeText(
            row["اسم المرض / الإعاقة"] ||
              row["اسم المرض"] ||
              row["نوع الإعاقة"] ||
              row.name
          );

          if (!name) return null;

          return {
            id: `imported-${Date.now()}-${Math.random()}`,
            name,
            category: safeText(row["التصنيف"] || row.category || "أخرى") || "أخرى",
            defaultSpecialist: safeText(row["المختص الافتراضي"] || row.defaultSpecialist),
            organization: safeText(row["الجمعية"] || row.organization || "كل الجمعيات") || "كل الجمعيات",
            organizationId: null,
            doctorId: null,
            priority: (safeText(row["الأولوية"] || row.priority || "متوسط") as PriorityLevel) || "متوسط",
            status: (safeText(row["الحالة"] || row.status || "نشط") as DiseaseStatus) || "نشط",
            notes: safeText(row["ملاحظات"] || row.notes),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        })
        .filter(Boolean) as DiseaseItem[];

      const merged = [...imported, ...diseases].filter(
        (item, index, array) =>
          array.findIndex((current) => current.name === item.name) === index
      );

      setDiseases(merged);
      saveManagedDiseases(merged);
      toast.success(`تم استيراد ${imported.length} عنصر`);
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء قراءة ملف Excel");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900">
                إدارة الأمراض والإعاقات
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                قائمة مركزية للأمراض وأنواع الإعاقة. أي إضافة هنا تظهر تلقائيًا في إدارة الحالات، لوحة التحكم، المراقبة الذكية، والتقارير.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                id="diseasesExcelUpload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.[0]) {
                    void handleExcelUpload(event.target.files[0]);
                    event.target.value = "";
                  }
                }}
              />

              <Button variant="outline" onClick={downloadTemplate}>
                <FileSpreadsheet className="ml-2 h-4 w-4" />
                قالب Excel
              </Button>

              <Button
                variant="outline"
                onClick={() => document.getElementById("diseasesExcelUpload")?.click()}
              >
                <Upload className="ml-2 h-4 w-4" />
                استيراد
              </Button>

              <Button variant="outline" onClick={exportDiseases}>
                <Download className="ml-2 h-4 w-4" />
                تصدير
              </Button>

              <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : closeDialog())}>
                <DialogTrigger asChild>
                  <Button
                    onClick={openCreateDialog}
                    className="bg-orange-600 text-white hover:bg-orange-700"
                  >
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة مرض
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingDisease ? "تعديل مرض / إعاقة" : "إضافة مرض / إعاقة"}
                    </DialogTitle>
                    <DialogDescription>
                      يتم استخدام هذه القائمة داخل إضافة وتعديل الحالات والتقارير.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          اسم المرض / نوع الإعاقة
                        </label>
                        <Input
                          value={form.name}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder="مثال: اضطراب طيف التوحد"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          التصنيف
                        </label>
                        <Select
                          value={form.category}
                          onValueChange={(value) =>
                            setForm((current) => ({ ...current, category: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          المختص الافتراضي
                        </label>
                        <Input
                          value={form.defaultSpecialist}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              defaultSpecialist: event.target.value,
                            }))
                          }
                          placeholder="مثال: أخصائي نطق وتخاطب"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          ربط بمختص موجود
                        </label>
                        <Select
                          value={form.doctorId || "__none"}
                          onValueChange={handleDoctorChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختاري مختص" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">غير محدد</SelectItem>
                            {doctors.map((doctor) => (
                              <SelectItem key={doctor.id} value={String(doctor.id)}>
                                {doctor.name}
                                {doctor.specialty ? ` - ${doctor.specialty}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          الجمعية المرتبطة
                        </label>
                        <Select
                          value={form.organizationId || "__all"}
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              organizationId: value === "__all" ? "" : value,
                              organization:
                                value === "__all"
                                  ? "كل الجمعيات"
                                  : organizations.find((item) => String(item.id) === value)?.name ||
                                    "كل الجمعيات",
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all">كل الجمعيات</SelectItem>
                            {organizations.map((organization) => (
                              <SelectItem key={organization.id} value={String(organization.id)}>
                                {organization.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          الأولوية
                        </label>
                        <Select
                          value={form.priority}
                          onValueChange={(value: PriorityLevel) =>
                            setForm((current) => ({ ...current, priority: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="منخفض">منخفض</SelectItem>
                            <SelectItem value="متوسط">متوسط</SelectItem>
                            <SelectItem value="مرتفع">مرتفع</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          الحالة
                        </label>
                        <Select
                          value={form.status}
                          onValueChange={(value: DiseaseStatus) =>
                            setForm((current) => ({ ...current, status: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="نشط">نشط</SelectItem>
                            <SelectItem value="موقوف">موقوف</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold">
                        ملاحظات
                      </label>
                      <textarea
                        value={form.notes}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, notes: event.target.value }))
                        }
                        placeholder="ملاحظات أو بروتوكول متابعة مختصر..."
                        className="min-h-[110px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm leading-7 text-orange-800">
                      عند الحفظ يتم تحديث قائمة الأمراض في إدارة الحالات والداشبورد والمراقبة الذكية تلقائيًا.
                    </div>

                    <Button
                      onClick={handleSubmit}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                    >
                      {editingDisease ? "حفظ التعديلات" : "إضافة المرض"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <Activity className="mb-3 h-5 w-5 text-orange-600" />
              <p className="text-sm text-slate-500">إجمالي العناصر</p>
              <p className="mt-2 text-3xl font-extrabold">{stats.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <Activity className="mb-3 h-5 w-5 text-emerald-600" />
              <p className="text-sm text-slate-500">نشطة</p>
              <p className="mt-2 text-3xl font-extrabold">{stats.active}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <Activity className="mb-3 h-5 w-5 text-red-600" />
              <p className="text-sm text-slate-500">أولوية مرتفعة</p>
              <p className="mt-2 text-3xl font-extrabold">{stats.highPriority}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <Activity className="mb-3 h-5 w-5 text-purple-600" />
              <p className="text-sm text-slate-500">التصنيفات</p>
              <p className="mt-2 text-3xl font-extrabold">{stats.categories}</p>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Search className="h-4 w-4 text-orange-600" />
            البحث والفلترة
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحثي باسم المرض، التصنيف، المختص..."
                className="pr-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الأولوية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأولويات</SelectItem>
                <SelectItem value="مرتفع">مرتفع</SelectItem>
                <SelectItem value="متوسط">متوسط</SelectItem>
                <SelectItem value="منخفض">منخفض</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="نشط">نشط</SelectItem>
                <SelectItem value="موقوف">موقوف</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-500">
                  <th className="px-5 py-4 text-right">المرض / الإعاقة</th>
                  <th className="px-5 py-4 text-right">التصنيف</th>
                  <th className="px-5 py-4 text-right">المختص الافتراضي</th>
                  <th className="px-5 py-4 text-right">الجمعية</th>
                  <th className="px-5 py-4 text-right">الأولوية</th>
                  <th className="px-5 py-4 text-right">الحالة</th>
                  <th className="px-5 py-4 text-right">عدد الحالات</th>
                  <th className="px-5 py-4 text-right">ملاحظات</th>
                  <th className="px-5 py-4 text-right">الإجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filteredDiseases.map((disease) => {
                  const usageCount = diseaseUsage.get(disease.name) || 0;

                  return (
                    <tr
                      key={disease.id}
                      className="border-b last:border-b-0 hover:bg-orange-50/40"
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{disease.name}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          آخر تحديث: {new Date(disease.updatedAt).toLocaleDateString("ar-SA")}
                        </div>
                      </td>

                      <td className="px-5 py-4">{disease.category}</td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-slate-400" />
                          {disease.defaultSpecialist || "-"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          {disease.organization || "كل الجمعيات"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getPriorityClass(disease.priority)}`}>
                          {disease.priority}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => toggleStatus(disease)}
                          className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(disease.status)}`}
                        >
                          {disease.status}
                        </button>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {usageCount} حالة
                        </span>
                      </td>

                      <td className="max-w-[260px] truncate px-5 py-4 text-slate-500">
                        {disease.notes || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-600 hover:text-orange-700"
                            onClick={() => openEditDialog(disease)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(disease)}
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

            {!filteredDiseases.length && (
              <div className="py-10 text-center text-sm text-slate-500">
                لا توجد نتائج مطابقة للفلاتر الحالية.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
