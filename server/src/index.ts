import { createApiServer } from './app.js'
import { readServerConfig } from './config.js'
import { openDatabase } from './database.js'

const config = readServerConfig()
const database = openDatabase(config.databasePath)
const server = createApiServer({
  database,
  runTtlMs: config.runTtlMs
})

server.listen(config.port, config.host, () => {
  console.log(`Leaderboard API listening on http://${config.host}:${config.port}`)
})

function shutDown(signal: string): void {
  console.log(`Received ${signal}; shutting down`)
  server.close(() => {
    database.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutDown('SIGTERM'))
process.on('SIGINT', () => shutDown('SIGINT'))
