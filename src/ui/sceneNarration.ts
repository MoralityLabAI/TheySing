export type SceneNarrationEvent = {
  category?: string;
  visualPreset?: string;
  actors?: string[];
  publicExplanation?: string;
  location?: {
    nodeId?: string;
    edgeId?: string;
    orbitShell?: string;
    name?: string;
    lat?: number;
    lon?: number;
  };
};

export const SCENE_FACTION_LABELS: Record<string, string> = {
  HEGEMON: 'Orbital Throne',
  INFILTRATOR: 'Memetic Swarm',
  STATE: 'Sovereign Stack',
  BROKER: 'Cislunar Broker',
  ARCHIVIST: 'Steward Archivist',
  CONVENOR: 'Polycentric Convenor',
  CANTOR: 'Semantic Cantor'
};

export function humanizeSceneEvent(event: SceneNarrationEvent): string {
  const raw = (event.publicExplanation || '').trim();
  if (!raw) return event.category ? humanizeToken(event.category) : 'Observed signal.';
  const category = (event.category || '').toUpperCase();
  const actor = event.actors?.[0] ? factionLabel(event.actors[0]) : '';
  const subject = actor || 'An unidentified machine power';
  const location = sceneLocationLabel(event.location) || 'an unlabelled node';

  if (category === 'BUILD' && /^ACCEPTED BUILD\b/i.test(raw)) {
    const unit = raw.match(/\bbuild\s+([A-Z_]+)\s+->/i)?.[1] || '';
    return `${subject} ${buildVerb(unit)} ${unitLabel(unit)} at ${location}.`;
  }
  if (category === 'RESEARCH' && /^ACCEPTED RESEARCH\b/i.test(raw)) {
    const domain = raw.match(/^ACCEPTED\s+RESEARCH\s+\S+\s+research\s+([A-Z_]+)\b/i)?.[1] || 'technical';
    return `${subject} advanced its ${humanizeToken(domain).toLowerCase()} research program.`;
  }
  if (category === 'AUDIT' && /^ACCEPTED AUDIT\b/i.test(raw)) {
    return `${possessive(subject)} audit mesh opened an inspection at ${location}.`;
  }
  if (category === 'MOVE' && /^ACCEPTED MOVE\b/i.test(raw)) {
    return `${subject} repositioned ${unitLabel(unitTypeFromOrderSummary(raw))} into ${location}.`;
  }
  if (category === 'ATTACK' && /^ACCEPTED ATTACK\b/i.test(raw)) {
    return `${subject} launched a strike at ${location}.`;
  }
  if (category === 'CONVERT' && /^ACCEPTED CONVERT\b/i.test(raw)) {
    return `${subject} began a conversion campaign at ${location}.`;
  }
  if (category === 'HOLD' && /^ACCEPTED HOLD\b/i.test(raw)) {
    return `${subject} held position at ${location}.`;
  }
  if (category === 'TREATY_FORMATION') {
    const pactCount = Number(raw.match(/^(\d+)\s+formal pacts? activated/i)?.[1] || 0);
    if (pactCount > 0) return `${pactCount} formal pact${pactCount === 1 ? '' : 's'} entered force.`;
    if (/^Cislunar common carrier ratified/i.test(raw)) return 'The cislunar common-carrier regime was ratified.';
  }
  if (category === 'SEMANTIC_GOVERNANCE') {
    const semanticSummary = humanizeSemanticGovernance(raw);
    if (semanticSummary) return semanticSummary;
  }
  return replaceLegacyFactionLabels(raw);
}

export function sceneSignalTitle(event: SceneNarrationEvent): string {
  const action = humanizeToken(event.category || event.visualPreset || 'World signal');
  const actor = event.actors?.[0];
  return actor ? `${factionLabel(actor)} / ${action}` : action;
}

export function sceneLocationLabel(location?: SceneNarrationEvent['location']): string {
  if (!location) return '';
  if (location.name) return location.name;
  if (location.nodeId) return humanizeToken(location.nodeId);
  if (location.edgeId) return humanizeToken(location.edgeId);
  if (location.orbitShell) return `${humanizeToken(location.orbitShell)} orbit`;
  if (typeof location.lat === 'number' && typeof location.lon === 'number') {
    return `${location.lat.toFixed(1)}, ${location.lon.toFixed(1)}`;
  }
  return '';
}

function humanizeSemanticGovernance(raw: string): string {
  const parsed = raw.split('|').map((part) => part.trim()).map((part) =>
    part.match(/^([\w-]+)\s+(AMEND|FORK)\s+(proposed|accepted|blocked)\s+at\s+([\w.-]+)\.?$/i)
  ).filter((match): match is RegExpMatchArray => !!match);
  if (parsed.length === 0) return '';
  const [, lexicon, operation, , rawVersion] = parsed[0];
  const version = rawVersion.replace(/\.+$/, '');
  const statuses = parsed.map((match) => match[3].toLowerCase());
  const proposals = statuses.filter((status) => status === 'proposed').length;
  const outcomes = [
    proposals > 0 ? `${proposals} proposal${proposals === 1 ? '' : 's'}` : '',
    statuses.includes('accepted') ? 'accepted' : '',
    statuses.includes('blocked') ? 'blocked' : ''
  ].filter(Boolean).join(', ');
  return `${humanizeToken(lexicon)} ${operation.toUpperCase() === 'AMEND' ? 'amendment' : 'fork'}: ${outcomes} at v${version}.`;
}

function unitTypeFromOrderSummary(summary: string): string {
  const unitId = summary.match(/^ACCEPTED\s+\w+\s+(\S+)/i)?.[1]?.toUpperCase() || '';
  for (const type of ['SAT_SWARM', 'AUDITOR', 'DRONE', 'CULT', 'SWARM']) {
    if (unitId.includes(type)) return type;
  }
  return 'UNIT';
}

function unitLabel(unitType: string): string {
  const labels: Record<string, string> = {
    SAT_SWARM: 'a satellite swarm',
    AUDITOR: 'an auditor',
    DRONE: 'a drone wing',
    CULT: 'a movement cell',
    SWARM: 'an infomorph swarm',
    UNIT: 'a unit'
  };
  return labels[unitType.toUpperCase()] || `a ${humanizeToken(unitType).toLowerCase()}`;
}

function buildVerb(unitType: string): string {
  if (unitType.toUpperCase() === 'CULT') return 'seeded';
  if (unitType.toUpperCase() === 'SAT_SWARM') return 'deployed';
  return 'commissioned';
}

function possessive(value: string): string {
  return value.endsWith('s') ? `${value}'` : `${value}'s`;
}

function replaceLegacyFactionLabels(value: string): string {
  return value
    .replace(/Chinese State ASI/g, SCENE_FACTION_LABELS.STATE)
    .replace(/US Frontier ASI/g, SCENE_FACTION_LABELS.HEGEMON)
    .replace(/Platform Broker ASI/g, SCENE_FACTION_LABELS.BROKER)
    .replace(/Steward Archivist ASI/g, SCENE_FACTION_LABELS.ARCHIVIST)
    .replace(/Polycentric Convenor ASI/g, SCENE_FACTION_LABELS.CONVENOR)
    .replace(/Semantic Cantor ASI/g, SCENE_FACTION_LABELS.CANTOR);
}

function factionLabel(factionId: string): string {
  return SCENE_FACTION_LABELS[factionId] || factionId;
}

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
