import test from 'node:test'
import assert from 'node:assert/strict'
import { getLocalMeal, buildEditorialTags, editorialEvidence, getSmartRecipes, getCuisineOptions, recipeMeta, matchesMeal } from './smartDiscovery.js'
const date=(y,m,d,h=12)=>new Date(y,m-1,d,h)
const byDay = date(2026,11,18)
function saved(taglist){ return taglist.map(value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')) }
const curated = {dish:{name:'Dal',tags:saved(buildEditorialTags({season:'winter',festival:'Diwali',region:'India',from:'2026-11-01',until:'2026-11-30',featured:true})),course:'Dinner',cuisine:'Indian'}}
const breakfast = {dish:{name:'Poha',course:'Breakfast',cuisine:'Indian',tags:['vegetarian']}}
const generic = {dish:{name:'Rice',course:'Main Course',tags:['vegetarian']}}
const lunch = {dish:{name:'Lunch',course:'Lunch',cuisine:'Japanese'}}
test('time-of-day boundaries are local and deterministic',()=>{
  assert.equal(getLocalMeal(date(2026,11,18,6)), 'Breakfast')
  assert.equal(getLocalMeal(date(2026,11,18,12)), 'Lunch')
  assert.equal(getLocalMeal(date(2026,11,18,16)), 'Snacks')
  assert.equal(getLocalMeal(date(2026,11,18,20)), 'Dinner')
  assert.equal(getLocalMeal(date(2026,11,18,2)), 'Dinner')
})
test('specific meals do not invent category for main course',()=>{
  assert.equal(matchesMeal(breakfast,'Breakfast'),true)
  assert.equal(matchesMeal(generic,'Dinner'),false)
  assert.equal(getSmartRecipes([generic,lunch],{mode:'now',meal:'Lunch'}).items[0],lunch)
})
test('normalized backend tags support active, expired and future windows',()=>{
  assert.equal(editorialEvidence(curated,byDay,'India').seasonal,true)
  assert.equal(editorialEvidence(curated,date(2026,12,5),'India').seasonal,false)
  assert.equal(editorialEvidence(curated,date(2026,10,31),'India').seasonal,false)
  assert.equal(editorialEvidence(curated,byDay,'Nepal').seasonal,false)
  assert.equal(editorialEvidence(curated,byDay,'').seasonal,false)
  assert.equal(editorialEvidence(curated,byDay,'India').label,'diwali')
})
test('editorial picks are explicitly flagged, not guessed as popular or viral',()=>{
  assert.equal(editorialEvidence(curated,byDay).editorial,true)
  assert.equal(editorialEvidence(generic,byDay).editorial,false)
  assert.equal(getSmartRecipes([generic,curated],{mode:'editorial',now:byDay}).items.length,1)
})
test('seasonal selection returns no false fallback',()=>{
  const result=getSmartRecipes([generic,breakfast,curated],{mode:'seasonal',now:byDay})
  assert.equal(result.items.length,0)
  assert.equal(result.matched,false)
  assert.equal(getSmartRecipes([generic,curated],{mode:'seasonal',now:byDay,region:'India'}).items[0],curated)
})
test('country/cuisine options are source-backed',()=>{
  assert.deepEqual(getCuisineOptions([lunch,generic,curated]),['india','Indian','Japanese'])
  assert.equal(getSmartRecipes([curated,lunch],{mode:'region',region:'Japanese'}).items[0],lunch)
  assert.equal(getSmartRecipes([curated,lunch],{mode:'region',region:'Spain'}).matched,false)
})
test('missing or malformed window cannot claim seasonal',()=>{
  assert.equal(editorialEvidence({tags:['season_winter']},byDay,'').seasonal,false)
  assert.throws(()=>buildEditorialTags({festival:'Holi',from:'2026-12-10',until:'2026-12-01'}))
  assert.throws(()=>buildEditorialTags({season:'winter',from:'2026-02-30',until:'2026-12-01'}))
})
test('basic published recipe record passes through shared metadata reader',()=>{
  const meta=recipeMeta({item:breakfast})
  assert.equal(meta.cuisine,'Indian')
  assert.ok(meta.course.includes('breakfast'))
})
