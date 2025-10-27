/**
 * progress-tracker.ts
 *
 * In-Memory Progress Tracking Service
 * Tracks real-time progress of AI analysis generation
 *
 * Features:
 * - Stores progress by unique analysis ID
 * - Supports multiple concurrent analyses
 * - Auto-cleanup of expired progress data
 * - Thread-safe operations
 */

import { v4 as uuidv4 } from 'uuid';

interface PhaseTimingData {
  phaseName: string;
  estimate: number;  // seconds
  startTime?: Date;
  actualDuration?: number;  // seconds
}

interface ProgressData {
  analysisId: string;
  stage: string;
  percentage: number;
  status: 'in_progress' | 'completed' | 'error';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  result?: any; // Store final analysis result
  // New timing fields
  phaseNumber?: number;
  totalPhases?: number;
  phaseTimings?: PhaseTimingData[];
  totalElapsedSeconds?: number;
  totalRemainingSeconds?: number;
}

class ProgressTracker {
  private progressMap: Map<string, ProgressData>;
  private readonly EXPIRY_TIME_MS = 10 * 60 * 1000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.progressMap = new Map();
    this.startCleanupTimer();
  }

  /**
   * Generate unique analysis ID using UUID v4
   *
   * @returns {string} Unique analysis identifier (UUID v4 format)
   * @example
   * const analysisId = progressTracker.generateAnalysisId();
   * // Returns: "123e4567-e89b-12d3-a456-426614174000"
   */
  generateAnalysisId(): string {
    return uuidv4();
  }

  /**
   * Initialize progress tracking for new analysis
   *
   * Creates new progress entry with 0% completion and 'in_progress' status.
   * This should be called when starting a new analysis generation.
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @returns {void}
   * @example
   * const analysisId = progressTracker.generateAnalysisId();
   * progressTracker.initializeProgress(analysisId);
   */
  initializeProgress(analysisId: string): void {
    const now = new Date();
    this.progressMap.set(analysisId, {
      analysisId,
      stage: 'Initializing...',
      percentage: 0,
      status: 'in_progress',
      createdAt: now,
      updatedAt: now
    });
    console.log(`[ProgressTracker] Initialized progress for analysis: ${analysisId}`);
  }

  /**
   * Initialize phase timing tracking
   *
   * Sets up the 5 phases with their estimates and starts tracking timing
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @returns {void}
   */
  initializePhaseTimings(analysisId: string): void {
    const existing = this.progressMap.get(analysisId);

    if (!existing) {
      console.warn(`[ProgressTracker] Cannot initialize phase timings for non-existent analysis: ${analysisId}`);
      return;
    }

    const phaseTimings: PhaseTimingData[] = [
      { phaseName: 'Company Analysis', estimate: 30 },
      { phaseName: 'Contact Persona', estimate: 30 },
      { phaseName: 'Influence Tactics', estimate: 30 },
      { phaseName: 'Discussion Points', estimate: 30 },
      { phaseName: 'Objection Handling', estimate: 30 }
    ];

    this.progressMap.set(analysisId, {
      ...existing,
      phaseNumber: 0,
      totalPhases: 5,
      phaseTimings,
      totalElapsedSeconds: 0,
      totalRemainingSeconds: 150, // 5 phases × 30 seconds
      updatedAt: new Date()
    });

    console.log(`[ProgressTracker] Initialized phase timings for: ${analysisId}`);
  }

  /**
   * Update phase progress with timing
   *
   * Updates the current phase, calculates elapsed and remaining time
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @param {number} phaseNumber - Current phase number (1-5)
   * @param {string} stage - Description of current stage
   * @param {number} percentage - Completion percentage (0-100)
   * @returns {void}
   */
  updatePhaseProgress(analysisId: string, phaseNumber: number, stage: string, percentage: number): void {
    const existing = this.progressMap.get(analysisId);

    if (!existing || !existing.phaseTimings) {
      console.warn(`[ProgressTracker] Cannot update phase progress - phase timings not initialized: ${analysisId}`);
      return;
    }

    const now = new Date();
    const phaseTimings = [...existing.phaseTimings];
    const currentPhaseIndex = phaseNumber - 1;

    // Start timing for new phase
    if (!phaseTimings[currentPhaseIndex].startTime) {
      phaseTimings[currentPhaseIndex].startTime = now;
    }

    // Mark previous phase as complete if moving to new phase
    if (phaseNumber > (existing.phaseNumber || 0)) {
      const previousPhaseIndex = phaseNumber - 2;
      if (previousPhaseIndex >= 0 && phaseTimings[previousPhaseIndex].startTime && !phaseTimings[previousPhaseIndex].actualDuration) {
        const startTime = phaseTimings[previousPhaseIndex].startTime!;
        phaseTimings[previousPhaseIndex].actualDuration = Math.round((now.getTime() - startTime.getTime()) / 1000);
      }
    }

    // Calculate total elapsed
    let totalElapsed = 0;
    for (let i = 0; i < phaseTimings.length; i++) {
      if (phaseTimings[i].actualDuration) {
        totalElapsed += phaseTimings[i].actualDuration!;
      } else if (i === currentPhaseIndex && phaseTimings[i].startTime) {
        // Add current phase elapsed time
        totalElapsed += Math.round((now.getTime() - phaseTimings[i].startTime!.getTime()) / 1000);
      }
    }

    // Calculate total remaining
    let totalRemaining = 0;
    for (let i = currentPhaseIndex; i < phaseTimings.length; i++) {
      if (i === currentPhaseIndex && phaseTimings[i].startTime) {
        // Current phase: estimate minus elapsed
        const currentElapsed = Math.round((now.getTime() - phaseTimings[i].startTime!.getTime()) / 1000);
        totalRemaining += Math.max(0, phaseTimings[i].estimate - currentElapsed);
      } else if (i > currentPhaseIndex) {
        // Future phases: use estimate
        totalRemaining += phaseTimings[i].estimate;
      }
    }

    this.progressMap.set(analysisId, {
      ...existing,
      stage,
      percentage,
      phaseNumber,
      phaseTimings,
      totalElapsedSeconds: totalElapsed,
      totalRemainingSeconds: totalRemaining,
      status: 'in_progress',
      updatedAt: now
    });

    console.log(`[ProgressTracker] Updated phase progress ${analysisId}: Phase ${phaseNumber}/5 - ${stage} (${percentage}%) | Elapsed: ${totalElapsed}s | Remaining: ~${totalRemaining}s`);
  }

  /**
   * Update progress for an analysis
   *
   * Updates the current stage and percentage completion. The status will remain
   * 'in_progress' - only setCompleted() or setError() should change the status.
   * If the analysisId doesn't exist, it will be auto-initialized.
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @param {string} stage - Description of current stage (e.g., "Analyzing company...")
   * @param {number} percentage - Completion percentage (0-100)
   * @returns {void}
   * @example
   * progressTracker.setProgress(analysisId, "Analyzing company landscape...", 20);
   * progressTracker.setProgress(analysisId, "Generating persona...", 40);
   */
  setProgress(analysisId: string, stage: string, percentage: number): void {
    const existing = this.progressMap.get(analysisId);

    if (!existing) {
      console.warn(`[ProgressTracker] Analysis ID not found: ${analysisId}`);
      // Initialize if not exists (fallback)
      this.initializeProgress(analysisId);
    }

    this.progressMap.set(analysisId, {
      ...existing!,
      stage,
      percentage,
      // Keep status as 'in_progress' - only setCompleted should change to 'completed'
      status: 'in_progress',
      updatedAt: new Date()
    });

    console.log(`[ProgressTracker] Updated ${analysisId}: ${stage} (${percentage}%)`);
  }

  /**
   * Mark analysis as completed and store result
   *
   * Sets status to 'completed', percentage to 100, and stores the final analysis result.
   * The result can then be retrieved via getResult() or getProgress().
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @param {any} result - Complete analysis result object
   * @returns {void}
   * @example
   * const result = {
   *   companyAnalysis: {...},
   *   contactPersona: {...},
   *   influenceTactics: {...}
   * };
   * progressTracker.setCompleted(analysisId, result);
   */
  setCompleted(analysisId: string, result: any): void {
    const existing = this.progressMap.get(analysisId);

    if (!existing) {
      console.warn(`[ProgressTracker] Cannot complete non-existent analysis: ${analysisId}`);
      return;
    }

    this.progressMap.set(analysisId, {
      ...existing,
      stage: 'Analysis complete!',
      percentage: 100,
      status: 'completed',
      updatedAt: new Date(),
      result
    });

    console.log(`[ProgressTracker] Completed analysis: ${analysisId}`);
  }

  /**
   * Mark analysis as failed
   *
   * Sets status to 'error' and stores the error message.
   * The analysis will no longer be updated after calling this method.
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @param {string} error - Error message describing what went wrong
   * @returns {void}
   * @example
   * progressTracker.setError(analysisId, "AI API request failed: 429 rate limit");
   */
  setError(analysisId: string, error: string): void {
    const existing = this.progressMap.get(analysisId);

    if (!existing) {
      console.warn(`[ProgressTracker] Cannot set error for non-existent analysis: ${analysisId}`);
      return;
    }

    this.progressMap.set(analysisId, {
      ...existing,
      status: 'error',
      error,
      updatedAt: new Date()
    });

    console.error(`[ProgressTracker] Error in analysis ${analysisId}: ${error}`);
  }

  /**
   * Get current progress for an analysis
   *
   * Returns a copy of the progress data to prevent external modification.
   * Use this to check current status, stage, and percentage.
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @returns {ProgressData | null} Progress data object, or null if not found
   * @example
   * const progress = progressTracker.getProgress(analysisId);
   * if (progress) {
   *   console.log(`${progress.stage} (${progress.percentage}%)`);
   * }
   */
  getProgress(analysisId: string): ProgressData | null {
    const progress = this.progressMap.get(analysisId);

    if (!progress) {
      console.warn(`[ProgressTracker] Progress not found for: ${analysisId}`);
      return null;
    }

    return { ...progress }; // Return copy to prevent external modification
  }

  /**
   * Check if analysis exists in progress tracker
   *
   * Use this to validate analysisId before attempting to retrieve progress.
   * Returns true even if the analysis has completed or errored.
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @returns {boolean} True if analysis exists, false otherwise
   * @example
   * if (!progressTracker.exists(analysisId)) {
   *   return ctx.notFound({ error: { message: 'Analysis not found' } });
   * }
   */
  exists(analysisId: string): boolean {
    return this.progressMap.has(analysisId);
  }

  /**
   * Get analysis result (only if completed)
   *
   * Returns the final analysis result only if status is 'completed'.
   * Returns null if the analysis doesn't exist or hasn't completed yet.
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @returns {any | null} Analysis result object, or null if not completed
   * @example
   * const result = progressTracker.getResult(analysisId);
   * if (result) {
   *   // Analysis is complete - use result
   *   return ctx.send({ success: true, data: result });
   * }
   */
  getResult(analysisId: string): any | null {
    const progress = this.progressMap.get(analysisId);

    if (!progress) {
      console.warn(`[ProgressTracker] Result not found for: ${analysisId}`);
      return null;
    }

    if (progress.status !== 'completed') {
      console.warn(`[ProgressTracker] Analysis not yet completed: ${analysisId}`);
      return null;
    }

    return progress.result;
  }

  /**
   * Delete progress data for an analysis
   *
   * Manually removes progress data from the tracker.
   * Use this for immediate cleanup after result is retrieved,
   * or to cancel an in-progress analysis.
   *
   * @param {string} analysisId - Unique identifier for the analysis
   * @returns {boolean} True if deleted, false if didn't exist
   * @example
   * // Clean up after retrieving result
   * const result = progressTracker.getResult(analysisId);
   * progressTracker.deleteProgress(analysisId);
   */
  deleteProgress(analysisId: string): boolean {
    const deleted = this.progressMap.delete(analysisId);

    if (deleted) {
      console.log(`[ProgressTracker] Deleted progress for: ${analysisId}`);
    } else {
      console.warn(`[ProgressTracker] Could not delete non-existent analysis: ${analysisId}`);
    }

    return deleted;
  }

  /**
   * Get all active analysis IDs
   *
   * Returns array of all tracked analysis IDs (in_progress, completed, and error).
   * Useful for debugging, monitoring, or admin dashboards.
   *
   * @returns {string[]} Array of analysis IDs currently being tracked
   * @example
   * const activeIds = progressTracker.getActiveAnalyses();
   * console.log(`Tracking ${activeIds.length} analyses`);
   */
  getActiveAnalyses(): string[] {
    return Array.from(this.progressMap.keys());
  }

  /**
   * Get count of tracked analyses
   *
   * Returns the total number of analyses currently in the progress tracker.
   * Includes in_progress, completed, and error status analyses.
   *
   * @returns {number} Number of analyses being tracked
   * @example
   * console.log(`Currently tracking ${progressTracker.getCount()} analyses`);
   */
  getCount(): number {
    return this.progressMap.size;
  }

  /**
   * Start automatic cleanup timer
   * Removes expired progress data every 5 minutes
   */
  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredProgress();
    }, 5 * 60 * 1000);

    console.log('[ProgressTracker] Started automatic cleanup timer');
  }

  /**
   * Clean up expired progress data
   * Removes entries older than EXPIRY_TIME_MS
   */
  private cleanupExpiredProgress(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [analysisId, progress] of this.progressMap.entries()) {
      const ageMs = now.getTime() - progress.updatedAt.getTime();

      if (ageMs > this.EXPIRY_TIME_MS) {
        this.progressMap.delete(analysisId);
        cleanedCount++;
        console.log(`[ProgressTracker] Cleaned up expired analysis: ${analysisId} (age: ${Math.round(ageMs / 1000 / 60)}min)`);
      }
    }

    if (cleanedCount > 0) {
      console.log(`[ProgressTracker] Cleanup complete: Removed ${cleanedCount} expired entries. Remaining: ${this.progressMap.size}`);
    }
  }

  /**
   * Manual cleanup trigger (for testing or shutdown)
   */
  cleanupNow(): number {
    const before = this.progressMap.size;
    this.cleanupExpiredProgress();
    return before - this.progressMap.size;
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[ProgressTracker] Stopped cleanup timer');
    }
  }

  /**
   * Clear all progress data (for testing)
   */
  clearAll(): void {
    const count = this.progressMap.size;
    this.progressMap.clear();
    console.log(`[ProgressTracker] Cleared all progress data (${count} entries)`);
  }
}

// Singleton instance
const progressTracker = new ProgressTracker();

// Export singleton instance
export default progressTracker;

// Export types for use in other modules
export type { ProgressData, PhaseTimingData };
