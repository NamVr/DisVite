/**
 * Serialized per-guild asynchronous task queue.
 * Guarantees FIFO execution of join reconciliation tasks per guild to prevent
 * REST rate limits and race conditions during high-volume join storms.
 */
export declare class GuildTaskQueue {
    private queues;
    private queueDepths;
    /**
     * Enqueue a task for a specific guild. Tasks for the same guild are executed sequentially,
     * while tasks for different guilds run concurrently.
     *
     * @param guildId The guild identifier.
     * @param task The async callback to execute.
     * @returns The resolved value of the task.
     */
    enqueue<T>(guildId: string, task: () => Promise<T>): Promise<T>;
    /**
     * Returns the number of guilds currently running or waiting on queued tasks.
     */
    get activeGuilds(): number;
    /**
     * Get the number of pending tasks for a specific guild.
     */
    getQueueDepth(guildId: string): number;
    /**
     * Clear all queues.
     */
    clear(): void;
}
