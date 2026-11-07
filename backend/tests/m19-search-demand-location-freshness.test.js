import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const adminSource = readFileSync(join(backendRoot, 'src/modules/adminGovernance/adminGovernance.service.js'), 'utf8')
const serviceStart = adminSource.indexOf('export async function getAdminSearchDemand({ query }) {')
const serviceEnd = adminSource.indexOf('\nexport async function searchAdminGovernance({', serviceStart)
assert.ok(serviceStart !== -1 && serviceEnd > serviceStart, 'Search demand service function must exist')
const serviceBody = adminSource.slice(serviceStart, serviceEnd).replace('export async function', 'async function')

function withFakeSearchEvents() {
  const calls = { aggregates: [], counts: [], finds: [] }
  const current = new Date()
  const fake = {
    countDocuments(match) {
      calls.counts.push(match)
      if (match.$and) return Promise.resolve(1) // Only Delhi has a coarse location.
      if (match.occurredAt?.$gte instanceof Date && current - match.occurredAt.$gte < 2 * 86400000) return Promise.resolve(1)
      return Promise.resolve(4)
    },
    aggregate(stages) {
      calls.aggregates.push(stages)
      const group = stages[1]?.$group || {}
      if (group._id === '$ownerUserId') return Promise.resolve([{ count: 2 }])
      if (group._id === '$normalizedQuery') return Promise.resolve([
        { query: 'Fresh Broccoli', searches: 3, uniqueCustomers: 2 },
        { query: 'milk', searches: 1, uniqueCustomers: 1 },
      ])
      if (group._id?.query) return Promise.resolve([
        { query: 'Fresh Broccoli', city: 'Delhi', state: 'Delhi', postcode: '110047', searches: 1 },
      ])
      return Promise.resolve([
        { city: 'Delhi', state: 'Delhi', postcode: '110047', searches: 1, uniqueCustomers: 1 },
      ])
    },
    find(match) {
      calls.finds.push(match)
      return {
        sort() { return this },
        limit() { return this },
        select() { return this },
        lean() {
          return Promise.resolve([
            { _id: 'new', displayQuery: 'Fresh Broccoli', surface: 'grocery', area: { city: 'Delhi', state: 'Delhi', postcode: '110047' }, occurredAt: current },
            { _id: 'old', displayQuery: 'milk', surface: 'recipes', area: {}, occurredAt: new Date(current - 3 * 86400000) },
          ])
        },
      }
    },
    findOne(match) {
      calls.finds.push(match)
      return { sort() { return this }, select() { return this }, lean() { return Promise.resolve({ occurredAt: current }) } }
    },
  }
  const getAdminSearchDemand = new Function('SearchDemandEvent', `${serviceBody}\nreturn getAdminSearchDemand`)(fake)
  return { getAdminSearchDemand, calls }
}

test('unknown locations do not displace known places while all searches remain counted', async () => {
  const { getAdminSearchDemand, calls } = withFakeSearchEvents()
  const result = await getAdminSearchDemand({ query: { days: 30, limit: 50 } })
  assert.equal(result.totalSearches, 4)
  assert.equal(result.uniqueCustomers, 2)
  assert.equal(result.topArea?.city, 'Delhi')
  assert.equal(result.searchesWithLocation, 1)
  assert.equal(result.searchesWithoutLocation, 3)
  assert.equal(result.searchesLast24Hours, 1)
  assert.ok(result.latestSearchAt)
  assert.ok(result.generatedAt instanceof Date)
  assert.equal(result.recent.length, 2)
  const areaAggregates = calls.aggregates.filter((stages) => typeof stages[1]?.$group?._id === 'object')
  assert.equal(areaAggregates.length, 2)
  for (const stages of areaAggregates) {
    assert.ok(stages[0].$match.$and, 'area-based groupings must exclude missing locations')
    const locationConditions = stages[0].$match.$and[1].$or
    assert.equal(locationConditions.length, 3)
  }
})

test('search query and location filters apply to the known-location aggregations', async () => {
  const { getAdminSearchDemand, calls } = withFakeSearchEvents()
  await getAdminSearchDemand({ query: { days: 7, limit: 10, q: 'broccoli', area: 'Delhi' } })
  const areaAggregate = calls.aggregates.find((stages) => typeof stages[1]?.$group?._id === 'object')
  const searchFilter = areaAggregate[0].$match.$and[0]
  assert.ok(searchFilter.normalizedQuery.$regex.includes('broccoli'))
  assert.ok(searchFilter.$or.some((condition) => condition['area.city']))
})

test('the demand result preserves the latest recorded event timestamp', async () => {
  const { getAdminSearchDemand } = withFakeSearchEvents()
  const result = await getAdminSearchDemand({ query: {} })
  assert.ok(new Date(result.latestSearchAt).getTime() > Date.now() - 60000)
})
