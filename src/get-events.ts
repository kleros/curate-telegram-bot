import fetch from "node-fetch"
import config from "./config"

interface EventDetails {
  registrationMetaEvidenceURI?: string
  finalRuling?: number
  requestType?: "RegistrationRequested" | "ClearingRequested"
  party?: string
  side?: number
  itemStatus?: "Absent" | "Registered" | string
}

export interface CurateEvent {
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
      requestType: request.requestType,
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
      itemStatus: request.item.status,
    },
  }
}

const parseDispute = (
  request: any,
  version: "classic" | "light"
): CurateEvent | null => {
  return {
    timestamp: request.rounds[1].creationTime,
    itemId: request.item.itemID,
    tcrAddress: request.registry.id,
    type: "Dispute",
    version: version,
    details: {
      registrationMetaEvidenceURI:
        request.registry.registrationMetaEvidence.URI,
      requestType: request.requestType,
    },
  }
}

const parseEvidence = (
  evidence: any,
  version: "classic" | "light"
): CurateEvent => {
  return {
    timestamp: evidence.timestamp,
    itemId: evidence.request.item.itemID,
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

const parseAppealPossible = (
  round: any,
  version: "classic" | "light"
): CurateEvent => {
  return {
    timestamp: round.appealPeriodStart,
    itemId: round.request.item.itemID,
    tcrAddress: round.request.item.registry.id,
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

  const disputes = data.disputes
    .map((r: any) => parseDispute(r, "classic"))
    .filter((r: CurateEvent | null) => r)
  const lightDisputes = data.lightDisputes
    .map((r: any) => parseDispute(r, "light"))
    .filter((r: CurateEvent | null) => r)
  const evidences = data.evidences.map((r: any) => parseEvidence(r, "classic"))
  const lightEvidences = data.lightEvidences.map((r: any) =>
    parseEvidence(r, "light")
  )
  const hasPaidAppealFees = data.hasPaidAppealFees.map((r: any) =>
    parseHasPaidAppealFee(r)
  )

  const appealPossibles = data.possibleAppeals.map((r: any) =>
    parseAppealPossible(r, "classic")
  )
  const lightAppealPossibles = data.lightPossibleAppeals.map((r: any) =>
    parseAppealPossible(r, "light")
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
    appealPossibles,
    lightAppealPossibles,
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
      status
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

  const disputes = `
  disputes: requests(where: {rounds_: {creationTime_gte: ${start}, creationTime_lt: ${end}}}) {
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
    rounds(orderBy: creationTime) {
      creationTime
    }
  }
  `

  const lightDisputes = `
  lightDisputes: lrequests(where: {rounds_: {creationTime_gte: ${start}, creationTime_lt: ${end}}}) {
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
    rounds(orderBy: creationTime) {
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

    ${possibleAppeals}

    ${lightPossibleAppeals}

    ${appealDecisions}

    ${lightAppealDecisions}

    ${rulings}

    ${lightRulings}
  }
  `

  const response = await fetch(config.SUBGRAPH_URL, {
    method: "POST",
    body: JSON.stringify({ query: fullQuery }),
  })

  const { data } = (await response.json()) as any

  // we need start and end to filter these, so we do it here.
  const filteredDisputes = data.disputes.filter(
    (dispute: any) =>
      dispute.rounds.length >= 2 &&
      start <= dispute.rounds[1].creationTime &&
      end > dispute.rounds[1].creationTime
  )

  const filteredLightDisputes = data.lightDisputes.filter(
    (dispute: any) =>
      dispute.rounds.length >= 2 &&
      start <= dispute.rounds[1].creationTime &&
      end > dispute.rounds[1].creationTime
  )

  // we hack the filtered disputes in there.
  const parsedEvents = parseAllEvents({
    ...data,
    disputes: filteredDisputes,
    lightDisputes: filteredLightDisputes,
  })

  // force the timestamps into being actual timestamps. they were strings before.
  parsedEvents.forEach((thing) => {
    thing.timestamp = Number(thing.timestamp)
  })

  const history = parsedEvents.sort((a, b) => a.timestamp - b.timestamp)

  //writeFileSync("superfile.json", JSON.stringify(history), "utf-8")

  return history
}

export default getEvents
