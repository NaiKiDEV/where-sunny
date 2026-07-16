import { Mountain, MountainSnow } from 'lucide-react';
import { isNotableTerrain, TERRAIN_LABEL, terrainOf } from '../../core/candidates/feature';
import { formatElevation } from '../../lib/format';
import { useAppStore } from '../../state/store';

/** Compact elevation pill - rendered only for alpine/highland places. */
export function TerrainTag({ elevation }: { elevation?: number }) {
  const system = useAppStore((s) => s.unitSystem);
  const terrain = terrainOf(elevation);
  if (elevation === undefined || !isNotableTerrain(terrain)) return null;
  const Icon = terrain === 'alpine' ? MountainSnow : Mountain;
  return (
    <span className="place-terrain" title={`${TERRAIN_LABEL[terrain]} · ${formatElevation(elevation, system)}`}>
      <Icon size={12} strokeWidth={2} aria-hidden /> {formatElevation(elevation, system)}
    </span>
  );
}
