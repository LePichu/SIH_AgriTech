import { createResource, createSignal, For } from "solid-js"
import type { Component } from "solid-js"
import OpenAI from "openai"
import styles from "./App.module.css"

interface ChatMessage {
	role: "user" | "assistant" | "system"
	content: string
}

const fetchContext = async () => {
	const response = await fetch("http://localhost:8000/data")
	if (!response.ok) {
		throw new Error("Failed to fetch Helios context")
	}
	return response.text()
}

const App: Component = () => {
	const [messages, setMessages] = createSignal<ChatMessage[]>([])
	const [userInput, setUserInput] = createSignal("")
	const [isLoading, setIsLoading] = createSignal(false)
	const [contextData] = createResource(fetchContext)

	const openai = new OpenAI({
		apiKey: "not-needed-for-local-proxy",
		baseURL: "http://localhost:8000/llm/v1",
		dangerouslyAllowBrowser: true,
	})

	const handleSendMessage = async (event: Event) => {
		event.preventDefault()
		const userMessage = userInput().trim()
		if (!userMessage || isLoading() || contextData.loading) return

		const newMessages: ChatMessage[] = [...messages(), {
			role: "user",
			content: userMessage,
		}]
		setMessages(newMessages)
		setUserInput("")
		setIsLoading(true)

		const systemPrompt: ChatMessage = {
			role: "system",
			content: contextData() || "You are a helpful assistant.",
		}
		const messagesWithContext = [systemPrompt, ...newMessages]

		try {
			const completion = await openai.chat.completions.create({
				model: "llama3-instruct",
				messages: messagesWithContext,
			})

			const assistantMessage = completion.choices[0]?.message

			if (assistantMessage) {
				setMessages([...newMessages, assistantMessage])
			}
		} catch (error) {
			console.error("Error fetching completion:", error)
			setMessages([...newMessages, {
				role: "assistant",
				content: "Sorry, I couldn't get a response.",
			}])
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div class={styles.App}>
			<div class={styles.chatWindow}>
				<For each={messages()}>
					{(message) => (
						<div
							class={message.role === "user"
								? styles.userMessage
								: styles.assistantMessage}
						>
							{message.content}
						</div>
					)}
				</For>
				{contextData.loading && (
					<div class={styles.loadingIndicator}>
						Loading Helios context...
					</div>
				)}
				{isLoading() && (
					<div class={styles.loadingIndicator}>
						Helios is thinking...
					</div>
				)}
			</div>
			<form class={styles.chatForm} onSubmit={handleSendMessage}>
				<input
					type="text"
					class={styles.chatInput}
					placeholder="Ask Helios anything..."
					value={userInput()}
					onInput={(e) => setUserInput(e.currentTarget.value)}
					disabled={isLoading() || contextData.loading}
				/>
				<button
					type="submit"
					class={styles.sendButton}
					disabled={isLoading() || contextData.loading}
				>
					Send
				</button>
			</form>
		</div>
	)
}

export default App
