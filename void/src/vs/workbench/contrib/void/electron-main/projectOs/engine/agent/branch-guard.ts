import type { BranchGuardConfig, BranchCheckResult } from '../../../../common/projectOsTypes.js'

export class BranchGuard {
  private minSteps: number
  private cooldownSteps: number
  private lastBranchStep = new Map<string, number>()

  constructor(config?: Partial<BranchGuardConfig>) {
    this.minSteps = config?.minSteps ?? 3
    this.cooldownSteps = config?.cooldownSteps ?? 5
  }

  getConfig(): BranchGuardConfig {
    return { minSteps: this.minSteps, cooldownSteps: this.cooldownSteps }
  }

  updateConfig(patch: Partial<BranchGuardConfig>): void {
    if (patch.minSteps !== undefined) this.minSteps = patch.minSteps
    if (patch.cooldownSteps !== undefined) this.cooldownSteps = patch.cooldownSteps
  }

  checkCanBranch(jobId: string, currentStep: number): BranchCheckResult {
    if (currentStep < this.minSteps) {
      return {
        canBranch: false,
        reason: `Minimum ${this.minSteps} steps required before branching (current: ${currentStep})`,
      }
    }

    const lastBranch = this.lastBranchStep.get(jobId)
    if (lastBranch !== undefined && currentStep - lastBranch < this.cooldownSteps) {
      return {
        canBranch: false,
        reason: `Cooldown: ${this.cooldownSteps} steps between branches (elapsed: ${currentStep - lastBranch})`,
      }
    }

    return { canBranch: true }
  }

  recordBranch(jobId: string, step: number): void {
    this.lastBranchStep.set(jobId, step)
  }
}
