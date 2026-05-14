/**
 * FightEnded — emitted when an RPG combat resolves to a definitive
 * winner. Used by economy to award reward coins, by RPG profile to
 * update win/loss counters, by quest system to advance "win N fights"
 * progress.
 *
 * Why an event rather than direct calls into other features?
 * The list of things that should react to a fight ending is open-ended
 * and lives across multiple features. An event lets each feature
 * declare its reaction in its own handlers class without RPG having to
 * know who consumes it.
 */
export class FightEnded {
  constructor(
    public readonly winner: string,
    public readonly loser: string,
    public readonly reward: number,
    public readonly guildId: string,
  ) {}
}
