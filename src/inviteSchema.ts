import mongoose, { Schema, Document, Model, Connection } from "mongoose";
import { InviteSchema } from "./types";

/**
 * Interface for bonus invite records in MongoDB.
 */
export interface BonusInviteDocument extends Document {
	guildId: string;
	userId: string;
	bonus: number;
}

/**
 * Schema for member invite records in MongoDB.
 */
export const InviteMongooseSchema: Schema = new Schema({
	guildId: {
		type: String,
		required: true,
		index: true,
	},
	inviteeId: {
		type: String,
		required: true,
		index: true,
	},
	inviterId: {
		type: String,
		index: true,
		default: null,
	},
	inviteCode: {
		type: String,
		default: null,
	},
	joinType: {
		type: String,
		enum: ["normal", "vanity", "unknown", "bot"],
		required: true,
	},
	joinedAt: {
		type: Date,
		required: true,
		index: true,
	},
	leftAt: {
		type: Date,
		default: null,
		index: true,
	},
	fake: {
		type: Boolean,
		default: false,
		index: true,
	},
});

// Compound indexes for optimized query performance in large guilds
InviteMongooseSchema.index({ guildId: 1, inviterId: 1, leftAt: 1, fake: 1 });
InviteMongooseSchema.index({ guildId: 1, inviteeId: 1, leftAt: 1, joinedAt: -1 });

/**
 * Schema for manual bonus / penalty invite counts.
 */
export const BonusMongooseSchema: Schema = new Schema({
	guildId: {
		type: String,
		required: true,
		index: true,
	},
	userId: {
		type: String,
		required: true,
		index: true,
	},
	bonus: {
		type: Number,
		default: 0,
	},
});

BonusMongooseSchema.index({ guildId: 1, userId: 1 }, { unique: true });

/**
 * Safely retrieve or compile the Mongoose model for invites, preventing OverwriteModelError.
 */
export function getInviteModel(
	modelName: string = "inviteSchema",
	connection?: Connection
): Model<InviteSchema & Document> {
	if (connection) {
		return (
			(connection.models[modelName] as Model<InviteSchema & Document>) ||
			connection.model<InviteSchema & Document>(modelName, InviteMongooseSchema)
		);
	}
	return (
		(mongoose.models[modelName] as Model<InviteSchema & Document>) ||
		mongoose.model<InviteSchema & Document>(modelName, InviteMongooseSchema)
	);
}

/**
 * Safely retrieve or compile the Mongoose model for bonus invites.
 */
export function getBonusInviteModel(
	modelName: string = "bonusInviteSchema",
	connection?: Connection
): Model<BonusInviteDocument> {
	if (connection) {
		return (
			(connection.models[modelName] as Model<BonusInviteDocument>) ||
			connection.model<BonusInviteDocument>(modelName, BonusMongooseSchema)
		);
	}
	return (
		(mongoose.models[modelName] as Model<BonusInviteDocument>) ||
		mongoose.model<BonusInviteDocument>(modelName, BonusMongooseSchema)
	);
}
