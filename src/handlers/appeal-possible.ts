import { CurateEvent } from "../get-events"

import { getKey } from "../utils/string"

import submitTweet from "../utils/submit-tweet"
import mainListFilter from "../utils/main-list-filter"
import config from "../config"
import getMetaEvidence from "../utils/get-meta-evidence"
import dbAttempt from "../utils/db-attempt"
import { Level } from "level"

const handleAppealPossible = async (event: CurateEvent, db: Level<string, string>): Promise<void> => {
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

  const message = `The arbitrator gave an appealable ruling to a dispute in ${config.NETWORK_NAME}.
    \nThink it is incorrect? Contribute appeal fees for a chance to earn the opponent's stake!
    \n\nListing: ${link}`

  console.info("-------vvvvvvv-------")
  console.info(message)
  console.info("-------^^^^^^^-------")

  // there is no tweetID because this is the first message, so it's null
  await submitTweet(twitterId, message, key, db)
}

export default handleAppealPossible
