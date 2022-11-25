

import { Level } from "level"

/**
 * If there's no previous message, then the event will act as the first message
 * in the chain.
 */
const dbAttempt = async (key: string, db: Level<string, string>) => {
  try {
    const value = await db.get(key)
    return value
  } catch (err) {
    console.error("dbAttempt: tweet not found")
    return null // return null instead of crashing
  }
}

export default dbAttempt
