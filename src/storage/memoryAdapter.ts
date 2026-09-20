import { InviteRecord, MemberInviteStats, StorageAdapter } from "../types";

/**
 * Ultra-fast, zero-dependency in-memory storage adapter.
 * Ideal for development, testing, lightweight bots, or bots that manage
 * their own persistent storage via event listeners.
 */
export class MemoryStorageAdapter implements StorageAdapter {
	private records: InviteRecord[] = [];
	private bonusInvites = new Map<string, number>();

	private getBonusKey(guildId: string, userId: string): string {
		return `${guildId}:${userId}`;
	}

	public async recordJoin(record: Omit<InviteRecord, "leftAt">): Promise<InviteRecord> {
		const fullRecord: InviteRecord = {
			...record,
			leftAt: null,
		};
		this.records.push(fullRecord);
		return fullRecord;
	}

	public async recordLeave(guildId: string, inviteeId: string): Promise<InviteRecord | null> {
		// Find latest active join record
		for (let i = this.records.length - 1; i >= 0; i--) {
			const rec = this.records[i];
			if (rec.guildId === guildId && rec.inviteeId === inviteeId && !rec.leftAt) {
				rec.leftAt = new Date();
				return rec;
			}
		}

		// Fallback: update latest record if none without leftAt
		for (let i = this.records.length - 1; i >= 0; i--) {
			const rec = this.records[i];
			if (rec.guildId === guildId && rec.inviteeId === inviteeId) {
				rec.leftAt = new Date();
				return rec;
			}
		}

		return null;
	}

	public async getMemberStats(guildId: string, userId: string): Promise<MemberInviteStats> {
		let total = 0;
		let left = 0;
		let fake = 0;

		for (const rec of this.records) {
			if (rec.guildId === guildId && rec.inviterId === userId) {
				total++;
				if (rec.fake) {
					fake++;
				}
				if (rec.leftAt) {
					left++;
				}
			}
		}

		const bonus = await this.getBonus(guildId, userId);
		const valid = Math.max(0, total - left - fake + bonus);

		return { total, valid, left, fake, bonus };
	}

	public async getLeaderboard(
		guildId: string,
		limit = 10
	): Promise<Array<{ userId: string; stats: MemberInviteStats }>> {
		const inviters = new Set<string>();

		for (const rec of this.records) {
			if (rec.guildId === guildId && rec.inviterId) {
				inviters.add(rec.inviterId);
			}
		}

		for (const key of this.bonusInvites.keys()) {
			if (key.startsWith(`${guildId}:`)) {
				inviters.add(key.split(":")[1]);
			}
		}

		const results: Array<{ userId: string; stats: MemberInviteStats }> = [];
		for (const userId of inviters) {
			const stats = await this.getMemberStats(guildId, userId);
			results.push({ userId, stats });
		}

		results.sort((a, b) => b.stats.valid - a.stats.valid);
		return results.slice(0, limit);
	}

	public async addBonus(guildId: string, userId: string, amount: number): Promise<number> {
		const key = this.getBonusKey(guildId, userId);
		const current = this.bonusInvites.get(key) || 0;
		const updated = current + amount;
		this.bonusInvites.set(key, updated);
		return updated;
	}

	public async getBonus(guildId: string, userId: string): Promise<number> {
		return this.bonusInvites.get(this.getBonusKey(guildId, userId)) || 0;
	}

	public async isFakeRejoin(
		guildId: string,
		inviteeId: string,
		thresholdMs: number
	): Promise<boolean> {
		const now = Date.now();
		for (let i = this.records.length - 1; i >= 0; i--) {
			const rec = this.records[i];
			if (rec.guildId === guildId && rec.inviteeId === inviteeId && rec.leftAt) {
				if (now - rec.leftAt.getTime() < thresholdMs) {
					return true;
				}
			}
		}
		return false;
	}

	public async clear(): Promise<void> {
		this.records = [];
		this.bonusInvites.clear();
	}
}
