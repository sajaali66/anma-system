import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  Clock,
  Filter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const sessionFormSchema = z.object({
  caseId: z.number().min(1, "الحالة مطلوبة"),
  sessionDate: z.date(),
  sessionType: z.string().min(1, "نوع الجلسة مطلوب"),
  attendance: z.enum(["حاضر", "غائب", "مؤجل"]),
  progress: z.enum(["تحسن", "ثابت", "تراجع"]),
  notes: z.string().optional(),
});

type SessionFormValues = z.infer<typeof sessionFormSchema>;

type CaseItem = {
  id: number;
  caseNumber: string;
  childName: string;
  organization: string;
};

type SessionItem = {
  id: number;
  caseId: number;
  sessionDate: string | Date;
  sessionType: string;
  attendance: "حاضر" | "غائب" | "مؤجل";
  progress: "تحسن" | "ثابت" | "تراجع";
  notes?: string | null;
};

const lightInputClass =
  "h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-sm placeholder:text-slate-400 focus:border-orange-500";

function notifyDashboardDataChanged() {
  window.dispatchEvent(new CustomEvent("anma-dashboard-data-updated"));
  window.dispatchEvent(new CustomEvent("anma-case-smart-sync-updated"));
}

function normalizeProgressByAttendance(
  attendance: SessionItem["attendance"],
  progress: SessionItem["progress"]
): SessionItem["progress"] {
  if (attendance === "غائب" || attendance === "مؤجل") return "ثابت";
  return progress || "ثابت";
}

function getAttendanceBadgeClass(attendance: SessionItem["attendance"]) {
  switch (attendance) {
    case "حاضر":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "غائب":
      return "bg-red-50 text-red-700 border-red-100";
    case "مؤجل":
      return "bg-orange-50 text-orange-700 border-orange-100";
    default:
      return "bg-slate-50 text-slate-700 border-slate-100";
  }
}

function getProgressBadgeClass(progress: SessionItem["progress"]) {
  switch (progress) {
    case "تحسن":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "ثابت":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "تراجع":
      return "bg-red-50 text-red-700 border-red-100";
    default:
      return "bg-slate-50 text-slate-700 border-slate-100";
  }
}

