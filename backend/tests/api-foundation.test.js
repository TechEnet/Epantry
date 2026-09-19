import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import request from 'supertest'

let app

before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.PORT = process.env.PORT || '5001'
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/epantry_test'
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

  app = (await import('../src/app.js')).default
})

test('GET /api/v1/health returns standardized success response', async () => {
  const response = await request(app).get('/api/v1/health').expect(200)

  assert.equal(response.body.success, true)
  assert.equal(response.body.message, 'EPANTRY API is running')
  assert.ok(response.body.data.requestId)
})

test('GET /api/v1/meta/bootstrap returns feature bootstrap contract', async () => {
  const response = await request(app).get('/api/v1/meta/bootstrap').expect(200)

  assert.equal(response.body.success, true)
  assert.equal(response.body.data.app.name, 'EPANTRY')
  assert.equal(typeof response.body.data.features.grocery, 'boolean')
})

test('GET /api/v1/landing/featured returns the M01 landing contract', async () => {
  const response = await request(app).get('/api/v1/landing/featured').expect(200)

  assert.equal(response.body.success, true)
  assert.ok(Array.isArray(response.body.data.grocery))
  assert.ok(Array.isArray(response.body.data.brands))
  assert.ok(Array.isArray(response.body.data.recipes))
  assert.ok(response.body.data.requestId)
})

test('unknown route returns standard 404 contract', async () => {
  const response = await request(app).get('/api/v1/not-real').expect(404)

  assert.equal(response.body.success, false)
  assert.ok(response.body.requestId)
})
