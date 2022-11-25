import { ethers, utils } from "ethers"
import config from "../config"
import CLASSIC_VIEW_ABI from "../abis/GeneralizedTCRView.json"
import LIGHT_VIEW_ABI from "../abis/LightGeneralizedTCRView.json"

const { formatEther } = utils

const provider = new ethers.providers.JsonRpcProvider(
  config.RPC
)

const classicGtcrView = new ethers.Contract(
  config.CLASSIC_VIEW,
  CLASSIC_VIEW_ABI,
  provider
)

const lightGtcrView = new ethers.Contract(
  config.LIGHT_VIEW,
  LIGHT_VIEW_ABI,
  provider
)

const getFormattedEthValues = async (tcrAddress: string, version: "classic" | "light") => {
  let data
  const gtcrView = version === "classic" ? classicGtcrView : lightGtcrView 
  try {
    data = await gtcrView.fetchArbitrable(tcrAddress)
  } catch (err) {
    console.warn(`Error fetching ETH values for this TCR @ ${tcrAddress}`, err)
    throw err
  }

  const formattedEthValues = {
    // Format wei values to ETH.
    submissionBaseDeposit: formatEther(data.submissionBaseDeposit),
    removalBaseDeposit: formatEther(data.removalBaseDeposit),
    submissionChallengeBaseDeposit: formatEther(
      data.submissionChallengeBaseDeposit
    ),
    removalChallengeBaseDeposit: formatEther(data.removalChallengeBaseDeposit),
  }

  return formattedEthValues
}

export default getFormattedEthValues