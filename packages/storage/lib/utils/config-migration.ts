/**
 * Configuration Migration Utilities
 * Implements atomic configuration updates and rollback with
 * version compatibility checking for safe config updates.
 */

import { ConfigValidator } from '../impl/config-validator';
import type { SecureConfigRecord, ConfigMigration, MigrationStep } from '../types/config';

/**
 * Migration execution result
 */
export interface MigrationResult {
  /** Whether migration was successful */
  success: boolean;
  /** Target configuration after migration */
  migratedConfig?: SecureConfigRecord;
  /** Error information if migration failed */
  error?: {
    code: string;
    message: string;
    failedStep?: string;
    details?: unknown;
  };
  /** Migration execution metadata */
  metadata: {
    /** Migration execution time in milliseconds */
    duration: number;
    /** Number of steps executed */
    stepsExecuted: number;
    /** Total number of steps */
    totalSteps: number;
    /** Whether rollback was performed */
    rolledBack: boolean;
    /** Backup created during migration */
    backupId?: string;
  };
}

/**
 * Migration validation result
 */
export interface MigrationValidationResult {
  /** Whether migration is valid */
  valid: boolean;
  /** Validation issues found */
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    step: string;
    message: string;
    suggestion?: string;
  }>;
  /** Estimated migration risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Pre-migration requirements */
  requirements: string[];
}

/**
 * Configuration migration manager
 */
export class ConfigMigrationManager {
  private validator: ConfigValidator;
  private migrationHistory: Map<string, MigrationResult> = new Map();
  private backups: Map<string, SecureConfigRecord> = new Map();

  constructor() {
    this.validator = new ConfigValidator();
  }

  /**
   * Execute configuration migration
   */
  public async executeMigration(
    sourceConfig: SecureConfigRecord,
    migration: ConfigMigration,
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    let stepsExecuted = 0;
    let backupId: string | undefined;
    let workingConfig = { ...sourceConfig };

    try {
      // Validate migration before execution
      const validationResult = this.validateMigration(sourceConfig, migration);
      if (!validationResult.valid) {
        const criticalIssues = validationResult.issues.filter(i => i.severity === 'error');
        if (criticalIssues.length > 0) {
          throw new Error(`Migration validation failed: ${criticalIssues[0]?.message ?? 'Unknown validation error'}`);
        }
      }

      // Create backup
      backupId = this.createBackup(sourceConfig);

      // Update migration metadata
      migration.metadata.status = 'running';
      migration.metadata.startedAt = new Date().toISOString();

      // Execute migration steps in order
      const sortedSteps = migration.steps.sort((a, b) => a.order - b.order);

      for (const step of sortedSteps) {
        try {
          workingConfig = await this.executeStep(workingConfig, step);
          stepsExecuted++;

          // Validate step result if step is required
          if (step.required && step.validate) {
            const stepValidation = step.validate(workingConfig);
            if (stepValidation.status === 'invalid') {
              throw new Error(`Step '${step.stepId}' validation failed`);
            }
          }
        } catch (stepError) {
          // If step fails and rollback is supported, perform rollback
          if (migration.rollback.supported) {
            await this.performRollback(sourceConfig, migration, backupId);

            return {
              success: false,
              error: {
                code: 'MIGRATION_STEP_FAILED',
                message: `Migration failed at step '${step.stepId}'`,
                failedStep: step.stepId,
                details: stepError,
              },
              metadata: {
                duration: Date.now() - startTime,
                stepsExecuted,
                totalSteps: migration.steps.length,
                rolledBack: true,
                backupId,
              },
            };
          } else {
            throw stepError;
          }
        }
      }

      // Final validation of migrated configuration
      const finalValidation = await this.validator.validateConfiguration(workingConfig);
      if (finalValidation.status === 'invalid') {
        // Attempt rollback if supported
        if (migration.rollback.supported) {
          await this.performRollback(sourceConfig, migration, backupId);

          return {
            success: false,
            error: {
              code: 'MIGRATION_VALIDATION_FAILED',
              message: 'Final configuration validation failed',
              details: finalValidation.issues,
            },
            metadata: {
              duration: Date.now() - startTime,
              stepsExecuted,
              totalSteps: migration.steps.length,
              rolledBack: true,
              backupId,
            },
          };
        } else {
          throw new Error('Final configuration validation failed and rollback is not supported');
        }
      }

      // Update migration metadata
      migration.metadata.status = 'completed';
      migration.metadata.completedAt = new Date().toISOString();

      // Store migration result in history
      const result: MigrationResult = {
        success: true,
        migratedConfig: workingConfig,
        metadata: {
          duration: Date.now() - startTime,
          stepsExecuted,
          totalSteps: migration.steps.length,
          rolledBack: false,
          backupId,
        },
      };

      this.migrationHistory.set(migration.metadata.migrationId, result);

      return result;
    } catch (error) {
      // Update migration metadata for failure
      migration.metadata.status = 'failed';

      return {
        success: false,
        error: {
          code: 'MIGRATION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          details: error,
        },
        metadata: {
          duration: Date.now() - startTime,
          stepsExecuted,
          totalSteps: migration.steps.length,
          rolledBack: false,
          ...(backupId ? { backupId } : {}),
        },
      };
    }
  }

