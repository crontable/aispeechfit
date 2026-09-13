import { createServiceHandler } from '../_shared/handler.ts';
import { createEdgeRuntime } from '../_shared/runtime.ts';

const publicOrigin = 'https://deploy-preview-30--aispeechfit.netlify.app';
let runtime: ReturnType<typeof createEdgeRuntime> | undefined;
Deno.serve(createServiceHandler(() => runtime ??= createEdgeRuntime(Deno.env.toObject(), publicOrigin), {
  publicOrigin, functionName: 'service-auth-preview-v1', version: 'edge-auth-preview-v1',
}));
