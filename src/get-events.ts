import { writeFileSync } from "fs"
import { request } from "http"
import fetch from "node-fetch"

interface EventDetails {
  registrationMetaEvidenceURI?: string
  finalRuling?: number
  requestType?: "RegistrationRequested" | "ClearingRequested"
  party?: string
  side?: number
}

interface CurateEvent {
  timestamp: number
  itemId: string
  tcrAddress: string
  type: string
  version: "classic" | "light"
  details: EventDetails
}

// on the interest of time
// and since I'm doing graphql queries in a raw fetch way (and I shouldn't have)
// i will pass args as <any> to the event parsers
// instead of creating interfaces like the following below:
/*interface RawRequestSubmitted {
  requester: string
  requestType: "RegistrationRequested" | "ClearingRequested"
  submissionTime: number
}*/

const parseRequestSubmitted = (
  request: any,
  version: "classic" | "light"
): CurateEvent => {
  return {
    timestamp: request.submissionTime,
    itemId: request.item.itemID,
    tcrAddress: request.registry.id,
    type: "RequestSubmitted",
    version: version,
    details: {
      registrationMetaEvidenceURI:
        request.registry.registrationMetaEvidence.URI,
    },
  }
}

// note, if finalRuling is null, take the requestType to derive what happened.
// we don't use "disputeOutcome" because we can't tell if refuse to arbitrate
const parseRequestResolved = (
  request: any,
  version: "classic" | "light"
): CurateEvent => {
  return {
    timestamp: request.resolutionTime,
    itemId: request.item.itemID,
    tcrAddress: request.registry.id,
    type: "RequestResolved",
    version: version,
    details: {
      registrationMetaEvidenceURI:
        request.registry.registrationMetaEvidence.URI,
      finalRuling: request.finalRuling,
      requestType: request.requestType,
    },
  }
}

const parseDispute = (
  request: any,
  version: "classic" | "light"
): CurateEvent | null => {
  // this was not a dispute creation
  if (request.rounds.length !== 2) return null
  // note, rounds are ordered desc, so, 1st elem in rounds is the dispute creation
  return {
    timestamp: request.rounds[0].creationTime,
    itemId: request.itemID,
    tcrAddress: request.registry.id,
    type: "Dispute",
    version: version,
    details: {
      registrationMetaEvidenceURI:
        request.registry.registrationMetaEvidence.URI,
    },
  }
}

const parseEvidence = (
  evidence: any,
  version: "classic" | "light"
): CurateEvent => {
  return {
    timestamp: evidence.timestamp,
    itemId: evidence.request.itemID,
    tcrAddress: evidence.request.registry.id,
    type: "Evidence",
    version: version,
    details: {
      registrationMetaEvidenceURI:
        evidence.request.registry.registrationMetaEvidence.URI,
      party: evidence.party,
      requestType: evidence.request.requestType,
    },
  }
}

// hasPaidAppealFee is pretty complicated, you need 2 parsers
const parseHasPaidAppealFee = (hasPaidAppealFee: any): CurateEvent => {
  return {
    timestamp: hasPaidAppealFee.timestamp,
    itemId: hasPaidAppealFee.round.request.item.itemID,
    tcrAddress: hasPaidAppealFee.round.request.registry.id,
    type: "HasPaidAppealFee",
    version: "classic",
    details: {
      registrationMetaEvidenceURI:
        hasPaidAppealFee.round.request.registry.registrationMetaEvidence.URI,
      side: hasPaidAppealFee.side,
    },
  }
}

/** 1 is requester, 2 is challenger */
const parseLightHasPaidAppealFee = (thing: any, side: number): CurateEvent => {
  return {
    timestamp:
      side === 1 ? thing.lastFundedRequester : thing.lastFundedChallenger,
    itemId: thing.request.item.itemID,
    tcrAddress: thing.request.item.registry.id,
    type: "HasPaidAppealFee",
    version: "light",
    details: {
      side: side,
    },
  }
}

const parseAppealPossible = (
  round: any,
  version: "classic" | "light"
): CurateEvent => {
  return {
    timestamp: round.appealPeriodStart,
    itemId: round.request.item.itemID,
    tcrAddress: round.request.registry.id,
    type: "AppealPossible",
    version: version,
    details: {},
  }
}

const parseAppealDecision = (
  round: any,
  version: "classic" | "light"
): CurateEvent => {
  return {
    timestamp: round.appealedAt,
    itemId: round.request.item.itemID,
    tcrAddress: round.request.item.registry.id,
    type: "AppealDecision",
    version: version,
    details: {},
  }
}

const parseRuling = (
  request: any,
  version: "classic" | "light"
): CurateEvent => {
  return {
    timestamp: request.resolutionTime,
    itemId: request.item.itemID,
    tcrAddress: request.item.registry.id,
    type: "Ruling",
    version: version,
    details: {
      registrationMetaEvidenceURI:
        request.item.registry.registrationMetaEvidence.URI,
      finalRuling: request.finalRuling,
      requestType: request.requestType,
    },
  }
}

