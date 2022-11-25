import { CurateEvent } from "../get-events"

import { capitalizeFirstLetter, getKey } from "../utils/string"

import submitTweet from "../utils/submit-tweet"
import mainListFilter from "../utils/main-list-filter"
import config from "../config"
import getMetaEvidence from "../utils/get-meta-evidence"
import dbAttempt from "../utils/db-attempt"
import { Level } from "level"

const handleRuling = async (
  event: CurateEvent,
  db: Level<string, string>
): Promise<void> => {
  const isRelevant = await mainListFilter(event.tcrAddress)
  if (!isRelevant) {
    console.log("Irrelevant interaction, ignoring...")
    return
  }

  const link = `${config.GTCR_UI_URL}/tcr/${config.CHAIN_ID}/${event.tcrAddress}/${event.itemId}`
  let meta = await getMetaEvidence(event)
  if (!meta) {
    console.warn("Error fetching metaevidence, will be assuming")
    meta = { itemName: "item", tcrTitle: "List" }
  }

  const key = getKey(event)
  const twitterId = await dbAttempt(key, db)

  let result: string
  if (event.details.requestType === "RegistrationRequested") {
    if (event.details.finalRuling === 1) {
      result = "registered"
    } else {
      result = "removed"
    }
  } else {
    if (event.details.finalRuling === 1) {
      result = "removed"
    } else {
      result = "registered"
    }
  }

  // todo itemName could make message too large
  const message = `${capitalizeFirstLetter(meta.itemName)} ${
    result === "registered" ? "listed on" : "rejected from"
  } ${meta.tcrTitle}, a list in ${
    config.NETWORK_NAME
  }. If you contributed appeal fees to the winner you may have claimable rewards.
    \n\nListing: ${link}`

  console.info("-------vvvvvvv-------")
  console.info(message)
  console.info("-------^^^^^^^-------")

  // there is no tweetID because this is the first message, so it's null
  await submitTweet(twitterId, message, key, db)
}

export default handleRuling
