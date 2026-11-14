/**
 * Audit logging service: one immutable entry per admin write, partitioned by
 * month (AUDIT#yyyy-mm) so "recent activity" is a single cheap query.
 * Entries hold who/what/when and a short summary only, never tokens,
 * credentials or full customer records.
 */
import { randomUUID } from "node:crypto";
import { ENTITY, keys } from "./keys";
import type { Repository } from "./repository";
import { auditEntrySchema, auditInputSchema, type AuditEntry, type AuditInput } from "./schemas";

export class AuditService {
  constructor(
    private readonly repo: Repository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  buildEntry(input: AuditInput): AuditEntry {
    const data = auditInputSchema.parse({ ...input, summary: input.summary.slice(0, 500) });
    const at = this.now();
    const key = keys.audit(at, randomUUID().replace(/-/g, ""));
    const ts = at.toISOString();
    return { ...key, ...data, entityType: ENTITY.audit, createdAt: ts, updatedAt: ts, version: 1 };
  }

  async record(input: AuditInput): Promise<AuditEntry> {
    const entry = this.buildEntry(input);
    return this.repo.create(entry, auditEntrySchema);
  }

  /** Most recent entries (current month first, then the previous month). */
  async recent(limit = 20): Promise<AuditEntry[]> {
    const now = this.now();
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const out: AuditEntry[] = [];
    for (const month of [now, previous]) {
      if (out.length >= limit) break;
      const { items } = await this.repo.query(keys.auditPartition(month), auditEntrySchema, { limit: limit - out.length, newestFirst: true });
      out.push(...items);
    }
    return out;
  }
}
