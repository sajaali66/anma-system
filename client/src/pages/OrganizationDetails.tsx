import { useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Building2,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  UserRound,
  MapPin,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CaseItem = {
  id: number;
  caseNumber: string;
  childName: string;
  age: number;
  city: string;
  organization: string;
  disorderType: string;
  specialist: string;
  referralType: "تكاملية" | "مساندة" | "لاحقة";
  status: "جديدة" | "نشطة" | "مكتملة" | "متعثرة";
  referralDate: string | Date;
  notes?: string | null;
};

function getStatusBadgeClass(status: CaseItem["status"]) {
  switch (status) {
    case "جديدة":
      return "bg-blue-100 text-blue-800";
    case "نشطة":
      return "bg-green-100 text-green-800";
    case "مكتملة":
      return "bg-gray-100 text-gray-800";
    case "متعثرة":
      return "bg-red-100 text-red-800";
    default:
      return "bg-muted text-foreground";
  }
}

export default function OrganizationDetails() {
  const params = useParams();
  const [, navigate] = useLocation();

  const organizationName = decodeURIComponent(params.id || "");

  const casesQuery = trpc.cases.list.useQuery();
  const deleteCaseMutation = trpc.cases.delete.useMutation({
    onSuccess: async () => {
      await casesQuery.refetch();
    },
  });

  const allCases = (casesQuery.data || []) as CaseItem[];

  const organizationCases = useMemo(() => {
    return allCases.filter(
      (item) => item.organization === organizationName
    );
  }, [allCases, organizationName]);

  const stats = useMemo(() => {
    const totalCases = organizationCases.length;
    const activeCases = organizationCases.filter(
      (item) => item.status === "نشطة"
    ).length;
    const completedCases = organizationCases.filter(
      (item) => item.status === "مكتملة"
    ).length;
    const atRiskCases = organizationCases.filter(
      (item) => item.status === "متعثرة"
    ).length;

    const cities = Array.from(
      new Set(organizationCases.map((item) => item.city).filter(Boolean))
    );

    const specialists = Array.from(
      new Set(organizationCases.map((item) => item.specialist).filter(Boolean))
    );

    const disorderTypes = Array.from(
      new Set(organizationCases.map((item) => item.disorderType).filter(Boolean))
    );

    return {
      totalCases,
      activeCases,
      completedCases,
      atRiskCases,
      cities,
      specialists,
      disorderTypes,
    };
  }, [organizationCases]);

  const handleDelete = (id: number) => {
    const confirmed = confirm("هل تريد حذف الحالة؟");
    if (!confirmed) return;

    deleteCaseMutation.mutate({ id });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              تفاصيل الجمعية
            </h1>
            <p className="text-muted-foreground">
              عرض معلومات الجمعية والحالات المرتبطة بها
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate("/organizations")}
            className="w-full md:w-auto"
          >
            <ArrowLeft className="ml-2 h-4 w-4" />
            الرجوع للجمعيات
          </Button>
        </div>

        <Card className="mb-6 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Building2 className="h-6 w-6 text-orange-600" />
              {organizationName || "جمعية غير معروفة"}
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="bg-orange-50">
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2 text-orange-700">
                <Users className="h-4 w-4" />
                إجمالي الحالات
              </div>
              <div className="text-3xl font-bold text-orange-600">
                {stats.totalCases}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50">
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2 text-green-700">
                <Activity className="h-4 w-4" />
                الحالات النشطة
              </div>
              <div className="text-3xl font-bold text-green-600">
                {stats.activeCases}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-50">
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2 text-gray-700">
                <CheckCircle2 className="h-4 w-4" />
                المكتملة
              </div>
              <div className="text-3xl font-bold text-gray-600">
                {stats.completedCases}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50">
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                المتعثرة
              </div>
              <div className="text-3xl font-bold text-red-600">
                {stats.atRiskCases}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-orange-600" />
                المدن
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.cities.join("، ") || "-"}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="h-5 w-5 text-blue-600" />
                المختصون
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.specialists.join("، ") || "-"}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-green-600" />
                أنواع الاضطرابات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.disorderTypes.join("، ") || "-"}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>الحالات التابعة للجمعية</CardTitle>
          </CardHeader>

          <CardContent>
            {organizationCases.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-right">رقم الحالة</th>
                      <th className="px-4 py-3 text-right">اسم الطفل</th>
                      <th className="px-4 py-3 text-right">العمر</th>
                      <th className="px-4 py-3 text-right">المدينة</th>
                      <th className="px-4 py-3 text-right">الاضطراب</th>
                      <th className="px-4 py-3 text-right">المختص</th>
                      <th className="px-4 py-3 text-right">الحالة</th>
                      <th className="px-4 py-3 text-right">الإجراءات</th>
                    </tr>
                  </thead>

                  <tbody>
                    {organizationCases.map((caseItem) => (
                      <tr
                        key={caseItem.id}
                        className="border-b border-border hover:bg-muted/50"
                      >
                        <td className="px-4 py-3">{caseItem.caseNumber}</td>
                        <td className="px-4 py-3 font-medium">
                          {caseItem.childName}
                        </td>
                        <td className="px-4 py-3">{caseItem.age}</td>
                        <td className="px-4 py-3">{caseItem.city}</td>
                        <td className="px-4 py-3">{caseItem.disorderType}</td>
                        <td className="px-4 py-3">{caseItem.specialist}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusBadgeClass(
                              caseItem.status
                            )}`}
                          >
                            {caseItem.status}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                navigate(`/cases/${caseItem.id}`)
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate(`/cases`)
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(caseItem.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                لا توجد حالات مرتبطة بهذه الجمعية
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}