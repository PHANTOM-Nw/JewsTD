import { readServerConfig } from './config.js'
import { openDatabase } from './database.js'

const config = readServerConfig()
const database = openDatabase(config.databasePath)
database.close()
console.log(`Leaderboard database is migrated at ${config.databasePath}`)
