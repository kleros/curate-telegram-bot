import { Level } from "level"
import { CurateEvent } from "./get-events"
import handleAppealDecision from "./handlers/appeal-decision"
import handleAppealPossible from "./handlers/appeal-possible"
import handleDispute from "./handlers/dispute"
import handleEvidence from "./handlers/evidence"
import handlePaidFees from "./handlers/paid-fees"
import handleRequestResolved from "./handlers/request-resolved"
import handleRequestSubmitted from "./handlers/request-submitted"
import handleRuling from "./handlers/ruling"

const handleEvent = async (event: CurateEvent, db: Level<string, string>): Promise<void> => {
  if (event.type === "RequestSubmitted") {
    await handleRequestSubmitted(event, db)
  } else if (event.type === "RequestResolved") {
    await handleRequestResolved(event, db)
  } else if (event.type === "Ruling") {
    await handleRuling(event, db)
  } else if (event.type === "HasPaidAppealFee") {
    await handlePaidFees(event, db)
  } else if (event.type === "Evidence") {
    await handleEvidence(event, db)
  } else if (event.type === "Dispute") {
    await handleDispute(event, db)
  } else if (event.type === "AppealDecision") {
    await handleAppealDecision(event, db)
  } else if (event.type === "AppealPossible") {
    await handleAppealPossible(event, db)
  } else {
    throw new Error("Unknown event!")
  }
}

export default handleEvent