const parseAllEvents = (data: any): CurateEvent[] => {
  const requestsSubmitted = data.requestsSubmitted.map((r: any) =>
    parseRequestSubmitted(r, "classic")
  )
  const lightRequestsSubmitted = data.lightRequestsSubmitted.map((r: any) =>
    parseRequestSubmitted(r, "light")
  )
  const requestsResolved = data.requestsResolved.map((r: any) =>
    parseRequestResolved(r, "classic")
  )
  const lightRequestsResolved = data.lightRequestsResolved.map((r: any) =>
    parseRequestResolved(r, "light")
  )
  const disputes = data.disputes.map((r: any) => parseDispute(r, "classic"))
  const lightDisputes = data.lightDisputes.map((r: any) =>
    parseDispute(r, "light")
  )
  const evidences = data.evidences.map((r: any) => parseEvidence(r, "classic"))
  const lightEvidences = data.evidences.map((r: any) =>
    parseEvidence(r, "light")
  )
  const hasPaidAppealFees = data.hasPaidAppealFees.map((r: any) =>
    parseHasPaidAppealFee(r)
  )
  const lightHasPaidAppealFeesRequester = data.lightFullyAppealedRequester.map(
    (r: any) => parseLightHasPaidAppealFee(r, 1)
  )
  const lightHasPaidAppealFeesChallenger =
    data.lightFullyAppealedChallenger.map((r: any) =>
      parseLightHasPaidAppealFee(r, 2)
    )

  const appealDecisions = data.appealDecisions.map((r: any) =>
    parseAppealDecision(r, "classic")
  )
  const lightAppealDecisions = data.lightAppealDecisions.map((r: any) =>
    parseAppealDecision(r, "light")
  )

  const rulings = data.rulings.map((r: any) => parseRuling(r, "classic"))
  const lightRulings = data.lightRulings.map((r: any) =>
    parseRuling(r, "light")
  )

  const allEvents = [
    requestsSubmitted,
    lightRequestsSubmitted,
    requestsResolved,
    lightRequestsResolved,
    disputes,
    lightDisputes,
    evidences,
    lightEvidences,
    hasPaidAppealFees,
    lightHasPaidAppealFeesRequester,
    lightHasPaidAppealFeesChallenger,
    appealDecisions,
    lightAppealDecisions,
    rulings,
    lightRulings,
  ].flat()

  return allEvents
}

