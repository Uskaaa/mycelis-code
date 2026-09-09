/**
 * TUI-specific helper functions for Kilo Gateway integration
 *
 * This module provides utilities that are consumed by the TUI layer
 * to implement organization selection, profile display, and team management.
 */

import type { KilocodeProfile, KilocodeBalance, Organization } from "../types.js"

/**
 * Format profile information for display
 * Used by TUI to show profile in dialogs
 */
export function formatProfileInfo(
  profile: KilocodeProfile,
  balance: KilocodeBalance | null,
  currentOrgId?: string,
): string {
  let content = ""

  if (profile.name) {
    content += `Name: ${profile.name}\n`
  }

  if (profile.email) {
    content += `Email: ${profile.email}\n`
  }

  // Show current workspace
  if (currentOrgId && profile.organizations) {
    const currentOrg = profile.organizations.find((org) => org.id === currentOrgId)
    if (currentOrg) {
      content += `Workspace: ${currentOrg.name} (${currentOrg.role})\n` // mycelis_change
    }
  }

  if (balance && balance.balance !== undefined && balance.balance !== null) {
    content += `Balance: $${balance.balance.toFixed(2)}\n`
  }

  // Add usage details link
  const usageUrl = currentOrgId
    ? `https://app.kilo.ai/organizations/${currentOrgId}/usage-details`
    : "https://app.kilo.ai/usage"
  content += `\nUsage Details: ${usageUrl}`

  return content
}

/**
 * Get workspace options formatted for TUI DialogSelect.
 * mycelis_change - there's no separate "personal account" anymore: a user's own workspace is
 * just another entry in `organizations` (see ProfileController in Mycelis.WebApp), so every
 * workspace - owned or joined - is listed the same way.
 */
export function getOrganizationOptions(
  organizations: Organization[],
  currentOrgId?: string,
): Array<{
  title: string
  value: string
  description?: string
  category: string
}> {
  return organizations.map((org) => ({
    title: org.name,
    value: org.id,
    description: org.id === currentOrgId ? `→ (current) ${org.role}` : org.role,
    category: "Workspaces", // mycelis_change
  }))
}

/**
 * Get the default workspace selection (first one if available).
 */
export function getDefaultOrganizationSelection(organizations: Organization[]): string | null {
  return organizations.length > 0 ? organizations[0].id : null
}
