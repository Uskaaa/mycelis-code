import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import path from "path"
import { Effect, Layer, Record, Result, Schema, Context } from "effect"
import { NonNegativeInt } from "@opencode-ai/core/schema"
import { Global } from "@opencode-ai/core/global"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Telemetry } from "@kilocode/kilo-telemetry" // kilocode_change
import * as Log from "@opencode-ai/core/util/log" // mycelis_change

const log = Log.create({ service: "auth" }) // mycelis_change

export const OAUTH_DUMMY_KEY = "kilo-oauth-dummy-key" // kilocode_change

const file = path.join(Global.Path.data, "auth.json")

const fail = (message: string) => (cause: unknown) => new AuthError({ message, cause })

export class Oauth extends Schema.Class<Oauth>("OAuth")({
  type: Schema.Literal("oauth"),
  refresh: Schema.String,
  access: Schema.String,
  expires: NonNegativeInt,
  accountId: Schema.optional(Schema.String),
  enterpriseUrl: Schema.optional(Schema.String),
}) {}

export class Api extends Schema.Class<Api>("ApiAuth")({
  type: Schema.Literal("api"),
  key: Schema.String,
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.String)),
}) {}

export class WellKnown extends Schema.Class<WellKnown>("WellKnownAuth")({
  type: Schema.Literal("wellknown"),
  key: Schema.String,
  token: Schema.String,
}) {}

export const Info = Schema.Union([Oauth, Api, WellKnown]).annotate({ discriminator: "type", identifier: "Auth" })
export type Info = Schema.Schema.Type<typeof Info>

export class AuthError extends Schema.TaggedErrorClass<AuthError>()("AuthError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export interface Interface {
  readonly get: (providerID: string) => Effect.Effect<Info | undefined, AuthError>
  readonly all: () => Effect.Effect<Record<string, Info>, AuthError>
  readonly set: (key: string, info: Info) => Effect.Effect<void, AuthError>
  readonly remove: (key: string) => Effect.Effect<void, AuthError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Auth") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fsys = yield* FSUtil.Service
    const decode = Schema.decodeUnknownOption(Info)

    const all = Effect.fn("Auth.all")(function* () {
      if (process.env.KILO_AUTH_CONTENT) {
        try {
          return JSON.parse(process.env.KILO_AUTH_CONTENT)
        } catch (err) {}
      }

      const data = (yield* fsys.readJson(file).pipe(Effect.orElseSucceed(() => ({})))) as Record<string, unknown>
      // mycelis_change - Record.filterMap used to drop entries that fail to decode against the
      // current Info schema completely silently. That's indistinguishable from "never logged in"
      // from every caller's point of view - auth.get(id) just returns undefined either way, and
      // since auth.json isn't rewritten just by being read, the entry stays permanently
      // undecodable (and thus permanently "logged out") until the next explicit auth.set for
      // that id. Logging what got dropped turns a silent, persistent, unexplained logout into a
      // diagnosable one.
      return Record.filterMap(data, (value, key) => {
        const result = decode(value)
        if (result._tag === "None") {
          log.warn("dropping undecodable stored auth entry - will read back as logged out", { key, value })
        }
        return Result.fromOption(result, () => undefined)
      })
    })

    const get = Effect.fn("Auth.get")(function* (providerID: string) {
      return (yield* all())[providerID]
    })

    const set = Effect.fn("Auth.set")(function* (key: string, info: Info) {
      const norm = key.replace(/\/+$/, "")
      const data = yield* all()
      if (norm !== key) delete data[key]
      delete data[norm + "/"]
      // mycelis_change - trace every write to the "kilo" credential (type + presence of the
      // fields the schema requires) so a future silent/persistent logout can be correlated with
      // exactly which write produced it, instead of only seeing the eventual dropped-entry
      // warning above with no record of what wrote the bad shape in the first place.
      if (norm === "kilo") {
        log.info("writing kilo auth", {
          type: info.type,
          hasKey: info.type === "api" || info.type === "wellknown" ? !!info.key : undefined,
          hasMetadata: info.type === "api" ? !!info.metadata : undefined,
          hasRefresh: info.type === "oauth" ? !!info.refresh : undefined,
          hasAccess: info.type === "oauth" ? !!info.access : undefined,
        })
      }
      yield* fsys
        .writeJson(file, { ...data, [norm]: info }, 0o600)
        .pipe(Effect.mapError(fail("Failed to write auth data")))
    })

    const remove = Effect.fn("Auth.remove")(function* (key: string) {
      const norm = key.replace(/\/+$/, "")
      const data = yield* all()
      delete data[key]
      delete data[norm]
      if (norm === "kilo") log.info("removing kilo auth") // mycelis_change
      yield* fsys.writeJson(file, data, 0o600).pipe(Effect.mapError(fail("Failed to write auth data")))

      // kilocode_change start - Track logout and reset telemetry identity for Kilo
      if (key === "kilo") {
        yield* Effect.promise(() => Telemetry.updateIdentity(null))
      }
      Telemetry.trackAuthLogout(key)
      // kilocode_change end
    })

    return Service.of({ get, all, set, remove })
  }),
)

export const node = LayerNode.make({ service: Service, layer: layer, deps: [FSUtil.node] })
export const defaultLayer = layer.pipe(Layer.provide(FSUtil.defaultLayer)) // kilocode_change - legacy Kilo runtime compatibility

export * as Auth from "."
