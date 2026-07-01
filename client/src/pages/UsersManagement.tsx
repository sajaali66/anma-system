import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  ShieldCheck,
  UserCog,
  Building2,
  Stethoscope,
  Mail,
  KeyRound,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
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

type UserRole =
  | "super_admin"
  | "admin"
  | "organization"
  | "doctor"
  | "case_manager";

type UserStatus = "نشط" | "موقوف";

type UserItem = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  organizationId?: number | null;
  doctorId?: number | null;
  status: UserStatus;
  createdAt?: string | Date;
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

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId: number | null;
  doctorId: number | null;
  status: UserStatus;
};

const defaultForm: UserFormState = {
  name: "",
  email: "",
  password: "",
  role: "case_manager",
  organizationId: null,
  doctorId: null,
  status: "نشط",
};

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  organization: "جمعية",
  doctor: "مختص",
  case_manager: "مشرف حالات",
};

const roleDescriptions: Record<UserRole, string> = {
  super_admin: "صلاحية كاملة للحساب الرئيسي فقط.",
  admin: "إدارة كاملة للمنصة بدون حذف الحساب الرئيسي.",
  case_manager: "إدارة الحالات والجلسات والتقارير.",
  organization: "يشاهد حالات الجمعية المرتبطة فقط.",
  doctor: "يشاهد الحالات المرتبطة بالمختص فقط.",
};

