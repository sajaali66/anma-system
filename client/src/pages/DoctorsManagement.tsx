import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Stethoscope,
  Mail,
  Phone,
  Users,
  Save,
  X,
  Wallet,
  Clock3,
  BadgeCheck,
  Brain,
  Building2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

type DoctorLevel = "استشاري" | "أخصائي أول" | "أخصائي" | "نائب";
type ServiceType =
  | "نمو وسلوك"
  | "نطق وتخاطب"
  | "علاج وظيفي"
  | "علاج طبيعي"
  | "نفسي"
  | "تعديل سلوك"
  | "تربية خاصة"
  | "صعوبات تعلم"
  | "أخرى";

type Doctor = {
  id: number;
  name: string;
  specialty: string;
  phone?: string;
  email?: string;
  organization?: string;
  organizationId?: number | null;
  casesCount?: number;
  sessionsCount?: number;
  status?: string;
  level?: DoctorLevel;
  serviceType?: ServiceType;
  evaluationPrice?: number | string;
  sessionPrice?: number | string;
  sessionDuration?: number | string;
  notes?: string;
};

type Organization = {
  id: number;
  name: string;
};

type DoctorForm = {
  name: string;
  specialty: string;
  level: DoctorLevel;
  serviceType: ServiceType;
  evaluationPrice: string;
  sessionPrice: string;
  sessionDuration: string;
  phone: string;
  email: string;
  organizationId: string;
  organization: string;
  status: string;
  notes: string;
};

const levelOptions: DoctorLevel[] = ["استشاري", "أخصائي أول", "أخصائي", "نائب"];
const serviceTypeOptions: ServiceType[] = [
  "نمو وسلوك",
  "نطق وتخاطب",
  "علاج وظيفي",
  "علاج طبيعي",
  "نفسي",
  "تعديل سلوك",
  "تربية خاصة",
  "صعوبات تعلم",
  "أخرى",
];

const emptyForm: DoctorForm = {
  name: "",
  specialty: "",
  level: "أخصائي",
  serviceType: "أخرى",
  evaluationPrice: "",
  sessionPrice: "",
  sessionDuration: "45",
  phone: "",
  email: "",
  organizationId: "",
  organization: "",
  status: "نشط",
  notes: "",
};

function getNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getPriceLabel(value?: number | string) {
  const n = getNumber(value);
  return n > 0 ? `${n.toLocaleString("ar-SA")} ريال` : "غير محدد";
}

