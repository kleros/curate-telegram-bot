import fs from "fs"
import getEvents from "./get-events"
import handleEvent from "./handle-event"
import { Level } from "level"
import config from "./config"

const db = new Level("./db")

const getNow = (): number => Math.floor(Date.now() / 1000)

const randomBetween = (min: number, max: number) =>
  Math.floor(min + Math.random() * (max - min))

export const sleep = (seconds = 0): Promise<void> => {
  if (seconds === 0) seconds = randomBetween(2, 5)
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

const readSavefile = (): number => {
  const lastTimestamp = JSON.parse(fs.readFileSync("./savefile.json", "utf-8"))
    .lastTimestamp as number
  return lastTimestamp
}

const updateSavefile = (): number => {
  const lastTimestamp = getNow()
  console.log("Saving timestamp to present.")
  const savefile: string = JSON.stringify({ lastTimestamp })
  // hack for testing! todo remove
  //fs.writeFileSync("./savefile.json", savefile, "utf-8")
  return lastTimestamp
}

const run = async (): Promise<void> => {
  // if first time it's ran, if just creates savefile.json and halts
  if (!fs.existsSync("./savefile.json")) {
    console.log("First execution. We will only save this file.")
    updateSavefile()
    return
  }

  // enter main flow of the program. write asap to stop from notifying same event.
  const lastTimestamp = readSavefile()
  const present = updateSavefile()

  console.log(present - lastTimestamp, "seconds have passed since last run.")
  const history = await getEvents(lastTimestamp, present)

  //const testHistory = history.filter((h) => h.type === "RequestResolved")
  console.log("Got", history.length, "events.")
  console.log("--------------------")

  // iterate through all items here, emit related notifications and store tweet ids around.
  for (const event of history) {
    //console.log(event)
    await handleEvent(event, db)
    await sleep(Number(config.TWEET_DELAY))
  }
}

export default run
