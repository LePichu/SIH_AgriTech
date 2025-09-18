import { Hono } from "https://deno.land/x/hono/mod.ts"
import { cors } from "https://deno.land/x/hono/middleware.ts"

const app = new Hono()
const llamaServerUrl = "http://localhost:3000"
const whisperServerUrl = "http://localhost:8081/inference"

app.use(
	"*",
	cors({
		origin: "http://localhost:5173",
		allowHeaders: ["*"],
		allowMethods: ["POST", "GET", "OPTIONS"],
	}),
)

app.post("/transcribe", async (c) => {
	try {
		const body = await c.req.formData()
		const response = await fetch(whisperServerUrl, {
			method: "POST",
			body: body,
		})
		const transcription = await response.json()
		return c.json(transcription)
	} catch (error) {
		console.error("Error during transcription:", error)
		return c.json({ text: "Error transcribing audio." }, 500)
	}
})

app.get("/data", async (c) => {
	try {
		const context = await Deno.readTextFile("./model/build/context.txt")
		c.header("Content-Type", "text/plain")
		return c.text(context)
	} catch (error) {
		console.error("Could not read context file:", error)
		return c.text("Context file not found.", 404)
	}
})

app.all("/llm/*", async (c) => {
	const url = new URL(c.req.url)
	const targetUrl = new URL(
		llamaServerUrl + url.pathname.replace("/llm", "") + url.search,
	)
	const newRequest = new Request(targetUrl, c.req.raw)
	const llamaResponse = await fetch(newRequest)
	const newHeaders = new Headers(llamaResponse.headers)
	return new Response(llamaResponse.body, {
		status: llamaResponse.status,
		statusText: llamaResponse.statusText,
		headers: newHeaders,
	})
})

console.log("API server running on http://localhost:8000")
Deno.serve(app.fetch)
