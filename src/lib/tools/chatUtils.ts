import type { DbChat } from '$types/db';
import type { DBMessage } from '$types/db';
import { get } from 'svelte/store';
import { OllamaApi } from '../db/ollamaApi';
import { settings } from '$lib/stores/settings.svelte';
import { idbQuery } from '$lib/db/dbQuery';
import type { OllApiGenerate, OllamaResponse } from '$types/ollama';
import { ollamaApiMainOptionsParams } from '$lib/stores/ollamaParams';

let categoryPresets = [
    'Coding',
    'Design',
    'Development',
    'Marketing',
    'Sales',
    'Support',
    'Management',
    'HR',
    'Finance',
    'Medicine',
    'Legal',
    'Livres',
    'Ecriture',
    'Espace',
];

export async function askOllama(prompt: string, model: string) {}

export async function guessChatMetadata(message: string): Promise<OllamaResponse> {
    const config = get(settings);
    let categories = categoryPresets.join('\r\n');
    const ollamaOptions = get(ollamaApiMainOptionsParams);
    //
    const prompt = `[INST]    
    Basé sur la conversation suivante:
    - génère un titre tres court et accrocheur qui capture l'essence principale du dialogue. Le titre ne doit pas dépasser 10 mots au maximum.
    - catégorise-la en un seul mot.  Utilise le nom d'une des catégories existantes si elle convient parfaitement.  Si aucune catégorie existante ne correspond bien, propose une nouvelle catégorie pertinente en un seul mot. Catégories existantes :  ${categories}\
    - Résume la conversation suivante en 2-3 phrases concises. Capture les points clés et le contexte général sans entrer dans les détails spécifiques. \r\n
    Conversation :\r\n
    ${message}
    \r\n
    Instructions strictes :  
- le JSON retourné doit contenir les clefs 'title', 'description' et 'category'.
- LA CATEGORY NE DOIT FAIRE QU'UN SEUL MOT.
- NE PAS COMMENCER AVEC "Title :", "Titre :" ou d'autres préfixes.
- NE PAS donner d'explications.
- UN MAXIMUM de 10 MOTs OBLIGATOIRE.
    \r\n
    [INST]`;

    const defaultOptions = {
        model: config?.defaultModel,
        system: 'Tu es un assistant de génération de titres. Ceux-ci doivent appraitre dans une liste. Tu réponds toujours en un maximum de trois seul mot.Tu ne fais jamais de phrases longues. Tes  reponse font entre un et dix mots',
        prompt,
        stream: false,
        format: 'json',
        options: { ...ollamaOptions, temperature: 0.1 },
    } as OllApiGenerate;

    return await OllamaApi.generate(defaultOptions, () => {});
}
export async function guessChatCategorie(message: string): Promise<OllamaResponse> {
    let categories = categoryPresets.join('\r\n');
    const config = get(settings);
    const ollamaOptions = get(ollamaApiMainOptionsParams);
    //
    const prompt = `[INST]
    Analyse la conversation suivante et catégorise-la en un seul mot. 
    Utilise le nom d'une des catégories existantes si elle convient parfaitement. 
    Si aucune catégorie existante ne correspond bien, propose une nouvelle catégorie pertinente en un seul mot.
    La categorie doit-être un seul mot.

Conversation :
 ${message}\r\n

Catégories existantes :
 ${categories}\r\n

Instructions strictes :
- Si une catégorie existante convient, réponds UNIQUEMENT avec ce mot.
- Sinon, invente une nouvelle catégorie d'UN SEUL MOT.
- NE PAS utiliser "Nouvelle catégorie :" ou d'autres préfixes.
- NE PAS donner d'explications.
- UN SEUL MOT OBLIGATOIRE.

Rappel : Ta réponse doit être UN SEUL MOT.
[/INST]`;

    const defaultOptions = {
        model: config?.defaultModel,
        system: 'Tu es un assistant de catégorisation précis. Tu réponds toujours en un seul mot.',
        prompt,
        stream: false,
        options: { ...ollamaOptions, temperature: 0.1 },
    } as OllApiGenerate;

    return await OllamaApi.generate(defaultOptions, () => {});
}

export async function guessChatDescription(message: string): Promise<OllamaResponse> {
    const config = get(settings);
    const ollamaOptions = get(ollamaApiMainOptionsParams);
    //

    /*   const prompt = `You are a translation machine. You don't interact, apologize, say hello, you don't say thank you or use all other forms of human communication.c
    The response will be displayed in a list, so do not include code or other similar things in the response.
    Only respond with the text dedicated to your task. 
    DO NOT TALK, YOU ARE NOT HERE TO TALK OR CHAT.
    Do not say:  Sure, here is a summary of the two articles in 50 words or less.
    Instructions: Make a very short resume of maximum 50 words with the following chat conversation:\r\n
    chat conversation: ${message}\r\n
    description:`; */
    const prompt = `Résume la conversation suivante en 2-3 phrases concises. Capture les points clés et le contexte général sans entrer dans les détails spécifiques.

Conversation :
 ${message}\r\n
\r\n
\r\n
Résumé :`;
    const defaultOptions = {
        model: config?.defaultModel,
        system: config?.system_prompt,
        prompt,
        stream: false,
        options: { ...ollamaOptions, temperature: 0.1 },
    } as OllApiGenerate;

    return await OllamaApi.generate(defaultOptions, () => {});
}

export class chatUtils {
    static async checkCategorie(chatId: string) {
        const chat = await idbQuery.getChat(chatId);
        const chatMessages = await idbQuery.getMessages(chatId);
        const resume = chatMessages
            .slice(0, 15)
            .map((message: DBMessage) => message.content)
            .join('\n\n-------\n\n');

        const res = await guessChatMetadata(resume);
        const upd = {} as DbChat;
        let fr = JSON.parse(res.response);
        if (res?.response !== '' && fr?.category) upd.category = fr.category;
        return idbQuery.updateChat(chatId, upd);
    }
    static async checkTitle(chatId: string) {
        const chat = await idbQuery.getChat(chatId);
        const chatMessages = await idbQuery.getMessages(chatId);

        const resume = chatMessages
            .slice(0, 15)
            .map((message: DBMessage) => message.content)
            .join('\n\n\n-------\n\n\n');

        const res = await guessChatMetadata(resume);

        const upd = {} as DbChat;
        let fr = JSON.parse(res.response);
        if (res?.response !== '' && fr?.title) upd.title = fr?.title; //  idbQuery.updateChat(chatId, { title: res.response });
        if (res?.response !== '' && fr?.description) upd.description = fr.description; // idbQuery.updateChat(chatId, { : resd.response });

        return idbQuery.updateChat(chatId, upd);
    }

    static getMessageDataObject(message: Partial<DBMessage>): DBMessage {
        return {
            content: message.content,
            createdAt: new Date(),
            data: [],
            edit: false,
            editedContent: '',
            messageId: crypto.randomUUID(),
            role: message.role,
            ...message,
        };
    }

    static getChatDataObject(chatData: DbChat = {} as DbChat): DbChat {
        return {
            chatId: crypto.randomUUID(),
            context: [],
            createdAt: new Date(),
            created_at: new Date(),
            dateLastMessage: new Date(),
            models: [get(settings).defaultModel],
            title: 'New Chat',
            ...chatData,
        };
    }

    static getMessageStatsObject(messageData: Partial<OllamaResponse>): OllamaResponse {
        return {
            messageId: crypto.randomUUID(),
            ...messageData,
        };
    }
}
