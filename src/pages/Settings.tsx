import { ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { usePluginConfig } from "@/services/plugins/registry";
import { usePluginsMeta } from "@/services/plugins/meta";
import type { PluginMeta, SearchCapability } from "@/services/plugins/meta";
import { PasswordChangeCard } from "@/components/PasswordChangeCard";

const CAP_LABEL: Record<SearchCapability, string> = {
  isbn: "ISBN",
  title: "Title",
  author: "Author",
  series: "Series",
  text: "Text",
  cover: "Cover",
};

function CapabilityBadge({ cap }: { cap: SearchCapability }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
      {CAP_LABEL[cap]}
    </span>
  );
}

function PluginRow({
  plugin,
  position,
  total,
  enabled,
  onToggle,
  onMove,
}: {
  plugin: PluginMeta;
  position: number;
  total: number;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onMove: (delta: number) => void;
}) {
  return (
    <li className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-5 h-5 rounded accent-blue-500"
        aria-label={`Enable ${plugin.name}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white">{plugin.name}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">#{position + 1}</span>
        </div>
        {plugin.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{plugin.description}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-2">
          {plugin.capabilities.map((c) => (
            <CapabilityBadge key={c} cap={c} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <button
          onClick={() => onMove(-1)}
          disabled={position === 0}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Move up"
        >
          <ChevronUp size={18} />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={position === total - 1}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Move down"
        >
          <ChevronDown size={18} />
        </button>
      </div>
    </li>
  );
}

export default function Settings() {
  const { order, disabled, movePlugin, toggle, reset } = usePluginConfig();
  const { plugins, defaultOrder } = usePluginsMeta();
  const disabledSet = new Set(disabled);
  const byId = new Map(plugins.map((p) => [p.id, p]));

  // Render in user order, then tail on any server plugins not yet present
  const seen = new Set<string>();
  const ordered: PluginMeta[] = [];
  for (const id of order) {
    const p = byId.get(id);
    if (p && !seen.has(id)) {
      seen.add(id);
      ordered.push(p);
    }
  }
  for (const p of plugins) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      ordered.push(p);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <PasswordChangeCard />

      <div>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Metadata Sources</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Top sources are tried first. Disable sources you don&rsquo;t want to query.
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Changes are saved automatically.
            </p>
          </div>
          <button
            onClick={() => reset(defaultOrder)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        <ul className="space-y-2">
          {ordered.map((p, i) => (
            <PluginRow
              key={p.id}
              plugin={p}
              position={i}
              total={ordered.length}
              enabled={!disabledSet.has(p.id)}
              onToggle={(e) => toggle(p.id, e)}
              onMove={(delta) => movePlugin(p.id, delta)}
            />
          ))}
        </ul>

        <p className="text-xs text-gray-500 dark:text-gray-500 mt-6">
          Each source can contribute data for one or more search types. When multiple sources return
          results for the same field, the higher-priority source wins.
        </p>
      </div>
    </div>
  );
}
