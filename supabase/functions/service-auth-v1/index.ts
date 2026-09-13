import { createEdgeRuntime } from '../_shared/runtime.ts';
import { createServiceHandler } from '../_shared/handler.ts';

const publicOrigin = 'https://aispeechfit.crontables.com';
let runtime: ReturnType<typeof createEdgeRuntime> | undefined;
Deno.serve(createServiceHandler(() => runtime ??= createEdgeRuntime(Deno.env.toObject(), publicOrigin), {
  publicOrigin, functionName: 'service-auth-v1', version: 'edge-auth-v1',
}));
