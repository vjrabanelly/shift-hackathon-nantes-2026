import type { TextToSpeechService } from './textToSpeech';
import type { ContinuousListeningEvent } from './continuousListening';
import { ContinuousListeningService } from './continuousListening';
import { AudioFeedbackService, AudioCue } from './audioFeedback';
import { NarrationService } from './narrationService';
import type { NarrationPayload } from './narrationService';
import { routeVoiceCommand } from './voiceCommandRouter';

export enum DialogueState {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING_STT = 'processing_stt',
  DIALOGUE = 'dialogue',
  SPEAKING = 'speaking',
  EXECUTING = 'executing',
  NARRATING = 'narrating',
  INTERRUPTED = 'interrupted',
  FORM_FILLING = 'form_filling',
  COMPLETE = 'complete',
}

export interface DialogueMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DialogueChatResult {
  reply: string;
  readyToExecute: boolean;
  refinedTask: string;
  userFormData?: Record<string, string>;
  fieldValue?: string;
}

export interface DialogueOrchestratorDeps {
  getPort: () => chrome.runtime.Port | null;
  tts: TextToSpeechService;
  onStateChange: (state: DialogueState) => void;
  onDialogueMessage: (message: DialogueMessage) => void;
  onTaskReady: (refinedTask: string, userFormData?: Record<string, string>) => void;
  onInterrupt: () => void;
  onResume: () => void;
  silenceTimeoutMs: number;
}

const REQUEST_TIMEOUT_MS = 15000;
const COMPLETE_IDLE_TIMEOUT_MS = 30000;

export class DialogueOrchestrator {
  private state: DialogueState = DialogueState.IDLE;
  private deps: DialogueOrchestratorDeps;
  private continuousListening: ContinuousListeningService;
  private audioFeedback: AudioFeedbackService;
  private narrationService: NarrationService;
  private conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  private currentTaskDescription = '';
  private pendingDialogueChat = false;
  private completeIdleTimerId: number | null = null;
  private requestTimeoutId: number | null = null;
  private currentFormFieldContext: { fieldLabel: string; fieldType: string } | null = null;
  private pendingCompletionNarration = false;

  constructor(deps: DialogueOrchestratorDeps) {
    this.deps = deps;
    this.continuousListening = new ContinuousListeningService({
      silenceTimeoutMs: deps.silenceTimeoutMs,
    });
    this.audioFeedback = new AudioFeedbackService();
    this.narrationService = new NarrationService();
  }

  // --- Public lifecycle ---

  async activate(): Promise<void> {
    if (this.state !== DialogueState.IDLE) return;

    this.audioFeedback.play(AudioCue.MicActivate);
    this.transition(DialogueState.LISTENING);

    try {
      await this.continuousListening.start(event => this.handleListeningEvent(event));
      this.continuousListening.startNextRecording();
    } catch (error) {
      console.error('[DialogueOrchestrator] Failed to start continuous listening:', error);
      this.transition(DialogueState.IDLE);
      throw error;
    }
  }

  deactivate(): void {
    this.audioFeedback.play(AudioCue.MicDeactivate);
    this.audioFeedback.stopHeartbeat();
    this.continuousListening.stop();
    this.deps.tts.stop();
    this.clearTimers();
    this.narrationService.reset();
    this.conversationHistory = [];
    this.currentTaskDescription = '';
    this.pendingDialogueChat = false;
    this.pendingCompletionNarration = false;
    this.currentFormFieldContext = null;
    this.transition(DialogueState.IDLE);
  }

  getState(): DialogueState {
    return this.state;
  }

