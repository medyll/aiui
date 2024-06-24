import { OllamaApi } from '$lib/db/ollamaApi';
import { ollamaApiMainOptionsParams } from '$lib/stores/ollamaParams';
import { settings } from '$lib/stores/settings.svelte';
import type { DBMessage } from '$types/db';
import { type OllamaChatMessage, type OllamaChat, type OllamaOptions, type OllamaResponse, type OllamaFormat, OllamaChatMessageRole } from '$types/ollama';
import { get } from 'svelte/store';
export type PromptSenderType = {
    prompt: string;
    context: number[];
    models: string[];
    images?: string[];
    options: OllamaOptions;
    format: OllamaFormat;
};

export type SenderCallback<T = any> = {
    data: OllamaResponse;
    target: DBMessage;
} & T;

/**
 * Represents a class that sends prompts and receives responses in a chat.
 * uses api/generate or api/chat depending of chatSessionType
 */
export class PromptMaker {
    private assistantMessage!: DBMessage;
    public chatSessionType: 'generate' | 'chat' = 'chat';
    //
    private apiChatParams!: Partial<OllamaChat>;

    /**
     * Creates an instance of PromptSender.
     * @param chatId - The ID of the chat.
     * @param apiChatParams - The chat apiChatParams | body.
     */
    constructor(apiChatParams = {} as PromptMaker['apiChatParams']) {
        this.apiChatParams = apiChatParams as OllamaChat;
    }

    /**
     * Event handler for receiving a response stream.
     * @param args - The callback data containing the response and assistant message.
     */
    onStream!: (args: { data: OllamaResponse; target: DBMessage }) => void;

    /**
     * Event handler for the end of the response stream.
     * @param args - The callback data containing the response and assistant message.
     */
    onEnd!: (args: SenderCallback) => void;

    /**
     * Sets the assistant message for the chat.
     * @param message - The assistant message.
     */
    public setRoleAssistant(message: DBMessage): void {
        this.assistantMessage = message;
    }

    /**
     * Sends a chat message and play a callback
     * @param userMessage - The user message to send.
     * userMessage: OllamaChatMessage, previousMessages: any, systemPrompt?: string
     */
    async sendChatMessage({
        userMessage,
        previousMessages,
        systemPrompt,
        ollamaChatBody,
        model,
        target,
    }: {
        userMessage: OllamaChatMessage;
        previousMessages: any;
        systemPrompt?: string;
        ollamaChatBody?: Partial<OllamaChat>;
        model?: string;
        target: DBMessage;
    }): Promise<void> {
        const config = get(settings);
        const ollamaOptions = get(ollamaApiMainOptionsParams);

        let system = null;
        if (systemPrompt ?? config?.system_prompt) {
            system = { role: OllamaChatMessageRole.ASSISTANT, content: systemPrompt ?? config?.system_prompt };
        }
        // send chat user message
        return OllamaApi.chat(
            {
                messages: [system, ...previousMessages, userMessage].filter((m) => m),
                model: model ?? config?.defaultModel,
                stream: true,
                ...ollamaChatBody,
                options: { ...ollamaOptions, ...ollamaChatBody?.options },
            } as OllamaChat,
            async (data: OllamaResponse) => {
                this.onResponseMessageStream({
                    data,
                    target,
                });
            }
        );
    }

    /**
     * Handles the response message stream.
     * @param args - The callback data containing the response and assistant message.
     */
    private async onResponseMessageStream({ data, target }: SenderCallback): Promise<void> {
        if (data.done) {
            this.onEnd({ data, target });
        } else {
            this.onStream({ data, target });
        }
    }
}
