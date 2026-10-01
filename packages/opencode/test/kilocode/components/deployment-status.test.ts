import { describe, expect, test } from "bun:test"
import { isDeploymentSettled } from "@/kilocode/components/deployment-status"

describe("isDeploymentSettled", () => {
  test("terminal statuses are settled, case-insensitively", () => {
    for (const status of ["Running", "running", "Stopped", "STOPPED", "Error", "Failed"]) {
      expect(isDeploymentSettled(status)).toBe(true)
    }
  })

  test("transitional statuses are not settled", () => {
    for (const status of ["Pending", "Provisioning", "Starting", "Stopping", "Deploying", "Deleting"]) {
      expect(isDeploymentSettled(status)).toBe(false)
    }
  })
})
