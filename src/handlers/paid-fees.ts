import { CurateEvent } from "../get-events"

import { getKey } from "../utils/string"

import submitTweet from "../utils/submit-tweet"
import mainListFilter from "../utils/main-list-filter"
import config from "../config"
import dbAttempt from "../utils/db-attempt"
import { Level } from "level"

const handlePaidFees = async (
  event: CurateEvent,
  db: Level<string, string>
): Promise<void> => {
  const isRelevant = await mainListFilter(event.tcrAddress)
  if (!isRelevant) {
    console.log("Irrelevant interaction, ignoring...")
    return
  }

  const link = `${config.GTCR_UI_URL}/tcr/${config.CHAIN_ID}/${event.tcrAddress}/${event.itemId}`

  const key = getKey(event)
  const twitterId = await dbAttempt(key, db)

  // todo itemName could make message too large
  const message = `The ${
    event.details.side === 1 ? "submitter" : "challenger"
  } is fully funded. The ${
    event.details.side === 1 ? "challenger" : "submitter"
  } must fully fund before the deadline in order to not lose the case.
      \n\nListing: ${link}`

  console.info("-------vvvvvvv-------")
  console.info(message)
  console.info("-------^^^^^^^-------")

  // there is no tweetID because this is the first message, so it's null
  await submitTweet(twitterId, message, key, db)
}

export default handlePaidFees
