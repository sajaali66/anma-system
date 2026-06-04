import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";

let mockOrganizations = [
  {
    id: 1,
    name: "جمعية إنماء",
    city: "الرياض",
    contactPerson: "محمد العتيبي",
    phone: "0500000000",
    email: "info@anmaa.sa",
    status: "نشطة",
    notes: "",
    createdAt: new Date(),
  },
];

let mockCases = [
  {
    id: 1,
    caseNumber: "C001",
    childName: "أحمد محمد",
    guardianName: "",
    phone: "",
    age: 5,
    gender: "غير محدد",
    city: "الرياض",
    organization: "جمعية إنماء",
    referralReason: "",
    hasPreviousDiagnosis: "غير محدد",
    previousDiagnosis: "",
    referralSource: "",
    disorderType: "توحد",
    specialist: "د. سارة",
    referralType: "تكاملية",
    status: "نشطة",
    referralDate: new Date(),
    notes: "",
  },
];

let mockSessions: any[] = [];
let mockImpact: any[] = [];
let mockCompliance: any[] = [];
let mockFinancing: any[] = [];

function ensureOrganizationExists(input: any) {
  const organizationName = input.organization || "غير محدد";

  if (organizationName === "غير محدد") return;

  const existingOrg = mockOrganizations.find(
    (org) => org.name === organizationName
  );

  if (!existingOrg) {
    mockOrganizations.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: organizationName,
      city: input.city || "غير محدد",
      contactPerson: input.guardianName || "",
      phone: input.phone || "",
      email: "",
      status: "نشطة",
      notes: "تمت إضافتها تلقائيًا من بيانات الحالات",
      createdAt: new Date(),
    });
  }
}

