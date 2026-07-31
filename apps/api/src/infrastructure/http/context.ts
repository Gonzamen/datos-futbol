import type { Dependencies } from '../../application/dependencies.js'
import type { Env } from '../../config/env.js'
import type { RealtimeGateway } from '../realtime/gateway.js'

/** What `main.ts` assembles and passes to `buildApp`. */
export interface AppDependencies {
  env: Env
  deps: Dependencies
}

/** What route registrars receive: the above, plus the gateway `buildApp` wires up. */
export interface AppContext extends AppDependencies {
  realtime: RealtimeGateway
}