const getEvents = async (
  start: number,
  end: number
): Promise<CurateEvent[]> => {
  // note for the future. it could be easier to just store the events as immutable entities
  // in the subgraph as they come, and as they are.

  console.log(
    "Getting events from... \n",
    new Date(start * 1000),
    "\n... to...\n",
    new Date(end * 1000)
  )

  // fetch info from the subgraph
  // to do this somewhat orderly, we will write each string separatedly.
  // then merge them at the end.

  const requestsSubmitted = `
  requestsSubmitted: requests(where: {submissionTime_gte: ${start}, submissionTime_lt: ${end}}) {
    requester
    requestType
    submissionTime
    item {
      id
      itemID
    }
    registry {
      id
      registrationMetaEvidence {
        URI
      }
    }
  }
  `

  const lightRequestsSubmitted = `
  lightRequestsSubmitted: lrequests(where: {submissionTime_gte: ${start}, submissionTime_lt: ${end}}) {
    id
    requester
    requestType
    submissionTime
    item {
      itemID
    }
    registry {
      id
      registrationMetaEvidence {
        URI
      }
    }
  }
  `

  const requestsResolved = `
  requestsResolved: requests(where: {resolutionTime_gte: ${start}, resolutionTime_lt: ${end}}) {
    requester
    requestType
    finalRuling
    resolutionTime
    item {
      itemID
    }
    registry {
      id
      registrationMetaEvidence {
        URI
      }
    }
  }
  `

  const lightRequestsResolved = `
  lightRequestsResolved: lrequests(where: {resolutionTime_gte: ${start}, resolutionTime_lt: ${end}}) {
    requester
    requestType
    finalRuling
    resolutionTime
    item {
      itemID
    }
    registry {
      id
      registrationMetaEvidence {
        URI
      }
    }
  }
  `

  // this one will be filtered after the act, to check that the second round is the one
  // within the period. (just check rounds[0].creationTime)
  const disputes = `
  disputes: requests(where: {numberOfRounds: 2, rounds_: {creationTime_gte: ${start}, creationTime_lt: ${end}}}) {
    requestType
    item {
      itemID
    }
    registry {
      id
      registrationMetaEvidence {
        URI
      }
    }
    rounds(orderBy: creationTime, orderDirection: desc) {
      creationTime
    }
  }
  `

  const lightDisputes = `
  lightDisputes: lrequests(where: {numberOfRounds: 2, rounds_: {creationTime_gte: ${start}, creationTime_lt: ${end}}}) {
    requestType
    item {
      itemID
    }
    registry {
      id
      registrationMetaEvidence {
        URI
      }
    }
    rounds(orderBy: creationTime, orderDirection: desc) {
      creationTime
    }
  }
  `

  const evidences = `
  evidences: evidences(where: {timestamp_gte: ${start}, timestamp_lt: ${end}}) {
    party
    timestamp
    request {
      requestType
      item {
        itemID
      }
      registry {
        id
        registrationMetaEvidence {
          URI
        }
      }
    }
  }
  `

  const lightEvidences = `
  lightEvidences: levidences(where: {timestamp_gte: ${start}, timestamp_lt: ${end}}) {
    id
    party
    timestamp
    request {
      requestType
      item {
        itemID
      }
      registry {
        id
        registrationMetaEvidence {
          URI
        }
      }
    }
  }
  `

  const hasPaidAppealFee = `
  hasPaidAppealFees(where: {timestamp_gte: ${start}, timestamp_lt: ${end}}) {
    side
    timestamp
    round {
      request {
        registry {
          id
          registrationMetaEvidence {
            URI
          }
        }
        item {
          itemID
        }
      }
    }
  }
  `

  // ^ this event doesn't exist in light curate. we're going to take an alternative approach.
  // two queries, one for requester and one for challenger.
  // todo add timestamp of last contribution to x side.
  // if fees are fully funded for that side, that's equivalent to "HasPaidAppealFees" timestamp
  const lightHasPaidAppealFee = `
  lightFullyAppealedRequester: lrounds(where: {hasPaidRequester: true, lastFundedRequester_gte: ${start}, lastFundedRequester_lt: ${end}}) {
    request {
      item {
        itemID
        registry {
          id
        }
      }
    }
    lastFundedRequester
  }

  lightFullyAppealedChallenger: lrounds(where: {hasPaidChallenger: true, lastFundedChallenger_gte: ${start}, lastFundedChallenger_lt: ${end}}) {
    request {
      item {
        itemID
        registry {
          id
        }
      }
    }
    lastFundedChallenger
  }
  `

  const possibleAppeals = `
  possibleAppeals: rounds(where: {appealPeriodStart_gte: ${start}, appealPeriodStart_lt: ${end}}) {
    request {
      item {
        itemID
        registry {
          id
          registrationMetaEvidence {
            URI
          }
        }
      }
    }
    appealPeriodStart
  }
  `

  const lightPossibleAppeals = `
  lightPossibleAppeals: lrounds(where: {appealPeriodStart_gte: ${start}, appealPeriodStart_lt: ${end}}) {
    request {
      item {
        itemID
        registry {
          id
          registrationMetaEvidence {
            URI
          }
        }
      }
    }
    appealPeriodStart
  }
  `

  const appealDecisions = `
  appealDecisions: rounds(where: {appealedAt_gte: ${start}, appealedAt_lt: ${end}}) {
    request {
      item {
        itemID
        registry {
          id
          registrationMetaEvidence {
            URI
          }
        }
      }
    }
    appealedAt
  }
  `

  const lightAppealDecisions = `
  lightAppealDecisions: lrounds(where: {appealedAt_gte: ${start}, appealedAt_lt: ${end}}) {
    request {
      item {
        itemID
        registry {
          id
          registrationMetaEvidence {
            URI
          }
        }
      }
    }
    appealedAt
  }
  `

  const rulings = `
  rulings: requests(where: {finalRuling_not: null, resolutionTime_gte: ${start}, resolutionTime_lt: ${end}}) {
    item {
      itemID
      registry {
        id
        registrationMetaEvidence {
          URI
        }
      }
    }
    finalRuling
    resolutionTime
  }
  `

  const lightRulings = `
  lightRulings: lrequests(where: {finalRuling_not: null, resolutionTime_gte: ${start}, resolutionTime_lt: ${end}}) {
    item {
      itemID
      registry {
        id
        registrationMetaEvidence {
          URI
        }
      }
    }
    requestType
    finalRuling
    resolutionTime
  }
  `

  // ---

  // add timestamp in levidence

  const fullQuery = `
  {
    ${requestsSubmitted}

    ${lightRequestsSubmitted}

    ${requestsResolved}

    ${lightRequestsResolved}

    ${disputes}

    ${lightDisputes}

    ${evidences}

    ${lightEvidences}

    ${hasPaidAppealFee}

    ${lightHasPaidAppealFee}

    ${possibleAppeals}

    ${lightPossibleAppeals}

    ${appealDecisions}

    ${lightAppealDecisions}

    ${rulings}

    ${lightRulings}
  }
  `

  const response = await fetch(
    "https://api.thegraph.com/subgraphs/name/greenlucid/legacy-curate-mainnet",
    {
      method: "POST",
      body: JSON.stringify({ query: fullQuery }),
    }
  )

  const { data } = (await response.json()) as any

  const history = parseAllEvents(data)

  writeFileSync("superfile.json", JSON.stringify(history), "utf-8")

  return history
}

export default getEvents
