CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`city` varchar(255) NOT NULL,
	`type` enum('ذوي الإعاقة','الأيتام','الطفولة','التنمية الأسرية','التوحد','أخرى') NOT NULL DEFAULT 'أخرى',
	`managerName` varchar(255),
	`phone` varchar(50),
	`email` varchar(320),
	`status` enum('نشطة','موقوفة','تحت المراجعة') NOT NULL DEFAULT 'نشطة',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `financings` MODIFY COLUMN `financingStatus` enum('معلق','موافق عليه','مدفوع','مكتمل') NOT NULL DEFAULT 'معلق';--> statement-breakpoint
ALTER TABLE `sessions` MODIFY COLUMN `progress` enum('تحسن','ثابت','تراجع') NOT NULL DEFAULT 'ثابت';--> statement-breakpoint
ALTER TABLE `cases` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `familyCompliances` ADD `commitmentLevel` enum('مرتفع','متوسط','منخفض') DEFAULT 'متوسط' NOT NULL;--> statement-breakpoint
ALTER TABLE `familyCompliances` ADD `barrierType` varchar(255);--> statement-breakpoint
ALTER TABLE `financings` ADD `fundingSource` varchar(255);--> statement-breakpoint
ALTER TABLE `financings` ADD `approvedSessionCount` int;--> statement-breakpoint
ALTER TABLE `financings` ADD `usedSessionCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `financings` ADD `financeNotes` text;--> statement-breakpoint
ALTER TABLE `impactMeasurements` ADD `testName` varchar(255) DEFAULT 'قياس عام' NOT NULL;--> statement-breakpoint
ALTER TABLE `impactMeasurements` ADD `valueType` enum('رقم','نسبة مئوية') DEFAULT 'رقم' NOT NULL;--> statement-breakpoint
ALTER TABLE `impactMeasurements` ADD `betterDirection` enum('أعلى أفضل','أقل أفضل') DEFAULT 'أعلى أفضل' NOT NULL;--> statement-breakpoint
ALTER TABLE `impactMeasurements` ADD `interpretation` varchar(255);