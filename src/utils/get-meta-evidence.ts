import fetch from "node-fetch"
import config from "../config"
import { CurateEvent } from "../get-events"

interface ProcessedMetaEvidence {
  itemName: string
  tcrTitle: string
}

const getMetaEvidence = async (
  event: CurateEvent
): Promise<ProcessedMetaEvidence | null> => {
  let tcrMetaEvidence: any
  const uri = event.details.registrationMetaEvidenceURI
  if (!uri) {
    console.warn("Attempted to fetch metaevidence, but no uri", event)
    return null
  }
  try {
    tcrMetaEvidence = await (
      await fetch(
        config.IPFS_GATEWAY +
          (event.details.registrationMetaEvidenceURI as string)
      )
    ).json()
  } catch (err) {
    console.warn("Error fetching meta evidence", event)
    return null
  }

  return {
    itemName: tcrMetaEvidence.metadata.itemName as string,
    tcrTitle: tcrMetaEvidence.metadata.tcrTitle as string,
  }
}

export default getMetaEvidence
