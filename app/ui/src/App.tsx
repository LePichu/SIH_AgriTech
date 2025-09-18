import { createSignal, For, createResource } from "solid-js"
import type { Component } from "solid-js"
import OpenAI from "openai"
import { marked } from "marked"
import styles from "./App.module.css"

interface ChatMessage {
	role: "user" | "assistant" | "system"
	content: string | (string | { type: "image_url", image_url: { url: string } } | { type: "text", text: string })[]
	imagePreview?: string
}

let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

const App: Component = () => {
	const [messages, setMessages] = createSignal<ChatMessage[]>([])
	const [userInput, setUserInput] = createSignal("")
	const [isLoading, setIsLoading] = createSignal(false)
	const [imageBase64, setImageBase64] = createSignal("")
	const [isRecording, setIsRecording] = createSignal(false)
	const [contextData] = createResource(async () => {
		const response = await fetch("http://localhost:8000/data")
		if (!response.ok) throw new Error("Failed to fetch Helios context")
		return response.text()
	})

	const llmClient = new OpenAI({
		apiKey: "not-needed-for-local-proxy",
		baseURL: "http://localhost:8000/llm/v1",
		dangerouslyAllowBrowser: true,
	})

	const handleMicClick = async () => {
		if (isRecording()) {
			mediaRecorder?.stop()
			setIsRecording(false)
		} else {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
				setIsRecording(true)
				audioChunks = []
				mediaRecorder = new MediaRecorder(stream)
				mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data)
				mediaRecorder.onstop = async () => {
					const audioBlob = new Blob(audioChunks, { type: "audio/wav" })
					const audioFile = new File([audioBlob], "recording.wav", { type: "audio/wav" })
					const formData = new FormData()
					formData.append("file", audioFile)
					formData.append("response_format", "json")
					try {
						setIsLoading(true)
						const response = await fetch("http://localhost:8000/transcribe", {
							method: "POST",
							body: formData,
						})
						const data = await response.json()
						if (data.text) {
							setUserInput((prev) => prev + data.text)
						}
					} catch (error) {
						console.error("Transcription error:", error)
					} finally {
						setIsLoading(false)
						stream.getTracks().forEach(track => track.stop())
					}
				}
				mediaRecorder.start()
			} catch (error) {
				console.error("Microphone access denied:", error)
			}
		}
	}

	const handleAudioFileChange = async (e: Event) => {
		const target = e.currentTarget as HTMLInputElement
		const file = target.files?.[0]
		if (!file) return

		const formData = new FormData()
		formData.append("file", file)
		formData.append("response_format", "json")
		
		try {
			setIsLoading(true)
			const response = await fetch("http://localhost:8000/transcribe", {
				method: "POST",
				body: formData,
			})
			const data = await response.json()
			if (data.text) {
				setUserInput((prev) => prev + data.text)
			}
		} catch (error) {
			console.error("Transcription error:", error)
		} finally {
			setIsLoading(false)
		}
		
		target.value = ""
	}

	const handleFileChange = (e: Event) => {
		const target = e.currentTarget as HTMLInputElement
		const file = target.files?.[0]
		if (file) {
			const reader = new FileReader()
			reader.onload = (event) => {
				const result = event.target?.result as string
				setImageBase64(result)
			}
			reader.readAsDataURL(file)
		}
		
		target.value = ""
	}

	const handleSendMessage = async (event: Event) => {
		event.preventDefault()
		const userText = userInput().trim()
		const userImage = imageBase64()
		if ((!userText && !userImage) || isLoading() || contextData.loading) return
		let userContent
		let userMessageForUi: ChatMessage
		if (userImage) {
			userContent = [ { type: "text", text: userText }, { type: "image_url", image_url: { url: userImage } } ]
			userMessageForUi = { role: "user", content: userText, imagePreview: userImage }
		} else {
			userContent = userText
			userMessageForUi = { role: "user", content: userText }
		}
		const newMessages: ChatMessage[] = [...messages(), userMessageForUi]
		setMessages(newMessages)
		setUserInput("")
		setImageBase64("")
		const apiMessages = [...messages().map(({ role, content }) => ({ role, content })), { role: "user", content: userContent }]
		let messagesWithContext = apiMessages
		if (messages().length === 1) {
			const systemPrompt: ChatMessage = { role: "system", content: contextData() || "You are a helpful assistant." }
			messagesWithContext = [systemPrompt, ...apiMessages]
		}
		setIsLoading(true)
		try {
			// @ts-ignore
			const completion = await llmClient.chat.completions.create({
				model: "llava-phi-3-mini",
				messages: messagesWithContext,
			})
			const assistantMessage = completion.choices[0]?.message
			if (assistantMessage) {
				setMessages([...newMessages, assistantMessage])
			}
		} catch (error) {
			console.error("Error fetching completion:", error)
			setMessages([...newMessages, { role: "assistant", content: "Sorry, I couldn't get a response." }])
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div class={styles.App}>
			<div class={styles.chatWindow}>
				<For each={messages()}>
					{(message) => (
						<div class={message.role === "user" ? styles.userMessage : styles.assistantMessage}>
							{message.role === "assistant" ? (
								<div class={styles.markdownOutput} innerHTML={marked.parse(message.content as string)} />
							) : (
								message.content
							)}
							{message.imagePreview && <img src={message.imagePreview} alt="User upload preview"/>}
						</div>
					)}
				</For>
				{contextData.loading && <div class={styles.loadingIndicator}>Loading Helios context...</div>}
				{isLoading() && <div class={styles.loadingIndicator}>Helios is thinking...</div>}
			</div>
			<form class={styles.chatForm} onSubmit={handleSendMessage}>
				<button type="button" class={`${styles.micButton} ${!isRecording() ? styles.idle : ""}`} onClick={handleMicClick}>
					!
				</button>
				<label for="audio-picker" class={styles.audioFileButton}>
					%
				</label>
				<input
					id="audio-picker"
					type="file"
					accept="audio/*"
					class={styles.fileInputHidden}
					onchange={handleAudioFileChange}
				/>
				<label for="file-picker" class={styles.filePickerLabel}>+</label>
				<input
					id="file-picker"
					type="file"
					accept="image/*"
					class={styles.fileInputHidden}
					onchange={handleFileChange}
				/>
				<input
					type="text"
					class={styles.chatInput}
					placeholder="Ask Helios anything..."
					value={userInput()}
					onInput={(e) => setUserInput(e.currentTarget.value)}
					disabled={isLoading() || contextData.loading}
				/>
				<button type="submit" class={styles.sendButton} disabled={isLoading() || contextData.loading}>
					Send
				</button>
			</form>
		</div>
	)
}

export default App