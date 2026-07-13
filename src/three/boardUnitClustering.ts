export type ClusterableBoardUnit = {
  unitId?: string;
  type?: string;
  owner?: string;
  location?: string;
  inferred?: boolean;
  isRevealed?: boolean;
  stealthLevel?: number | string;
};

export type BoardUnitCluster<T extends ClusterableBoardUnit = ClusterableBoardUnit> = {
  unit: T;
  units: T[];
  count: number;
  key: string;
};

export function clusterBoardUnits<T extends ClusterableBoardUnit>(units: T[]): Array<BoardUnitCluster<T>> {
  const clusters = new Map<string, BoardUnitCluster<T>>();
  for (const unit of units) {
    if (!unit.location) continue;
    const revealState = unit.isRevealed === true ? 'REVEALED' : unit.isRevealed === false ? 'CONCEALED' : 'UNSPECIFIED';
    const key = [
      unit.location,
      unit.owner || 'ALL',
      unit.type || 'UNIT',
      unit.inferred ? 'INFERRED' : 'OBSERVED',
      revealState,
      unit.stealthLevel ?? ''
    ].join('|');
    const existing = clusters.get(key);
    if (existing) {
      existing.units.push(unit);
      existing.count += 1;
    } else {
      clusters.set(key, { unit, units: [unit], count: 1, key });
    }
  }
  return Array.from(clusters.values());
}
