"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildTaskQueue = void 0;
/**
 * Serialized per-guild asynchronous task queue.
 * Guarantees FIFO execution of join reconciliation tasks per guild to prevent
 * REST rate limits and race conditions during high-volume join storms.
 */
class GuildTaskQueue {
    constructor() {
        this.queues = new Map();
        this.queueDepths = new Map();
    }
    /**
     * Enqueue a task for a specific guild. Tasks for the same guild are executed sequentially,
     * while tasks for different guilds run concurrently.
     *
     * @param guildId The guild identifier.
     * @param task The async callback to execute.
     * @returns The resolved value of the task.
     */
    async enqueue(guildId, task) {
        const currentDepth = (this.queueDepths.get(guildId) || 0) + 1;
        this.queueDepths.set(guildId, currentDepth);
        const currentQueue = this.queues.get(guildId) || Promise.resolve();
        const nextPromise = currentQueue
            .catch(() => {
            // Prevent unhandled rejections from previous failed tasks breaking the queue chain.
        })
            .then(() => task());
        this.queues.set(guildId, nextPromise);
        try {
            return await nextPromise;
        }
        finally {
            const remaining = (this.queueDepths.get(guildId) || 1) - 1;
            if (remaining <= 0) {
                this.queueDepths.delete(guildId);
                // If this was the last promise in the chain for this guild, purge the queue to avoid memory leaks.
                if (this.queues.get(guildId) === nextPromise) {
                    this.queues.delete(guildId);
                }
            }
            else {
                this.queueDepths.set(guildId, remaining);
            }
        }
    }
    /**
     * Returns the number of guilds currently running or waiting on queued tasks.
     */
    get activeGuilds() {
        return this.queues.size;
    }
    /**
     * Get the number of pending tasks for a specific guild.
     */
    getQueueDepth(guildId) {
        return this.queueDepths.get(guildId) || 0;
    }
    /**
     * Clear all queues.
     */
    clear() {
        this.queues.clear();
        this.queueDepths.clear();
    }
}
exports.GuildTaskQueue = GuildTaskQueue;