function getLevelBadge(level?: string) {
  if (level === "استشاري") return "bg-purple-50 text-purple-700 border-purple-100";
  if (level === "أخصائي أول") return "bg-blue-50 text-blue-700 border-blue-100";
  if (level === "أخصائي") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getSuggestedPricing(level: DoctorLevel) {
  if (level === "استشاري") return { evaluationPrice: "600", sessionPrice: "400" };
  if (level === "أخصائي أول") return { evaluationPrice: "450", sessionPrice: "300" };
  if (level === "أخصائي") return { evaluationPrice: "300", sessionPrice: "220" };
  return { evaluationPrice: "250", sessionPrice: "180" };
}

function getSmartFundingExample(sessionPrice?: number | string) {
  const price = getNumber(sessionPrice);
  if (!price) return "أضيفي سعر الجلسة لحساب التمويل الذكي";
  return `8 جلسات × ${price.toLocaleString("ar-SA")} = ${(price * 8).toLocaleString("ar-SA")} ريال`;
}

export default function DoctorsManagement() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [form, setForm] = useState<DoctorForm>(emptyForm);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [showForm, setShowForm] = useState(false);

  const doctorsQuery = trpc.doctors.list.useQuery();
  const organizationsQuery = trpc.organizations.list.useQuery(undefined, {
    refetchInterval: 8000,
  });

  const doctors = (doctorsQuery.data || []) as Doctor[];
  const organizations = (organizationsQuery.data || []) as Organization[];

  const createDoctor = trpc.doctors.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المختص بنجاح");
      void doctorsQuery.refetch();
      setForm(emptyForm);
      setShowForm(false);
    },
    onError: (error: any) => toast.error(error.message || "حدث خطأ أثناء إضافة المختص"),
  });

  const updateDoctor = trpc.doctors.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل المختص بنجاح");
      void doctorsQuery.refetch();
      setForm(emptyForm);
      setEditingDoctor(null);
      setShowForm(false);
    },
    onError: (error: any) => toast.error(error.message || "حدث خطأ أثناء تعديل المختص"),
  });

  const deleteDoctor = trpc.doctors.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المختص بنجاح");
      void doctorsQuery.refetch();
    },
    onError: (error: any) => toast.error(error.message || "حدث خطأ أثناء حذف المختص"),
  });

  const filteredDoctors = doctors.filter((doctor) => {
    const searchText = search.trim().toLowerCase();
    const searchable = [
      doctor.name,
      doctor.specialty,
      doctor.phone,
      doctor.email,
      doctor.organization,
      doctor.level,
      doctor.serviceType,
      doctor.status,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchText || searchable.includes(searchText);
    const matchesLevel = levelFilter === "all" || doctor.level === levelFilter;
    const matchesService = serviceFilter === "all" || doctor.serviceType === serviceFilter;

    return matchesSearch && matchesLevel && matchesService;
  });

  const totalCases = useMemo(
    () => doctors.reduce((sum, doctor) => sum + Number(doctor.casesCount || 0), 0),
    [doctors]
  );

  const totalSessions = useMemo(
    () => doctors.reduce((sum, doctor) => sum + Number(doctor.sessionsCount || 0), 0),
    [doctors]
  );

  const activeDoctors = doctors.filter((doctor) => doctor.status !== "موقوف").length;
  const consultantsCount = doctors.filter((doctor) => doctor.level === "استشاري").length;

  const averageSessionPrice = useMemo(() => {
    const prices = doctors.map((doctor) => getNumber(doctor.sessionPrice)).filter((price) => price > 0);
    if (!prices.length) return 0;
    return Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);
  }, [doctors]);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("اسم المختص مطلوب");
      return;
    }

    if (!form.specialty.trim()) {
      toast.error("التخصص مطلوب");
      return;
    }

    if (!form.sessionPrice.trim()) {
      toast.error("سعر الجلسة مطلوب لحساب التمويل الذكي");
      return;
    }

    const selectedOrganization = organizations.find(
      (organization) => String(organization.id) === form.organizationId
    );

    const payload = {
      name: form.name.trim(),
      specialty: form.specialty.trim(),
      level: form.level,
      serviceType: form.serviceType,
      evaluationPrice: getNumber(form.evaluationPrice),
      sessionPrice: getNumber(form.sessionPrice),
      sessionDuration: getNumber(form.sessionDuration) || 45,
      phone: form.phone.trim(),
      email: form.email.trim(),
      organizationId: form.organizationId ? Number(form.organizationId) : null,
      organization: selectedOrganization?.name || form.organization.trim() || "غير محدد",
      status: form.status,
      notes: form.notes.trim(),
    };

    if (editingDoctor) {
      updateDoctor.mutate({
        id: editingDoctor.id,
        data: payload,
      });
    } else {
      createDoctor.mutate(payload);
    }
  };

  const handleEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setForm({
      name: doctor.name || "",
      specialty: doctor.specialty || "",
      level: doctor.level || "أخصائي",
      serviceType: doctor.serviceType || "أخرى",
      evaluationPrice: doctor.evaluationPrice ? String(doctor.evaluationPrice) : "",
      sessionPrice: doctor.sessionPrice ? String(doctor.sessionPrice) : "",
      sessionDuration: doctor.sessionDuration ? String(doctor.sessionDuration) : "45",
      phone: doctor.phone || "",
      email: doctor.email || "",
      organizationId: doctor.organizationId ? String(doctor.organizationId) : "",
      organization: doctor.organization || "",
      status: doctor.status || "نشط",
      notes: doctor.notes || "",
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingDoctor(null);
    setForm(emptyForm);
  };

  const handleDelete = (doctor: Doctor) => {
    const confirmed = confirm(
      `هل أنتِ متأكدة من حذف المختص ${doctor.name}؟ سيتم فك ارتباطه من الحالات المرتبطة.`
    );

    if (!confirmed) return;

    deleteDoctor.mutate({ id: doctor.id });
  };

  const applySuggestedPricing = () => {
    const prices = getSuggestedPricing(form.level);
    setForm({
      ...form,
      evaluationPrice: prices.evaluationPrice,
      sessionPrice: prices.sessionPrice,
    });
    toast.success("تم تطبيق التسعير المقترح حسب التصنيف");
  };

  return (
    <div dir="rtl" className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              <Stethoscope className="h-4 w-4" />
              Specialist Network
            </div>

            <h1 className="text-2xl font-black text-slate-900">
              إدارة المختصين
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              إدارة المختصين والتسعير المستخدم في خطط الرعاية والتمويل.
            </p>
          </div>

          <button
            onClick={() => {
              setShowForm(true);
              setEditingDoctor(null);
              setForm(emptyForm);
            }}
            className="flex h-11 items-center gap-2 rounded-2xl bg-orange-600 px-5 font-bold text-white hover:bg-orange-700"
          >
            <Plus className="h-5 w-5" />
            مختص جديد
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[
          { title: "المختصين", value: doctors.length, tone: "bg-white text-slate-900", icon: Stethoscope },
          { title: "الحالات", value: totalCases, tone: "bg-blue-50 text-blue-700", icon: Users },
          { title: "النشطون", value: activeDoctors, tone: "bg-emerald-50 text-emerald-700", icon: BadgeCheck },
          { title: "استشاريون", value: consultantsCount, tone: "bg-purple-50 text-purple-700", icon: Brain },
          { title: "متوسط الجلسة", value: averageSessionPrice || 0, tone: "bg-amber-50 text-amber-700", icon: Wallet },
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

      <section className="rounded-3xl border border-orange-100 bg-orange-50/60 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <Brain className="h-5 w-5 text-orange-600" />
              التسعير الذكي
            </h2>

            <p className="mt-1 text-sm leading-7 text-slate-600">
              تُستخدم أسعار التقييم والجلسات لحساب الاحتياج التمويلي تلقائيًا داخل ملف الحالة.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-orange-700 shadow-sm">
            {getSmartFundingExample(averageSessionPrice)}
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {editingDoctor ? "تعديل مختص" : "إضافة مختص"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                أدخلي بيانات الخدمة والتسعير ونطاق العمل.
              </p>
            </div>

            <button
              onClick={handleCancel}
              className="rounded-xl bg-slate-50 p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              placeholder="اسم المختص"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            />

            <input
              placeholder="التخصص الدقيق"
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            />

            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value as DoctorLevel })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            >
              {levelOptions.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>

            <select
              value={form.serviceType}
              onChange={(e) => setForm({ ...form, serviceType: e.target.value as ServiceType })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            >
              {serviceTypeOptions.map((service) => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>

            <input
              type="number"
              placeholder="سعر التقييم"
              value={form.evaluationPrice}
              onChange={(e) => setForm({ ...form, evaluationPrice: e.target.value })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            />

            <input
              type="number"
              placeholder="سعر الجلسة"
              value={form.sessionPrice}
              onChange={(e) => setForm({ ...form, sessionPrice: e.target.value })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            />

            <input
              type="number"
              placeholder="مدة الجلسة بالدقائق"
              value={form.sessionDuration}
              onChange={(e) => setForm({ ...form, sessionDuration: e.target.value })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            />

            <input
              placeholder="رقم الجوال"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            />

            <input
              placeholder="البريد الإلكتروني"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            />

            <select
              value={form.organizationId}
              onChange={(e) => {
                const selected = organizations.find((org) => String(org.id) === e.target.value);
                setForm({
                  ...form,
                  organizationId: e.target.value,
                  organization: selected?.name || "",
                });
              }}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            >
              <option value="">كل الجمعيات / غير محدد</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
            >
              <option value="نشط">نشط</option>
              <option value="موقوف">موقوف</option>
            </select>

            <button
              type="button"
              onClick={applySuggestedPricing}
              className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 font-bold text-orange-700 hover:bg-orange-100"
            >
              تطبيق تسعير مقترح
            </button>

            <textarea
              placeholder="ملاحظات عن خبرة المختص أو نوع الحالات المناسبة له"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="min-h-[90px] rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400 md:col-span-3"
            />
          </div>

          <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
            <b>حساب تمويلي تقريبي:</b> {getSmartFundingExample(form.sessionPrice)}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={createDoctor.isPending || updateDoctor.isPending}
              className="flex items-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              <Save className="h-5 w-5" />
              {editingDoctor ? "حفظ التعديل" : "حفظ المختص"}
            </button>

            <button
              onClick={handleCancel}
              className="rounded-2xl border bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
            >
              إلغاء
            </button>
          </div>
        </section>
      )}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن مختص أو تخصص أو رقم جوال..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border bg-slate-50 px-4 py-3 pr-10 outline-none focus:border-orange-400"
            />
          </div>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
          >
            <option value="all">كل التصنيفات</option>
            {levelOptions.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="rounded-2xl border bg-slate-50 px-4 py-3 outline-none focus:border-orange-400"
          >
            <option value="all">كل الخدمات</option>
            {serviceTypeOptions.map((service) => (
              <option key={service} value={service}>{service}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">قائمة المختصين</h2>
            <p className="mt-1 text-xs text-slate-500">التخصص، التسعير، الحالات، والجلسات.</p>
          </div>
        </div>

        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-3 text-right">المختص</th>
                <th className="px-4 py-3 text-right">التصنيف</th>
                <th className="px-4 py-3 text-right">الخدمة</th>
                <th className="px-4 py-3 text-right">التسعير</th>
                <th className="px-4 py-3 text-right">الجمعية</th>
                <th className="px-4 py-3 text-right">الأداء</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-right">الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {doctorsQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    جاري تحميل المختصين...
                  </td>
                </tr>
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    لا توجد نتائج مطابقة
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doctor) => {
                  const initials =
                    doctor.name
                      ?.split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("") || "د";

                  const performanceScore = Math.min(
                    100,
                    Math.round(
                      (Number(doctor.casesCount || 0) * 8) +
                        (Number(doctor.sessionsCount || 0) * 3) +
                        (doctor.status === "نشط" ? 20 : 0)
                    )
                  );

                  return (
                    <tr key={doctor.id} className="border-b last:border-b-0 hover:bg-orange-50/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-sm font-black text-orange-700">
                            {initials}
                          </div>

                          <div>
                            <div className="font-black text-slate-900">{doctor.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{doctor.specialty}</div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {doctor.phone || "-"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5" />
                                {doctor.email || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getLevelBadge(doctor.level)}`}>
                          {doctor.level || "غير محدد"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                          {doctor.serviceType || "أخرى"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-amber-500" />
                            الجلسة: <b>{getPriceLabel(doctor.sessionPrice)}</b>
                          </div>
                          <div>التقييم: {getPriceLabel(doctor.evaluationPrice)}</div>
                          <div className="flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {doctor.sessionDuration || 45} دقيقة
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          {doctor.organization || "غير محدد"}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <div className="text-xs text-slate-500">
                            {doctor.casesCount || 0} حالة · {doctor.sessionsCount || 0} جلسة
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-orange-500"
                                style={{ width: `${performanceScore}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold">{performanceScore}%</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            doctor.status === "موقوف"
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {doctor.status || "نشط"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(doctor)}
                            className="rounded-xl bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(doctor)}
                            className="rounded-xl bg-red-50 p-2 text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
