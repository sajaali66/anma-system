CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`alertType` enum('غياب','حالة حرجة','متعثرة','أخرى') NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseNumber` varchar(50) NOT NULL,
	`childName` varchar(255) NOT NULL,
	`age` int NOT NULL,
	`city` varchar(255) NOT NULL,
	`organization` varchar(255) NOT NULL,
	`disorderType` varchar(255) NOT NULL,
	`specialist` varchar(255) NOT NULL,
	`referralType` enum('تكاملية','مساندة','لاحقة') NOT NULL,
	`status` enum('جديدة','نشطة','مكتملة','متعثرة') NOT NULL DEFAULT 'جديدة',
	`referralDate` timestamp NOT NULL,
	`highRisk` boolean DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `cases_caseNumber_unique` UNIQUE(`caseNumber`)
);
--> statement-breakpoint
CREATE TABLE `familyCompliance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`attendancePercentage` decimal(5,2) NOT NULL,
	`homeplanImplementation` boolean NOT NULL,
	`specialistNotes` text,
	`complianceDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `familyCompliance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`sessionCount` int NOT NULL,
	`sessionCost` decimal(10,2) NOT NULL,
	`totalCost` decimal(10,2) NOT NULL,
	`financingStatus` enum('معلق','موافق عليه','مدفوع') NOT NULL DEFAULT 'معلق',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `impactMeasurement` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`baseline` decimal(10,2) NOT NULL,
	`after` decimal(10,2) NOT NULL,
	`improvementPercentage` decimal(10,2) NOT NULL,
	`measurementDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `impactMeasurement_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int,
	`reportType` enum('حالات','جلسات','أثر','شامل') NOT NULL,
	`content` text NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`sessionDate` timestamp NOT NULL,
	`sessionType` varchar(255) NOT NULL,
	`attendance` enum('حاضر','غائب') NOT NULL,
	`notes` text,
	`progress` enum('تحسن','ثابت','تراجع') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
