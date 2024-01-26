import { aiState } from '$lib/stores';
import { ollamaApiMainOptionsParams } from '$lib/stores/ollamaParams';
import { settings } from '$lib/stores/settings';
import type { OllChatMessage as ChatCompletionMessage, OllApiChat as OllApiChat, OllApiGenerate, OllResponseType } from '$types/ollama';
import { get } from 'svelte/store';

export class OllamaApi {
    private options = {
        model: 'llama2-uncensored',
    };

    constructor(options?: {}) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Generates text using the Ollama API.
     * @param prompt - The prompt for generating the text.
     * @param hook - Optional callback function to handle the response data.
     * @param apiBody - Optional additional parameters for the API request.
     * @returns A Promise that resolves to the generated text or the API response.
     */
    static async generate(prompt: string, apiBody?: Partial<OllApiGenerate>, hook?: (data: OllResponseType) => void) {
        const config = get(settings);
        const ollamaOptions = get(ollamaApiMainOptionsParams);

        const defaultOptions = {
            model: config?.defaultModel,
            prompt,
            system: config?.system_prompt,
            ...apiBody,
            options: { ...ollamaOptions, ...apiBody?.options },
        } as OllApiGenerate;

        const res = await fetch(`${config.ollama_server}/api/generate`, {
            body: JSON.stringify(defaultOptions),
            headers: {
                'Content-Type': 'application/octet-stream',
                ...getHeader(),
            },
            method: 'POST',
        });

        if (!res.ok) {
            throw await res.json();
        } else {
            if (apiBody?.stream) {
                this.stream(res, hook);
            } else {
                if (!res.ok) throw await res.json();
                const out = await res.json();

                return out;
            }
        }
        return res;
    }

    static async chat(
        message: ChatCompletionMessage,
        messages: ChatCompletionMessage[] = [],
        systemPrompt: string | null = null,
        ollApiParams: Partial<OllApiChat>,
        hook?: (data: OllResponseType) => void
    ) {
        const config = get(settings);
        // default params
        const ollamaOptions = get(ollamaApiMainOptionsParams);

        if (systemPrompt ?? config?.system_prompt) {
            let system = { role: 'system', content: systemPrompt ?? config?.system_prompt };
            messages = [system, ...messages] as ChatCompletionMessage[];
        }
        const defaultOptions: OllApiChat = {
            model: config?.defaultModel,
            messages: [...messages, message], // { role: 'system', prompt: config.system_prompt }
            format: ollApiParams?.format,
            template: ollApiParams?.template ?? null,
            stream: ollApiParams?.stream ?? true,
            //...ollApiParams,
            options: { ...ollamaOptions, ...ollApiParams?.options },
        };

        const res = await fetch(`${config.ollama_server}/api/chat`, {
            body: JSON.stringify(defaultOptions),
            headers: {
                'Content-Type': 'text/event-stream',
                ...getHeader(),
            },
            method: 'POST',
        });

        if (!res.ok) {
            throw await res.json();
        } else {
            if (defaultOptions?.stream) {
                this.stream(res, hook);
            } else {
                if (!res.ok) throw await res.json();
                const out = await res.json();

                return out;
            }
        }
        return res;
    }

    static async ping(url: string) {
        return fetch(`${url}/api/tags`, {
            headers: {
                'Content-Type': 'application/json',
                ...getHeader(),
            },
            method: 'GET',
        })
            .then(async (res) => {
                if (!res?.ok) throw await res.json();
                return await res.json();
            })
            .then(async (res) => {
                return res?.models;
            })
            .catch((error) => {
                throw error;
            });
    }

    async listModels() {
        const config = get(settings);

        return fetch(`${config.ollama_server}/api/tags`, {
            headers: {
                'Content-Type': 'application/json',
                ...getHeader(),
            },
            method: 'GET',
        })
            .then(async (res) => {
                if (!res?.ok) throw await res.json();
                return await res.json();
            })
            .then(async (res) => {
                return res?.models;
            })
            .catch((error) => {
                throw error;
            });
    }

    static async deleteModel(model: string) {
        const config = get(settings);
        return fetch(`${config.ollama_server}/api/delete`, {
            body: JSON.stringify({ name: model }),
            headers: {
                'Content-Type': 'application/json',
                ...getHeader(),
            },
            method: 'DELETE',
        })
            .then(async (res) => {
                if (!res.ok) throw await res.json();
                return await res.json();
            })
            .then(async (res) => {
                return res;
            })
            .catch((error) => {
                throw error;
            });
    }

    static async pullModel(model: string, hook: (args: any) => void) {
        const config = get(settings);

        const res = await fetch(`${config.ollama_server}/api/pull`, {
            body: JSON.stringify({ name: model }),
            headers: {
                'Content-Type': 'text/event-stream',
                ...getHeader(),
            },
            method: 'POST',
        })
            .then(async (res) => {
                return res;
            })
            .then(async (res) => {
                return res;
            })
            .catch((error) => {
                throw error;
            });
        this.stream(res, hook);
    }

    static async stream(response: Response, hook?: (data: OllResponseType) => void) {
        if (response.body) {
            const streamReader = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(splitStream('\n')).getReader();

            while (true) {
                const { value, done } = await streamReader.read();

                if (Boolean(done) || get(aiState) == 'request_stop') break;
                if (value) {
                    const data: OllResponseType = JSON.parse(value);

                    if (hook) hook(data);
                }
            }
        }
    }
}

function splitStream(separator: string) {
    let buffer = '';
    return new TransformStream({
        flush(controller) {
            if (buffer) controller.enqueue(buffer);
        },
        transform(chunk, controller) {
            buffer += chunk;
            const parts = buffer.split(separator);
            parts.slice(0, -1).forEach((part) => controller.enqueue(part));
            buffer = parts[parts.length - 1];
        },
    });
}

function getHeader() {
    return {};
}
