import { projectOsUuid } from '../projectOsUuid.js'
import type {
  AgentFlowLog,
  AgentStep,
  AgentStepType,
  ExecutionStatus,
} from '../../../../common/projectOsTypes.js'

// ── Agent Flow Tracker (M2 Stub) ────────────────────────────────

export class AgentFlowTracker {
  private steps: AgentStep[] = []
  private status: ExecutionStatus = 'pending'
  private startedAt: string

  constructor(
    private readonly jobId: string,
    private readonly nodeId: string,
  ) {
    this.startedAt = new Date().toISOString()
  }

  /** Create a new step and mark it as running */
  startStep(type: AgentStepType, label: string): AgentStep {
    const step: AgentStep = {
      id: `step_${projectOsUuid().slice(0, 8)}`,
      type,
      status: 'running',
      label,
      detail: '',
      startedAt: new Date().toISOString(),
      completedAt: null,
      filesInvolved: [],
    }

    this.steps.push(step)
    this.status = type as ExecutionStatus
    return step
  }

  /** Mark a step as successfully completed */
  completeStep(stepId: string, output: string): void {
    const step = this.steps.find((s) => s.id === stepId)
    if (!step) return

    step.status = 'complete'
    step.output = output
    step.completedAt = new Date().toISOString()
  }

  /** Mark a step as failed with an error */
  failStep(stepId: string, error: string): void {
    const step = this.steps.find((s) => s.id === stepId)
    if (!step) return

    step.status = 'error'
    step.output = error
    step.completedAt = new Date().toISOString()
    this.status = 'error'
  }

  /** Get the full flow log */
  getLog(): AgentFlowLog {
    const allComplete = this.steps.every(
      (s) => s.status === 'complete' || s.status === 'skipped',
    )

    return {
      jobId: this.jobId,
      nodeId: this.nodeId,
      steps: [...this.steps],
      status: this.status === 'error'
        ? 'error'
        : allComplete
          ? 'complete'
          : this.status,
      startedAt: this.startedAt,
      completedAt: allComplete ? new Date().toISOString() : null,
    }
  }

  /** Get a snapshot of all steps */
  getSteps(): AgentStep[] {
    return [...this.steps]
  }
}
