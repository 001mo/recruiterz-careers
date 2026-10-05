import type { PublicJob } from "./intake";

export type ApplicationProgress = {
  reference: string; job: PublicJob; submitted_at: string | null; closed_at: string | null;
  status: "submitted" | "under_review" | "hired" | "not_selected" | "withdrawn";
  status_label: string; can_withdraw: boolean; version: number; requested_actions: [];
};

export function progressDescription(status: ApplicationProgress["status"]): string {
  switch (status) {
    case "submitted": return "The hiring team has received your application.";
    case "under_review": return "The hiring team is reviewing your application. No action is needed from you right now.";
    case "hired": return "The hiring team has marked your application as hired. Follow their instructions for your next steps.";
    case "not_selected": return "The hiring team has decided not to move forward with this application.";
    case "withdrawn": return "Your application has been withdrawn and is no longer being considered.";
  }
}