  getConversationHistory(): DialogueMessage[] {
    return this.conversationHistory
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  // --- Port message handlers (called by SidePanel) ---

  handleSttResult(text: string): void {
    if (!text || text.trim().length < 2) {
      if (this.state === DialogueState.PROCESSING_STT || this.state === DialogueState.LISTENING) {
        this.transition(DialogueState.LISTENING);
        this.continuousListening.startNextRecording();
      }
      return;
    }

    const trimmed = text.trim();
    const route = routeVoiceCommand(trimmed);

    if (route.type === 'action') {
      switch (route.command) {
        case 'execute':
          this.handleExecuteTrigger();
          return;
        case 'stop':
        case 'annule':
          this.handleStopCommand();
          return;
        case 'repete':
          this.deps.tts.repeatLast();
          this.transition(DialogueState.LISTENING);
          this.continuousListening.startNextRecording();
          return;
        case 'modify':
          if (this.state === DialogueState.EXECUTING || this.state === DialogueState.INTERRUPTED) {
            this.deps.onInterrupt();
            this.transition(DialogueState.INTERRUPTED);
            this.speakAndListen('Que souhaitez-vous modifier ?');
          }
          return;
        default:
          break;
      }
    }

    this.deps.onDialogueMessage({ role: 'user', content: trimmed });
    this.conversationHistory.push({ role: 'user', content: trimmed });

    if (this.state === DialogueState.FORM_FILLING) {
      this.handleFormFieldInput(trimmed);
      return;
    }

    this.transition(DialogueState.DIALOGUE);
    this.sendDialogueChat();
  }

  handleSttError(error: string): void {
    console.error('STT error:', error);
    if (this.state === DialogueState.PROCESSING_STT) {
      this.speakAndListen("Desole, je n'ai pas compris. Pouvez-vous repeter ?");
    }
  }

  handleDialogueChatResult(result: DialogueChatResult): void {
    this.pendingDialogueChat = false;
    this.clearRequestTimeout();

    if (this.state !== DialogueState.DIALOGUE && this.state !== DialogueState.INTERRUPTED) return;

    this.conversationHistory.push({ role: 'assistant', content: result.reply });
    this.deps.onDialogueMessage({ role: 'assistant', content: result.reply });

    if (result.readyToExecute) {
      this.currentTaskDescription = result.refinedTask || this.currentTaskDescription;
      this.narrationService.setTaskDescription(this.currentTaskDescription);
      this.speakThenExecute('Je lance la recherche.', result.refinedTask, result.userFormData);
    } else {
      this.speakAndListen(result.reply);
    }
  }

  handleDialogueChatError(): void {
    this.pendingDialogueChat = false;
    this.clearRequestTimeout();
    this.speakAndListen('Desole, un probleme est survenu. Veuillez reessayer.');
  }

  handleDialogueNarrateResult(narration: string, waitForUser = false): void {
    this.clearRequestTimeout();

    if (this.pendingCompletionNarration) {
      this.pendingCompletionNarration = false;
      const completionText = narration + ' Voulez-vous autre chose ?';
      this.speakCompletionAndListen(completionText);
      return;
    }

    if (this.state !== DialogueState.EXECUTING && this.state !== DialogueState.NARRATING) return;

    this.narrationService.setLastNarrationText(narration);
    this.transition(DialogueState.NARRATING);

    this.continuousListening.mute();
    this.deps.tts
      .speakAndWait({ text: narration, interrupt: false })
      .then(() => {
        this.continuousListening.unmute();
        if (this.state === DialogueState.NARRATING) {
          this.transition(DialogueState.EXECUTING);
          // No recording during execution — mic stays off, Navigator works undisturbed
        }
      })
      .catch(() => {
        this.continuousListening.unmute();
        if (this.state === DialogueState.NARRATING) {
          this.transition(DialogueState.EXECUTING);
        }
      });
  }

  handleDialogueNarrateError(): void {
    this.clearRequestTimeout();
    this.continuousListening.unmute();
    if (this.state === DialogueState.NARRATING) {
      this.transition(DialogueState.EXECUTING);
    }
  }

  handleDialogueFormFieldResult(result: DialogueChatResult): void {
    this.clearRequestTimeout();
    if (this.state !== DialogueState.FORM_FILLING) return;
    this.speakAndListen(result.reply);
  }

  handleDialogueFormFieldError(): void {
    this.clearRequestTimeout();
    if (this.state === DialogueState.FORM_FILLING) {
      this.currentFormFieldContext = null;
      this.speakAndListen("Desole, je n'ai pas pu traiter cette demande. Que souhaitez-vous faire ?");
    }
  }

  handleAgentEvent(event: { state: string; details: string; actor: string; step: number; taskId?: string }): void {
    if (this.state !== DialogueState.EXECUTING && this.state !== DialogueState.NARRATING) return;

    if (event.state === 'ACT_FORM_FIELD_NEEDED') {
      this.handleFormFieldNeeded(event.details);
      return;
    }

    const payload = this.narrationService.addEvent({
      state: event.state,
      details: event.details,
      actor: event.actor,
      step: event.step,
    });

    if (payload) {
      this.sendNarration(payload);
    }
  }

  handleTaskStarted(): void {
    this.transition(DialogueState.EXECUTING);
    this.audioFeedback.startHeartbeat();
  }

  handleTaskCompleted(finalContent?: string): void {
    this.audioFeedback.stopHeartbeat();
    this.audioFeedback.play(AudioCue.TaskComplete);
    this.transition(DialogueState.COMPLETE);
    this.continuousListening.mute();
    this.deps.tts.stop();

    if (finalContent) {
      this.postMessage({
        type: 'dialogue_narrate',
        events: [{ state: 'task.ok', details: finalContent, actor: 'system', step: 0 }],
        taskDescription: this.currentTaskDescription,
        previousNarration: '',
      });
      this.pendingCompletionNarration = true;
      this.setRequestTimeout();
    } else {
      this.speakCompletionAndListen("C'est termine. Voulez-vous autre chose ?");
    }
  }

  handleTaskFailed(error?: string): void {
    this.audioFeedback.stopHeartbeat();
    this.audioFeedback.play(AudioCue.TaskError);

    const message = error
      ? `Desole, une erreur est survenue : ${error.substring(0, 100)}`
      : "Desole, la tache n'a pas pu etre completee.";

    this.transition(DialogueState.COMPLETE);
    this.speakAndListen(message);
  }

  handleTaskCancelled(): void {
    this.audioFeedback.stopHeartbeat();
    this.speakAndListen('La tache a ete annulee. Que souhaitez-vous faire ?');
  }

  // --- Private helpers ---

  private transition(newState: DialogueState): void {
    this.state = newState;
    this.deps.onStateChange(newState);
  }

  private speakCompletionAndListen(text: string): void {
    this.continuousListening.mute();
    this.deps.tts
      .speakAndWait({ text, interrupt: true })
      .then(() => this.resumeListeningAfterTts())
      .catch(() => this.resumeListeningAfterTts());
  }

  private speakAndListen(text: string): void {
    this.transition(DialogueState.SPEAKING);
    this.continuousListening.mute();

    this.deps.tts
      .speakAndWait({ text, interrupt: false })
      .then(() => this.resumeListeningAfterTts())
      .catch(() => this.resumeListeningAfterTts());
  }

  private speakThenExecute(confirmationText: string, refinedTask: string, userFormData?: Record<string, string>): void {
    this.continuousListening.mute();
    this.deps.tts
      .speakAndWait({ text: confirmationText, interrupt: true })
      .then(() => {
        this.continuousListening.unmute();
        this.deps.onTaskReady(refinedTask, userFormData);
      })
      .catch(() => {
        this.continuousListening.unmute();
        this.deps.onTaskReady(refinedTask, userFormData);
      });
  }

  /** Safe port access - returns null if disconnected. */
  private getPort(): chrome.runtime.Port | null {
    return this.deps.getPort();
  }

  /** Send a message to background, silently ignoring if port is dead. */
  private postMessage(message: Record<string, unknown>): void {
    try {
      const port = this.getPort();
      if (port) {
        port.postMessage(message);
      }
    } catch {
      // Port disconnected - ignore
    }
  }

  /** Common recovery after TTS finishes or fails: unmute, beep, listen, record. */
  private resumeListeningAfterTts(): void {
    this.continuousListening.unmute();
    this.audioFeedback.play(AudioCue.UserTurnStart);
    this.transition(DialogueState.LISTENING);
    this.continuousListening.startNextRecording();
  }

  private handleExecuteTrigger(): void {
    if (this.state === DialogueState.INTERRUPTED) {
      this.deps.onResume();
      this.transition(DialogueState.EXECUTING);
      this.audioFeedback.startHeartbeat();
      return;
    }

    if (this.conversationHistory.length === 0) {
      this.speakAndListen("Je n'ai pas encore de tache. Dites-moi ce que vous souhaitez faire.");
      return;
    }

    this.conversationHistory.push({ role: 'user', content: 'Go, lance la tache.' });
    this.transition(DialogueState.DIALOGUE);
    this.sendDialogueChat();
  }

  private handleStopCommand(): void {
    if (this.state === DialogueState.EXECUTING || this.state === DialogueState.NARRATING) {
      this.deps.onInterrupt();
      this.audioFeedback.stopHeartbeat();
      this.transition(DialogueState.INTERRUPTED);
      this.speakAndListen("J'arrete. Que souhaitez-vous faire ?");
    } else {
      this.speakAndListen("J'annule.");
      this.conversationHistory = [];
    }
  }

  private handleListeningEvent(event: ContinuousListeningEvent): void {
    switch (event.type) {
      case 'utterance_end':
        // Only process audio in LISTENING state (dialogue phase, form filling, completion)
        // During EXECUTING, mic is off — user uses F2 to interrupt
        if (this.state === DialogueState.LISTENING) {
          this.transition(DialogueState.PROCESSING_STT);
          this.postMessage({
            type: 'speech_to_text',
            audio: event.audioDataUrl,
          });
        }
        break;

      case 'silence_timeout':
        if (this.state === DialogueState.LISTENING && this.conversationHistory.length > 0) {
          this.sendSilencePrompt();
        }
        break;

      case 'voice_start':
        if (this.completeIdleTimerId !== null) {
          clearTimeout(this.completeIdleTimerId);
          this.completeIdleTimerId = null;
        }
        break;

      case 'error':
        console.error('Continuous listening error:', event.error);
        // Only deactivate on mic permission errors, not port/network errors
        if (event.error?.message?.includes('permission') || event.error?.message?.includes('NotAllowed')) {
          this.deactivate();
        }
        // Other errors (disconnected port, etc.) - just try to keep going
        break;
    }
  }

  private handleFormFieldNeeded(detailsJson: string): void {
    try {
      const details = JSON.parse(detailsJson) as {
        fieldLabel: string;
        fieldType: string;
        options?: string[];
      };

      this.currentFormFieldContext = {
        fieldLabel: details.fieldLabel,
        fieldType: details.fieldType,
      };

      this.audioFeedback.stopHeartbeat();
      this.transition(DialogueState.FORM_FILLING);

      this.setRequestTimeout();
      this.postMessage({
        type: 'dialogue_form_field',
        fieldLabel: details.fieldLabel,
        fieldType: details.fieldType,
        options: details.options,
      });
    } catch {
      this.transition(DialogueState.FORM_FILLING);
      this.speakAndListen("J'ai besoin d'une information supplementaire. Pouvez-vous me la donner ?");
    }
  }

  private handleFormFieldInput(text: string): void {
    const normalized = text.toLowerCase().trim();
    const isConfirm = ['oui', 'ok', 'correct', 'exactement', "c'est ca", 'cest ca', 'parfait'].some(w =>
      normalized.includes(w),
    );
    const isDeny = ['non', 'pas correct', 'faux', 'erreur', 'incorrect'].some(w => normalized.includes(w));

    if (isDeny) {
      const fieldLabel = this.currentFormFieldContext?.fieldLabel || 'information';
      this.speakAndListen(`D'accord, pouvez-vous me redonner votre ${fieldLabel} ?`);
      return;
    }

    if (isConfirm && this.currentFormFieldContext) {
      const lastAssistantMsg = [...this.conversationHistory].reverse().find(m => m.role === 'assistant');

      if (lastAssistantMsg) {
        const match = lastAssistantMsg.content.match(/compris\s*:?\s*(.+?)[.,!?]?\s*(?:c'est|C'est)/);
        const value = match?.[1]?.trim() || text;

        this.postMessage({
          type: 'form_field_response',
          value,
        });

        this.currentFormFieldContext = null;
        this.transition(DialogueState.EXECUTING);
        this.audioFeedback.startHeartbeat();
        this.speakAndListen('Merci, je continue.');
        return;
      }
    }

    this.transition(DialogueState.DIALOGUE);
    this.sendDialogueChat();
  }

  private sendDialogueChat(): void {
    if (this.pendingDialogueChat) return;

    this.pendingDialogueChat = true;
    this.setRequestTimeout();

    this.postMessage({
      type: 'dialogue_chat',
      messages: this.conversationHistory,
    });
  }

  private sendNarration(payload: NarrationPayload): void {
    this.setRequestTimeout();
    this.postMessage({
      type: 'dialogue_narrate',
      events: payload.events,
      taskDescription: payload.taskDescription,
      previousNarration: payload.previousNarration,
    });
  }

  private sendSilencePrompt(): void {
    this.postMessage({
      type: 'dialogue_chat',
      messages: [
        ...this.conversationHistory,
        {
          role: 'system',
          content:
            "L'utilisateur est silencieux depuis 5 secondes. Demande-lui gentiment s'il veut lancer la tache ou s'il a d'autres informations a donner. Reponds en JSON avec readyToExecute=false.",
        },
      ],
    });
    this.pendingDialogueChat = true;
    this.setRequestTimeout();
  }

  private setRequestTimeout(): void {
    this.clearRequestTimeout();
    this.requestTimeoutId = window.setTimeout(() => {
      this.pendingDialogueChat = false;
      if (
        this.state === DialogueState.DIALOGUE ||
        this.state === DialogueState.PROCESSING_STT ||
        this.state === DialogueState.FORM_FILLING ||
        this.state === DialogueState.COMPLETE
      ) {
        if (this.state === DialogueState.FORM_FILLING) {
          this.currentFormFieldContext = null;
        }
        this.speakAndListen('La requete a expire. Que souhaitez-vous faire ?');
      } else if (this.state === DialogueState.NARRATING) {
        // Narration timed out - recover
        this.continuousListening.unmute();
        this.transition(DialogueState.EXECUTING);
      }
    }, REQUEST_TIMEOUT_MS);
  }

  private clearRequestTimeout(): void {
    if (this.requestTimeoutId !== null) {
      clearTimeout(this.requestTimeoutId);
      this.requestTimeoutId = null;
    }
  }

  private clearTimers(): void {
    this.clearRequestTimeout();
    if (this.completeIdleTimerId !== null) {
      clearTimeout(this.completeIdleTimerId);
      this.completeIdleTimerId = null;
    }
  }
}