function getRoleBadge(role: UserRole) {
  if (role === "super_admin") return "bg-purple-50 text-purple-700 border-purple-100";
  if (role === "admin") return "bg-orange-50 text-orange-700 border-orange-100";
  if (role === "organization") return "bg-blue-50 text-blue-700 border-blue-100";
  if (role === "doctor") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getCurrentLocalUser(): Partial<UserItem> | null {
  try {
    const raw = localStorage.getItem("anma_demo_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function generateTemporaryPassword() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `Anma@${random}`;
}

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function UsersManagement() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserFormState>(defaultForm);

  const currentUser = getCurrentLocalUser();

  const usersQuery = trpc.users.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const organizationsQuery = trpc.organizations.list.useQuery(undefined, {
    refetchInterval: 8000,
  });

  const doctorsQuery = trpc.doctors.list.useQuery(undefined, {
    refetchInterval: 8000,
  });

  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم بنجاح");
      void usersQuery.refetch();
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء إنشاء المستخدم");
    },
  });

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل المستخدم بنجاح");
      void usersQuery.refetch();
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء تعديل المستخدم");
    },
  });

  const deleteUserMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المستخدم");
      void usersQuery.refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "لا يمكن حذف المستخدم");
    },
  });

  const users = (usersQuery.data || []) as UserItem[];
  const organizations = (organizationsQuery.data || []) as OrganizationItem[];
  const doctors = (doctorsQuery.data || []) as DoctorItem[];

  const filteredDoctors = useMemo(() => {
    if (!form.organizationId) return doctors;
    return doctors.filter(
      (doctor) =>
        !doctor.organizationId ||
        Number(doctor.organizationId) === Number(form.organizationId)
    );
  }, [doctors, form.organizationId]);

  const filteredUsers = useMemo(() => {
    const value = search.trim().toLowerCase();

    return users.filter((user) => {
      const organization = organizations.find(
        (item) => Number(item.id) === Number(user.organizationId)
      );

      const doctor = doctors.find(
        (item) => Number(item.id) === Number(user.doctorId)
      );

      const matchesSearch =
        !value ||
        [
          user.name,
          user.email,
          roleLabels[user.role],
          user.status,
          organization?.name,
          doctor?.name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(value);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter, organizations, doctors]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((user) => user.status === "نشط").length,
      suspended: users.filter((user) => user.status === "موقوف").length,
      admins: users.filter((user) => user.role === "admin" || user.role === "super_admin").length,
      doctors: users.filter((user) => user.role === "doctor").length,
      organizations: users.filter((user) => user.role === "organization").length,
    };
  }, [users]);

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: UserItem) => {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "case_manager",
      organizationId: user.organizationId ?? null,
      doctorId: user.doctorId ?? null,
      status: user.status || "نشط",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setForm(defaultForm);
  };

  const updateForm = <K extends keyof UserFormState>(
    key: K,
    value: UserFormState[K]
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleRoleChange = (role: UserRole) => {
    setForm((current) => ({
      ...current,
      role,
      organizationId:
        role === "organization" || role === "doctor"
          ? current.organizationId
          : null,
      doctorId: role === "doctor" ? current.doctorId : null,
    }));
  };

  const handleSubmit = () => {
    const name = form.name.trim();
    const email = normalizeEmail(form.email);
    const password = form.password.trim();

    if (!name) {
      toast.error("اسم المستخدم مطلوب");
      return;
    }

    if (!email) {
      toast.error("البريد الإلكتروني مطلوب");
      return;
    }

    if (!email.includes("@")) {
      toast.error("صيغة البريد الإلكتروني غير صحيحة");
      return;
    }

    if (!editingUser && password.length < 4) {
      toast.error("كلمة المرور يجب ألا تقل عن 4 خانات");
      return;
    }

    const duplicateEmail = users.some(
      (user) =>
        normalizeEmail(user.email) === email &&
        Number(user.id) !== Number(editingUser?.id)
    );

    if (duplicateEmail) {
      toast.error("هذا البريد مستخدم مسبقًا");
      return;
    }

    if (form.role === "organization" && !form.organizationId) {
      toast.error("اختاري الجمعية المرتبطة بالمستخدم");
      return;
    }

    if (form.role === "doctor" && !form.doctorId) {
      toast.error("اختاري المختص المرتبط بالمستخدم");
      return;
    }

    const selectedDoctor = doctors.find(
      (doctor) => Number(doctor.id) === Number(form.doctorId)
    );

    const payload = {
      name,
      email,
      role: form.role,
      organizationId:
        form.role === "organization" || form.role === "doctor"
          ? form.organizationId ?? selectedDoctor?.organizationId ?? null
          : null,
      doctorId: form.role === "doctor" ? form.doctorId : null,
      status: form.status,
    };

    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        data: {
          ...payload,
          ...(password ? { password } : {}),
        },
      });
      return;
    }

    createUserMutation.mutate({
      ...payload,
      password,
    });
  };

  const handleDelete = (user: UserItem) => {
    if (user.id === 1 || user.role === "super_admin") {
      toast.error("لا يمكن حذف الحساب الرئيسي");
      return;
    }

    if (currentUser?.email && normalizeEmail(currentUser.email || "") === normalizeEmail(user.email)) {
      toast.error("لا يمكنك حذف حسابك الحالي");
      return;
    }

    const confirmed = confirm(`هل أنتِ متأكدة من حذف المستخدم ${user.name}؟`);
    if (!confirmed) return;

    deleteUserMutation.mutate({ id: user.id });
  };

  const toggleStatus = (user: UserItem) => {
    if (user.id === 1 || user.role === "super_admin") {
      toast.error("لا يمكن إيقاف الحساب الرئيسي");
      return;
    }

    updateUserMutation.mutate({
      id: user.id,
      data: {
        status: user.status === "نشط" ? "موقوف" : "نشط",
      },
    });
  };

  const handleResetPassword = async (user: UserItem) => {
    if (user.id === 1 || user.role === "super_admin") {
      toast.error("لا يمكن إعادة تعيين كلمة مرور الحساب الرئيسي من هنا");
      return;
    }

    if (currentUser?.email && normalizeEmail(currentUser.email || "") === normalizeEmail(user.email)) {
      toast.error("لا يمكنك إعادة تعيين كلمة مرور حسابك الحالي من هنا");
      return;
    }

    const confirmed = confirm(`إعادة تعيين كلمة المرور للمستخدم ${user.name}؟`);
    if (!confirmed) return;

    const temporaryPassword = generateTemporaryPassword();
    const copied = await copyToClipboard(temporaryPassword);

    updateUserMutation.mutate({
      id: user.id,
      data: {
        password: temporaryPassword,
      },
    });

    if (copied) {
      toast.success(`تم نسخ كلمة المرور المؤقتة: ${temporaryPassword}`);
    } else {
      toast.success(`كلمة المرور المؤقتة: ${temporaryPassword}`);
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              <ShieldCheck className="h-4 w-4" />
              Access Control
            </div>

            <h1 className="text-2xl font-black text-slate-900">
              إدارة المستخدمين
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              إدارة الحسابات والصلاحيات وربط المستخدمين بالجمعيات والمختصين.
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={openCreateDialog}
                className="h-11 rounded-2xl bg-orange-600 px-5 font-bold text-white hover:bg-orange-700"
              >
                <Plus className="ml-2 h-4 w-4" />
                مستخدم جديد
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">
                  {editingUser ? "تعديل مستخدم" : "إضافة مستخدم جديد"}
                </DialogTitle>
                <DialogDescription>
                  حددي الدور ونطاق الوصول المناسب للمستخدم.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm leading-7 text-orange-800">
                الحسابات يتم إنشاؤها من الإدارة فقط للحفاظ على خصوصية بيانات الحالات.
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">الاسم</label>
                  <Input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="مثال: سارة الأحمد"
                    className="rounded-2xl bg-slate-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">البريد الإلكتروني</label>
                  <Input
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    placeholder="user@anma.sa"
                    className="rounded-2xl bg-slate-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    كلمة المرور{" "}
                    {editingUser && (
                      <span className="text-xs font-normal text-slate-400">
                        (اتركيها فارغة إذا لا تريدين تغييرها)
                      </span>
                    )}
                  </label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => updateForm("password", event.target.value)}
                    placeholder="••••••"
                    className="rounded-2xl bg-slate-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">الدور</label>
                  <select
                    value={form.role}
                    onChange={(event) => handleRoleChange(event.target.value as UserRole)}
                    className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  >
                    <option value="admin">Admin</option>
                    <option value="case_manager">مشرف حالات</option>
                    <option value="organization">جمعية</option>
                    <option value="doctor">مختص</option>
                    <option value="super_admin">Super Admin</option>
                  </select>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {roleDescriptions[form.role]}
                  </p>
                </div>

                {(form.role === "organization" || form.role === "doctor") && (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">الجمعية</label>
                    <select
                      value={form.organizationId ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "organizationId",
                          event.target.value ? Number(event.target.value) : null
                        )
                      }
                      className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                    >
                      <option value="">اختاري الجمعية</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {form.role === "doctor" && (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">المختص</label>
                    <select
                      value={form.doctorId ?? ""}
                      onChange={(event) => {
                        const doctorId = event.target.value ? Number(event.target.value) : null;
                        const selectedDoctor = doctors.find(
                          (doctor) => Number(doctor.id) === Number(doctorId)
                        );

                        setForm((current) => ({
                          ...current,
                          doctorId,
                          organizationId:
                            current.organizationId ?? selectedDoctor?.organizationId ?? null,
                        }));
                      }}
                      className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                    >
                      <option value="">اختاري المختص</option>
                      {filteredDoctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name}
                          {doctor.specialty ? ` - ${doctor.specialty}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">حالة الحساب</label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value as UserStatus)
                    }
                    className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  >
                    <option value="نشط">نشط</option>
                    <option value="موقوف">موقوف</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" className="rounded-2xl" onClick={closeDialog}>
                  إلغاء
                </Button>

                <Button
                  onClick={handleSubmit}
                  className="rounded-2xl bg-orange-600 text-white hover:bg-orange-700"
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                >
                  {editingUser ? "حفظ التعديل" : "إنشاء المستخدم"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { title: "المستخدمين", value: stats.total, tone: "bg-white text-slate-900", icon: Users },
          { title: "نشط", value: stats.active, tone: "bg-emerald-50 text-emerald-700", icon: ShieldCheck },
          { title: "إدارة", value: stats.admins, tone: "bg-orange-50 text-orange-700", icon: UserCog },
          { title: "جمعيات", value: stats.organizations, tone: "bg-blue-50 text-blue-700", icon: Building2 },
          { title: "مختصين", value: stats.doctors, tone: "bg-emerald-50 text-emerald-700", icon: Stethoscope },
          { title: "موقوف", value: stats.suspended, tone: "bg-red-50 text-red-700", icon: KeyRound },
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

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-900">الصلاحيات</h2>
          <p className="mt-1 text-xs text-slate-500">
            الأدوار المعتمدة لتحديد الصفحات والبيانات المتاحة لكل مستخدم.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {Object.entries(roleDescriptions).map(([role, description]) => (
            <div key={role} className="rounded-2xl border bg-slate-50 p-4">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getRoleBadge(role as UserRole)}`}>
                {roleLabels[role as UserRole]}
              </span>
              <p className="mt-3 line-clamp-2 text-xs leading-6 text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">قائمة المستخدمين</h2>
            <p className="mt-1 text-xs text-slate-500">
              بحث وتصفية وتعديل الحسابات الداخلية.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 md:w-auto md:grid-cols-3">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="بحث..."
                className="rounded-2xl bg-slate-50 pr-10"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as "all" | UserRole)}
              className="rounded-2xl border bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400"
            >
              <option value="all">كل الأدوار</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="case_manager">مشرف حالات</option>
              <option value="organization">جمعية</option>
              <option value="doctor">مختص</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | UserStatus)}
              className="rounded-2xl border bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400"
            >
              <option value="all">كل الحالات</option>
              <option value="نشط">نشط</option>
              <option value="موقوف">موقوف</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-3 text-right">المستخدم</th>
                <th className="px-4 py-3 text-right">الدور</th>
                <th className="px-4 py-3 text-right">نطاق الوصول</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-right">آخر دخول</th>
                <th className="px-4 py-3 text-right">الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => {
                const organization = organizations.find(
                  (item) => Number(item.id) === Number(user.organizationId)
                );

                const doctor = doctors.find(
                  (item) => Number(item.id) === Number(user.doctorId)
                );

                const accessScope =
                  user.role === "organization"
                    ? organization?.name || "جمعية غير محددة"
                    : user.role === "doctor"
                    ? doctor?.name || "مختص غير محدد"
                    : user.role === "case_manager"
                    ? "الحالات والجلسات والتقارير"
                    : "كل المنصة";

                const initials = user.name
                  ?.split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("") || "م";

                return (
                  <tr key={user.id} className="border-b last:border-b-0 hover:bg-orange-50/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-sm font-black text-orange-700">
                          {initials}
                        </div>

                        <div>
                          <div className="font-black text-slate-900">{user.name}</div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                            <Mail className="h-3.5 w-3.5" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getRoleBadge(user.role)}`}>
                        {roleLabels[user.role]}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-700">{accessScope}</div>
                      {user.role === "doctor" && organization?.name && (
                        <div className="text-xs text-slate-400">
                          الجمعية: {organization.name}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          user.status === "نشط"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString("ar-SA") : "غير مسجل"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-orange-600"
                          onClick={() => openEditDialog(user)}
                        >
                          <Pencil className="ml-1 h-4 w-4" />
                          تعديل
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className={`rounded-xl ${user.status === "نشط" ? "text-amber-600" : "text-emerald-600"}`}
                          onClick={() => toggleStatus(user)}
                          disabled={updateUserMutation.isPending || user.id === 1 || user.role === "super_admin"}
                        >
                          {user.status === "نشط" ? "إيقاف" : "تفعيل"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-blue-600"
                          onClick={() => void handleResetPassword(user)}
                          disabled={updateUserMutation.isPending || user.id === 1 || user.role === "super_admin"}
                        >
                          <KeyRound className="ml-1 h-4 w-4" />
                          كلمة مرور
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(user)}
                          disabled={deleteUserMutation.isPending || user.id === 1 || user.role === "super_admin"}
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

          {!filteredUsers.length && (
            <div className="py-10 text-center text-sm text-slate-500">
              لا توجد حسابات مطابقة للبحث.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
