import { Level } from "level"
import Twitter from "twitter-lite"
import config from "../config"

const twitterClient = new Twitter({
  consumer_key: config.TWITTER_CONSUMER_KEY,
  consumer_secret: config.TWITTER_CONSUMER_SECRET,
  access_token_key: config.TWITTER_ACCESS_TOKEN,
  access_token_secret: config.TWITTER_ACCESS_TOKEN_SECRET,
})

const submitTweet = async (
  tweetID: string | null,
  message: string,
  key: string,
  db: Level<string, string>
) => {
  if (process.env.node === "staging") {
    console.log("Won't submit tweet")
    return
  }

  let tweet
  if (tweetID === null)
    try {
      tweet = await twitterClient.post("statuses/update", {
        status: message,
      })
    } catch (err) {
      console.log("Caught error submitting parent tweet")
      console.error(err)
    }
  else
    try {
      tweet = await twitterClient.post("statuses/update", {
        status: message,
        in_reply_to_status_id: tweetID,
        auto_populate_reply_metadata: true,
      })
    } catch (err) {
      console.log("Caught error submitting response tweet")
      console.error(err)
    }
  if (tweet) {
    try {
      await db.put(key, tweet.id_str)
    } catch (e) {
      console.error("Somehow, cannot write tweet id?", e)
    }
  }
}

export default submitTweet
