import { cbdbPlugin } from "./sources/cbdb.js";
import { databazeknihPlugin } from "./sources/databazeknih.js";
import { googleBooksPlugin } from "./sources/googleBooks.js";
import { legiePlugin } from "./sources/legie.js";
import { nkpPlugin } from "./sources/nkp.js";
import { obalkyKnihPlugin } from "./sources/obalkyKnih.js";
import { openLibraryPlugin } from "./sources/openLibrary.js";
import type { BookSourcePlugin } from "./types.js";

export const BUILTIN_PLUGINS: BookSourcePlugin[] = [
  cbdbPlugin,
  databazeknihPlugin,
  nkpPlugin,
  googleBooksPlugin,
  openLibraryPlugin,
  legiePlugin,
  obalkyKnihPlugin,
];

export const DEFAULT_ORDER: string[] = BUILTIN_PLUGINS.map((p) => p.id);

export type PluginMeta = {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
};

import { getCapabilities } from "./types.js";

export function pluginsMeta(): PluginMeta[] {
  return BUILTIN_PLUGINS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    capabilities: getCapabilities(p),
  }));
}
