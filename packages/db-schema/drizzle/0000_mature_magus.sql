CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_id_account_id_unique` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `catalog_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "catalog_templates_tier_check" CHECK("catalog_templates"."tier" in ('BASIC', 'PREMIUM'))
);
--> statement-breakpoint
CREATE TABLE `collaborators` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`label` text NOT NULL,
	`access_token` text NOT NULL,
	`pin_hash` text,
	`permissions_json` text DEFAULT '{}' NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collaborators_access_token_unique` ON `collaborators` (`access_token`);--> statement-breakpoint
CREATE INDEX `collaborators_invitation_id_idx` ON `collaborators` (`invitation_id`);--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`name` text NOT NULL,
	`phone_normalized` text,
	`category` text DEFAULT 'REGULER' NOT NULL,
	`allowed_event_ids_json` text DEFAULT '[]' NOT NULL,
	`max_pax` integer DEFAULT 1 NOT NULL,
	`table_number` text,
	`session_label` text,
	`qr_token` text NOT NULL,
	`wa_sent_status` text DEFAULT 'PENDING' NOT NULL,
	`wa_sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "guests_category_check" CHECK("guests"."category" in ('VIP', 'KELUARGA', 'REGULER')),
	CONSTRAINT "guests_wa_sent_status_check" CHECK("guests"."wa_sent_status" in ('PENDING', 'SENT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guests_qr_token_unique` ON `guests` (`qr_token`);--> statement-breakpoint
CREATE INDEX `guests_invitation_id_idx` ON `guests` (`invitation_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`template_id` text NOT NULL,
	`tier` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`content_json` text DEFAULT '{}' NOT NULL,
	`published_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `catalog_templates`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invitations_tier_check" CHECK("invitations"."tier" in ('BASIC', 'PREMIUM')),
	CONSTRAINT "invitations_status_check" CHECK("invitations"."status" in ('DRAFT', 'ACTIVE', 'EXPIRED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_slug_unique` ON `invitations` (`slug`);--> statement-breakpoint
CREATE INDEX `invitations_user_id_idx` ON `invitations` (`user_id`);--> statement-breakpoint
CREATE INDEX `invitations_template_id_idx` ON `invitations` (`template_id`);--> statement-breakpoint
CREATE TABLE `promos` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` integer NOT NULL,
	`partner_name` text,
	`commission_percent` integer,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "promos_discount_type_check" CHECK("promos"."discount_type" in ('PERCENT', 'FIXED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promos_code_unique` ON `promos` (`code`);--> statement-breakpoint
CREATE TABLE `rsvps` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`guest_id` text,
	`guest_name` text NOT NULL,
	`attendance` text NOT NULL,
	`guest_count` integer DEFAULT 1 NOT NULL,
	`message` text,
	`host_reply` text,
	`is_hidden` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "rsvps_attendance_check" CHECK("rsvps"."attendance" in ('HADIR', 'TIDAK_HADIR', 'RAGU'))
);
--> statement-breakpoint
CREATE INDEX `rsvps_invitation_id_idx` ON `rsvps` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `rsvps_guest_id_idx` ON `rsvps` (`guest_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`merchant_order_id` text NOT NULL,
	`gateway_provider` text DEFAULT 'SIMULATED' NOT NULL,
	`gateway_reference` text,
	`promo_code` text,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "transactions_gateway_provider_check" CHECK("transactions"."gateway_provider" in ('SIMULATED', 'DUITKU')),
	CONSTRAINT "transactions_status_check" CHECK("transactions"."status" in ('PENDING', 'PAID', 'FAILED', 'EXPIRED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_merchant_order_id_unique` ON `transactions` (`merchant_order_id`);--> statement-breakpoint
CREATE INDEX `transactions_invitation_id_idx` ON `transactions` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_id_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`role` text DEFAULT 'USER' NOT NULL,
	`whatsapp_number` text,
	CONSTRAINT "users_role_check" CHECK("users"."role" in ('USER', 'ADMIN'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);