/**
 * CommandHistory - Undo/redo system with transaction grouping.
 * Supports grouping multiple commands into single undo steps (e.g., pointer drag).
 */

import { type Command, type CommandResult } from '../commands/commands';

/** History entry */
export interface HistoryEntry {
  command: Command;
  result: CommandResult;
  timestamp: number;
  /** Optional group ID for related commands (e.g., drag operations) */
  groupId: string | undefined;
}

/** Transaction for grouping commands */
export interface Transaction {
  id: string;
  description: string;
  commands: Command[];
  results: CommandResult[];
  timestamp: number;
  isOpen: boolean;
}

/** CommandHistory configuration */
export interface CommandHistoryConfig {
  /** Maximum number of history entries */
  maxEntries: number;
  /** Whether to coalesce rapid commands of same type */
  coalesceEnabled: boolean;
  /** Time window for coalescing (ms) */
  coalesceWindow: number;
}

export const DEFAULT_HISTORY_CONFIG: CommandHistoryConfig = {
  maxEntries: 1000,
  coalesceEnabled: true,
  coalesceWindow: 100, // ms
};

/**
 * CommandHistory - Manages undo/redo stack with transaction support
 */
export class CommandHistory {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private currentTransaction: Transaction | null = null;
  private config: CommandHistoryConfig;
  private lastCommandTime: number = 0;
  private lastCommandType: string | null = null;

  constructor(config: Partial<CommandHistoryConfig> = {}) {
    this.config = { ...DEFAULT_HISTORY_CONFIG, ...config };
  }

  /** Execute a command and record it */
  execute(command: Command): CommandResult {
    const now = Date.now();

    // Check if we should merge with previous command
    if (this.config.coalesceEnabled && this.past.length > 0) {
      const lastEntry = this.past[this.past.length - 1];
      if (lastEntry && lastEntry.command && typeof command.canMerge === 'function') {
        const timeDiff = now - this.lastCommandTime;
        const sameType = this.lastCommandType === command.constructor.name;
        
        if (timeDiff <= this.config.coalesceWindow && sameType && typeof command.canMerge === 'function') {
          const canMerge = lastEntry.command.canMerge?.(command);
          if (canMerge) {
            // Merge: undo last command, then execute merged command
            lastEntry.command.undo(lastEntry.result.undoData);
            const merged = lastEntry.command.merge?.(command);
            if (merged) {
              const mergedResult = merged.execute();
              this.past[this.past.length - 1] = { command: merged, result: mergedResult, timestamp: now, groupId: undefined };
              this.lastCommandTime = now;
              this.lastCommandType = command.constructor.name;
              this.future = []; // Clear future on new command
              return mergedResult;
            }
          }
        }
      }
    }

    // Execute command normally
    const result = command.execute();

    // Add to history
    const groupId = this.currentTransaction?.id;
    this.past.push({ command, result, timestamp: now, groupId });
    this.lastCommandTime = now;
    this.lastCommandType = command.constructor.name;

    // Trim history if needed
    if (this.past.length > this.config.maxEntries) {
      this.past.shift();
    }

    // Clear future on new command
    this.future = [];

    return result;
  }

  /** Undo the last command (or group of commands with same groupId) */
  undo(): CommandResult | null {
    if (this.past.length === 0) return null;

    const entry = this.past.pop();
    if (!entry) return null;
    
    entry.command.undo(entry.result.undoData);
    
    // If this entry has a groupId, undo all other entries with the same groupId
    if (entry.groupId) {
      const groupEntries: HistoryEntry[] = [];
      // Collect all entries with the same groupId (newest first)
      while (this.past.length > 0) {
        const lastEntry = this.past[this.past.length - 1];
        if (lastEntry && lastEntry.groupId === entry.groupId) {
          groupEntries.push(this.past.pop()!);
        } else {
          break;
        }
      }
      // Undo in order (newest first - already in correct order from popping)
      for (const groupedEntry of groupEntries) {
        groupedEntry.command.undo(groupedEntry.result.undoData);
      }
      // Add all to future (maintaining order: entry first, then grouped in chronological order)
      this.future.push(entry, ...groupEntries.reverse());
    } else {
      this.future.push(entry);
    }
    
    return entry.result;
  }

  /** Redo the last undone command (or group) */
  redo(): CommandResult | null {
    if (this.future.length === 0) return null;

    const entry = this.future.pop();
    if (!entry) return null;
    
    const result = entry.command.execute();
    
    // If this entry has a groupId, redo all other entries with the same groupId
    if (entry.groupId) {
      const groupEntries: HistoryEntry[] = [];
      // Collect all entries with the same groupId
      while (this.future.length > 0) {
        const lastEntry = this.future[this.future.length - 1];
        if (lastEntry && lastEntry.groupId === entry.groupId) {
          groupEntries.push(this.future.pop()!);
        } else {
          break;
        }
      }
      // Redo in order
      for (const groupedEntry of groupEntries) {
        groupedEntry.command.execute();
      }
      // Add all to past
      this.past.push(entry, ...groupEntries);
    } else {
      this.past.push({ command: entry.command, result, timestamp: Date.now(), groupId: undefined });
    }
    
    return result;
  }

