import mongoose, { Connection, Model, Document } from "mongoose";
import {
	InviteRecord,
	InviteSchema,
	MemberInviteStats,
	StorageAdapter,
} from "../types";
import {
	BonusInviteDocument,
	getBonusInviteModel,
	getInviteModel,
} from "../inviteSchema";

export interface MongooseStorageOptions {
	mongoURI?: string;
	connection?: Connection;
	modelName?: string;
	bonusModelName?: string;
	onError?: (error: Error) => void;
	onDebug?: (message: string) => void;
}

/**
 * Production-ready Mongoose persistence adapter with single-roundtrip aggregations,
 * connection sharing, and atomic bonus counters.
 */
export class MongooseStorageAdapter implements StorageAdapter {
	private inviteModel: Model<InviteSchema & Document>;
	private bonusModel: Model<BonusInviteDocument>;
	private options: MongooseStorageOptions;
	private ownsConnection = false;

	constructor(options: MongooseStorageOptions) {
		this.options = options;
		const conn = options.connection;
		this.inviteModel = getInviteModel(options.modelName || "inviteSchema", conn);
		this.bonusModel = getBonusInviteModel(
			options.bonusModelName || "bonusInviteSchema",
			conn
		);
	}

	public async init(): Promise<void> {
		if (this.options.connection) {
			this.options.onDebug?.("DisVite: Reusing provided Mongoose connection.");
			return;
		}

		if (this.options.mongoURI) {
			this.ownsConnection = true;
			await this.connectWithRetry(this.options.mongoURI, 1);
		}
	}

	private async connectWithRetry(uri: string, attempt: number): Promise<void> {
		try {
			await mongoose.connect(uri);
			this.options.onDebug?.("DisVite: Connected to MongoDB successfully.");
		} catch (error: any) {
			this.options.onError?.(
				new Error(`DisVite: Failed to connect to MongoDB: ${error?.message || error}`)
			);

			if (attempt < 3) {
				this.options.onDebug?.(
					`DisVite: Retrying MongoDB connection in 2s (Attempt ${attempt + 1}/3)...`
				);
				await new Promise((resolve) => setTimeout(resolve, 2000));
				await this.connectWithRetry(uri, attempt + 1);
			} else {
				throw new Error("DisVite: Unable to establish MongoDB connection after 3 attempts.");
			}
		}
	}

	public async recordJoin(record: Omit<InviteRecord, "leftAt">): Promise<InviteRecord> {
		const doc = new this.inviteModel({
			guildId: record.guildId,
			inviteeId: record.inviteeId,
			inviterId: record.inviterId || null,
			inviteCode: record.inviteCode || null,
			joinType: record.joinType,
			joinedAt: record.joinedAt,
			leftAt: null,
			fake: record.fake,
		});

		const saved = await doc.save();
		return {
			guildId: saved.guildId,
			inviteeId: saved.inviteeId,
			inviterId: saved.inviterId,
			inviteCode: saved.inviteCode,
			joinType: saved.joinType,
			joinedAt: saved.joinedAt,
			leftAt: saved.leftAt,
			fake: saved.fake,
		};
	}

	public async recordLeave(guildId: string, inviteeId: string): Promise<InviteRecord | null> {
		const updated = await this.inviteModel
			.findOneAndUpdate(
				{ guildId, inviteeId, leftAt: null },
				{ leftAt: new Date() },
				{ sort: { joinedAt: -1 }, new: true }
			)
			.exec();

		if (updated) {
			return {
				guildId: updated.guildId,
				inviteeId: updated.inviteeId,
				inviterId: updated.inviterId,
				inviteCode: updated.inviteCode,
				joinType: updated.joinType,
				joinedAt: updated.joinedAt,
				leftAt: updated.leftAt,
				fake: updated.fake,
			};
		}

		return null;
	}