function SessionFields({
  form,
  cases,
}: {
  form: UseFormReturn<SessionFormValues>;
  cases: CaseItem[];
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="caseId"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>الحالة / الطفل</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(Number(value))}
                value={field.value ? String(field.value) : ""}
              >
                <FormControl>
                  <SelectTrigger className={lightInputClass}>
                    <SelectValue placeholder="اختاري الحالة" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-72 overflow-y-auto bg-white">
                  {cases.map((caseItem) => (
                    <SelectItem key={caseItem.id} value={String(caseItem.id)}>
                      {caseItem.childName} - {caseItem.caseNumber}
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
          name="sessionDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>تاريخ الجلسة</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  className={lightInputClass}
                  value={
                    field.value instanceof Date
                      ? field.value.toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => field.onChange(new Date(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sessionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>نوع الجلسة</FormLabel>
              <FormControl>
                <Input
                  placeholder="تخاطب / سلوكي / وظيفي"
                  className={lightInputClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="attendance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الحضور</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className={lightInputClass}>
                    <SelectValue placeholder="اختاري الحضور" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white">
                  <SelectItem value="حاضر">حاضر</SelectItem>
                  <SelectItem value="غائب">غائب</SelectItem>
                  <SelectItem value="مؤجل">مؤجل</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="progress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>التقدم</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className={lightInputClass}>
                    <SelectValue placeholder="اختاري مستوى التقدم" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white">
                  <SelectItem value="تحسن">تحسن</SelectItem>
                  <SelectItem value="ثابت">ثابت</SelectItem>
                  <SelectItem value="تراجع">تراجع</SelectItem>
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
            <FormLabel>ملاحظات الجلسة</FormLabel>
            <FormControl>
              <textarea
                placeholder="اكتبي ملاحظات المختص أو التوصيات بعد الجلسة..."
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-orange-500"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export default function SessionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(
    null
  );

  const casesQuery = trpc.cases.list.useQuery();
  const allCases = (casesQuery.data || []) as CaseItem[];

  const sessionsQueries = trpc.useQueries((t: any) =>
    allCases.map((caseItem) => t.sessions.getByCase({ caseId: caseItem.id }))
  );

  const sessionsData = useMemo(() => {
    const merged: SessionItem[] = [];
    sessionsQueries.forEach((query: any) => {
      if (query.data) merged.push(...(query.data as SessionItem[]));
    });

    return merged.sort(
      (a, b) =>
        new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
    );
  }, [sessionsQueries]);

  const casesMap = useMemo(() => {
    const map = new Map<number, CaseItem>();
    allCases.forEach((item) => map.set(item.id, item));
    return map;
  }, [allCases]);

  const availableOrganizations = useMemo(() => {
    const organizations = allCases
      .map((item) => item.organization)
      .filter(Boolean);
    return Array.from(new Set(organizations));
  }, [allCases]);

  const refetchAllSessions = () => {
    sessionsQueries.forEach((query: any) => void query.refetch());
  };

  const createForm = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: {
      caseId: 0,
      sessionDate: new Date(),
      sessionType: "",
      attendance: "حاضر",
      progress: "ثابت",
      notes: "",
    },
  });

  const editForm = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: {
      caseId: 0,
      sessionDate: new Date(),
      sessionType: "",
      attendance: "حاضر",
      progress: "ثابت",
      notes: "",
    },
  });

  const createSessionMutation = trpc.sessions.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الجلسة بنجاح");
      refetchAllSessions();
      void casesQuery.refetch();
      notifyDashboardDataChanged();
      setIsCreateDialogOpen(false);
      createForm.reset({
        caseId: 0,
        sessionDate: new Date(),
        sessionType: "",
        attendance: "حاضر",
        progress: "ثابت",
        notes: "",
      });
    },
    onError: (error: any) =>
      toast.error(error.message || "حدث خطأ في إضافة الجلسة"),
  });

  const updateSessionMutation = trpc.sessions.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الجلسة بنجاح");
      refetchAllSessions();
      void casesQuery.refetch();
      notifyDashboardDataChanged();
      setIsEditDialogOpen(false);
      setSelectedSession(null);
    },
    onError: (error: any) =>
      toast.error(error.message || "حدث خطأ في تعديل الجلسة"),
  });

  const deleteSessionMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الجلسة بنجاح");
      refetchAllSessions();
      void casesQuery.refetch();
      notifyDashboardDataChanged();
    },
    onError: (error: any) =>
      toast.error(error.message || "حدث خطأ في حذف الجلسة"),
  });

  const onCreateSubmit = (values: SessionFormValues) => {
    createSessionMutation.mutate({
      ...values,
      caseId: Number(values.caseId),
      sessionDate:
        values.sessionDate instanceof Date
          ? values.sessionDate
          : new Date(values.sessionDate),
      progress: normalizeProgressByAttendance(
        values.attendance,
        values.progress
      ),
      notes: values.notes?.trim() || "",
    });
  };

  const onEditSubmit = (values: SessionFormValues) => {
    if (!selectedSession) return;

    updateSessionMutation.mutate({
      id: selectedSession.id,
      data: {
        caseId: Number(values.caseId),
        sessionDate:
          values.sessionDate instanceof Date
            ? values.sessionDate
            : new Date(values.sessionDate),
        sessionType: values.sessionType,
        attendance: values.attendance,
        progress: normalizeProgressByAttendance(
          values.attendance,
          values.progress
        ),
        notes: values.notes?.trim() || "",
      },
    });
  };

  const handleEdit = (session: SessionItem) => {
    setSelectedSession(session);
    editForm.reset({
      caseId: session.caseId,
      sessionDate: new Date(session.sessionDate),
      sessionType: session.sessionType,
      attendance: session.attendance,
      progress: session.progress,
      notes: session.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (sessionId: number) => {
    const confirmed = confirm("هل أنتِ متأكدة من حذف الجلسة؟");
    if (!confirmed) return;
    deleteSessionMutation.mutate({ id: sessionId });
  };

  const filteredSessions = sessionsData.filter((session) => {
    const caseInfo = casesMap.get(session.caseId);

    const matchesSearch =
      searchTerm === "" ||
      caseInfo?.childName?.includes(searchTerm) ||
      caseInfo?.caseNumber?.includes(searchTerm) ||
      session.sessionType?.includes(searchTerm);

    const matchesAttendance =
      attendanceFilter === "all" || session.attendance === attendanceFilter;

    const matchesProgress =
      progressFilter === "all" || session.progress === progressFilter;

    const matchesOrganization =
      organizationFilter === "all" || caseInfo?.organization === organizationFilter;

    return (
      Boolean(matchesSearch) &&
      matchesAttendance &&
      matchesProgress &&
      matchesOrganization
    );
  });

  const todayCount = sessionsData.filter((session) => {
    const d = new Date(session.sessionDate);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const absentCount = sessionsData.filter((s) => s.attendance === "غائب").length;
  const postponedCount = sessionsData.filter(
    (s) => s.attendance === "مؤجل"
  ).length;
  const improvedCount = sessionsData.filter((s) => s.progress === "تحسن").length;

  const stats = [
    {
      title: "جلسات اليوم",
      value: todayCount,
      desc: "عدد الجلسات المجدولة اليوم",
      icon: CalendarDays,
      bg: "bg-orange-50",
      color: "text-orange-600",
    },
    {
      title: "إجمالي الغياب",
      value: absentCount,
      desc: "جلسات مسجلة كغياب",
      icon: CircleAlert,
      bg: "bg-red-50",
      color: "text-red-600",
    },
    {
      title: "الجلسات المؤجلة",
      value: postponedCount,
      desc: "تحتاج إعادة جدولة",
      icon: Clock,
      bg: "bg-amber-50",
      color: "text-amber-600",
    },
    {
      title: "جلسات بتحسن",
      value: improvedCount,
      desc: "الجلسات التي سجلت تحسن",
      icon: CircleCheck,
      bg: "bg-emerald-50",
      color: "text-emerald-600",
    },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            متابعة الجلسات
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            إدارة الجلسات ومتابعة الحضور والتقدم لكل حالة بشكل مرن
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 rounded-2xl bg-orange-600 px-6 font-bold text-white shadow-lg shadow-orange-100 hover:bg-orange-700">
              <Plus className="ml-2 h-5 w-5" />
              إضافة جلسة جديدة
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl rounded-3xl bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold">
                إضافة جلسة جديدة
              </DialogTitle>
              <DialogDescription>
                أدخلي بيانات الجلسة وسيتم تحديث الحالة والداشبورد تلقائيًا.
              </DialogDescription>
            </DialogHeader>

            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit(onCreateSubmit)}
                className="space-y-5"
              >
                <SessionFields form={createForm} cases={allCases} />

                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-orange-600 font-bold text-white hover:bg-orange-700"
                  disabled={createSessionMutation.isPending}
                >
                  {createSessionMutation.isPending
                    ? "جاري الإضافة..."
                    : "إضافة الجلسة"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">
              تعديل الجلسة
            </DialogTitle>
            <DialogDescription>
              عدلي بيانات الجلسة ثم احفظي التغييرات.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-5"
            >
              <SessionFields form={editForm} cases={allCases} />

              <Button
                type="submit"
                className="h-12 w-full rounded-2xl bg-orange-600 font-bold text-white hover:bg-orange-700"
                disabled={updateSessionMutation.isPending}
              >
                {updateSessionMutation.isPending
                  ? "جاري الحفظ..."
                  : "حفظ التعديلات"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.title}
              className="rounded-3xl border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.bg}`}
                  >
                    <Icon className={`h-6 w-6 ${item.color}`} />
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">
                      {item.title}
                    </p>
                    <p className={`mt-3 text-4xl font-extrabold ${item.color}`}>
                      {item.value}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{item.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-orange-50 p-2">
              <Filter className="h-5 w-5 text-orange-600" />
            </div>

            <div>
              <CardTitle className="text-lg font-extrabold text-slate-900">
                البحث والفلترة
              </CardTitle>
              <CardDescription>
                فلترة الجلسات حسب الحالة أو الحضور أو الجمعية
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="ابحثي باسم الطفل أو رقم الحالة..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 rounded-2xl bg-white pr-10"
              />
            </div>

            <Select value={attendanceFilter} onValueChange={setAttendanceFilter}>
              <SelectTrigger className="h-11 rounded-2xl bg-white">
                <SelectValue placeholder="كل الحضور" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">كل الحضور</SelectItem>
                <SelectItem value="حاضر">حاضر</SelectItem>
                <SelectItem value="غائب">غائب</SelectItem>
                <SelectItem value="مؤجل">مؤجل</SelectItem>
              </SelectContent>
            </Select>

            <Select value={progressFilter} onValueChange={setProgressFilter}>
              <SelectTrigger className="h-11 rounded-2xl bg-white">
                <SelectValue placeholder="كل التقدم" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">كل التقدم</SelectItem>
                <SelectItem value="تحسن">تحسن</SelectItem>
                <SelectItem value="ثابت">ثابت</SelectItem>
                <SelectItem value="تراجع">تراجع</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={organizationFilter}
              onValueChange={setOrganizationFilter}
            >
              <SelectTrigger className="h-11 rounded-2xl bg-white">
                <SelectValue placeholder="كل الجمعيات" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">كل الجمعيات</SelectItem>
                {availableOrganizations.map((org) => (
                  <SelectItem key={org} value={org}>
                    {org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-extrabold text-slate-900">
            قائمة الجلسات
          </CardTitle>
          <CardDescription>
            عدد الجلسات المطابقة: {filteredSessions.length}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-500">
                    <th className="px-4 py-4 text-right">التاريخ</th>
                    <th className="px-4 py-4 text-right">الحالة</th>
                    <th className="px-4 py-4 text-right">نوع الجلسة</th>
                    <th className="px-4 py-4 text-right">الحضور</th>
                    <th className="px-4 py-4 text-right">التقدم</th>
                    <th className="px-4 py-4 text-right">الملاحظات</th>
                    <th className="px-4 py-4 text-right">الإجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        لا توجد جلسات مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => {
                      const caseInfo = casesMap.get(session.caseId);

                      return (
                        <tr
                          key={session.id}
                          className="border-b border-slate-100 transition last:border-b-0 hover:bg-slate-50"
                        >
                          <td className="px-4 py-4 font-medium text-slate-800">
                            {new Date(session.sessionDate).toLocaleDateString(
                              "ar-SA"
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-bold text-slate-900">
                              {caseInfo?.childName || "-"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {caseInfo?.caseNumber || "-"}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-slate-700">
                            {session.sessionType}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getAttendanceBadgeClass(
                                session.attendance
                              )}`}
                            >
                              {session.attendance}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getProgressBadgeClass(
                                session.progress
                              )}`}
                            >
                              {session.progress}
                            </span>
                          </td>

                          <td className="max-w-[260px] truncate px-4 py-4 text-slate-500">
                            {session.notes || "-"}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(session)}
                                className="rounded-xl"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(session.id)}
                                className="rounded-xl"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}