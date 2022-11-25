import { CurateEvent } from "../get-events"

import { articleFor, getKey, truncateETHAddress } from "../utils/string"

import submitTweet from "../utils/submit-tweet"
import mainListFilter from "../utils/main-list-filter"
import config from "../config"
import getMetaEvidence from "../utils/get-meta-evidence"
import dbAttempt from "../utils/db-attempt"
import { Level } from "level"

const handleEvidence = async (
  event: CurateEvent,
  db: Level<string, string>
): Promise<void> => {
  const isRelevant = await mainListFilter(event.tcrAddress)
  if (!isRelevant) {
    console.log("Irrelevant interaction, ignoring...")
    return
  }

  const link = `${config.GTCR_UI_URL}/tcr/${config.CHAIN_ID}/${event.tcrAddress}/${event.itemId}`
  const meta = await getMetaEvidence(event)
  if (!meta) {
    console.warn("Error fetching metaevidence, will not emit", event)
    return
  }

  const key = getKey(event)
  const twitterId = await dbAttempt(key, db)

  // todo itemName could make message too large
  const message = `New evidence has been submitted by ${truncateETHAddress(
    event.details.party as string
  )} on the ${
    event.details.requestType === "ClearingRequested"
      ? "removal request"
      : "submission"
  } of ${articleFor(meta.itemName)} ${meta.itemName} ${
    event.details.requestType === "ClearingRequested" ? "from the" : "to the"
  } ${meta.tcrTitle} List in ${config.NETWORK_NAME}.
      \n\nListing: ${link}`

  console.info("-------vvvvvvv-------")
  console.info(message)
  console.info("-------^^^^^^^-------")

  // there is no tweetID because this is the first message, so it's null
  await submitTweet(twitterId, message, key, db)
}

export default handleEvidence
