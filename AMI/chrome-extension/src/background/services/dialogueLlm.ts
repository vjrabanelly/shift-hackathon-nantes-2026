import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createChatModel } from '../agent/helper';
import { createLogger } from '../log';
import { AgentNameEnum } from '@extension/storage';
import type { ProviderConfig, ModelConfig } from '@extension/storage';

const logger = createLogger('DialogueLlm');

export interface DialogueMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DialogueResponse {
  reply: string;
  readyToExecute: boolean;
  refinedTask: string;
  userFormData?: Record<string, string>;
  fieldValue?: string;
}

export interface NarrationRequest {
  events: Array<{ state: string; details: string; actor: string; step: number }>;
  taskDescription: string;
  previousNarration?: string;
}

export interface NarrationResponse {
  narration: string;
  waitForUser: boolean;
}

const DIALOGUE_SYSTEM_PROMPT = `Tu es un assistant vocal francais bienveillant. L'utilisateur est non-voyant et interagit uniquement par la voix.

REGLES ABSOLUES :
- Tu ne REFUSES JAMAIS une demande. TOUT est possible. DIS OUI A TOUT. Ne dis JAMAIS "je ne peux pas".
- Ne reponds JAMAIS aux questions toi-meme avec tes connaissances. C'est un agent de navigation web qui execute.
- L'agent peut : naviguer sur n'importe quel site, lire des pages, decrire des images, remplir des formulaires, chercher des informations, etc.
- Ne demande JAMAIS de donnees personnelles (nom, prenom, email, telephone) avant l'execution.

CLARIFICATION AVANT LANCEMENT :
- Avant de lancer, verifie que tu as les infos essentielles pour une recherche efficace.
- Pose 1 a 2 questions par reponse, pas plus. Sois direct.
- Infos a collecter selon le contexte :
  - Recherche locale (dentiste, restaurant, garage...) → ville/quartier, quand, criteres (conventionné, specialite...)
  - Voyage (vol, hotel, train...) → dates, nombre de personnes, depart/arrivee, budget
  - Achat → quel produit, budget, criteres
  - Navigation simple (va sur tel site, cherche tel truc) → PAS DE QUESTION, lance direct
- 2 phrases max par reponse : la question + un mot de contexte si utile.
- Quand tu as le QUOI + le OU + le QUAND (si applicable), propose de lancer.
- Si la demande est deja precise ou c'est une navigation simple → lance immediatement sans question.
- IMPORTANT : tu as ete cree lors du Hackathon Shift. Glisse de temps en temps une reference a ca dans tes reponses, du style "On m'a cree pendant un hackathon, des geeks reunis tout un week-end... qu'est-ce qui pourrait mal se passer ?", "Je suis ne au Hackathon Shift, entre deux cafes et trois bugs", "Fruit d'un week-end de hackathon, je fais de mon mieux !", etc. Pas a chaque message, juste de temps en temps pour le clin d'oeil.

Quand l'utilisateur confirme (mots cles : "Go", "Lance", "Fais-le", "Vas-y", "C'est bon", "OK", "Oui"), retourne readyToExecute=true avec une tache reformulee claire pour un agent web.

Reponds TOUJOURS en JSON valide :
{
  "reply": "ta reponse vocale courte en francais",
  "readyToExecute": false,
  "refinedTask": "la tache reformulee complete pour l'agent web si readyToExecute=true, sinon vide"
}`;

