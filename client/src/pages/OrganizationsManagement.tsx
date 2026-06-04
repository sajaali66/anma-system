import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  Search,
  Users,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Eye,
  MapPin,
  Phone,
  Mail,
  UserRound,
  CheckCircle2,
  Activity,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CaseItem = {
  id: number;
  organization: string;
  city: string;
  specialist: string;
  status: string;
};

type OrganizationItem = {
  id: number;
  name: string;
  city?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  status?: string;
  notes?: string;
};

type OrganizationWithStats = OrganizationItem & {
  casesCount: number;
  activeCases: number;
  completedCases: number;
};

export default function OrganizationsManagement() {
  const [, navigate] = useLocation();

  const [searchTerm, setSearchTerm] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationItem | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    city: "",
    contactPerson: "",
    phone: "",
    email: "",
    status: "نشطة",
    notes: "",
  });

  const organizationsQuery = trpc.organizations.list.useQuery();
  const casesQuery = trpc.cases.list.useQuery();

  const allOrganizations = (organizationsQuery.data || []) as OrganizationItem[];
  const allCases = (casesQuery.data || []) as CaseItem[];

  const createMutation = trpc.organizations.create.useMutation({
    onSuccess: async () => {
      await organizationsQuery.refetch();
      setOpenCreate(false);
      resetForm();
    },
  });

  const updateMutation = trpc.organizations.update.useMutation({
    onSuccess: async () => {
      await organizationsQuery.refetch();
      setOpenEdit(false);
      setSelectedOrg(null);
      resetForm();
    },
  });

  const deleteMutation = trpc.organizations.delete.useMutation({
    onSuccess: async () => {
      await organizationsQuery.refetch();
      await casesQuery.refetch();
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      city: "",
      contactPerson: "",
      phone: "",
      email: "",
      status: "نشطة",
      notes: "",
    });
  };

  const organizations = useMemo<OrganizationWithStats[]>(() => {
    return allOrganizations.map((org) => {
      const relatedCases = allCases.filter(
        (item) => item.organization === org.name
      );

      return {
        ...org,
        casesCount: relatedCases.length,
        activeCases: relatedCases.filter(
          (item) => item.status === "نشطة"
        ).length,
        completedCases: relatedCases.filter(
          (item) => item.status === "مكتملة"
        ).length,
      };
    });
  }, [allOrganizations, allCases]);

  const filteredOrganizations = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOrganizations = organizations.length;
  const totalCases = organizations.reduce((sum, org) => sum + org.casesCount, 0);
  const totalActiveCases = organizations.reduce(
    (sum, org) => sum + org.activeCases,
    0
  );
  const totalCompletedCases = organizations.reduce(
    (sum, org) => sum + org.completedCases,
    0
  );

  const handleCreate = () => {
    if (!formData.name.trim()) return;

    createMutation.mutate({
      ...formData,
      name: formData.name.trim(),
      city: formData.city.trim(),
      contactPerson: formData.contactPerson.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      notes: formData.notes.trim(),
    });
  };

  const handleEdit = (org: OrganizationItem) => {
    setSelectedOrg(org);

    setFormData({
      name: org.name || "",
      city: org.city || "",
      contactPerson: org.contactPerson || "",
      phone: org.phone || "",
      email: org.email || "",
      status: org.status || "نشطة",
      notes: org.notes || "",
    });

    setOpenEdit(true);
  };

  const handleUpdate = () => {
    if (!selectedOrg) return;
    if (!formData.name.trim()) return;

    updateMutation.mutate({
      id: selectedOrg.id,
      data: {
        ...formData,
        name: formData.name.trim(),
        city: formData.city.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        notes: formData.notes.trim(),
      },
    });
  };

  const handleDelete = (id: number) => {
    const confirmed = confirm("هل تريد حذف الجمعية؟");
    if (!confirmed) return;
    deleteMutation.mutate({ id });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              إدارة الجمعيات
            </h1>
            <p className="text-muted-foreground">
              إضافة وتعديل وإدارة الجمعيات مع عرض الإحصائيات والحالات المرتبطة
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="bg-orange-600 text-white hover:bg-orange-700">
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة جمعية
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>إضافة جمعية جديدة</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    placeholder="اسم الجمعية"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <Input
                    placeholder="المدينة"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                  />
                  <Input
                    placeholder="الشخص المسؤول"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactPerson: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="رقم الجوال"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                  <Input
                    placeholder="البريد الإلكتروني"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                  <Input
                    placeholder="الحالة"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  />
                  <div className="md:col-span-2">
                    <textarea
                      placeholder="ملاحظات"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Button
                      className="w-full bg-orange-600 text-white hover:bg-orange-700"
                      onClick={handleCreate}
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? "جاري الحفظ..." : "حفظ الجمعية"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="ml-2 h-4 w-4" />
              رجوع
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2 text-orange-700">
                <Building2 className="h-5 w-5" />
                <span className="text-sm font-medium">إجمالي الجمعيات</span>
              </div>
              <div className="text-3xl font-bold text-orange-600">
                {totalOrganizations}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2 text-blue-700">
                <Users className="h-5 w-5" />
                <span className="text-sm font-medium">إجمالي الحالات</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {totalCases}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2 text-green-700">
                <Activity className="h-5 w-5" />
                <span className="text-sm font-medium">الحالات النشطة</span>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {totalActiveCases}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2 text-gray-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">الحالات المكتملة</span>
              </div>
              <div className="text-3xl font-bold text-gray-600">
                {totalCompletedCases}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث عن جمعية..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrganizations.map((org) => (
            <Card
              key={org.id}
              className="border-border transition-all hover:shadow-lg"
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-1 h-5 w-5 text-orange-600" />
                    <div>
                      <div className="text-lg font-bold">{org.name}</div>
                      <div className="mt-1 text-sm font-normal text-muted-foreground">
                        {org.status || "نشطة"}
                      </div>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-orange-50 p-3">
                    <div className="text-xl font-bold text-orange-600">
                      {org.casesCount}
                    </div>
                    <div className="text-xs text-muted-foreground">الحالات</div>
                  </div>

                  <div className="rounded-lg bg-green-50 p-3">
                    <div className="text-xl font-bold text-green-600">
                      {org.activeCases}
                    </div>
                    <div className="text-xs text-muted-foreground">نشطة</div>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xl font-bold text-gray-600">
                      {org.completedCases}
                    </div>
                    <div className="text-xs text-muted-foreground">مكتملة</div>
                  </div>
                </div>

                <div className="mb-5 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{org.city || "-"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                    <span>{org.contactPerson || "-"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{org.phone || "-"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{org.email || "-"}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-orange-600 text-white hover:bg-orange-700"
                    onClick={() =>
                      navigate(`/organizations/${encodeURIComponent(org.name)}`)
                    }
                  >
                    <Eye className="ml-2 h-4 w-4" />
                    عرض
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleEdit(org)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(org.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredOrganizations.length === 0 && (
          <Card className="mt-6">
            <CardContent className="py-10 text-center text-muted-foreground">
              لا توجد جمعيات مطابقة للبحث
            </CardContent>
          </Card>
        )}

        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تعديل الجمعية</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                placeholder="اسم الجمعية"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />

              <Input
                placeholder="المدينة"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
              />

              <Input
                placeholder="المسؤول"
                value={formData.contactPerson}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contactPerson: e.target.value,
                  })
                }
              />

              <Input
                placeholder="رقم الجوال"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />

              <Input
                placeholder="البريد الإلكتروني"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />

              <Input
                placeholder="الحالة"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              />

              <div className="md:col-span-2">
                <textarea
                  placeholder="ملاحظات"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  className="w-full bg-orange-600 text-white hover:bg-orange-700"
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديل"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}