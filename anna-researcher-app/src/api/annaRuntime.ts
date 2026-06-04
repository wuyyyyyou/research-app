import type { AnnaRuntimeApi, AnnaRuntimeGlobal } from "../types";

export const ANNA_RUNTIME_SDK_URL = "/static/anna-apps/_sdk/latest/index.js";

interface AnnaRuntimeModule {
  AnnaAppRuntime?: AnnaRuntimeGlobal;
  default?: AnnaRuntimeGlobal;
}

export async function connectAnnaRuntime(): Promise<AnnaRuntimeApi> {
  const mod = (await import(/* @vite-ignore */ ANNA_RUNTIME_SDK_URL)) as AnnaRuntimeModule;
  const runtime = mod.AnnaAppRuntime ?? mod.default;
  if (!runtime) throw new Error("AnnaAppRuntime SDK did not export AnnaAppRuntime.");
  return runtime.connect();
}
