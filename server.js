import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import { Server } from "socket.io"
import http from "http"
import fs from "fs"
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

const app = express()

// Serve static HTML pages by route (ต้องอยู่หลัง const app = express())
app.get("/catagoly", (req, res) => res.sendFile(path.join(__dirname, "catagoly.html")));
app.get("/menu", (req, res) => res.sendFile(path.join(__dirname, "menu.html")));
app.get("/gamemath", (req, res) => res.sendFile(path.join(__dirname, "gamemath.html")));
app.get("/gamepicture", (req, res) => res.sendFile(path.join(__dirname, "gamepicture.html")));
app.get("/gamethai", (req, res) => res.sendFile(path.join(__dirname, "gamethai.html")));
app.get("/teachermatch", (req, res) => res.sendFile(path.join(__dirname, "teachermatch.html")));
app.get("/teacherpicture", (req, res) => res.sendFile(path.join(__dirname, "teacherpicture.html")));
app.get("/teacherthai", (req, res) => res.sendFile(path.join(__dirname, "teacherthai.html")));
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Allow larger JSON bodies (for base64 uploads) and urlencoded bodies
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(express.static(__dirname))

// Upload endpoint: accept base64 DataURL JSON and save to /uploads
app.post('/uploadBase64', async (req, res) => {
  try {
    const { filename, dataUrl } = req.body || {}
    if (!filename || !dataUrl) return res.status(400).json({ success: false, message: 'filename and dataUrl required' })

    const uploadsDir = path.join(__dirname, 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    const m = String(dataUrl).match(/^data:(.+);base64,(.+)$/)
    if (!m) return res.status(400).json({ success: false, message: 'invalid dataUrl' })
    const mime = m[1]
    const b64 = m[2]
    const buffer = Buffer.from(b64, 'base64')

    const safeName = `${Date.now()}-${path.basename(filename)}`
    const outPath = path.join(uploadsDir, safeName)
    fs.writeFileSync(outPath, buffer)

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${safeName}`
    console.log('[UPLOAD] saved', outPath, '->', fileUrl)
    res.json({ success: true, url: fileUrl })
  } catch (e) {
    console.error('[UPLOAD] error', e)
    res.status(500).json({ success: false, message: 'upload failed' })
  }
})

// --- Usage tracking endpoints (start / end / event) ---
app.post('/api/usage/start', async (req, res) => {
  try {
    let { clientId, page, section, timestamp } = req.body || {}
    const startAt = timestamp || new Date().toISOString()
    // If clientId not provided, check cookie header for huaroa_client_id
    try {
      if (!clientId && req.headers && req.headers.cookie) {
        const cookies = String(req.headers.cookie).split(';').map(s => s.trim())
        for (const c of cookies) {
          if (c.startsWith('huaroa_client_id=')) {
            clientId = decodeURIComponent(c.split('=')[1] || '')
            break
          }
        }
      }
      // if still no clientId, create one and set cookie so browser will persist it
      if (!clientId) {
        clientId = 'c-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
        // set cookie for 365 days
        try { res.setHeader('Set-Cookie', `huaroa_client_id=${encodeURIComponent(clientId)}; Path=/; HttpOnly`); } catch(e){}
      }
    } catch(e) { /* ignore cookie parsing errors */ }
    // Buffer the usage in memory and return a usageId. We'll flush to DB on end.
    let usageId = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2)
    const bufferKey = makeUsageKey(usageId, clientId, page)
    bufferedUsages.set(bufferKey, {
      usageId,
      client_id: clientId || null,
      page: page || null,
      section: section || null,
      start_at: startAt,
      end_at: null,
      durationMs: null,
      events: [],
      lastActivityAt: Date.now()
    })
    // Append a lightweight start line to per-page file log (optional), marked as buffered
    appendUsageLog(page || 'unknown', { type: 'start_buffered', usageId, client_id: clientId || null, page: page || null, start_at: startAt, created_at: new Date().toISOString() })
    // Record unique daily page user (if clientId provided)
    try {
      if (clientId && page) await recordDailyPageUser(clientId, page)
    } catch (err) {
      console.warn('[WARN] recordDailyPageUser call failed', err && err.message)
    }
    // Record page view (increment total visits for this page/day)
    try {
      if (page) await recordDailyPageView(page)
    } catch (err) {
      console.warn('[WARN] recordDailyPageView call failed', err && err.message)
    }
    return res.json({ success: true, usageId, clientId: clientId || null, page: page || null })
  } catch (e) {
    console.error('[ERROR] /api/usage/start', e)
    res.status(500).json({ success: false, message: 'failed to start usage' })
  }
})

app.post('/api/usage/end', async (req, res) => {
  try {
    const { usageId, clientId, page, section, timestamp } = req.body || {}
    const endAt = timestamp || new Date().toISOString()
    // Prefer flushing buffered usage if available
    try {
      // try find buffer by usageId
      let bufKey = null
      if (usageId) {
        if (bufferedUsages.has(String(usageId))) bufKey = String(usageId)
        else {
          // also check keys that start with usageId (our key format may include timestamp suffix)
          for (const k of bufferedUsages.keys()) {
            if (k.indexOf(String(usageId)) === 0) { bufKey = k; break }
          }
        }
      }
      // otherwise try by clientId+page
      if (!bufKey && clientId && page) {
        for (const [k, buf] of bufferedUsages.entries()) {
          if (buf.client_id === clientId && buf.page === page && !buf.end_at) { bufKey = k; break }
        }
      }
      if (bufKey) {
        const buf = bufferedUsages.get(bufKey)
        const startMs = new Date(buf.start_at).getTime()
        const endMs = new Date(endAt).getTime()
        const durationMs = Math.max(0, endMs - startMs)
        buf.end_at = endAt
        buf.durationMs = durationMs
        buf.lastActivityAt = Date.now()
        const insertedId = await flushBufferedUsage(bufKey, 'end')
        return res.json({ success: true, usageId: insertedId || buf.usageId, durationMs })
      }

      // Fallback to legacy behavior: try to update DB records if they exist
      const pageColl = getPageUsageColl(page)
      if (pageColl) {
        // try find an open doc by clientId
        if (clientId && page) {
          const doc = await pageColl.findOne({ client_id: clientId, page, section: section || null, end_at: null }, { sort: { start_at: -1 } })
          if (doc) {
            const startMs = new Date(doc.start_at).getTime()
            const endMs = new Date(endAt).getTime()
            const durationMs = Math.max(0, endMs - startMs)
            await pageColl.updateOne({ _id: doc._id }, { $set: { end_at: endAt, durationMs } })
            appendUsageLog(page || doc.page || 'unknown', { type: 'end', usageId: doc._id.toString(), client_id: clientId, start_at: doc.start_at, end_at: endAt, durationMs, created_at: new Date().toISOString() })
            return res.json({ success: true, usageId: doc._id.toString(), durationMs })
          }
        }
      }
      if (usageColl) {
        if (usageId) {
          try {
            const { ObjectId } = require('mongodb')
            const oId = new ObjectId(usageId)
            const doc = await usageColl.findOne({ _id: oId })
            if (doc) {
              const startMs = new Date(doc.start_at).getTime()
              const endMs = new Date(endAt).getTime()
              const durationMs = Math.max(0, endMs - startMs)
              await usageColl.updateOne({ _id: doc._id }, { $set: { end_at: endAt, durationMs } })
              appendUsageLog(doc.page || page || 'unknown', { type: 'end', usageId: doc._id.toString(), client_id: doc.client_id || clientId || null, start_at: doc.start_at, end_at: endAt, durationMs, created_at: new Date().toISOString() })
              return res.json({ success: true, usageId: doc._id.toString(), durationMs })
            }
          } catch (inner) { console.error('[WARN] fallback usageColl parsing usageId', inner && inner.message) }
        }
        if (clientId && page) {
          const doc = await usageColl.findOne({ client_id: clientId, page, section: section || null, end_at: null }, { sort: { start_at: -1 } })
          if (doc) {
            const startMs = new Date(doc.start_at).getTime()
            const endMs = new Date(endAt).getTime()
            const durationMs = Math.max(0, endMs - startMs)
            await usageColl.updateOne({ _id: doc._id }, { $set: { end_at: endAt, durationMs } })
            appendUsageLog(page || doc.page || 'unknown', { type: 'end', usageId: doc._id.toString(), client_id: clientId, start_at: doc.start_at, end_at: endAt, durationMs, created_at: new Date().toISOString() })
            return res.json({ success: true, usageId: doc._id.toString(), durationMs })
          }
        }
      }

      return res.json({ success: true, message: 'no open usage found' })
    } catch (innerErr) {
      console.error('[ERROR] /api/usage/end internal', innerErr && innerErr.message)
      return res.status(500).json({ success: false, message: 'internal error' })
    }
  } catch (e) {
    console.error('[ERROR] /api/usage/end', e)
    res.status(500).json({ success: false, message: 'failed to end usage' })
  }
})

app.post('/api/usage/event', async (req, res) => {
  try {
    const { clientId, page, section, name, data, timestamp } = req.body || {}
    const ts = timestamp || new Date().toISOString()
    const eventDoc = { name: name || null, data: data || null, timestamp: ts }
    // Try to find buffered usage by usageId / clientId+page
    // Preference: if client has a buffered usage, append event there
    let appended = false
    // attempt to find by clientId+page
    for (const [k, buf] of bufferedUsages.entries()) {
      if ((buf.client_id && clientId && buf.client_id === clientId) && (buf.page === page)) {
        buf.events.push(eventDoc)
        buf.lastActivityAt = Date.now()
        appended = true
        break
      }
    }
    // fallback: if not buffered, write to DB as before
    if (!appended) {
      const doc = { client_id: clientId || null, page: page || null, section: section || null, name: name || null, data: data || null, timestamp: ts, created_at: new Date().toISOString() }
      const pageColl = getPageUsageColl(page)
      if (pageColl) await pageColl.insertOne(doc)
      else if (usageColl) await usageColl.insertOne(doc)
      appendUsageLog(page || 'unknown', Object.assign({ type: 'event' }, doc))
    }
    return res.json({ success: true, buffered: appended })
  } catch (e) {
    console.error('[ERROR] /api/usage/event', e)
    res.status(500).json({ success: false, message: 'failed to record usage event' })
  }
})


// In-memory storage
const feedbackList = []

// Create HTTP Server with Socket.IO
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Track connected clients with last-seen timestamp (heartbeat)
const connectedClients = new Map()
let activeClients = 0
// Map clientId (from localStorage) => Set of socket ids
const clientIdMap = new Map()
// Reverse map socket.id => clientId for cleanup
const socketIdToClientId = new Map()

// Daily users persistence
const DATA_DIR = path.join(__dirname, 'data')
// MongoDB persistence for daily users (unique per day)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nippit62:ohm0966477158@testing.hgxbz.mongodb.net/?retryWrites=true&w=majority'
const MONGODB_DB = process.env.MONGODB_DB || 'Huroa2'
let mongoClient
let dailyUsersColl
let sessionsColl
let feedbacksColl
let usageColl
let mdb
let dailyPageUsersColl
let dailyPageCountsColl
let dailyPageViewsColl
const pageUsageColls = new Map()

function safeCollectionNameForPage(page) {
  // normalize page like '/gamemath' -> 'usage_gamemath'
  const p = String(page || 'unknown')
    .replace(/^\/+/, '') // remove leading slash
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .toLowerCase()
  return `usage_${p || 'unknown'}`
}

function getPageUsageColl(page) {
  try {
    if (!mdb) return null
    const cname = safeCollectionNameForPage(page)
    if (pageUsageColls.has(cname)) return pageUsageColls.get(cname)
    const coll = mdb.collection(cname)
    // ensure useful indexes
    coll.createIndex({ client_id: 1 }).catch(()=>{})
    coll.createIndex({ start_at: 1 }).catch(()=>{})
    coll.createIndex({ end_at: 1 }).catch(()=>{})
    pageUsageColls.set(cname, coll)
    return coll
  } catch (e) {
    console.error('[WARN] getPageUsageColl failed', e && e.message)
    return null
  }
}
try {
  mongoClient = new MongoClient(MONGODB_URI)
  await mongoClient.connect()
  mdb = mongoClient.db(MONGODB_DB)
  dailyUsersColl = mdb.collection('daily_users')
  // sessions collection for recording session durations
  sessionsColl = mdb.collection('sessions')
  // usage events collection for per-page / per-section tracking
  usageColl = mdb.collection('usage_events')
  // daily page users: track unique client_id per page per day
  dailyPageUsersColl = mdb.collection('daily_page_users')
  dailyPageCountsColl = mdb.collection('daily_page_counts')
  // daily page views: total visits per page per day
  dailyPageViewsColl = mdb.collection('daily_page_views')
  feedbacksColl = mdb.collection('feedbacks')
  await sessionsColl.createIndex({ client_id: 1 })
  if (usageColl) {
    await usageColl.createIndex({ client_id: 1 })
    await usageColl.createIndex({ page: 1 })
    await usageColl.createIndex({ section: 1 })
  }
  // ensure indexes for daily page tracking
  if (dailyPageUsersColl) {
    await dailyPageUsersColl.createIndex({ client_id: 1, page: 1, day: 1 }, { unique: true })
  }
  if (dailyPageCountsColl) {
    await dailyPageCountsColl.createIndex({ page: 1, day: 1 }, { unique: true })
  }
  if (dailyPageViewsColl) {
    await dailyPageViewsColl.createIndex({ page: 1, day: 1 }, { unique: true })
  }
  // ensure unique index on client_id + day
  await dailyUsersColl.createIndex({ client_id: 1, day: 1 }, { unique: true })
  // feedbacks: index for createdAt
  await feedbacksColl.createIndex({ createdAt: 1 })
  console.log('[DEBUG] Connected to MongoDB and ensured index for daily_users & feedbacks')
} catch (e) {
  console.error('[ERROR] Failed to connect to MongoDB', e)
  // proceed without DB — recordDailyUser will be a no-op
  dailyUsersColl = null
  sessionsColl = null
  usageColl = null
}

async function recordDailyUser(clientId) {
  if (!clientId) return
  if (!dailyUsersColl) return
  try {
    const day = new Date().toISOString().slice(0, 10)
    const createdAt = new Date().toISOString()
    // upsert with insert-if-not-exists semantics
    const res = await dailyUsersColl.updateOne(
      { client_id: clientId, day },
      { $setOnInsert: { created_at: createdAt } },
      { upsert: true }
    )
    if (res.upsertedCount && res.upsertedCount > 0) {
      console.log(`[DEBUG] Recorded daily user ${clientId} for ${day} (inserted)`)
    }
  } catch (e) {
    // ignore duplicate key or other transient errors
    console.error('[WARN] recordDailyUser failed', e && e.message)
  }
}

async function recordDailyPageUser(clientId, page) {
  if (!clientId || !page) return
  if (!dailyPageUsersColl || !dailyPageCountsColl) return
  try {
    const day = new Date().toISOString().slice(0, 10)
    const createdAt = new Date().toISOString()
    // try to insert unique record per client+page+day
    const upsertRes = await dailyPageUsersColl.updateOne(
      { client_id: clientId, page, day },
      { $setOnInsert: { created_at: createdAt } },
      { upsert: true }
    )
    // debug log to help diagnose why counts may not increment
    try {
      console.log(`[DEBUG] recordDailyPageUser: client=${clientId} page=${page} day=${day} upsertRes=`, upsertRes)
    } catch (logErr) {
      console.log('[DEBUG] recordDailyPageUser: could not stringify upsertRes', logErr && logErr.message)
    }
    // detect if this call actually inserted a new document (driver versions differ)
    const inserted = Boolean(
      (upsertRes.upsertedId && Object.keys(upsertRes.upsertedId).length > 0) ||
      (upsertRes.upsertedCount && upsertRes.upsertedCount > 0) ||
      (upsertRes.lastErrorObject && upsertRes.lastErrorObject.upserted)
    )
    // if upserted (new unique user for this page/day), increment counter
    if (inserted) {
      await dailyPageCountsColl.updateOne(
        { page, day },
        { $inc: { count: 1 }, $setOnInsert: { created_at: createdAt } },
        { upsert: true }
      )
      // emit realtime update for dashboards (new unique user for page/day)
      try {
        if (typeof io !== 'undefined' && io && dailyPageCountsColl) {
          const doc = await dailyPageCountsColl.findOne({ page, day })
          io.emit('daily:unique', { page, day, count: doc && doc.count ? doc.count : 0 })
        }
      } catch(e) { console.error('[WARN] emit daily:unique failed', e && e.message) }
      console.log(`[DEBUG] recordDailyPageUser: incremented daily_page_counts for page=${page} day=${day}`)
      console.log(`[DEBUG] Recorded daily page user ${clientId} for ${page} on ${day}`)
    }
  } catch (e) {
    console.error('[WARN] recordDailyPageUser failed', e && e.message)
  }
}

async function recordDailyPageView(page) {
  if (!page) return
  if (!dailyPageViewsColl) return
  try {
    const day = new Date().toISOString().slice(0, 10)
    const createdAt = new Date().toISOString()
    await dailyPageViewsColl.updateOne(
      { page, day },
      { $inc: { count: 1 }, $setOnInsert: { created_at: createdAt } },
      { upsert: true }
    )
    // emit realtime update for dashboards (page view increment)
    try {
      if (typeof io !== 'undefined' && io && dailyPageViewsColl) {
        const doc = await dailyPageViewsColl.findOne({ page, day })
        io.emit('daily:views', { page, day, count: doc && doc.count ? doc.count : 0 })
      }
    } catch(e) { console.error('[WARN] emit daily:views failed', e && e.message) }
  } catch (e) {
    console.error('[WARN] recordDailyPageView failed', e && e.message)
  }
}

// Helper: append usage record to per-page NDJSON file under data/usage/
function appendUsageLog(page, record) {
  try {
    const usageDir = path.join(DATA_DIR, 'usage')
    if (!fs.existsSync(usageDir)) fs.mkdirSync(usageDir, { recursive: true })
    const safePage = String(page || 'unknown').replace(/[^a-zA-Z0-9-_\.]/g, '_').replace(/^_+/, '')
    const outPath = path.join(usageDir, safePage + '.ndjson')
    const line = JSON.stringify(record) + '\n'
    fs.appendFileSync(outPath, line, { encoding: 'utf8' })
  } catch (e) {
    console.error('[WARN] appendUsageLog failed', e && e.message)
  }
}

// In-memory session starts: socket.id -> startTimestamp(ms)
const sessionStarts = new Map()

// Buffered usage events: usageId -> { usageId, client_id, page, section, start_at, events: [], lastActivityAt }
const bufferedUsages = new Map()

function makeUsageKey(usageId, clientId, page) {
  if (usageId) return String(usageId)
  return `${clientId || 'anon'}::${page || 'unknown'}::${Date.now()}`
}

async function flushBufferedUsage(bufferKey, reason) {
  const buf = bufferedUsages.get(bufferKey)
  if (!buf) return null
  try {
    const doc = {
      client_id: buf.client_id || null,
      page: buf.page || null,
      section: buf.section || null,
      start_at: buf.start_at || new Date().toISOString(),
      end_at: buf.end_at || new Date().toISOString(),
      durationMs: buf.durationMs || null,
      events: buf.events || [],
      created_at: new Date().toISOString(),
      flush_reason: reason || 'end'
    }
    const pageColl = getPageUsageColl(buf.page)
    let insertedId = null
    if (pageColl) {
      const r = await pageColl.insertOne(doc)
      insertedId = r.insertedId && r.insertedId.toString()
    } else if (usageColl) {
      const r = await usageColl.insertOne(doc)
      insertedId = r.insertedId && r.insertedId.toString()
    }
    // emit realtime event for dashboards
    try {
      if (typeof io !== 'undefined' && io && buf) {
        io.emit('usage:flushed', { page: buf.page || 'unknown', client_id: buf.client_id || null, start_at: buf.start_at, end_at: buf.end_at, durationMs: buf.durationMs, usageId: insertedId || buf.usageId, eventsCount: (buf.events||[]).length, created_at: doc.created_at })
      }
    } catch(e) { console.error('[WARN] emit usage:flushed failed', e && e.message) }
    // append single summary to per-page NDJSON
    appendUsageLog(buf.page || 'unknown', Object.assign({ type: 'flush', usageId: insertedId || buf.usageId }, doc))
    bufferedUsages.delete(bufferKey)
    console.log(`[DEBUG] flushBufferedUsage: flushed buffer ${bufferKey} -> id=${insertedId} reason=${reason}`)
    return insertedId
  } catch (e) {
    console.error('[ERROR] flushBufferedUsage failed', e && e.message)
    return null
  }
}

// periodic flush: flush buffered usages that haven't had activity for 30 minutes
setInterval(async () => {
  try {
    const now = Date.now()
    const timeoutMs = 30 * 60 * 1000 // 30 minutes
    for (const [k, buf] of bufferedUsages.entries()) {
      if ((now - (buf.lastActivityAt || Date.now())) > timeoutMs) {
        console.log('[DEBUG] periodic flush for buffer', k)
        await flushBufferedUsage(k, 'timeout')
      }
    }
  } catch (e) {
    console.error('[ERROR] periodic flush error', e && e.message)
  }
}, 60 * 1000)

async function recordSession(clientId, socketId, startMs, endMs) {
  if (!sessionsColl) return
  try {
    const durationMs = Math.max(0, (endMs - startMs))
    const ins = await sessionsColl.insertOne({
      client_id: clientId || null,
      socket_id: socketId,
      start_at: new Date(startMs).toISOString(),
      end_at: new Date(endMs).toISOString(),
      durationMs,
      created_at: new Date().toISOString()
    })
    // emit realtime session event
    try { if (typeof io !== 'undefined' && io) io.emit('session:recorded', { _id: ins.insertedId && ins.insertedId.toString(), client_id: clientId || null, socket_id: socketId, start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString(), durationMs }) } catch(e) {}
    // no logging here to avoid noisy output
  } catch (e) {
    // ignore duplicate/insert errors
    console.error('[WARN] recordSession failed', e && e.message)
  }
}

io.on("connection", (socket) => {
  console.log(`[DEBUG] New WebSocket connection: ${socket.id}`)

  // mark session start
  sessionStarts.set(socket.id, Date.now())

  // add client with current timestamp
  connectedClients.set(socket.id, Date.now())
  activeClients = connectedClients.size
  console.log(`[DEBUG] Active clients after connection: ${activeClients}`)
  io.emit("clientCount", activeClients)

  // update last-seen on heartbeat
  socket.on("heartbeat", (clientId) => {
    connectedClients.set(socket.id, Date.now())
    // record unique daily user id if provided by client
    try {
      if (clientId) {
        recordDailyUser(clientId)
        // add mapping clientId -> socket.id
        const set = clientIdMap.get(clientId) || new Set()
        set.add(socket.id)
        clientIdMap.set(clientId, set)
        // reverse map for cleanup
        socketIdToClientId.set(socket.id, clientId)
      }
    } catch (e) {
      console.error('[WARN] recordDailyUser failed', e)
    }
    // optional debug
    // console.log(`[DEBUG] Heartbeat from ${socket.id}`)
  })

  socket.on("message", (msg) => {
    console.log(`[DEBUG] Message received from ${socket.id}: ${msg}`)
  })

  socket.on("disconnect", () => {
    console.log(`[DEBUG] WebSocket disconnected: ${socket.id}`)
    connectedClients.delete(socket.id)
    // cleanup clientId mapping if present
    const cid = socketIdToClientId.get(socket.id)
    if (cid) {
      const set = clientIdMap.get(cid)
      if (set) {
        set.delete(socket.id)
        if (set.size === 0) clientIdMap.delete(cid)
        else clientIdMap.set(cid, set)
      }
      socketIdToClientId.delete(socket.id)
    }
    // record session duration
    try {
      const startMs = sessionStarts.get(socket.id) || Date.now()
      const endMs = Date.now()
      const clientIdForSession = cid || null
      recordSession(clientIdForSession, socket.id, startMs, endMs)
    } catch (e) {
      console.error('[WARN] failed to record session on disconnect', e && e.message)
    }
    sessionStarts.delete(socket.id)
    activeClients = connectedClients.size
    console.log(`[DEBUG] Active clients after disconnection: ${activeClients}`)
    io.emit("clientCount", activeClients)
  })
})

// Periodically remove clients that have not sent heartbeat within timeout
const HEARTBEAT_TIMEOUT_MS = 30000 // 30s
setInterval(() => {
  const now = Date.now()
  let removed = 0
  for (const [id, lastSeen] of connectedClients.entries()) {
    if (now - lastSeen > HEARTBEAT_TIMEOUT_MS) {
      console.log(`[DEBUG] Removing timed-out client ${id}`)
        connectedClients.delete(id)
        // also clean clientId maps if this socket was associated
        const cid = socketIdToClientId.get(id)
        if (cid) {
          const set = clientIdMap.get(cid)
          if (set) {
            set.delete(id)
            if (set.size === 0) clientIdMap.delete(cid)
            else clientIdMap.set(cid, set)
          }
          socketIdToClientId.delete(id)
        }
        // record session for timed-out connection
        try {
          const startMs = sessionStarts.get(id) || lastSeen || (now - HEARTBEAT_TIMEOUT_MS)
          const endMs = now
          const clientIdForSession = socketIdToClientId.get(id) || null
          recordSession(clientIdForSession, id, startMs, endMs)
        } catch (e) {
          console.error('[WARN] failed to record session on prune', e && e.message)
        }
        sessionStarts.delete(id)
      removed++
    }
  }
  if (removed > 0) {
    activeClients = connectedClients.size
    console.log(`[DEBUG] Active clients after prune: ${activeClients}`)
    io.emit("clientCount", activeClients)
  }
}, 10000)

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) {
    const clientIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress
    console.log(`Client IP: ${clientIp}`)
  }
  next()
})

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "menu.html"))
})

app.post("/api/feedback", async (req, res) => {
  try {
    console.log("[FEEDBACK] รับข้อมูล POST /api/feedback:", req.body);
    let feedbackItem = null;
    // รองรับทั้งแบบใหม่ (name, phone, feedback) และแบบเดิม (id, feedback)
    if (req.body.name && req.body.phone && req.body.feedback) {
      // แบบใหม่
      const { name, phone, feedback, timestamp } = req.body;
      feedbackItem = {
        name,
        phone,
        feedback,
        timestamp: timestamp || new Date().toISOString(),
        createdAt: new Date().toLocaleString("th-TH", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
    } else if (req.body.id && req.body.feedback) {
      // แบบเดิม
      const { id, feedback, timestamp, createdAt } = req.body;
      feedbackItem = {
        id,
        feedback,
        timestamp: timestamp || new Date().toISOString(),
        createdAt: createdAt || new Date().toLocaleString("th-TH", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
    } else {
      console.log("[FEEDBACK] ข้อมูลไม่ครบถ้วน:", req.body);
      return res.status(400).json({
        success: false,
        message: "ข้อมูลไม่ครบถ้วน กรุณากรอกชื่อ เบอร์โทร และข้อเสนอแนะ หรือ id, feedback",
      });
    }

    if (feedbacksColl) {
      const result = await feedbacksColl.insertOne(feedbackItem);
      console.log("[FEEDBACK] บันทึกลง MongoDB แล้ว _id:", result.insertedId, feedbackItem);
    } else {
      console.log("[WARN] feedbacksColl is not available, feedback not saved to DB.", feedbackItem);
    }

    res.json({
      success: true,
      message: "บันทึกข้อเสนอแนะสำเร็จ",
      data: feedbackItem,
    });
  } catch (error) {
    console.error("[FEEDBACK] Error saving feedback:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการบันทึกข้อเสนอแนะ",
    });
  }
})


app.get("/api/feedback", (req, res) => {
  try {
    res.json({
      success: true,
      data: feedbackList,
      count: feedbackList.length,
    })
  } catch (error) {
    console.error("Error getting feedback:", error)
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล",
    })
  }
})

app.get("/api/active-clients", async (req, res) => {
  try {
    console.log("[DEBUG] API /api/active-clients called.")
    console.log(`[DEBUG] Current active clients: ${activeClients}`)

    // Respond first
    res.json({
      success: true,
      activeClients,
      timestamp: new Date().toISOString(),
    })

    // Then, attempt to record a visit in MongoDB (non-blocking for client)
    try {
      if (countersColl && dailyVisitsColl) {
        const day = new Date().toISOString().slice(0, 10)
        await countersColl.updateOne({ _id: 'visits' }, { $inc: { total: 1 }, $setOnInsert: { created_at: new Date().toISOString() } }, { upsert: true })
        await dailyVisitsColl.updateOne({ day }, { $inc: { count: 1 }, $setOnInsert: { created_at: new Date().toISOString() } }, { upsert: true })
      }
      // if clientId provided in query, record unique daily user as well
      const clientId = req.query.clientId || null
      if (clientId) {
        await recordDailyUser(clientId)
      }
    } catch (e) {
      console.error('[WARN] failed to persist visit from /api/active-clients', e && e.message)
    }
  } catch (error) {
    console.error("Error fetching active clients:", error && error.message)
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลจำนวนผู้ใช้งาน",
    })
  }
})

// เส้น API แยก (คนละเส้นกับ /api) สำหรับแสดงจำนวนผู้ใช้งานปัจจุบัน
app.get("/status/active-clients", async (req, res) => {
  try {
    console.log("[DEBUG] API /status/active-clients called.")
    console.log("[DEBUG] Current active clients: " + activeClients)
    const distinctActiveClientIds = clientIdMap.size
    const today = new Date().toISOString().slice(0, 10)
    // query MongoDB for today's unique count and total ever unique
    let dailyUniqueToday = 0
    let totalEverUsers = 0
    try {
      if (dailyUsersColl) {
        dailyUniqueToday = await dailyUsersColl.countDocuments({ day: today })
        const distinct = await dailyUsersColl.distinct('client_id')
        totalEverUsers = Array.isArray(distinct) ? distinct.length : 0
      }
    } catch (e) {
      console.error('[ERROR] querying daily users from MongoDB', e)
    }
    res.json({
      success: true,
      activeConnections: activeClients,
      distinctActiveClientIds,
      dailyUniqueToday,
      totalEverUsers,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error fetching active clients (status):", error && error.message)
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลจำนวนผู้ใช้งาน (status)",
    })
  }
})

// คืนจำนวนการเชื่อมต่อ (active) แยกตาม clientId (clientId -> count)
app.get('/status/clientid-counts', (req, res) => {
  try {
    const counts = {}
    for (const [clientId, set] of clientIdMap.entries()) {
      counts[clientId] = set.size
    }
    res.json({
      success: true,
      counts,
      totalDistinctClientIds: clientIdMap.size,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ERROR] /status/clientid-counts', error)
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' })
  }
})

// Average usage duration endpoint
app.get('/status/usage-average', async (req, res) => {
  try {
    if (!sessionsColl) return res.json({ success: false, message: 'DB not available' })
    const period = (req.query.period || 'all') // 'all' or 'day'
    const clientId = req.query.clientId || null
    const match = {}
    if (clientId) match.client_id = clientId
    if (period === 'day') {
      const startOfDay = new Date().toISOString().slice(0, 10)
      match.day = startOfDay // note: we didn't store day in sessions; compute from start_at instead
      // better: filter start_at by date prefix
      const today = new Date().toISOString().slice(0, 10)
      match.start_at = { $regex: `^${today}` }
    }

    // Build aggregation
    const pipeline = []
    if (Object.keys(match).length) pipeline.push({ $match: match })
    pipeline.push({ $group: { _id: null, avgMs: { $avg: '$durationMs' }, totalMs: { $sum: '$durationMs' }, count: { $sum: 1 } } })
    const agg = await sessionsColl.aggregate(pipeline).toArray()
    const row = (agg && agg[0]) || { avgMs: 0, totalMs: 0, count: 0 }
    res.json({
      success: true,
      averageMs: row.avgMs || 0,
      averageMinutes: ((row.avgMs || 0) / 60000),
      // Added: average and total duration in hours for easier reporting
      averageHours: ((row.avgMs || 0) / 3600000),
      averageHoursRounded: Number(((row.avgMs || 0) / 3600000).toFixed(2)),
      totalDurationMs: row.totalMs || 0,
      totalHours: ((row.totalMs || 0) / 3600000),
      sessionsCount: row.count || 0,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[ERROR] /status/usage-average', e)
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' })
  }
})

// Daily stats endpoint - returns per-day unique users and visit counts
app.get('/status/daily-stats', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '30', 10)
    // If we have daily_summary and daily_visits, read from them and join
    if (dailySummaryColl && dailyVisitsColl) {
      const summaries = await dailySummaryColl.find({}).sort({ day: -1 }).limit(limit).toArray()
      // get days list
      const days = summaries.map(s => s.day)
      // fetch visits for these days
      const visitsDocs = await dailyVisitsColl.find({ day: { $in: days } }).toArray()
      const visitsMap = {}
      visitsDocs.forEach(d => { visitsMap[d.day] = d.count || 0 })
      const out = summaries.map(s => ({ day: s.day, uniqueCount: s.uniqueCount || 0, visitCount: visitsMap[s.day] || 0 }))
      return res.json({ success: true, data: out, timestamp: new Date().toISOString() })
    }

    // Fallback: compute from daily_users and daily_visits if available
    if (!dailyUsersColl && !dailyVisitsColl) return res.json({ success: false, message: 'DB not available' })

    // determine days to query (from daily_visits or daily_users distinct)
    let days = []
    if (dailyVisitsColl) {
      days = await dailyVisitsColl.distinct('day')
    }
    if ((!days || days.length === 0) && dailyUsersColl) {
      days = await dailyUsersColl.distinct('day')
    }
    days.sort((a, b) => b.localeCompare(a))
    days = days.slice(0, limit)

    const out = []
    for (const d of days) {
      const uniqueCount = dailyUsersColl ? await dailyUsersColl.countDocuments({ day: d }) : 0
      const visitDoc = dailyVisitsColl ? await dailyVisitsColl.findOne({ day: d }) : null
      const visitCount = (visitDoc && visitDoc.count) || 0
      out.push({ day: d, uniqueCount, visitCount })
    }
    res.json({ success: true, data: out, timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[ERROR] /status/daily-stats', e && e.message)
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' })
  }
})

// Summary: usage by page (counts + avg duration)
app.get('/status/usage-by-page', async (req, res) => {
  try {
    if (!mdb) return res.json({ success: false, message: 'DB not available' })
    const cols = await mdb.listCollections().toArray()
    const usageCols = cols.map(c => c.name).filter(n => n && n.startsWith('usage_'))
    const out = []
    for (const name of usageCols) {
      const coll = mdb.collection(name)
      // Only count session documents (those with a start_at). Event-only docs (click events) should not increase session counts.
      const agg = await coll.aggregate([
        { $match: { start_at: { $exists: true } } },
        { $group: { _id: null, count: { $sum: 1 }, avgMs: { $avg: '$durationMs' }, withDuration: { $sum: { $cond: [{ $ifNull: ['$durationMs', false] }, 1, 0] } } } }
      ]).toArray()
      const row = (agg && agg[0]) || { count: 0, avgMs: 0, withDuration: 0 }
      out.push({ collection: name, page: name.replace(/^usage_/, ''), count: row.count || 0, avgDurationMs: row.avgMs || 0, recordsWithDuration: row.withDuration || 0 })
    }
    res.json({ success: true, data: out, timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[ERROR] /status/usage-by-page', e)
    res.status(500).json({ success: false, message: 'failed' })
  }
})

// Returns daily page counts. Usage:
// /status/daily-page-counts?page=/gamepicture&day=2025-11-25
// /status/daily-page-counts?page=/gamepicture&limit=7  (last 7 days for page)
// /status/daily-page-counts?day=2025-11-25  (all pages for a given day)
app.get('/status/daily-page-counts', async (req, res) => {
  try {
    if (!dailyPageCountsColl) return res.json({ success: false, message: 'DB not available' })
    const page = req.query.page || null
    const day = req.query.day || null
    const limit = Math.min(120, parseInt(req.query.limit || '30', 10))

    if (page && day) {
      const doc = await dailyPageCountsColl.findOne({ page, day })
      return res.json({ success: true, data: doc ? { page: doc.page, day: doc.day, count: doc.count || 0 } : { page, day, count: 0 }, source: 'db', timestamp: new Date().toISOString() })
    }

    if (page && !day) {
      // last N days for page
      const docs = await dailyPageCountsColl.find({ page }).sort({ day: -1 }).limit(limit).toArray()
      return res.json({ success: true, data: docs.map(d => ({ page: d.page, day: d.day, count: d.count || 0 })), source: 'db', timestamp: new Date().toISOString() })
    }

    if (!page && day) {
      // all pages for a specific day
      const docs = await dailyPageCountsColl.find({ day }).sort({ count: -1 }).toArray()
      return res.json({ success: true, data: docs.map(d => ({ page: d.page, day: d.day, count: d.count || 0 })), source: 'db', timestamp: new Date().toISOString() })
    }

    // neither page nor day: return recent entries (by day desc)
    const docs = await dailyPageCountsColl.find({}).sort({ day: -1, page: 1 }).limit(limit).toArray()
    return res.json({ success: true, data: docs.map(d => ({ page: d.page, day: d.day, count: d.count || 0 })), source: 'db', timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[ERROR] /status/daily-page-counts', e)
    res.status(500).json({ success: false, message: 'failed' })
  }
})

// Returns the list of unique client ids for a given page and day
// Usage: /status/daily-page-users?page=/gamepicture&day=2025-11-25
app.get('/status/daily-page-users', async (req, res) => {
  try {
    if (!dailyPageUsersColl) return res.json({ success: false, message: 'DB not available' })
    const page = req.query.page || null
    const day = req.query.day || null
    if (!page || !day) return res.json({ success: false, message: 'page and day required' })

    const q = { page, day }
    const docs = await dailyPageUsersColl.find(q).project({ _id: 0, client_id: 1, created_at: 1 }).toArray()
    return res.json({ success: true, page, day, count: docs.length, users: docs, source: 'db', timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[ERROR] /status/daily-page-users', e)
    res.status(500).json({ success: false, message: 'failed' })
  }
})

// Returns daily page views (total visits) for page/day or series
// Usage examples:
// /status/daily-page-views?page=/gamepicture&day=2025-11-25
// /status/daily-page-views?page=/gamepicture&limit=7
// /status/daily-page-views?day=2025-11-25  (all pages for a day)
app.get('/status/daily-page-views', async (req, res) => {
  try {
    if (!dailyPageViewsColl) return res.json({ success: false, message: 'DB not available' })
    const page = req.query.page || null
    const day = req.query.day || null
    const limit = Math.min(120, parseInt(req.query.limit || '30', 10))

    if (page && day) {
      const doc = await dailyPageViewsColl.findOne({ page, day })
      return res.json({ success: true, data: doc ? { page: doc.page, day: doc.day, count: doc.count || 0 } : { page, day, count: 0 }, source: 'db', timestamp: new Date().toISOString() })
    }

    if (page && !day) {
      // last N days for page
      const docs = await dailyPageViewsColl.find({ page }).sort({ day: -1 }).limit(limit).toArray()
      return res.json({ success: true, data: docs.map(d => ({ page: d.page, day: d.day, count: d.count || 0 })), source: 'db', timestamp: new Date().toISOString() })
    }

    if (!page && day) {
      // all pages for a specific day
      const docs = await dailyPageViewsColl.find({ day }).sort({ count: -1 }).toArray()
      return res.json({ success: true, data: docs.map(d => ({ page: d.page, day: d.day, count: d.count || 0 })), source: 'db', timestamp: new Date().toISOString() })
    }

    // neither page nor day: return recent entries
    const docs = await dailyPageViewsColl.find({}).sort({ day: -1, page: 1 }).limit(limit).toArray()
    return res.json({ success: true, data: docs.map(d => ({ page: d.page, day: d.day, count: d.count || 0 })), source: 'db', timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[ERROR] /status/daily-page-views', e)
    res.status(500).json({ success: false, message: 'failed' })
  }
})

// Summary per page for a single day: returns unique users (daily_page_counts) and views (daily_page_views)
// Usage: /status/daily-page-summary?day=2025-11-25
app.get('/status/daily-page-summary', async (req, res) => {
  try {
    const day = req.query.day || new Date().toISOString().slice(0, 10)
    if (!day) return res.json({ success: false, message: 'day required' })

    // If no DB collections available, return error
    if (!dailyPageCountsColl && !dailyPageViewsColl && !dailyPageUsersColl) {
      return res.json({ success: false, message: 'DB not available' })
    }

    // Fetch counts (unique users per page) if available
    let countsDocs = []
    if (dailyPageCountsColl) {
      countsDocs = await dailyPageCountsColl.find({ day }).toArray()
    } else if (dailyPageUsersColl) {
      // fallback: aggregate unique users per page from daily_page_users
      const agg = await dailyPageUsersColl.aggregate([
        { $match: { day } },
        { $group: { _id: '$page', count: { $sum: 1 } } }
      ]).toArray()
      countsDocs = agg.map(a => ({ page: a._id, day, count: a.count }))
    }

    // Fetch views if available
    let viewsDocs = []
    if (dailyPageViewsColl) {
      viewsDocs = await dailyPageViewsColl.find({ day }).toArray()
    }

    // Merge results by page
    const map = new Map()
    countsDocs.forEach(d => {
      const p = d.page || d._id || 'unknown'
      map.set(p, Object.assign(map.get(p) || {}, { page: p, day: d.day || day, uniqueCount: d.count || 0 }))
    })
    viewsDocs.forEach(d => {
      const p = d.page || d._id || 'unknown'
      map.set(p, Object.assign(map.get(p) || {}, { page: p, day: d.day || day, views: d.count || 0 }))
    })

    // If neither collection had an entry for some pages, we still want to return something reasonable
    const out = Array.from(map.values()).map(item => ({ page: item.page, day: item.day, uniqueCount: item.uniqueCount || 0, views: item.views || 0 }))
    // sort by uniqueCount desc then views desc
    out.sort((a, b) => (b.uniqueCount - a.uniqueCount) || (b.views - a.views))

    return res.json({ success: true, day, data: out, timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[ERROR] /status/daily-page-summary', e)
    res.status(500).json({ success: false, message: 'failed' })
  }
})

// Summary by section for a given page
app.get('/status/usage-by-section', async (req, res) => {
  try {
    const page = req.query.page || ''
    if (!page) return res.json({ success: false, message: 'page required' })
    const coll = getPageUsageColl(page) || usageColl
    if (!coll) return res.json({ success: false, message: 'DB not available' })
    const agg = await coll.aggregate([
      // Only include session documents (have start_at). Exclude event-only docs to avoid counting each click.
      { $match: { start_at: { $exists: true } } },
      { $group: { _id: '$section', count: { $sum: 1 }, avgMs: { $avg: '$durationMs' } } },
      { $sort: { count: -1 } }
    ]).toArray()
    const out = agg.map(r => ({ section: r._id || 'unknown', count: r.count || 0, avgDurationMs: r.avgMs || 0 }))
    res.json({ success: true, data: out, timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[ERROR] /status/usage-by-section', e)
    res.status(500).json({ success: false, message: 'failed' })
  }
})

// Recent usage records for a page (fallback to file tail if DB unavailable)
app.get('/status/recent-usage', async (req, res) => {
  try {
    const page = req.query.page || ''
    const limit = Math.min(200, parseInt(req.query.limit || '50', 10))
    const source = req.query.source || null
    if (!page) return res.json({ success: false, message: 'page required' })
    const coll = getPageUsageColl(page)
    if (coll) {
      const docs = await coll.find({}).sort({ created_at: -1 }).limit(limit).toArray()
      return res.json({ success: true, data: docs, source: 'db', timestamp: new Date().toISOString() })
    }
    // If caller explicitly requested DB-only, return error instead of falling back to file
    if (source === 'db') return res.json({ success: false, message: 'DB not available' })
    // fallback: read file
    const usageDir = path.join(DATA_DIR, 'usage')
    const safePage = String(page || 'unknown').replace(/[^a-zA-Z0-9-_\.]/g, '_').replace(/^_+/, '')
    const outPath = path.join(usageDir, safePage + '.ndjson')
    if (!fs.existsSync(outPath)) return res.json({ success: true, data: [], source: 'file', timestamp: new Date().toISOString() })
    const content = fs.readFileSync(outPath, 'utf8').split('\n').filter(Boolean)
    const tail = content.slice(-limit).reverse().map(l => { try { return JSON.parse(l) } catch(e){ return l } })
    return res.json({ success: true, data: tail, source: 'file', timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[ERROR] /status/recent-usage', e)
    res.status(500).json({ success: false, message: 'failed' })
  }
})

// เสิร์ฟสคริปต์ client สำหรับเชื่อมต่อ Socket.IO และส่ง heartbeat
app.get('/socket-client.js', (req, res) => {
  console.log(`[DEBUG] Serving /socket-client.js to ${req.ip || req.connection.remoteAddress}`);
  res.type('application/javascript').send(`(function(){
    try{
      var KEY='__huaroa_client_id';
      var clientId=null;
      try{clientId=localStorage.getItem(KEY)}catch(e){}
      if(!clientId){clientId='c-'+Math.random().toString(36).slice(2)+'-'+Date.now().toString(36);try{localStorage.setItem(KEY,clientId)}catch(e){}}
      var socket = io();
      function sendHeartbeat(){ if(socket&&socket.connected) socket.emit('heartbeat', clientId); }
      socket.on('connect', function(){ console.log('[DEBUG] socket-client connected', socket.id); sendHeartbeat(); socket.__heartbeatInterval = setInterval(sendHeartbeat, 10000); });
      socket.on('disconnect', function(reason){ console.log('[DEBUG] socket-client disconnected', reason); if(socket.__heartbeatInterval) clearInterval(socket.__heartbeatInterval); });
      socket.on('clientCount', function(count){ console.log('Active clients:', count); var el=document.getElementById('user-count'); if(el) el.textContent='จำนวนผู้ใช้งาน: '+count; });

      // Usage tracker helper (idempotent start/end per page)
      var __usageCurrentByPage = {};
      function usageStart(page, section){
        try{
          var p = page||location.pathname;
          // if we already have a usageId for this page, don't start another
          __usageCurrentByPage = __usageCurrentByPage || {};
          if(__usageCurrentByPage[p]){
            return Promise.resolve({ success: true, usageId: __usageCurrentByPage[p] });
          }
          var payload={ clientId: clientId, page: p, section: section||null, timestamp: new Date().toISOString() };
          return fetch('/api/usage/start',{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).then(r=>r.json()).then(function(res){
            try{ if(res && res.usageId){ __usageCurrentByPage = __usageCurrentByPage || {}; __usageCurrentByPage[p] = res.usageId; } }catch(e){}
            return res
          }).catch(e=>{ console.warn('usage start failed', e); return null; });
        }catch(e){console.warn('usageStart err',e);return Promise.resolve(null);} 
      }
      function usageEnd(usageId, page, section){
        try{
          var p = page||location.pathname;
          __usageCurrentByPage = __usageCurrentByPage || {};
          var id = usageId || (__usageCurrentByPage[p] ? __usageCurrentByPage[p] : null);
          if(!id) return Promise.resolve({ success: false, message: 'no open usage' });
          var payload={ usageId: id, clientId: clientId, page: p, section: section||null, timestamp: new Date().toISOString() };
          // prefer sendBeacon for unload scenarios; here use fetch
          return fetch('/api/usage/end',{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).then(r=>r.json()).then(function(res){
            try{ if(id && __usageCurrentByPage && __usageCurrentByPage[p]===id) delete __usageCurrentByPage[p]; }catch(e){}
            return res
          }).catch(e=>{ console.warn('usage end failed', e); return null; });
        }catch(e){console.warn('usageEnd err',e);return Promise.resolve(null);} 
      }
      function usageEvent(name, data, page, section){
        try{
          var p = page||location.pathname;
          var payload={ clientId: clientId, page: p, section: section||null, name: name, data: data||null, timestamp: new Date().toISOString() };
          return fetch('/api/usage/event',{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r=>r.json()).catch(e=>{ console.warn('usage event failed', e); return null; });
        }catch(e){console.warn('usageEvent err',e);return Promise.resolve(null);} 
      }

      // Expose basic API for pages
      window.usageTracker = { start: usageStart, end: usageEnd, event: usageEvent };

      function autoStart(){
        try{ usageStart(location.pathname, 'page'); }catch(e){}
      }
      function autoEnd(){
        try{ usageEnd(null, location.pathname, 'page'); }catch(e){}
      }

      document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden'){ autoEnd(); } else { autoStart(); } });
      window.addEventListener('beforeunload', function(){
        try{
          // end all open usages for pages before unload using navigator.sendBeacon when available
          try{
            var keys = Object.keys(__usageCurrentByPage || {});
            if(keys.length){
              keys.forEach(function(p){
                try{
                  var id = __usageCurrentByPage[p];
                  var payload = JSON.stringify({ usageId: id, clientId: clientId, page: p, timestamp: new Date().toISOString() });
                  if(navigator && navigator.sendBeacon){ navigator.sendBeacon('/api/usage/end', payload); }
                  else { navigator.fetch('/api/usage/end', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: payload, keepalive: true }).catch(function(){}); }
                }catch(e){}
              });
            }
          }catch(e){}
        }catch(e){}
      });

      // start once immediately for current page
      autoStart();
    }catch(e){ console.error('socket-client failed', e); }
  })();`)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT)
  console.log("[DEBUG] WebSocket server is active and ready to accept connections.")
})
