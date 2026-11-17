CREATE TABLE `invitation_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`reporter_hash` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "invitation_reports_reason_check" CHECK("invitation_reports"."reason" in ('SPAM', 'INAPPROPRIATE', 'FRAUD', 'OTHER'))
);
--> statement-breakpoint
CREATE INDEX `invitation_reports_invitation_id_idx` ON `invitation_reports` (`invitation_id`);--> statement-breakpoint
ALTER TABLE `invitations` ADD `appearance_json` text;