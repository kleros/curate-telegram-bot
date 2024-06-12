import fetch from "node-fetch"
import { toChecksumAddress } from "ethereum-checksum-address"
import config from "../config"

// just make the query work like this:
// 1. check if list is in a list.
// 2. if so, check if that list (take the 1st one) is also in a list.
// 3. iterate 5 times.

const getIncluderList = async (tcr: string) => {
  // not sure right now, if appears the data for both chain registries
  // starts with "0xd594". then, it predictably contains the address.
  const classicTargetData = `0xd594${tcr.slice(2)}`
  const subgraphQuery = {
    query: `
    {
      items(where: {data: "${classicTargetData}", status_in: [Registered, ClearingRequested]}) {
        registryAddress
      }

      itemProps(where: {type: "GTCR address", value: "${toChecksumAddress(
        tcr
      )}"}) {
        item {
          registryAddress
        }
      }
    }
    `,
  }

  const response = (await fetch(config.SUBGRAPH_URL, {
    method: "POST",
    body: JSON.stringify(subgraphQuery),
  })) as any

  const { data } = (await response.json()) as any

  const classicRegistry =
    data.items.length > 0 ? data.items[0].registryAddress : undefined

  const lightRegistry =
    data.itemProps > 0 ? data.itemProps[0].item.registryAddress : undefined

  if (classicRegistry) return classicRegistry
  else if (lightRegistry) return lightRegistry

  return null
}

const containedInMain = async (main: string, tcr: string) => {
  let currentTcr = tcr.toLowerCase()
  for (let i = 0; i < 5; i++) {
    const containerRegistry = await getIncluderList(currentTcr)
    if (containerRegistry === null) return false
    if (containerRegistry.toLowerCase() === main.toLowerCase()) return true

    currentTcr = containerRegistry.toLowerCase()
  }

  // probably a loop occurred, lets escape.
  // sorry i didn't bother to implement dijsktra
  return false
}

/**
 * Checks if a tcr is contained in the main registry, or if it's the main registry.
 */
const mainListFilter = async (tcr: string): Promise<boolean> => {
  const main = config.MAIN_LIST_ADDRESS
  tcr = tcr.toLowerCase()
  if (tcr === main) {
    console.log("Interaction in main list")
    return true
  }

  const result = await containedInMain(main, tcr)
  console.log(`tcr: ${tcr} went through filter. Result: ${result}`)
  return result
}

export default mainListFilter
