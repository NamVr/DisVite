import { Schema, Document, Model, Connection } from "mongoose";
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
export declare const InviteMongooseSchema: Schema;
/**
 * Schema for manual bonus / penalty invite counts.
 */
export declare const BonusMongooseSchema: Schema;
/**
 * Safely retrieve or compile the Mongoose model for invites, preventing OverwriteModelError.
 */
export declare function getInviteModel(modelName?: string, connection?: Connection): Model<InviteSchema & Document>;
/**
 * Safely retrieve or compile the Mongoose model for bonus invites.
 */
export declare function getBonusInviteModel(modelName?: string, connection?: Connection): Model<BonusInviteDocument>;
