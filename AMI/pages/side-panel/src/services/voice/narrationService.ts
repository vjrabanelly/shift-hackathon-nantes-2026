export interface AgentEventSummary {
  state: string;
  details: string;
  actor: string;
  step: number;
}

export interface NarrationPayload {
  events: AgentEventSummary[];
  taskDescription: string;
  previousNarration?: string;
}

const MILESTONE_STATES = new Set([
  'task.start',
  'step.ok',
  'task.ok',
  'task.fail',
  'task.cancel',
  'act.form_field_needed',
]);

export class NarrationService {
  private eventBuffer: AgentEventSummary[] = [];
  private lastNarrationTime = 0;
  private lastNarrationText = '';
  private taskDescription = '';
  private minIntervalMs: number;

  constructor(minIntervalMs = 8000) {
    this.minIntervalMs = minIntervalMs;
  }

  setTaskDescription(description: string): void {
    this.taskDescription = description;
  }

  addEvent(event: AgentEventSummary): NarrationPayload | null {
    this.eventBuffer.push(event);

    const now = Date.now();
    const timeSinceLastNarration = now - this.lastNarrationTime;

    if (this.isMilestone(event) && timeSinceLastNarration >= this.minIntervalMs) {
      return this.flush();
    }

    return null;
  }

  flush(): NarrationPayload | null {
    if (this.eventBuffer.length === 0) return null;

    const payload: NarrationPayload = {
      events: [...this.eventBuffer],
      taskDescription: this.taskDescription,
      previousNarration: this.lastNarrationText || undefined,
    };

    this.eventBuffer = [];
    this.lastNarrationTime = Date.now();

    return payload;
  }

  setLastNarrationText(text: string): void {
    this.lastNarrationText = text;
  }

  reset(): void {
    this.eventBuffer = [];
    this.lastNarrationTime = 0;
    this.lastNarrationText = '';
    this.taskDescription = '';
  }

  private isMilestone(event: AgentEventSummary): boolean {
    if (MILESTONE_STATES.has(event.state)) return true;
    if (event.actor === 'planner' && event.state === 'step.ok') return true;
    // Also trigger on any act.start to keep the anecdotes flowing
    if (event.state === 'act.start') return true;
    return false;
  }
}
