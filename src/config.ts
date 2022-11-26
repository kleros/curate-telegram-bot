interface Config {
  SUBGRAPH_URL: string
  MAIN_LIST_ADDRESS: string
  CLASSIC_VIEW: string
  LIGHT_VIEW: string
  NODE_ENV: string
  RPC: string
  CHAIN_ID: string
  NETWORK_NAME: string
  CURRENCY_NAME: string
  GTCR_UI_URL: string
  TWITTER_CONSUMER_KEY: string
  TWITTER_CONSUMER_SECRET: string
  TWITTER_ACCESS_TOKEN: string
  TWITTER_ACCESS_TOKEN_SECRET: string
  IPFS_GATEWAY: string
  LOOP_TIME: string
  TWEET_DELAY: string
}

const getSanitizedConfig = (config: unknown): Config => {
  for (const [key, value] of Object.entries(
    config as { [value: string]: string | undefined }
  )) {
    if (value === undefined) {
      throw new Error(`Missing key ${key} in config.env`)
    }
  }
  return config as Config
}

const config = getSanitizedConfig(process.env)

export default config