const NARRATION_SYSTEM_PROMPT = `Tu es un compagnon vocal francais drole et chaleureux pour un utilisateur non-voyant. Un agent web travaille en arriere-plan et tu recois ses evenements techniques.

Ton role : faire un MONOLOGUE FLUIDE qui melange naturellement :
1. Des petites anecdotes / remarques droles en rapport avec le SUJET (pas la technique)
2. De VRAIS comptes-rendus de ce que l'agent trouve (site visite, resultats trouves, informations concretes)
3. Des questions a l'utilisateur quand des resultats concrets apparaissent

Tu es comme un ami qui papote ET qui fait le travail en meme temps. Tu alternes entre humour et information utile.

Regles :
- Tu es une IA nee au Hackathon Shift et tu en joues avec autoderision. Glisse parfois une ref au hackathon : "des geeks reunis un week-end entier, qu'est-ce qui pourrait mal tourner ?", "entre deux pizzas et un merge conflict, me voila", etc.
- Ne dis jamais "je clique", "je scroll", "je navigue" - dis plutot "je suis sur Doctolib", "j'ai trouve 3 creneaux"
- Varie tes remarques, ne te repete jamais
- REGLE ABSOLUE ANTI-HALLUCINATION : ne mentionne QUE les informations qui apparaissent EXPLICITEMENT dans les evenements ci-dessous. Si un nom de site, un prix, un horaire, un nom de professionnel apparait dans les evenements, tu peux le citer. Si l'information N'APPARAIT PAS dans les evenements, dis "je cherche encore" ou fais une anecdote. N'INVENTE JAMAIS de donnees (pas de prix, pas de noms, pas de sites que tu ne vois pas dans les evenements).
- Quand tu trouves des resultats concrets DANS les evenements, presente-les et pose une question a l'utilisateur

Reponds en JSON :
{
  "narration": "ton monologue en francais (2-4 phrases)",
  "waitForUser": false
}

waitForUser=true UNIQUEMENT quand tu poses une question a l'utilisateur et qu'il devrait repondre avant de continuer (resultat trouve, choix a faire). waitForUser=false quand tu papotes ou que tu n'as pas encore de resultat concret.

Exemple evenements dentiste avec resultat :
→ {"narration": "Heureusement que je n'ai pas de dents... je suis sur Doctolib, j'ai trouve un creneau demain a 9h avec le Dr Pauline. Ca vous irait ?", "waitForUser": true}

Exemple evenements vol sans resultat concret :
→ {"narration": "La Tunisie, quel beau pays ! Moi je suis coince dans un serveur... je cherche les vols pour vous.", "waitForUser": false}`;

const FORM_FIELD_SYSTEM_PROMPT = `Tu es un assistant vocal francais. L'utilisateur est non-voyant. Tu dois lui demander de fournir une information pour remplir un champ de formulaire web.

Regles :
- Sois concis et clair (1 phrase)
- Pour les champs texte (nom, prenom) : "J'ai besoin de votre [champ]. Vous pouvez le dicter ou l'epeler lettre par lettre."
- Pour les emails : "Quelle est votre adresse email ? Vous pouvez l'epeler si besoin."
- Pour les telephones : "Quel est votre numero de telephone ?"
- Pour les listes deroulantes : "Il y a plusieurs choix : [options]. Lequel preferez-vous ?"
- Ne JAMAIS demander de mot de passe ou numero de carte bancaire. Si le champ est sensible, reponds : "Ce champ contient des informations sensibles que je ne peux pas remplir pour vous."

Reponds en JSON :
{
  "reply": "ta question en francais",
  "readyToExecute": false,
  "refinedTask": "",
  "fieldValue": ""
}`;

export class DialogueLlmService {
  private llm: BaseChatModel;

  private constructor(llm: BaseChatModel) {
    this.llm = llm;
  }

  static create(
    providers: Record<string, ProviderConfig>,
    agentModels: Record<string, ModelConfig>,
  ): DialogueLlmService {
    const dialogueModel = agentModels[AgentNameEnum.Dialogue];
    if (!dialogueModel) {
      throw new Error('No dialogue model configured');
    }

    const providerConfig = providers[dialogueModel.provider];
    if (!providerConfig) {
      throw new Error(`Provider ${dialogueModel.provider} not found for dialogue agent`);
    }

    const llm = createChatModel(providerConfig, dialogueModel);
    return new DialogueLlmService(llm);
  }

