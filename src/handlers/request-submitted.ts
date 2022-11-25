import { CurateEvent } from "../get-events"
import getFormattedEthValues from "../utils/get-formatted-eth-values"

import { articleFor, getKey, truncateETHValue } from "../utils/string"

import submitTweet from "../utils/submit-tweet"
import mainListFilter from "../utils/main-list-filter"
import config from "../config"
import getMetaEvidence from "../utils/get-meta-evidence"
import { Level } from "level"

const handleRequestSubmitted = async (
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

  const ethValues = await getFormattedEthValues(event.tcrAddress, event.version)

  const depositETH = truncateETHValue(
    event.details.requestType === "RegistrationRequested"
      ? ethValues.submissionBaseDeposit
      : ethValues.removalBaseDeposit
  )

  // todo itemName could make message too large
  const message = `Someone ${
    event.details.requestType === "RegistrationRequested"
      ? "submitted"
      : "requested the removal of"
  } ${articleFor(meta.itemName)} ${meta.itemName} ${
    event.details.requestType === "RegistrationRequested" ? "to" : "from"
  } ${meta.tcrTitle}, a list in ${
    config.NETWORK_NAME
  }. Verify it for a chance to win ${depositETH} #${
    config.CURRENCY_NAME
  }\n\nListing: ${link}`

  const key = getKey(event)

  console.info("-------vvvvvvv-------")
  console.info(message)
  console.info("-------^^^^^^^-------")

  // there is no tweetID because this is the first message, so it's null
  await submitTweet(null, message, key, db)
}

export default handleRequestSubmitted
