// mycelis_change - new file
import { createServer, type Server } from "http"
import { execFile } from "child_process"
import { randomBytes } from "crypto"
import type { AuthOAuthResult } from "@kilocode/plugin"
import { MYCELIS_WEB_URL, MYCELIS_CLI_CLIENT_ID } from "../api/constants.js"

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

const SUCCESS_HTML =
  "<!doctype html><title>Mycelis</title><body style='font-family:sans-serif;text-align:center;margin-top:20vh'>" +
  "<h2>Signed in to Mycelis</h2><p>You can close this tab and return to the terminal.</p></body>"

const FAILURE_HTML =
  "<!doctype html><title>Mycelis</title><body style='font-family:sans-serif;text-align:center;margin-top:20vh'>" +
  "<h2>Sign-in failed</h2><p>You can close this tab and try again in the terminal.</p></body>"

function openBrowser(url: string) {
  const [cmd, ...args] =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url]
  execFile(cmd, args, { windowsHide: true })
}

type CallbackResult = { code: string } | { error: string }

/**
 * Starts a loopback HTTP server on an ephemeral port and resolves once it's
 * listening, handing back both the port (needed to build the redirect_uri
 * before the browser opens) and a promise that settles when the OIDC
 * redirect lands on it (or the timeout below fires first).
 */
function startCallbackServer(expectedState: string): Promise<{ port: number; result: Promise<CallbackResult> }> {
  return new Promise((resolveStart, rejectStart) => {
    let settled = false
    let resolveResult!: (value: CallbackResult) => void
    const result = new Promise<CallbackResult>((res) => {
      resolveResult = res
    })

    let server: Server
    const finish = (value: CallbackResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolveResult(value)
      server.close()
    }

    const timer = setTimeout(() => finish({ error: "Timed out waiting for browser sign-in" }), CALLBACK_TIMEOUT_MS)

    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      if (url.pathname !== "/callback") {
        res.writeHead(404).end()
        return
      }

      const code = url.searchParams.get("code")
      const state = url.searchParams.get("state")
      const ok = Boolean(code) && state === expectedState

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(ok ? SUCCESS_HTML : FAILURE_HTML)

      finish(ok ? { code: code! } : { error: "Sign-in was not completed" })
    })

    server.on("error", rejectStart)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        rejectStart(new Error("Failed to start local callback server"))
        return
      }
      resolveStart({ port: address.port, result })
    })
  })
}

/**
 * Browser-based login for Mycelis.
 *
 * Reuses the exact /oidc/authorize + /oidc/token handoff that already powers the
 * OpenWebUI integration (Authify's OidcProviderController) - same login page, same
 * session detection. The only Mycelis-side addition is a reserved "mycelis-cli"
 * client_id and a Personal Access Token minted alongside the OIDC token response,
 * since the model gateway (YarpGatewayController/ModelsProxyController) only accepts
 * PATs, not the short-lived OIDC access_token.
 */
export async function authenticateWithMycelisBrowserLogin(): Promise<AuthOAuthResult> {
  const state = randomBytes(16).toString("hex")

  return {
    url: MYCELIS_WEB_URL,
    instructions: "Sign in to Mycelis in your browser to continue",
    method: "auto",
    async callback() {
      const { port, result } = await startCallbackServer(state)
      const redirectUri = `http://127.0.0.1:${port}/callback`
      const authorizeUrl = new URL("/oidc/authorize", MYCELIS_WEB_URL)
      authorizeUrl.searchParams.set("client_id", MYCELIS_CLI_CLIENT_ID)
      authorizeUrl.searchParams.set("redirect_uri", redirectUri)
      authorizeUrl.searchParams.set("state", state)

      openBrowser(authorizeUrl.toString())

      const outcome = await result
      if ("error" in outcome) return { type: "failed" }

      const tokenResponse = await fetch(new URL("/oidc/token", MYCELIS_WEB_URL), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: outcome.code }),
      })

      if (!tokenResponse.ok) return { type: "failed" }

      const data = (await tokenResponse.json()) as { pat?: string }
      if (!data.pat) return { type: "failed" }

      return {
        type: "success",
        provider: "kilo",
        key: data.pat,
      }
    },
  }
}