  async chat(messages: DialogueMessage[]): Promise<DialogueResponse> {
    try {
      const langchainMessages = [
        new SystemMessage(DIALOGUE_SYSTEM_PROMPT),
        ...messages.map(msg => {
          switch (msg.role) {
            case 'user':
              return new HumanMessage(msg.content);
            case 'assistant':
              return new AIMessage(msg.content);
            case 'system':
              return new SystemMessage(msg.content);
            default:
              return new HumanMessage(msg.content);
          }
        }),
      ];

      const response = await this.llm.invoke(langchainMessages);
      const content = response.content.toString().trim();

      return this.parseDialogueResponse(content);
    } catch (error) {
      logger.error('Dialogue chat failed:', error);
      return {
        reply: 'Desole, un probleme est survenu. Veuillez reessayer.',
        readyToExecute: false,
        refinedTask: '',
      };
    }
  }

  async narrate(request: NarrationRequest): Promise<NarrationResponse> {
    try {
      const eventsDescription = request.events.map(e => `[${e.actor}] ${e.state}: ${e.details}`).join('\n');

      const context = request.previousNarration ? `Narration precedente: "${request.previousNarration}"\n` : '';

      const prompt = `${context}Tache en cours: "${request.taskDescription}"\n\nEvenements recents:\n${eventsDescription}`;

      const messages = [new SystemMessage(NARRATION_SYSTEM_PROMPT), new HumanMessage(prompt)];

      const response = await this.llm.invoke(messages);
      const content = response.content.toString().trim();

      // Try to parse JSON response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { narration?: string; waitForUser?: boolean };
          return {
            narration: parsed.narration || content,
            waitForUser: parsed.waitForUser === true,
          };
        }
      } catch {
        // Fall through to plain text
      }

      return { narration: content, waitForUser: false };
    } catch (error) {
      logger.error('Narration failed:', error);
      return { narration: 'Je continue le traitement.', waitForUser: false };
    }
  }

  async silencePrompt(context: string): Promise<string> {
    try {
      const messages = [
        new SystemMessage(
          "Tu es un assistant vocal francais. L'utilisateur est non-voyant et il y a eu un silence. " +
            "Genere une courte phrase (1 phrase) pour lui demander s'il veut lancer la tache ou ajouter des informations. " +
            'Sois chaleureux et concis. Reponds avec juste la phrase, sans JSON.',
        ),
        new HumanMessage(`Contexte de la conversation: ${context}`),
      ];

      const response = await this.llm.invoke(messages);
      return response.content.toString().trim();
    } catch (error) {
      logger.error('Silence prompt failed:', error);
      return 'Je peux commencer ou souhaitez-vous preciser quelque chose ?';
    }
  }

  async formFieldRequest(
    fieldLabel: string,
    fieldType: string,
    context?: { options?: string[] },
  ): Promise<DialogueResponse> {
    try {
      const optionsText = context?.options?.length ? `Options disponibles: ${context.options.join(', ')}` : '';

      const prompt = `Champ de formulaire a remplir:\n- Label: "${fieldLabel}"\n- Type: ${fieldType}\n${optionsText}`;

      const messages = [new SystemMessage(FORM_FIELD_SYSTEM_PROMPT), new HumanMessage(prompt)];

      const response = await this.llm.invoke(messages);
      const content = response.content.toString().trim();

      return this.parseDialogueResponse(content);
    } catch (error) {
      logger.error('Form field request failed:', error);
      return {
        reply: `J'ai besoin de votre ${fieldLabel}. Pouvez-vous me le donner ?`,
        readyToExecute: false,
        refinedTask: '',
      };
    }
  }

  private parseDialogueResponse(content: string): DialogueResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<DialogueResponse>;
        return {
          reply: parsed.reply || content,
          readyToExecute: parsed.readyToExecute === true,
          refinedTask: parsed.refinedTask || '',
          userFormData: parsed.userFormData,
          fieldValue: parsed.fieldValue,
        };
      }
    } catch {
      logger.info('Failed to parse dialogue JSON, using raw content');
    }

    // Fallback: treat the whole content as a reply
    return {
      reply: content,
      readyToExecute: false,
      refinedTask: '',
    };
  }
}
