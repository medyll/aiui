import type { ChatDataType } from '$lib/stores/chatter';
import { get } from 'svelte/store';
import { chatUtils } from './chatUtils';
import { aiResponseState } from '$lib/stores/chatEditListener';
import { OllamaFetch, type OllamaStreamLine } from './ollamaFetch';
import { dbQuery } from '../db/dbQuery';
import type { MessageType } from '$lib/stores/messages';

export type PromptSenderType = {
	prompt: string;
	context: number[];
	models: string[];
};

export type SenderCallback<T> = { 
	data: OllamaStreamLine;
} & T;

type ArgsType<T> = {
	cb: (args: SenderCallback<T>) => void;
	cbData:   T   ;
};

export class ChatSender<T>  {
	chatId!: string;
	chat!: ChatDataType;
	cb!: (args: SenderCallback<T>) => void;
	
	private cbData!: any;

	constructor(chat: ChatDataType, args: ArgsType<T>) {
		this.chat = chat;
		this.chatId = chat.chatId;

		this.cb = args.cb;
		this.cbData = args.cbData;
	}

	async sendMessage(content: string) {
		const chat = this.chat;

		aiResponseState.set('running');

		let args = { prompt: content, context: chat?.context ?? [], models: chat.models };
		// use args as a parameter
		this.sendPrompt(
			args,
			async (data) => this.cb({ ...this.cbData, data })
		);
	}

	async sendPrompt(sender: PromptSenderType, hook: (data: OllamaStreamLine) => void) {
		await Promise.all(
			sender.models.map(async (model) => {
				await OllamaFetch.generate(sender.prompt, hook, { sync: false, model });
			})
		);
	}
}
