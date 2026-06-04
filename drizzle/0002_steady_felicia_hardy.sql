CREATE TABLE `familyCompliances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`attendancePercentage` decimal(5,2) NOT NULL,
	`homeplanImplementation` boolean NOT NULL,
	`specialistNotes` text,
	`complianceDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `familyCompliances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`sessionCount` int NOT NULL,
	`sessionCost` decimal(10,2) NOT NULL,
	`totalCost` decimal(10,2) NOT NULL,
	`financingStatus` enum('معلق','موافق عليه','مدفوع') NOT NULL DEFAULT 'معلق',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `impactMeasurements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`baseline` decimal(10,2) NOT NULL,
	`afterValue` decimal(10,2) NOT NULL,
	`improvementPercentage` decimal(10,2) NOT NULL,
	`measurementDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `impactMeasurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `familyCompliance`;--> statement-breakpoint
DROP TABLE `financing`;--> statement-breakpoint
DROP TABLE `impactMeasurement`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `alerts` MODIFY COLUMN `isRead` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `cases` MODIFY COLUMN `highRisk` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;