import type { KpiComment, Market } from "./types";
import { API_BASE } from "./api";

/**
 * Shared KPI comments, stored server-side (see comments_store.py) so every user
 * with Galileo access sees the same threads. Not cached: a thread is fetched
 * when its panel opens, and writes go straight to the server.
 */
export interface SharedComment extends KpiComment {
  /** Written by the current user, so they may delete it. */
  mine: boolean;
}

export interface CommentThread {
  comments: SharedComment[];
  /** Display name the server will record as author. */
  me: string;
}

export interface NewComment {
  flow: string;
  market: Market;
  area: string;
  text: string;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) throw new Error(`Galileo comments: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export function fetchComments(flow: string, market: Market): Promise<CommentThread> {
  return call<CommentThread>(`comments?${new URLSearchParams({ flow, market })}`);
}

export async function postComment(comment: NewComment): Promise<SharedComment> {
  const body = await call<{ comment: SharedComment }>("comments", {
    method: "POST",
    body: JSON.stringify(comment),
  });
  return body.comment;
}

export async function deleteComment(id: string): Promise<void> {
  await call(`comments/${encodeURIComponent(id)}`, { method: "DELETE" });
}
