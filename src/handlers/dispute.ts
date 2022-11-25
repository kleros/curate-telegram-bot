import { CurateEvent } from "../get-events"
import getFormattedEthValues from "../utils/get-formatted-eth-values"

import {
  articleFor,
  capitalizeFirstLetter,
  getKey,
  truncateETHValue,
} from "../utils/string"

import submitTweet from "../utils/submit-tweet"
import mainListFilter from "../utils/main-list-filter"
import config from "../config"
import getMetaEvidence from "../utils/get-meta-evidence"
import dbAttempt from "../utils/db-attempt"
import { Level } from "level"

const handleDispute = async (
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
    meta = { itemName: "item", tcrTitle: "Unknown" }
  }

  const key = getKey(event)
  const twitterId = await dbAttempt(key, db)

  const ethValues = await getFormattedEthValues(event.tcrAddress, event.version)

  const totalETH =
    event.details.requestType === "RegistrationRequested"
      ? Number(ethValues.submissionBaseDeposit) +
        Number(ethValues.submissionChallengeBaseDeposit)
      : Number(ethValues.removalBaseDeposit) +
        Number(ethValues.removalChallengeBaseDeposit)

  // todo itemName could make message too large
  const message = `Challenge! ${capitalizeFirstLetter(
    articleFor(meta.itemName)
  )} ${meta.itemName} ${
    event.details.requestType === "RegistrationRequested"
      ? "submission"
      : "removal"
  } headed to court in ${config.NETWORK_NAME}!
      \n\nA total of ${totalETH} #${config.CURRENCY_NAME} is at stake.
      \n\nListing: ${link}`

  console.info("-------vvvvvvv-------")
  console.info(message)
  console.info("-------^^^^^^^-------")

  // there is no tweetID because this is the first message, so it's null
  await submitTweet(twitterId, message, key, db)
}

export default handleDispute