  /** Check if undo is available */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /** Check if redo is available */
  canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Get undo description */
  getUndoDescription(): string | null {
    if (this.past.length === 0) return null;
    const entry = this.past[this.past.length - 1];
    if (entry && entry.groupId) {
      // Count grouped commands
      let count = 1;
      for (let i = this.past.length - 2; i >= 0; i--) {
        const pastEntry = this.past[i];
        if (pastEntry && pastEntry.groupId === entry.groupId) count++;
        else break;
      }
      return `${entry.command.description} (${count} commands)`;
    }
    return entry?.command.description ?? null;
  }

  /** Get redo description */
  getRedoDescription(): string | null {
    if (this.future.length === 0) return null;
    const entry = this.future[this.future.length - 1];
    if (entry && entry.groupId) {
      let count = 1;
      for (let i = this.future.length - 2; i >= 0; i--) {
        const futureEntry = this.future[i];
        if (futureEntry && futureEntry.groupId === entry.groupId) count++;
        else break;
      }
      return `${entry.command.description} (${count} commands)`;
    }
    return entry?.command.description ?? null;
  }

  /** Get past history (for UI) */
  getPast(): HistoryEntry[] {
    return [...this.past];
  }

  /** Get future history (for UI) */
  getFuture(): HistoryEntry[] {
    return [...this.future];
  }

  /** Clear all history */
  clear(): void {
    this.past = [];
    this.future = [];
    this.currentTransaction = null;
  }

  /** Start a new transaction */
  beginTransaction(description: string): void {
    if (this.currentTransaction) {
      throw new Error('Transaction already in progress');
    }
    this.currentTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      description,
      commands: [],
      results: [],
      timestamp: Date.now(),
      isOpen: true,
    };
  }

  /** Execute a command within the current transaction */
  executeInTransaction(command: Command): CommandResult {
    if (!this.currentTransaction) {
      throw new Error('No active transaction');
    }

    const result = command.execute();
    this.currentTransaction.commands.push(command);
    this.currentTransaction.results.push(result);
    return result;
  }

  /** Commit the current transaction - groups commands under a single groupId */
  commitTransaction(): void {
    if (!this.currentTransaction) {
      throw new Error('No active transaction');
    }

    const { commands, results, id, timestamp } = this.currentTransaction;
    
    if (commands.length > 0) {
      // Add all commands to history with the transaction's groupId
      // They were already executed during the transaction, so we just record them
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        const result = results[i];
        if (command && result) {
          this.past.push({
            command,
            result,
            timestamp: timestamp + i,
            groupId: id,
          });
        }
      }
      
      // Trim history if needed
      if (this.past.length > this.config.maxEntries) {
        this.past = this.past.slice(-this.config.maxEntries);
      }
    }

    this.currentTransaction.isOpen = false;
    this.currentTransaction = null;
    this.future = [];
  }

  /** Rollback the current transaction */
  rollbackTransaction(): void {
    if (!this.currentTransaction) {
      throw new Error('No active transaction');
    }

    // Undo all commands in reverse order
    for (let i = this.currentTransaction.commands.length - 1; i >= 0; i--) {
      const cmd = this.currentTransaction.commands[i];
      const result = this.currentTransaction.results[i];
      if (cmd && result) {
        cmd.undo(result.undoData);
      }
    }

    this.currentTransaction = null;
  }

  /** Get current transaction */
  getCurrentTransaction(): Transaction | null {
    return this.currentTransaction;
  }

  /** Check if in a transaction */
  isInTransaction(): boolean {
    return this.currentTransaction !== null && this.currentTransaction.isOpen;
  }

  /** Get history size */
  getSize(): { past: number; future: number } {
    return { past: this.past.length, future: this.future.length };
  }

  /** Get configuration */
  getConfig(): CommandHistoryConfig {
    return { ...this.config };
  }

  /** Update configuration */
  setConfig(config: Partial<CommandHistoryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/** Factory for creating command history */
export function createCommandHistory(config?: Partial<CommandHistoryConfig>): CommandHistory {
  return new CommandHistory(config);
}

/** Pointer drag transaction helper - groups rapid commands into one undo step */
export function createDragTransaction(
  history: CommandHistory,
  description: string,
  commands: Command[]
): void {
  history.beginTransaction(description);
  for (const cmd of commands) {
    history.executeInTransaction(cmd);
  }
  history.commitTransaction();
}
