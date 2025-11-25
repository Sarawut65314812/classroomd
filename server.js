// Serve catagoly.html at /catagoly
app.get("/catagoly", (req, res) => {
  res.sendFile(path.join(__dirname, "catagoly.html"));
});
import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import { Server } from "socket.io"
import http from "http"
import fs from "fs"
import { MongoClient } from 'mongodb'

const app = express()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(express.json())
app.use(express.static(__dirname))

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
try {
  mongoClient = new MongoClient(MONGODB_URI)
  await mongoClient.connect()
  const mdb = mongoClient.db(MONGODB_DB)
  dailyUsersColl = mdb.collection('daily_users')
  // sessions collection for recording session durations
  sessionsColl = mdb.collection('sessions')
  feedbacksColl = mdb.collection('feedbacks')
  await sessionsColl.createIndex({ client_id: 1 })
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

// In-memory session starts: socket.id -> startTimestamp(ms)
const sessionStarts = new Map()

async function recordSession(clientId, socketId, startMs, endMs) {
  if (!sessionsColl) return
  try {
    const durationMs = Math.max(0, (endMs - startMs))
    await sessionsColl.insertOne({
      client_id: clientId || null,
      socket_id: socketId,
      start_at: new Date(startMs).toISOString(),
      end_at: new Date(endMs).toISOString(),
      durationMs,
      created_at: new Date().toISOString()
    })
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
    }catch(e){ console.error('socket-client failed', e); }
  })();`)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT)
  console.log("[DEBUG] WebSocket server is active and ready to accept connections.")
})
