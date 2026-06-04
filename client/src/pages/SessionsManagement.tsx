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

const lightInputClass = "placeholder:text-muted-foreground/40 bg-white";

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
      return "bg-green-100 text-green-800";
    case "غائب":
      return "bg-red-100 text-red-800";
    case "مؤجل":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function getProgressBadgeClass(progress: SessionItem["progress"]) {
  switch (progress) {
    case "تحسن":
      return "bg-emerald-100 text-emerald-800";
    case "ثابت":
      return "bg-amber-100 text-amber-800";
    case "تراجع":
      return "bg-red-100 text-red-800";
    default:
      return "bg-muted text-foreground";
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
    <>
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
                  <SelectTrigger className={`${lightInputClass} h-11 w-full text-sm`}>
                    <SelectValue placeholder="اختر الحالة" />
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
                    <SelectValue placeholder="اختر الحضور" />
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
                    <SelectValue placeholder="اختر مستوى التقدم" />
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
            <FormLabel>ملاحظات</FormLabel>
            <FormControl>
              <textarea
                placeholder="أي ملاحظات إضافية عن الجلسة..."
                className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 placeholder:text-muted-foreground/40"
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

export default function SessionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);

  const casesQuery = trpc.cases.list.useQuery();
  const allCases = (casesQuery.data || []) as CaseItem[];

  const sessionsQueries = trpc.useQueries((t) =>
    allCases.map((caseItem) =>
      t.sessions.getByCase({ caseId: caseItem.id })
    )
  );

  const sessionsData = useMemo(() => {
    const merged: SessionItem[] = [];
    sessionsQueries.forEach((query) => {
      if (query.data) merged.push(...(query.data as SessionItem[]));
    });
    return merged.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
  }, [sessionsQueries]);

  const casesMap = useMemo(() => {
    const map = new Map<number, CaseItem>();
    allCases.forEach((item) => map.set(item.id, item));
    return map;
  }, [allCases]);

  const availableOrganizations = useMemo(() => {
    const organizations = allCases.map((item) => item.organization).filter(Boolean);
    return Array.from(new Set(organizations));
  }, [allCases]);

  const refetchAllSessions = () => {
    sessionsQueries.forEach((query) => void query.refetch());
  };

  const createForm = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: { caseId: 0, sessionDate: new Date(), sessionType: "", attendance: "حاضر", progress: "ثابت", notes: "" },
  });

  const editForm = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: { caseId: 0, sessionDate: new Date(), sessionType: "", attendance: "حاضر", progress: "ثابت", notes: "" },
  });

  const createSessionMutation = trpc.sessions.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الجلسة بنجاح");
      refetchAllSessions();
      void casesQuery.refetch();
      notifyDashboardDataChanged();
      setIsCreateDialogOpen(false);
      createForm.reset({ caseId: 0, sessionDate: new Date(), sessionType: "", attendance: "حاضر", progress: "ثابت", notes: "" });
    },
    onError: (error: any) => toast.error(error.message || "حدث خطأ في إضافة الجلسة"),
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
    onError: (error: any) => toast.error(error.message || "حدث خطأ في تعديل الجلسة"),
  });

  const deleteSessionMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الجلسة بنجاح");
      refetchAllSessions();
      void casesQuery.refetch();
      notifyDashboardDataChanged();
    },
    onError: (error: any) => toast.error(error.message || "حدث خطأ في حذف الجلسة"),
  });

  const onCreateSubmit = (values: SessionFormValues) => {
    createSessionMutation.mutate({
      ...values,
      caseId: Number(values.caseId),
      sessionDate: values.sessionDate instanceof Date ? values.sessionDate : new Date(values.sessionDate),
      progress: normalizeProgressByAttendance(values.attendance, values.progress),
      notes: values.notes?.trim() || "",
    });
  };

  const onEditSubmit = (values: SessionFormValues) => {
    if (!selectedSession) return;
    updateSessionMutation.mutate({
      id: selectedSession.id,
      data: {
        caseId: Number(values.caseId),
        sessionDate: values.sessionDate instanceof Date ? values.sessionDate : new Date(values.sessionDate),
        sessionType: values.sessionType,
        attendance: values.attendance,
        progress: normalizeProgressByAttendance(values.attendance, values.progress),
        notes: values.notes?.trim() || "",
      },
    });
  };

  const handleEdit = (session: SessionItem) => {
    setSelectedSession(session);
    editForm.reset({ caseId: session.caseId, sessionDate: new Date(session.sessionDate), sessionType: session.sessionType, attendance: session.attendance, progress: session.progress, notes: session.notes || "" });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (sessionId: number) => {
    const confirmed = confirm("هل أنت متأكد من حذف الجلسة؟");
    if (!confirmed) return;
    deleteSessionMutation.mutate({ id: sessionId });
  };

  const filteredSessions = sessionsData.filter((session) => {
    const caseInfo = casesMap.get(session.caseId);
    const matchesSearch = caseInfo?.childName?.includes(searchTerm) || caseInfo?.caseNumber?.includes(searchTerm) || session.sessionType?.includes(searchTerm);
    const matchesAttendance = attendanceFilter === "all" || session.attendance === attendanceFilter;
    const matchesProgress = progressFilter === "all" || session.progress === progressFilter;
    const matchesOrganization = organizationFilter === "all" || caseInfo?.organization === organizationFilter;
    return Boolean(matchesSearch || searchTerm === "") && matchesAttendance && matchesProgress && matchesOrganization;
  });

  const todayCount = sessionsData.filter((session) => {
    const d = new Date(session.sessionDate);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const absentCount = sessionsData.filter((s) => s.attendance === "غائب").length;
  const postponedCount = sessionsData.filter((s) => s.attendance === "مؤجل").length;
  const improvedCount = sessionsData.filter((s) => s.progress === "تحسن").length;

  return (
    <div dir="rtl" className="min-h-full bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">متابعة الجلسات</h1>
            <p className="text-muted-foreground">إدارة الجلسات ومتابعة الحضور والتقدم لكل حالة</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 text-white hover:bg-orange-700">
                <Plus className="ml-2 h-4 w-4" /> إضافة جلسة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-white">
              <DialogHeader><DialogTitle>إضافة جلسة جديدة</DialogTitle><DialogDescription>أدخل بيانات الجلسة الجديدة بعناية</DialogDescription></DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <SessionFields form={createForm} cases={allCases} />
                  <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={createSessionMutation.isPending}>{createSessionMutation.isPending ? "جاري الإضافة..." : "إضافة الجلسة"}</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl bg-white">
            <DialogHeader><DialogTitle>تعديل الجلسة</DialogTitle><DialogDescription>عدلي بيانات الجلسة ثم احفظي التغييرات</DialogDescription></DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <SessionFields form={editForm} cases={allCases} />
                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={updateSessionMutation.isPending}>{updateSessionMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="bg-white"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-orange-600" />جلسات اليوم</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-orange-600">{todayCount}</div><p className="mt-1 text-sm text-muted-foreground">عدد الجلسات المجدولة اليوم</p></CardContent></Card>
          <Card className="bg-white"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><CircleAlert className="h-5 w-5 text-red-600" />إجمالي الغياب</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-red-600">{absentCount}</div><p className="mt-1 text-sm text-muted-foreground">جلسات مسجلة كغياب</p></CardContent></Card>
          <Card className="bg-white"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><CircleAlert className="h-5 w-5 text-orange-600" />الجلسات المؤجلة</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-orange-600">{postponedCount}</div><p className="mt-1 text-sm text-muted-foreground">جلسات تحتاج إعادة جدولة</p></CardContent></Card>
          <Card className="bg-white"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><CircleCheck className="h-5 w-5 text-green-600" />جلسات بتحسن</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-green-600">{improvedCount}</div><p className="mt-1 text-sm text-muted-foreground">عدد الجلسات التي سجلت تحسن</p></CardContent></Card>
        </div>

        <Card className="mb-6 bg-white"><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-orange-600" />البحث والفلترة</CardTitle><CardDescription>فلترة الجلسات حسب الحالة أو الحضور أو الجمعية</CardDescription></CardHeader><CardContent><div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input placeholder="ابحث باسم الطفل أو رقم الحالة أو نوع الجلسة..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="bg-white" />
          <Select value={attendanceFilter} onValueChange={setAttendanceFilter}><SelectTrigger className="bg-white"><SelectValue placeholder="كل الحضور" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">كل الحضور</SelectItem><SelectItem value="حاضر">حاضر</SelectItem><SelectItem value="غائب">غائب</SelectItem><SelectItem value="مؤجل">مؤجل</SelectItem></SelectContent></Select>
          <Select value={progressFilter} onValueChange={setProgressFilter}><SelectTrigger className="bg-white"><SelectValue placeholder="كل التقدم" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">كل التقدم</SelectItem><SelectItem value="تحسن">تحسن</SelectItem><SelectItem value="ثابت">ثابت</SelectItem><SelectItem value="تراجع">تراجع</SelectItem></SelectContent></Select>
          <Select value={organizationFilter} onValueChange={setOrganizationFilter}><SelectTrigger className="bg-white"><SelectValue placeholder="كل الجمعيات" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">كل الجمعيات</SelectItem>{availableOrganizations.map((org) => <SelectItem key={org} value={org}>{org}</SelectItem>)}</SelectContent></Select>
        </div></CardContent></Card>

        <Card className="bg-white"><CardHeader><CardTitle>قائمة الجلسات</CardTitle><CardDescription>عدد الجلسات: {filteredSessions.length}</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-slate-500"><th className="px-4 py-3 text-right">التاريخ</th><th className="px-4 py-3 text-right">الحالة</th><th className="px-4 py-3 text-right">نوع الجلسة</th><th className="px-4 py-3 text-right">الحضور</th><th className="px-4 py-3 text-right">التقدم</th><th className="px-4 py-3 text-right">الملاحظات</th><th className="px-4 py-3 text-right">الإجراءات</th></tr></thead><tbody>
          {filteredSessions.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">لا توجد جلسات مطابقة للبحث</td></tr> : filteredSessions.map((session) => {
            const caseInfo = casesMap.get(session.caseId);
            return <tr key={session.id} className="border-b last:border-b-0"><td className="px-4 py-3">{new Date(session.sessionDate).toLocaleDateString("ar-SA")}</td><td className="px-4 py-3"><div className="font-semibold">{caseInfo?.childName || "-"}</div><div className="text-xs text-muted-foreground">{caseInfo?.caseNumber || "-"}</div></td><td className="px-4 py-3">{session.sessionType}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAttendanceBadgeClass(session.attendance)}`}>{session.attendance}</span></td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${getProgressBadgeClass(session.progress)}`}>{session.progress}</span></td><td className="max-w-[260px] truncate px-4 py-3 text-muted-foreground">{session.notes || "-"}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => handleEdit(session)}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="outline" size="sm" onClick={() => handleDelete(session.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div></td></tr>;
          })}
        </tbody></table></div></CardContent></Card>
      </div>
    </div>
  );
}