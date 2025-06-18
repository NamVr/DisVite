import mongoose, { Schema } from "mongoose";
import { InviteSchema } from "./types";
/**
 * Interface representing the schema for an invite in the database.
 */
declare const InviteSchema: Schema;
declare const _default: mongoose.Model<InviteSchema, {}, {}, {}, mongoose.Document<unknown, {}, InviteSchema, {}> & InviteSchema & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, any>;
export default _default;
