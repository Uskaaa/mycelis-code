/**
 * AccountSwitcher component
 * Dropdown for switching between workspaces.
 * Placed in the welcome screen header, matching the legacy OrganizationSelector pattern.
 * Visible only when the user is logged in and belongs to at least one organization.
 */

import { Component, createSignal, createMemo, createEffect, For, Show, onCleanup } from "solid-js"
import { Spinner } from "@kilocode/kilo-ui/spinner"
import { useServer } from "../../context/server"
import { useVSCode } from "../../context/vscode"
import { useLanguage } from "../../context/language"
import { BalanceChip } from "./BalanceChip"

// mycelis_change - Mycelis has no personal-account tier, everything runs through workspaces
// (see dialog-kilo-profile.tsx in the CLI). Default to the owned workspace when no selection has
// ever been made, same as the CLI dialog and ProfileView.tsx.
export const AccountSwitcher: Component<{ class?: string }> = (props) => {
  const server = useServer()
  const vscode = useVSCode()
  const language = useLanguage()
  const [open, setOpen] = createSignal(false)
  const [switching, setSwitching] = createSignal(false)
  let ref: HTMLDivElement | undefined

  const profile = () => server.profileData()
  const orgs = () => profile()?.profile.organizations ?? []
  const visible = () => !!profile() && orgs().length > 0
  const current = () => profile()?.currentOrgId ?? orgs().find((org) => org.role === "Owner")?.id ?? orgs().at(0)?.id

  const selected = createMemo(() => {
    const id = current()
    return orgs().find((o) => o.id === id)
  })

  const label = createMemo(() => selected()?.name ?? orgs().at(0)?.name ?? "")

  // Clear switching state when profile data changes (switch completed or failed)
  createEffect(() => {
    profile()
    setSwitching(false)
  })

  function pick(org: { id: string; name: string; role: string }) {
    if (org.id === current()) {
      setOpen(false)
      return
    }
    setSwitching(true)
    vscode.postMessage({
      type: "setOrganization",
      organizationId: org.id,
    })
    setOpen(false)
  }

  // Close on Escape or outside click
  createEffect(() => {
    if (!open()) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const onMouse = (e: MouseEvent) => {
      if (ref && !ref.contains(e.target as Node)) setOpen(false)
    }

    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onMouse)
    onCleanup(() => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onMouse)
    })
  })

  return (
    <Show when={visible()}>
      <div class={`account-switcher ${props.class ?? ""}`} ref={ref}>
        <button
          type="button"
          class={`account-switcher-trigger ${switching() ? "account-switcher-switching" : ""}`}
          onClick={() => !switching() && setOpen((v) => !v)}
          disabled={switching()}
          aria-haspopup="listbox"
          aria-expanded={open()}
          aria-busy={switching()}
          title={
            switching()
              ? language.t("profile.switchingAccount")
              : selected()
                ? `${selected()!.name} – ${selected()!.role.toUpperCase()}`
                : ""
          }
        >
          <span class="account-switcher-label">{label()}</span>
          <BalanceChip class="account-switcher-balance" />
          <span class="account-switcher-badges">
            <Show when={selected() && !switching()}>
              <span class="account-switcher-role">{selected()!.role.toUpperCase()}</span>
            </Show>
            <Show
              when={switching()}
              fallback={
                <svg
                  class={`account-switcher-chevron ${open() ? "open" : ""}`}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="rgb(156 163 175)"
                  aria-hidden="true"
                >
                  <path d="M3 4.5L6 7.5L9 4.5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              }
            >
              <Spinner style={{ width: "12px", height: "12px" }} />
            </Show>
          </span>
        </button>

        <Show when={open() && !switching()}>
          <div class="account-switcher-dropdown" role="listbox" aria-label="Account">
            <For each={orgs()}>
              {(org) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={current() === org.id}
                  class="account-switcher-item"
                  onClick={() => pick(org)}
                >
                  <span class="account-switcher-item-name">{org.name}</span>
                  <span class="account-switcher-role">{org.role.toUpperCase()}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  )
}
