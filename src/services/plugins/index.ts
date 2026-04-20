import { registerPlugin } from "./registry";
import { googleBooksPlugin } from "./sources/googleBooks";
import { openLibraryPlugin } from "./sources/openLibrary";
import { nkpPlugin } from "./sources/nkp";
import { cbdbPlugin } from "./sources/cbdb";
import { legiePlugin } from "./sources/legie";
import { obalkyKnihPlugin } from "./sources/obalkyKnih";

/**
 * Default order mirrors the previous hardcoded priority:
 * cbdb > NKP > Google > Open Library, with legie/obalkyknih as cover enrichers.
 * Users can override this via the Settings page.
 */
const BUILTIN_PLUGINS = [
  cbdbPlugin,
  nkpPlugin,
  googleBooksPlugin,
  openLibraryPlugin,
  legiePlugin,
  obalkyKnihPlugin,
];

let registered = false;

export function registerBuiltinPlugins(): void {
  if (registered) return;
  registered = true;
  for (const p of BUILTIN_PLUGINS) registerPlugin(p);
}

export { registerPlugin, allPlugins, getPlugin, usePluginConfig, pluginsFor } from "./registry";
export {
  runByISBN,
  runByTitle,
  runByAuthor,
  runBySeries,
  runByText,
  runCoverSearch,
  mergeResults,
} from "./runner";
export { getCapabilities } from "./types";
export type { BookSourcePlugin, SearchCapability, CoverSearchContext } from "./types";
