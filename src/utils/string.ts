import config from "../config"
import { CurateEvent } from "../get-events"

export const isVowel = (c: string) => "aiueo".includes(c.toLowerCase())

export const truncateETHValue = (n: string, decimals = 2) =>
  n.slice(0, String(n).indexOf(".") + 1 + decimals)

export const truncateETHAddress = (ethAddr: string) =>
  `${ethAddr.slice(0, 6)}...${ethAddr.slice(38)}`

export const capitalizeFirstLetter = (input: string) =>
  input.charAt(0).toUpperCase() + input.slice(1)

export const articleFor = (str: string) => (str && isVowel(str[0]) ? "an" : "a")

export const getKey = (event: CurateEvent) =>
  `${config.CHAIN_ID}-${event.tcrAddress}-${event.itemId}`
