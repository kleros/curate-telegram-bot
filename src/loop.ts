import config from "./config"
import run, { sleep } from "./run"

const loop = async () => {
  while (true) {
    run()
    await sleep(Number(config.LOOP_TIME))
  }
}

loop()
