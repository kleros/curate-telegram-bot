import { ethers } from "ethers"
import fetch from "node-fetch"
import config from "../config"
import { CurateEvent } from "../get-events"
import CLASSIC_ABI from "../abis/GeneralizedTCR.json"
import LIGHT_ABI from "../abis/LightGeneralizedTCR.json"

interface ProcessedMetaEvidence {
  itemName: string
  tcrTitle: string
}

const rpcMetaEvidenceFetchURI = async (event: CurateEvent): Promise<string> => {
  const provider = new ethers.providers.JsonRpcProvider(config.RPC)
  const abi = event.version === "classic" ? CLASSIC_ABI : LIGHT_ABI
  const tcr = new ethers.Contract(event.tcrAddress, abi, provider)
  const logs = (
    await provider.getLogs({
      ...tcr.filters.MetaEvidence(),
      fromBlock: 0,
    })
  ).map((log) => tcr.interface.parseLog(log))
  const { _evidence: metaEvidencePath } = logs[logs.length - 1].args
  return metaEvidencePath
}

const getMetaEvidence = async (
  event: CurateEvent
): Promise<ProcessedMetaEvidence | null> => {
  let tcrMetaEvidence: any
  let uri = event.details.registrationMetaEvidenceURI
  if (!uri) {
    console.warn("(meta) No uri in subgraph, fetching manually...")
    uri = await rpcMetaEvidenceFetchURI(event)
  }

  try {
    tcrMetaEvidence = await (await fetch(config.IPFS_GATEWAY + uri)).json()
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
