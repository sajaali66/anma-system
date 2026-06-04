export type AIRiskLevel =
  | "لا توجد جلسات بعد"
  | "مستقر"
  | "متابعة"
  | "خطر";

export type AIAlertType =
  | "clinical"
  | "attendance"
  | "administrative"
  | "not_started"
  | "stable";

export type AIAnalysisResult = {
  level: AIRiskLevel;
  riskScore: number;
  statusKey: "not_started" | "stable" | "follow_up" | "high_risk";
  reason: string;
  action: string;
  needsAttention: boolean;
  isHighRisk: boolean;
  alertType: AIAlertType;
  administrativeAlerts: string[];
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function getSessionsArray(c: any): any[] {
  const possible =
    c.sessions ||
    c.caseSessions ||
    c.appointments ||
    c.visits ||
    c.sessionList ||
    [];

  return Array.isArray(possible) ? possible : [];
}

function getSessionStatus(s: any): string {
  return text(s.attendanceStatus || s.status || s.sessionStatus || s.attendance);
}

export function getSessionStats(c: any) {
  const embeddedSessions = getSessionsArray(c);

  const sessionsCount =
    embeddedSessions.length > 0
      ? embeddedSessions.length
      : num(
          c.sessionsCount ||
            c.totalSessions ||
            c.sessionCount ||
            c.usedSessionCount ||
            c.completedSessions ||
            0
        );

  const attendedSessions =
    embeddedSessions.length > 0
      ? embeddedSessions.filter((s) => {
          const status = getSessionStatus(s);
          return (
            status === "حاضر" ||
            status === "مكتملة" ||
            status === "completed" ||
            status === "attended"
          );
        }).length
      : num(c.attendedSessions || c.completedSessions || 0);

  const absentSessions =
    embeddedSessions.length > 0
      ? embeddedSessions.filter((s) => {
          const status = getSessionStatus(s);
          return (
            status === "غائب" ||
            status === "فائتة" ||
            status === "absent" ||
            status === "missed" ||
            status === "no-show"
          );
        }).length
      : num(c.absentSessions || c.missedSessions || c.missedAppointments || 0);

  const postponedSessions =
    embeddedSessions.length > 0
      ? embeddedSessions.filter((s) => {
          const status = getSessionStatus(s);
          return status === "مؤجل" || status === "مؤجلة" || status === "postponed";
        }).length
      : num(c.postponedSessions || c.delayedSessions || 0);

  const attendanceRate =
    sessionsCount > 0 ? Math.round((attendedSessions / sessionsCount) * 100) : 0;

  return {
    sessionsCount,
    attendedSessions,
    absentSessions,
    postponedSessions,
    attendanceRate,
  };
}

export function analyzeCaseAI(c: any): AIAnalysisResult {
  const {
    sessionsCount,
    absentSessions,
    postponedSessions,
  } = getSessionStats(c);

  const hasSessions = sessionsCount > 0;

  const caseStatus = text(c.status || c.operationalStatus);

  const hasSpecialist = Boolean(
    text(c.specialistName || c.specialist || c.doctorName)
  );

  const hasDisability = Boolean(
    text(c.disabilityType || c.disorderType || c.diagnosis)
  );

  const hasPhone = Boolean(
    text(c.familyPhone || c.phone || c.beneficiaryPhone)
  );

  const administrativeAlerts: string[] = [];

  if (!hasSpecialist) {
    administrativeAlerts.push("لا يوجد مختص مرتبط بالحالة");
  }

  if (!hasPhone) {
    administrativeAlerts.push("بيانات التواصل ناقصة");
  }

  if (!hasDisability) {
    administrativeAlerts.push("التشخيص أو نوع الإعاقة غير مكتمل");
  }

  if (!hasSessions) {
    return {
      level: "لا توجد جلسات بعد",
      riskScore: 0,
      statusKey: "not_started",
      reason: "لم يتم تسجيل أي جلسة لهذه الحالة بعد.",
      action: "إضافة أول جلسة أو تقييم مبدئي.",
      needsAttention: false,
      isHighRisk: false,
      alertType: "not_started",
      administrativeAlerts,
    };
  }

  if (absentSessions >= 3 || caseStatus === "حرجة" || caseStatus === "متعثرة") {
    return {
      level: "خطر",
      riskScore: 90,
      statusKey: "high_risk",
      reason:
        absentSessions >= 3
          ? `تم تسجيل ${absentSessions} غيابات، وهذا يتطلب تدخلًا عاجلًا.`
          : "الحالة مصنفة كحرجة أو متعثرة.",
      action: "مراجعة عاجلة للخطة العلاجية والتواصل مع الأسرة.",
      needsAttention: true,
      isHighRisk: true,
      alertType: "attendance",
      administrativeAlerts,
    };
  }

  if (absentSessions === 1 || absentSessions === 2 || postponedSessions > 0) {
    return {
      level: "متابعة",
      riskScore: 50,
      statusKey: "follow_up",
      reason:
        absentSessions > 0
          ? `تم تسجيل ${absentSessions} غياب، وتحتاج الحالة متابعة.`
          : "توجد جلسات مؤجلة تحتاج إعادة جدولة.",
      action: "متابعة الأسرة وتأكيد الجلسة القادمة.",
      needsAttention: true,
      isHighRisk: false,
      alertType: "attendance",
      administrativeAlerts,
    };
  }

  if (administrativeAlerts.length > 0) {
    return {
      level: "مستقر",
      riskScore: 15,
      statusKey: "stable",
      reason: "الحالة مستقرة علاجياً، لكن توجد تنبيهات إدارية.",
      action: "استكمال البيانات الإدارية الناقصة.",
      needsAttention: true,
      isHighRisk: false,
      alertType: "administrative",
      administrativeAlerts,
    };
  }

  return {
    level: "مستقر",
    riskScore: 15,
    statusKey: "stable",
    reason: "الحالة مستقرة، لديها جلسات ولا توجد غيابات مؤثرة.",
    action: "الاستمرار في الخطة الحالية.",
    needsAttention: false,
    isHighRisk: false,
    alertType: "stable",
    administrativeAlerts,
  };
}