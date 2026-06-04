import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Users
 * Local authentication only
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Organizations
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  city: varchar("city", { length: 255 }).notNull(),
  type: mysqlEnum("type", [
    "ذوي الإعاقة",
    "الأيتام",
    "الطفولة",
    "التنمية الأسرية",
    "التوحد",
    "أخرى",
  ])
    .default("أخرى")
    .notNull(),
  managerName: varchar("managerName", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  status: mysqlEnum("status", ["نشطة", "موقوفة", "تحت المراجعة"])
    .default("نشطة")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Cases
 */
export const cases = mysqlTable("cases", {
  id: int("id").autoincrement().primaryKey(),
  caseNumber: varchar("caseNumber", { length: 50 }).notNull().unique(),
  childName: varchar("childName", { length: 255 }).notNull(),
  age: int("age").notNull(),
  city: varchar("city", { length: 255 }).notNull(),

  // الربط الجديد بالجمعيات
  organizationId: int("organizationId"),

  // الإبقاء على الاسم النصي الحالي مؤقتًا حتى ما ينكسر النظام القديم
  organization: varchar("organization", { length: 255 }).notNull(),

  disorderType: varchar("disorderType", { length: 255 }).notNull(),
  specialist: varchar("specialist", { length: 255 }).notNull(),
  referralType: mysqlEnum("referralType", ["تكاملية", "مساندة", "لاحقة"])
    .notNull(),
  status: mysqlEnum("status", ["جديدة", "نشطة", "مكتملة", "متعثرة"])
    .default("جديدة")
    .notNull(),
  referralDate: timestamp("referralDate").notNull(),
  highRisk: boolean("highRisk").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Case = typeof cases.$inferSelect;
export type InsertCase = typeof cases.$inferInsert;

/**
 * Sessions
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  sessionDate: timestamp("sessionDate").notNull(),
  sessionType: varchar("sessionType", { length: 255 }).notNull(),
  attendance: mysqlEnum("attendance", ["حاضر", "غائب"]).notNull(),
  notes: text("notes"),
  progress: mysqlEnum("progress", ["تحسن", "ثابت", "تراجع"])
    .default("ثابت")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Impact Measurement
 */
export const impactMeasurements = mysqlTable("impactMeasurements", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),

  testName: varchar("testName", { length: 255 })
    .default("قياس عام")
    .notNull(),

  valueType: mysqlEnum("valueType", ["رقم", "نسبة مئوية"])
    .default("رقم")
    .notNull(),

  betterDirection: mysqlEnum("betterDirection", ["أعلى أفضل", "أقل أفضل"])
    .default("أعلى أفضل")
    .notNull(),

  baseline: decimal("baseline", { precision: 10, scale: 2 }).notNull(),
  afterValue: decimal("afterValue", { precision: 10, scale: 2 }).notNull(),

  improvementPercentage: decimal("improvementPercentage", {
    precision: 10,
    scale: 2,
  }).notNull(),

  interpretation: varchar("interpretation", { length: 255 }),

  measurementDate: timestamp("measurementDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImpactMeasurement = typeof impactMeasurements.$inferSelect;
export type InsertImpactMeasurement = typeof impactMeasurements.$inferInsert;

/**
 * Family Compliance
 */
export const familyCompliances = mysqlTable("familyCompliances", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),

  attendancePercentage: decimal("attendancePercentage", {
    precision: 5,
    scale: 2,
  }).notNull(),

  homeplanImplementation: boolean("homeplanImplementation").notNull(),

  commitmentLevel: mysqlEnum("commitmentLevel", ["مرتفع", "متوسط", "منخفض"])
    .default("متوسط")
    .notNull(),

  barrierType: varchar("barrierType", { length: 255 }),

  specialistNotes: text("specialistNotes"),
  complianceDate: timestamp("complianceDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FamilyCompliance = typeof familyCompliances.$inferSelect;
export type InsertFamilyCompliance = typeof familyCompliances.$inferInsert;

/**
 * Financing
 */
export const financings = mysqlTable("financings", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),

  fundingSource: varchar("fundingSource", { length: 255 }),
  approvedSessionCount: int("approvedSessionCount"),
  usedSessionCount: int("usedSessionCount").default(0).notNull(),
  sessionCount: int("sessionCount").notNull(),

  sessionCost: decimal("sessionCost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("totalCost", { precision: 10, scale: 2 }).notNull(),

  financingStatus: mysqlEnum("financingStatus", [
    "معلق",
    "موافق عليه",
    "مدفوع",
    "مكتمل",
  ])
    .default("معلق")
    .notNull(),

  financeNotes: text("financeNotes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Financing = typeof financings.$inferSelect;
export type InsertFinancing = typeof financings.$inferInsert;

/**
 * Alerts
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  alertType: mysqlEnum("alertType", ["غياب", "حالة حرجة", "متعثرة", "أخرى"])
    .notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Reports
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId"),
  reportType: mysqlEnum("reportType", ["حالات", "جلسات", "أثر", "شامل"])
    .notNull(),
  content: text("content").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Relations
 */
export const organizationsRelations = relations(organizations, ({ many }) => ({
  cases: many(cases),
}));

export const casesRelations = relations(cases, ({ many, one }) => ({
  organizationRef: one(organizations, {
    fields: [cases.organizationId],
    references: [organizations.id],
  }),
  sessions: many(sessions),
  impactMeasurements: many(impactMeasurements),
  familyCompliances: many(familyCompliances),
  financings: many(financings),
  alerts: many(alerts),
  reports: many(reports),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  case: one(cases, {
    fields: [sessions.caseId],
    references: [cases.id],
  }),
}));

export const impactMeasurementsRelations = relations(
  impactMeasurements,
  ({ one }) => ({
    case: one(cases, {
      fields: [impactMeasurements.caseId],
      references: [cases.id],
    }),
  })
);

export const familyCompliancesRelations = relations(
  familyCompliances,
  ({ one }) => ({
    case: one(cases, {
      fields: [familyCompliances.caseId],
      references: [cases.id],
    }),
  })
);

export const financingsRelations = relations(financings, ({ one }) => ({
  case: one(cases, {
    fields: [financings.caseId],
    references: [cases.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  case: one(cases, {
    fields: [alerts.caseId],
    references: [cases.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  case: one(cases, {
    fields: [reports.caseId],
    references: [cases.id],
  }),
}));