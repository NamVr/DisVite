import { Schema, Document, Model } from "mongoose";
import { InviteSchema } from "./types";
/**
 * Interface representing the schema for an invite in the database.
 */
declare const InviteSchema: Schema;
export declare function getInviteModel(modelName?: string): Model<InviteSchema & Document>;
export {};
