import data from "./content_comments.json";
import type { KpiComment } from "./types";

/**
 * Published efficiency-KPI comments, committed with the dashboard so everyone
 * who opens it sees the same set. Locally-added comments (compose form) live in
 * localStorage until copied here and committed.
 */
export const seededComments = (data as { comments: KpiComment[] }).comments;
