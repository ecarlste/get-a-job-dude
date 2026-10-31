CREATE TYPE "public"."loop_ending" AS ENUM('open', 'offer', 'rejected', 'withdrawn', 'ghosted');--> statement-breakpoint
ALTER TABLE "interview_loop" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_loop" ADD COLUMN "job_link" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_loop" ADD COLUMN "applied_on" date;--> statement-breakpoint
ALTER TABLE "interview_loop" ADD COLUMN "people" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_loop" ADD COLUMN "ending" "loop_ending" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_loop" ADD COLUMN "job_lead_id" uuid;