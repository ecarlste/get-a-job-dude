CREATE TABLE "viewer_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "viewer_membership_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "viewer_membership" ADD CONSTRAINT "viewer_membership_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewer_membership" ADD CONSTRAINT "viewer_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;