	public async getMemberStats(guildId: string, userId: string): Promise<MemberInviteStats> {
		const [statsAggregate, bonus] = await Promise.all([
			this.inviteModel
				.aggregate([
					{ $match: { guildId, inviterId: userId } },
					{
						$group: {
							_id: null,
							total: { $sum: 1 },
							left: {
								$sum: {
									$cond: [{ $ifNull: ["$leftAt", false] }, 1, 0],
								},
							},
							fake: {
								$sum: {
									$cond: ["$fake", 1, 0],
								},
							},
						},
					},
				])
				.exec(),
			this.getBonus(guildId, userId),
		]);

		const res = statsAggregate[0] || { total: 0, left: 0, fake: 0 };
		const valid = Math.max(0, res.total - res.left - res.fake + bonus);

		return {
			total: res.total,
			valid,
			left: res.left,
			fake: res.fake,
			bonus,
		};
	}

	public async getLeaderboard(
		guildId: string,
		limit = 10
	): Promise<Array<{ userId: string; stats: MemberInviteStats }>> {
		const [aggregates, bonuses] = await Promise.all([
			this.inviteModel
				.aggregate([
					{ $match: { guildId, inviterId: { $ne: null } } },
					{
						$group: {
							_id: "$inviterId",
							total: { $sum: 1 },
							left: {
								$sum: {
									$cond: [{ $ifNull: ["$leftAt", false] }, 1, 0],
								},
							},
							fake: {
								$sum: {
									$cond: ["$fake", 1, 0],
								},
							},
						},
					},
				])
				.exec(),
			this.bonusModel.find({ guildId }).lean().exec(),
		]);

		const bonusMap = new Map<string, number>();
		for (const b of bonuses) {
			bonusMap.set(b.userId, b.bonus || 0);
		}

		const userIds = new Set<string>();
		const statsMap = new Map<string, { total: number; left: number; fake: number }>();

		for (const row of aggregates) {
			if (row._id) {
				userIds.add(row._id);
				statsMap.set(row._id, { total: row.total, left: row.left, fake: row.fake });
			}
		}

		for (const b of bonuses) {
			userIds.add(b.userId);
		}

		const results: Array<{ userId: string; stats: MemberInviteStats }> = [];
		for (const userId of userIds) {
			const s = statsMap.get(userId) || { total: 0, left: 0, fake: 0 };
			const bonus = bonusMap.get(userId) || 0;
			const valid = Math.max(0, s.total - s.left - s.fake + bonus);
			results.push({
				userId,
				stats: {
					total: s.total,
					valid,
					left: s.left,
					fake: s.fake,
					bonus,
				},
			});
		}

		results.sort((a, b) => b.stats.valid - a.stats.valid);
		return results.slice(0, limit);
	}

	public async addBonus(guildId: string, userId: string, amount: number): Promise<number> {
		const doc = await this.bonusModel
			.findOneAndUpdate(
				{ guildId, userId },
				{ $inc: { bonus: amount } },
				{ upsert: true, new: true }
			)
			.exec();

		return doc?.bonus || 0;
	}

	public async getBonus(guildId: string, userId: string): Promise<number> {
		const doc = await this.bonusModel.findOne({ guildId, userId }).lean().exec();
		return doc?.bonus || 0;
	}

	public async isFakeRejoin(
		guildId: string,
		inviteeId: string,
		thresholdMs: number
	): Promise<boolean> {
		const recentRecord = await this.inviteModel
			.findOne({
				guildId,
				inviteeId,
				leftAt: { $ne: null },
			})
			.sort({ leftAt: -1 })
			.lean()
			.exec();

		if (recentRecord && recentRecord.leftAt) {
			const leftTime = new Date(recentRecord.leftAt).getTime();
			if (Date.now() - leftTime < thresholdMs) {
				return true;
			}
		}

		return false;
	}

	public async close(): Promise<void> {
		if (this.ownsConnection) {
			await mongoose.disconnect();
		}
	}
}