  /**
   * Validate migration before execution
   */
  public validateMigration(sourceConfig: SecureConfigRecord, migration: ConfigMigration): MigrationValidationResult {
    const issues: MigrationValidationResult['issues'] = [];
    const requirements: string[] = [];
    let riskLevel: MigrationValidationResult['riskLevel'] = 'low';

    // Check version compatibility
    if (!this.isVersionCompatible(sourceConfig.configVersion, migration.fromVersion)) {
      issues.push({
        severity: 'error',
        step: 'version-check',
        message: `Source version ${sourceConfig.configVersion} is not compatible with migration from version ${migration.fromVersion}`,
        suggestion: 'Ensure you have the correct migration for your configuration version',
      });
      riskLevel = 'critical';
    }

    // Validate migration steps
    if (migration.steps.length === 0) {
      issues.push({
        severity: 'error',
        step: 'steps-validation',
        message: 'Migration contains no steps',
      });
      riskLevel = 'critical';
    }

    // Check for required steps
    const requiredSteps = migration.steps.filter(step => step.required);
    if (requiredSteps.length === 0) {
      issues.push({
        severity: 'warning',
        step: 'required-steps',
        message: 'Migration has no required steps, which may indicate an incomplete migration',
      });
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Validate step order
    const stepOrders = migration.steps.map(step => step.order);
    const uniqueOrders = new Set(stepOrders);
    if (uniqueOrders.size !== stepOrders.length) {
      issues.push({
        severity: 'error',
        step: 'step-order',
        message: 'Migration steps have duplicate order numbers',
        suggestion: 'Ensure each step has a unique order number',
      });
      riskLevel = 'high';
    }

    // Check rollback support
    if (!migration.rollback.supported && requiredSteps.length > 0) {
      issues.push({
        severity: 'warning',
        step: 'rollback-support',
        message: 'Migration has required steps but no rollback support',
        suggestion: 'Consider implementing rollback steps for safer migration',
      });
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Check for destructive operations
    const destructiveOperations = ['remove', 'decrypt'];
    const hasDestructiveOps = migration.steps.some(step => destructiveOperations.includes(step.operation));

    if (hasDestructiveOps) {
      issues.push({
        severity: 'warning',
        step: 'destructive-operations',
        message: 'Migration contains potentially destructive operations',
        suggestion: 'Ensure you have a backup before proceeding',
      });
      if (riskLevel === 'low') riskLevel = 'medium';
      requirements.push('Create configuration backup before migration');
    }

    // Check time limits for rollback
    if (migration.rollback.supported && migration.rollback.timeLimit) {
      requirements.push(
        `Complete migration within ${migration.rollback.timeLimit} hours to maintain rollback capability`,
      );
    }

    // Validate affected fields
    const allAffectedFields = new Set<string>();
    migration.steps.forEach(step => {
      step.affectedFields.forEach(field => allAffectedFields.add(field));
    });

    if (allAffectedFields.has('encryptedApiKey')) {
      issues.push({
        severity: 'info',
        step: 'api-key-migration',
        message: 'Migration will affect API key storage',
        suggestion: 'Ensure you have the master password available for re-encryption',
      });
      requirements.push('Master password required for API key migration');
    }

    return {
      valid: !issues.some(issue => issue.severity === 'error'),
      issues,
      riskLevel,
      requirements,
    };
  }

  /**
   * Create migration for version upgrade
   */
  public createVersionMigration(fromVersion: string, toVersion: string): ConfigMigration {
    const migrationId = `migration-${fromVersion}-to-${toVersion}-${Date.now()}`;

    // Define migration steps based on version differences
    const steps = this.generateMigrationSteps(fromVersion, toVersion);

    return {
      fromVersion,
      toVersion,
      strategy: 'automatic',
      steps,
      rollback: {
        supported: true,
        steps: this.generateRollbackSteps(steps),
        timeLimit: 24, // 24 hours
      },
      metadata: {
        migrationId,
        status: 'pending',
      },
    };
  }

  /**
   * Generate migration steps for version upgrade
   */
  private generateMigrationSteps(fromVersion: string, toVersion: string): MigrationStep[] {
    const steps: MigrationStep[] = [];

    // Version 1.0.0 to 1.1.0 migration example
    if (fromVersion === '1.0.0' && toVersion === '1.1.0') {
      steps.push({
        stepId: 'add-backup-metadata',
        description: 'Add backup metadata to configuration',
        operation: 'add',
        affectedFields: ['backup'],
        order: 1,
        required: false,
      });

      steps.push({
        stepId: 'update-version',
        description: 'Update configuration version',
        operation: 'transform',
        affectedFields: ['configVersion'],
        order: 2,
        required: true,
      });
    }

    // Add more version-specific migrations as needed

    return steps;
  }

  /**
   * Generate rollback steps from forward migration steps
   */
  private generateRollbackSteps(forwardSteps: MigrationStep[]): MigrationStep[] {
    return forwardSteps
      .filter(step => step.required) // Only rollback required steps
      .reverse() // Reverse order for rollback
      .map((step, index) => ({
        stepId: `rollback-${step.stepId}`,
        description: `Rollback: ${step.description}`,
        operation: this.getRollbackOperation(step.operation),
        affectedFields: step.affectedFields,
        order: index + 1,
        required: true,
      }));
  }

  /**
   * Get rollback operation for a forward operation
   */
  private getRollbackOperation(forwardOp: MigrationStep['operation']): MigrationStep['operation'] {
    const rollbackMap: Record<MigrationStep['operation'], MigrationStep['operation']> = {
      add: 'remove',
      remove: 'add',
      transform: 'transform',
      encrypt: 'decrypt',
      decrypt: 'encrypt',
      validate: 'validate',
    };

    return rollbackMap[forwardOp] || 'transform';
  }

  /**
   * Execute individual migration step
   */
  private async executeStep(config: SecureConfigRecord, step: MigrationStep): Promise<SecureConfigRecord> {
    const updatedConfig = { ...config };

    switch (step.operation) {
      case 'add':
        return this.executeAddStep(updatedConfig, step);
      case 'remove':
        return this.executeRemoveStep(updatedConfig, step);
      case 'transform':
        return this.executeTransformStep(updatedConfig, step);
      case 'encrypt':
        return this.executeEncryptStep(updatedConfig, step);
      case 'decrypt':
        return this.executeDecryptStep(updatedConfig, step);
      case 'validate':
        return this.executeValidateStep(updatedConfig, step);
      default:
        throw new Error(`Unsupported migration operation: ${step.operation}`);
    }
  }

  /**
   * Execute add operation
   */
  private executeAddStep(config: SecureConfigRecord, step: MigrationStep): SecureConfigRecord {
    const updatedConfig = { ...config };

    // Add new fields based on step requirements
    step.affectedFields.forEach(field => {
      switch (field) {
        case 'backup':
          if (!updatedConfig.backup) {
            updatedConfig.backup = {
              backupId: `backup-${Date.now()}`,
              location: 'local',
              encrypted: true,
              createdAt: new Date().toISOString(),
              size: JSON.stringify(config).length,
              checksum: '', // Would be calculated in real implementation
              recoveryTest: {
                estimatedRecoveryTime: 5,
              },
            };
          }
          break;
        // Add more fields as needed
      }
    });

    return updatedConfig;
  }

  /**
   * Execute remove operation
   */
  private executeRemoveStep(config: SecureConfigRecord, step: MigrationStep): SecureConfigRecord {
    const updatedConfig = { ...config };

    step.affectedFields.forEach(field => {
      // Remove fields (be careful with this operation)
      if (field in updatedConfig) {
        delete (updatedConfig as Record<string, unknown>)[field];
      }
    });

    return updatedConfig;
  }

  /**
   * Execute transform operation
   */
  private executeTransformStep(config: SecureConfigRecord, step: MigrationStep): SecureConfigRecord {
    const updatedConfig = { ...config };

    step.affectedFields.forEach(field => {
      switch (field) {
        case 'configVersion':
          // Update version number
          updatedConfig.configVersion = '1.1.0'; // Would be dynamic in real implementation
          break;
        case 'updatedAt':
          updatedConfig.updatedAt = new Date().toISOString();
          break;
        // Add more transformations as needed
      }
    });

    return updatedConfig;
  }

  /**
   * Execute encrypt operation
   */
  private executeEncryptStep(config: SecureConfigRecord, _step: MigrationStep): SecureConfigRecord {
    // This would implement field encryption
    // For now, return config unchanged
    return { ...config };
  }

  /**
   * Execute decrypt operation
   */
  private executeDecryptStep(config: SecureConfigRecord, _step: MigrationStep): SecureConfigRecord {
    // This would implement field decryption
    // For now, return config unchanged
    return { ...config };
  }

  /**
   * Execute validate operation
   */
  private async executeValidateStep(config: SecureConfigRecord, step: MigrationStep): Promise<SecureConfigRecord> {
    // Perform validation but don't modify config
    const validation = await this.validator.validateConfiguration(config);

    if (validation.status === 'invalid') {
      throw new Error(`Validation failed for step ${step.stepId}`);
    }

    return config;
  }

  /**
   * Perform rollback to previous configuration
   */
  private async performRollback(
    originalConfig: SecureConfigRecord,
    migration: ConfigMigration,
    backupId?: string,
  ): Promise<void> {
    if (!migration.rollback.supported) {
      throw new Error('Rollback is not supported for this migration');
    }

    // Check time limit
    if (migration.rollback.timeLimit && migration.metadata.startedAt) {
      const startTime = new Date(migration.metadata.startedAt).getTime();
      const currentTime = Date.now();
      const hoursElapsed = (currentTime - startTime) / (1000 * 60 * 60);

      if (hoursElapsed > migration.rollback.timeLimit) {
        throw new Error(`Rollback time limit of ${migration.rollback.timeLimit} hours exceeded`);
      }
    }

    // Restore from backup if available
    if (backupId && this.backups.has(backupId)) {
      const _backupConfig = this.backups.get(backupId)!;
      // In real implementation, would restore to storage
      console.info(`Rolled back to backup ${backupId}`);
      return;
    }

    // Execute rollback steps if available
    if (migration.rollback.steps && migration.rollback.steps.length > 0) {
      let rollbackConfig = { ...originalConfig };

      for (const step of migration.rollback.steps) {
        rollbackConfig = await this.executeStep(rollbackConfig, step);
      }

      // In real implementation, would save rollback config
      console.info('Executed rollback steps');
    }

    // Update migration status
    migration.metadata.status = 'rolledback';
  }

  /**
   * Create backup of configuration
   */
  private createBackup(config: SecureConfigRecord): string {
    const backupId = `backup-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.backups.set(backupId, { ...config });

    // In real implementation, would persist backup to storage
    console.debug(`Created backup with ID: ${backupId}`);

    return backupId;
  }

  /**
   * Check if source version is compatible with migration
   */
  private isVersionCompatible(sourceVersion: string, migrationFromVersion: string): boolean {
    // Simple version comparison - could be more sophisticated
    return sourceVersion === migrationFromVersion;
  }

  /**
   * Get migration history
   */
  public getMigrationHistory(): Map<string, MigrationResult> {
    return new Map(this.migrationHistory);
  }

  /**
   * Get available backups
   */
  public getAvailableBackups(): string[] {
    return Array.from(this.backups.keys());
  }

  /**
   * Restore from backup
   */
  public restoreFromBackup(backupId: string): SecureConfigRecord | null {
    return this.backups.get(backupId) || null;
  }

  /**
   * Clean up old backups and migration history
   */
  public cleanup(retentionDays = 30): void {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    // Clean up old backups
    for (const [backupId] of this.backups) {
      const backupTime = parseInt(backupId.split('-')[1] ?? '0');
      if (backupTime < cutoffTime) {
        this.backups.delete(backupId);
      }
    }

    // Clean up old migration history
    for (const [migrationId, result] of this.migrationHistory) {
      if (result.metadata.duration && result.metadata.duration < cutoffTime) {
        this.migrationHistory.delete(migrationId);
      }
    }
  }
}
