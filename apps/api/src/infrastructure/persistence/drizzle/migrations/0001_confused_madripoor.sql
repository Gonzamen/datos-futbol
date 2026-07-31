CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"label" text NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"assignee_user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "possible_duplicate_of" uuid;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "segments_match_id_idx" ON "segments" USING btree ("match_id");