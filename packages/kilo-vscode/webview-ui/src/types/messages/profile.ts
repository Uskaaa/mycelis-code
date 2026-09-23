// Kilo notification types (mirrored from kilo-gateway)
export interface KilocodeNotificationAction {
  actionText: string
  actionURL: string
}

export interface KilocodeNotification {
  id: string
  title: string
  message: string
  action?: KilocodeNotificationAction
  showIn?: string[]
  suggestModelId?: string
}

// Profile types from kilo-gateway
export interface KilocodeBalance {
  balance: number
}

export interface ProfileData {
  profile: {
    email: string
    name?: string
    organizations?: Array<{ id: string; name: string; role: string }>
    selectedOrganizationId?: string
    hasPersonalAccount?: boolean
  }
  balance: KilocodeBalance | null
  currentOrgId: string | null
  // mycelis_change - single usage-details deep link from /kilo/profile, replaces the old
  // dashboard/top-up/kilo-pass links; see dialog-kilo-profile.tsx for the CLI equivalent.
  usageUrl?: string
}
