import type { CatalogMatch } from '@/types/models/catalog-match'
import type { ModelRef } from '@/types/models/model-ref'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import type {
  ResolveCatalogMatchesOptions,
  ResolveCatalogMatchesResult,
} from '@/types/models/resolve-catalog-matches-result'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import { isModelAllowed } from '@/services/models/model-catalog-options'
import humanizeModelId from '@/utils/humanize-model-id'
import { modelShortId } from '@/utils/model-vendor'
import parseModelRef from '@/utils/parse-model-ref'
import serializeModelRef from '@/utils/serialize-model-ref'
import filterScoredProviderModels from './filter-scored-provider-models'

/** Matches SCORE_EXACT in score-model-match.ts (exact id/name). */
const SCORE_EXACT = 100
const MATCH_CAP = 8
const MULTI_PROVIDER_NOTE =
  'Same model from multiple providers; ask the user which to use'

const modelDisplayName = (model: ModelRef): string => {
  const named = model.name?.trim()
  if (named) {
    return named
  }
  return humanizeModelId(modelShortId(model.modelId))
}

const filterAllowedGroups = (
  groups: ProviderModelGroup[],
  settings: VixlSettings,
): ProviderModelGroup[] => {
  const next: ProviderModelGroup[] = []
  for (const group of groups) {
    const models = group.models.filter((model) =>
      isModelAllowed(settings, {
        providerId: model.providerId,
        modelId: model.modelId,
      }),
    )
    if (models.length > 0) {
      next.push({ ...group, models })
    }
  }
  return next
}

const toCatalogMatch = (
  group: ProviderModelGroup,
  model: ModelRef,
  score: number,
): CatalogMatch => ({
  ref: serializeModelRef({
    providerId: model.providerId,
    modelId: model.modelId,
  }),
  name: modelDisplayName(model),
  providerId: group.providerId,
  providerName: group.providerName,
  score,
})

const pickBest = (matches: CatalogMatch[]): string | undefined => {
  if (matches.length === 0) {
    return undefined
  }
  const top = matches[0]
  if (!top) {
    return undefined
  }
  if (matches.length === 1) {
    return top.ref
  }
  if (top.score < SCORE_EXACT) {
    return undefined
  }
  const exactCount = matches.filter((match) => match.score >= SCORE_EXACT).length
  if (exactCount === 1) {
    return top.ref
  }
  return undefined
}

const hasSameModelFromMultipleProviders = (matches: CatalogMatch[]): boolean => {
  const providersByModelId = new Map<string, Set<string>>()
  for (const match of matches) {
    const parsed = parseModelRef(match.ref)
    if (!parsed) {
      continue
    }
    const providers = providersByModelId.get(parsed.modelId)
    if (providers) {
      providers.add(match.providerId)
      continue
    }
    providersByModelId.set(parsed.modelId, new Set([match.providerId]))
  }
  for (const providers of providersByModelId.values()) {
    if (providers.size > 1) {
      return true
    }
  }
  return false
}

const resolveCatalogMatches = (
  groups: ProviderModelGroup[],
  settings: VixlSettings,
  options: ResolveCatalogMatchesOptions,
): ResolveCatalogMatchesResult => {
  const query = options.query.trim()

  if (!query) {
    return {
      matches: [],
      error: 'Provide a query',
    }
  }

  const allowed = filterAllowedGroups(groups, settings)
  if (allowed.length === 0) {
    return { matches: [] }
  }

  const scored = filterScoredProviderModels(allowed, query)
  if (scored.length === 0) {
    return { matches: [] }
  }

  const matches = scored
    .slice(0, MATCH_CAP)
    .map((entry) => toCatalogMatch(entry.group, entry.model, entry.score))
  const note = hasSameModelFromMultipleProviders(matches)
    ? MULTI_PROVIDER_NOTE
    : undefined
  const best = note ? undefined : pickBest(matches)
  return {
    matches,
    ...(best ? { best } : {}),
    ...(note ? { note } : {}),
  }
}

export default resolveCatalogMatches