/* =========================
   SMART ENGINE (8 SESSIONS)
========================= */
function getCaseSmartAnalysis(caseId: number) {
  const MAX_SESSIONS = 8;

  const caseData = mockCases.find((item) => item.id === caseId);

  const sessions = mockSessions.filter((item) => item.caseId === caseId);
  const impacts = mockImpact.filter((item) => item.caseId === caseId);
  const compliances = mockCompliance.filter((item) => item.caseId === caseId);
  const financing = mockFinancing.filter((item) => item.caseId === caseId);

  const totalSessions = sessions.length;

  const presentCount = sessions.filter(
    (item) => item.attendance === "حاضر"
  ).length;

  const absentCount = sessions.filter(
    (item) => item.attendance === "غائب"
  ).length;

  const improvedCount = sessions.filter(
    (item) => item.progress === "تحسن"
  ).length;

  const declinedCount = sessions.filter(
    (item) => item.progress === "تراجع"
  ).length;

  const completionRate = Math.min((totalSessions / MAX_SESSIONS) * 100, 100);

  const attendanceRate =
    totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

  const impactRate =
    impacts.length > 0
      ? Math.min(
          100,
          Math.max(
            0,
            impacts.reduce(
              (sum, item) => sum + Number(item.improvementPercentage || 0),
              0
            ) / impacts.length
          )
        )
      : 0;

  let complianceRate = 0;

  if (compliances.length > 0) {
    complianceRate =
      compliances.reduce((sum, item) => {
        const attendance = Number(item.attendancePercentage || 0);

        const level =
          item.commitmentLevel === "مرتفع"
            ? 100
            : item.commitmentLevel === "متوسط"
            ? 70
            : 40;

        const homePlan = item.homeplanImplementation ? 100 : 0;

        return sum + (attendance + level + homePlan) / 3;
      }, 0) / compliances.length;
  }

  const score = Math.round(
    completionRate * 0.4 +
      attendanceRate * 0.25 +
      impactRate * 0.2 +
      complianceRate * 0.15
  );

  const remainingSessions = Math.max(MAX_SESSIONS - totalSessions, 0);

  const alerts: string[] = [];
  const recommendations: string[] = [];

  if (totalSessions === 0) {
    alerts.push("لا توجد جلسات مسجلة");
  }

  if (absentCount >= 2) {
    alerts.push("يوجد غياب متكرر");
  }

  if (impacts.length === 0) {
    alerts.push("لا يوجد قياس أثر");
  }

  if (score < 60) {
    alerts.push("الحالة تحتاج تدخل عاجل");
  }

  if (remainingSessions > 0) {
    recommendations.push(`متبقي ${remainingSessions} جلسة لإكمال الخطة`);
  } else {
    recommendations.push("تم إكمال 8 جلسات ويوصى بتقييم نهائي");
  }

  if (score >= 80) {
    recommendations.push("الحالة تسير بشكل ممتاز");
  } else if (score >= 60) {
    recommendations.push("الحالة تحتاج متابعة إضافية");
  } else {
    recommendations.push("مراجعة الخطة العلاجية");
  }

  return {
    caseId,
    childName: caseData?.childName ?? "-",
    caseNumber: caseData?.caseNumber ?? "-",
    organization: caseData?.organization ?? "-",

    score,

    status:
      score >= 80 ? "ممتاز" : score >= 60 ? "يحتاج متابعة" : "خطر",

    sessionsCount: totalSessions,
    maxSessions: MAX_SESSIONS,
    remainingSessions,

    absentCount,
    improvedCount,
    declinedCount,

    impactCount: impacts.length,
    complianceCount: compliances.length,
    financingCount: financing.length,

    completionRate: Math.round(completionRate),
    attendanceRate: Math.round(attendanceRate),
    impactRate: Math.round(impactRate),
    complianceRate: Math.round(complianceRate),

    alerts,
    recommendations,
    timestamp: new Date(),
  };
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(() => null),
  }),

  organizations: router({
    list: publicProcedure.query(() => mockOrganizations),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        return mockOrganizations.find((item) => item.id === input.id) ?? null;
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const newItem = {
        id: Date.now(),
        createdAt: new Date(),
        status: "نشطة",
        notes: "",
        ...input,
      };

      mockOrganizations.unshift(newItem);

      return {
        success: true,
        data: newItem,
      };
    }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.any(),
        })
      )
      .mutation(({ input }) => {
        const oldOrg = mockOrganizations.find((item) => item.id === input.id);

        mockOrganizations = mockOrganizations.map((item) =>
          item.id === input.id ? { ...item, ...input.data } : item
        );

        if (oldOrg && input.data?.name && oldOrg.name !== input.data.name) {
          mockCases = mockCases.map((item) =>
            item.organization === oldOrg.name
              ? {
                  ...item,
                  organization: input.data.name,
                }
              : item
          );
        }

        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const org = mockOrganizations.find((item) => item.id === input.id);

        if (org) {
          mockCases = mockCases.filter(
            (item) => item.organization !== org.name
          );

          const remainingCaseIds = mockCases.map((item) => item.id);

          mockSessions = mockSessions.filter((item) =>
            remainingCaseIds.includes(item.caseId)
          );

          mockImpact = mockImpact.filter((item) =>
            remainingCaseIds.includes(item.caseId)
          );

          mockCompliance = mockCompliance.filter((item) =>
            remainingCaseIds.includes(item.caseId)
          );

          mockFinancing = mockFinancing.filter((item) =>
            remainingCaseIds.includes(item.caseId)
          );
        }

        mockOrganizations = mockOrganizations.filter(
          (item) => item.id !== input.id
        );

        return { success: true };
      }),
  }),

  cases: router({
    list: publicProcedure.query(() => mockCases),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        return mockCases.find((item) => item.id === input.id) ?? null;
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      ensureOrganizationExists(input);

      const newItem = {
        id: Date.now(),
        status: "جديدة",
        referralDate: new Date(),
        notes: "",
        guardianName: "",
        phone: "",
        gender: "غير محدد",
        referralReason: "",
        hasPreviousDiagnosis: "غير محدد",
        previousDiagnosis: "",
        referralSource: "",
        disorderType: "",
        specialist: "",
        referralType: "تكاملية",
        ...input,
      };

      mockCases.unshift(newItem);

      return {
        success: true,
        data: newItem,
      };
    }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.any(),
        })
      )
      .mutation(({ input }) => {
        ensureOrganizationExists(input.data);

        mockCases = mockCases.map((item) =>
          item.id === input.id ? { ...item, ...input.data } : item
        );

        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        mockCases = mockCases.filter((item) => item.id !== input.id);

        mockSessions = mockSessions.filter((item) => item.caseId !== input.id);

        mockImpact = mockImpact.filter((item) => item.caseId !== input.id);

        mockCompliance = mockCompliance.filter(
          (item) => item.caseId !== input.id
        );

        mockFinancing = mockFinancing.filter(
          (item) => item.caseId !== input.id
        );

        return { success: true };
      }),
  }),

  sessions: router({
    getByCase: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return mockSessions.filter((item) => item.caseId === input.caseId);
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const newItem = {
        id: Date.now(),
        createdAt: new Date(),
        ...input,
      };

      mockSessions.unshift(newItem);

      return {
        success: true,
        data: newItem,
      };
    }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.any(),
        })
      )
      .mutation(({ input }) => {
        mockSessions = mockSessions.map((item) =>
          item.id === input.id ? { ...item, ...input.data } : item
        );

        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        mockSessions = mockSessions.filter((item) => item.id !== input.id);

        return { success: true };
      }),
  }),

  impact: router({
    getByCase: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return mockImpact.filter((item) => item.caseId === input.caseId);
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const baseline = Number(input.baseline || 0);
      const afterValue = Number(input.after || input.afterValue || 0);

      let improvementPercentage = 0;

      if (baseline !== 0) {
        if (input.betterDirection === "أقل أفضل") {
          improvementPercentage = ((baseline - afterValue) / baseline) * 100;
        } else {
          improvementPercentage = ((afterValue - baseline) / baseline) * 100;
        }
      }

      const newItem = {
        id: Date.now(),
        createdAt: new Date(),
        ...input,
        afterValue,
        improvementPercentage: Math.round(improvementPercentage),
        interpretation:
          improvementPercentage > 0
            ? "يوجد تحسن"
            : improvementPercentage < 0
            ? "يوجد تراجع"
            : "لا يوجد تغير واضح",
      };

      mockImpact.unshift(newItem);

      return {
        success: true,
        data: newItem,
      };
    }),
  }),

  compliance: router({
    getByCase: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return mockCompliance.filter((item) => item.caseId === input.caseId);
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const newItem = {
        id: Date.now(),
        createdAt: new Date(),
        ...input,
      };

      mockCompliance.unshift(newItem);

      return {
        success: true,
        data: newItem,
      };
    }),
  }),

  financing: router({
    getByCase: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return mockFinancing.filter((item) => item.caseId === input.caseId);
      }),

    create: publicProcedure.input(z.any()).mutation(({ input }) => {
      const count = Number(input.sessionCount || 0);
      const cost = Number(input.sessionCost || 0);

      const newItem = {
        id: Date.now(),
        createdAt: new Date(),
        ...input,
        totalCost: count * cost,
      };

      mockFinancing.unshift(newItem);

      return {
        success: true,
        data: newItem,
      };
    }),
  }),

  smart: router({
    alerts: publicProcedure.query(() => {
      const alerts: any[] = [];

      mockCases.forEach((item) => {
        const result = getCaseSmartAnalysis(item.id);

        result.alerts.forEach((msg) => {
          alerts.push({
            id: `${item.id}-${msg}`,
            caseId: item.id,
            childName: item.childName,
            organization: item.organization,
            message: msg,
            severity: result.score < 60 ? "high" : "medium",
            createdAt: new Date(),
          });
        });
      });

      return alerts;
    }),

    caseSummary: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => {
        return getCaseSmartAnalysis(input.caseId);
      }),

    dashboardSummary: publicProcedure.query(() => {
      const list = mockCases.map((item) => getCaseSmartAnalysis(item.id));

      const highRisk = list.filter((item) => item.score < 60).length;

      const needsFollowup = list.filter(
        (item) => item.score >= 60 && item.score < 80
      ).length;

      const excellent = list.filter((item) => item.score >= 80).length;

      return {
        totalCases: mockCases.length,
        totalOrganizations: mockOrganizations.length,
        totalSessions: mockSessions.length,
        highRisk,
        needsFollowup,
        excellent,
        averageScore:
          list.length > 0
            ? Math.round(
                list.reduce((sum, item) => sum + item.score, 0) / list.length
              )
            : 0,
        generatedAt: new Date(),
      };
    }),

    organizationsRanking: publicProcedure.query(() => {
      return mockOrganizations
        .map((org) => {
          const orgCases = mockCases.filter(
            (item) => item.organization === org.name
          );

          const results = orgCases.map((item) =>
            getCaseSmartAnalysis(item.id)
          );

          const averageScore =
            results.length > 0
              ? Math.round(
                  results.reduce((sum, item) => sum + item.score, 0) /
                    results.length
                )
              : 0;

          return {
            organizationId: org.id,
            organizationName: org.name,
            casesCount: orgCases.length,
            averageScore,
            highRiskCases: results.filter((item) => item.score < 60).length,
            status:
              averageScore >= 80
                ? "ممتاز"
                : averageScore >= 60
                ? "يحتاج متابعة"
                : "خطر",
          };
        })
        .sort((a, b) => b.averageScore - a.averageScore);
    }),
  }),

  analysis: router({
    analyzeCaseProgress: publicProcedure
      .input(
        z.object({
          caseId: z.number(),
        })
      )
      .mutation(({ input }) => {
        const result = getCaseSmartAnalysis(input.caseId);

        return {
          childName: result.childName,
          score: result.score,
          status: result.status,
          analysis: `
تقييم الحالة: ${result.status}
درجة الحالة: ${result.score}/100

تفاصيل المؤشر:
- إنجاز الجلسات: ${result.completionRate}%
- الحضور: ${result.attendanceRate}%
- قياس الأثر: ${result.impactRate}%
- التزام الأسرة: ${result.complianceRate}%

عدد الجلسات المسجلة: ${result.sessionsCount}
الجلسات المتبقية: ${result.remainingSessions}
عدد الغياب: ${result.absentCount}
جلسات التحسن: ${result.improvedCount}
جلسات التراجع: ${result.declinedCount}
قياسات الأثر: ${result.impactCount}
سجلات الالتزام: ${result.complianceCount}

التنبيهات:
${
  result.alerts.length
    ? result.alerts.map((item) => `- ${item}`).join("\n")
    : "- لا توجد تنبيهات حالية"
}

التوصيات:
${
  result.recommendations.length
    ? result.recommendations.map((item) => `- ${item}`).join("\n")
    : "- الاستمرار في المتابعة"
}
          `.trim(),
          alerts: result.alerts,
          recommendations: result.recommendations,
          timestamp: new Date(),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;