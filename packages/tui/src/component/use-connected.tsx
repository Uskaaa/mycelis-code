import { createMemo } from "solid-js"
import { useSync } from "../context/sync"

// mycelis_change - "connected" means signed in to *Mycelis* specifically. Mycelis has no
// anonymous/free tier, so the presence of some other configured provider (e.g. a direct
// Anthropic key set up before ever touching Mycelis) must not count as "connected".
//
// It's tempting to check `provider_next.connected.includes("kilo")` for this (several other
// call sites did, this file included until this fix) - but that's wrong: the "kilo" provider
// ALWAYS autoloads anonymously (kiloCustomLoaders in kilocode/provider/provider.ts sets
// `autoload: Object.keys(input.models).length > 0`, unconditionally, as Kilo's free tier), so
// it's unconditionally present in provider_next.connected whether or not the user ever signed
// in. A real Mycelis login stores its PAT as an "api"-type credential (see
// OidcProviderController.Token + ProviderAuth.callback), which merges the provider with
// `source: "api"` *before* the anonymous custom-loader fallback runs and finds an existing
// entry to patch rather than creating a fresh `source: "custom"` one - so the provider's
// `source` in provider_next.all, not its mere presence in provider_next.connected, is the only
// signal that actually distinguishes "signed in" from "anonymous free tier".
export function isKiloConnected(providers: ReadonlyArray<{ id: string; source: string }>) {
  const kilo = providers.find((provider) => provider.id === "kilo")
  return kilo !== undefined && kilo.source !== "custom"
}

export function useConnected() {
  const sync = useSync()
  return createMemo(() => isKiloConnected(sync.data.provider_next.all))
}
