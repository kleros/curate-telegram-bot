import { fstat, writeFileSync } from "fs"
import fetch from "node-fetch"

interface EventDetails {}

interface CurateEvent {
  itemId: string
  tcrAddress: string
  type: string
  version: "classic" | "light"
  details: EventDetails
}

const getEvents = async (
  start: number,
  end: number
): Promise<CurateEvent[]> => {
  const history: CurateEvent[] = []
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
    id
    requester
    requestType
    submissionTime
    item {
      id
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
      id
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
    id
    requester
    requestType
    disputed
    disputeOutcome
    submissionTime
    item {
      id
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
    id
    requester
    requestType
    disputed
    disputeOutcome
    submissionTime
    item {
      id
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
    id
    requestType
    item {
      id
    }
    registry {
      id
    }
    rounds(first: 1, orderBy: creationTime, orderDirection: desc) {
			id
      creationTime
    }
  }
  `

  const lightDisputes = `
  lightDisputes: lrequests(where: {numberOfRounds: 2, rounds_: {creationTime_gte: ${start}, creationTime_lt: ${end}}}) {
    id
    requestType
    item {
      id
    }
    registry {
      id
    }
    rounds(first: 1, orderBy: creationTime, orderDirection: desc) {
			id
      creationTime
    }
  }
  `

  const evidences = `
  evidences: evidences(where: {timestamp_gte: ${start}, timestamp_lt: ${end}}) {
    id
    party
    request {
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
    request {
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
    registry {
      id
    }
    item {
      itemID
    }
    lastFundedRequester
  }

  lightFullyAppealedChallenger: lrounds(where: {hasPaidChallenger: true, lastFundedChallenger_gte: ${start}, lastFundedChallenger_lt: ${end}}) {
    registry {
      id
    }
    item {
      itemID
    }
    lastFundedChallenger
  }
  `

  // possibleAppeals... todo just create the entity for it. timestamp and item relation.
  // L354 classic
  const possibleAppeals = `
  possibleAppeals: rounds(where: {appealPeriodStart_gte: ${start}, appealPeriodStart_lt: ${end}}) {
    request {
      item {
        itemID
        registry {
          id
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
        }
      }
    }
    appealPeriodStart
  }
  `

  // appealDecisions... ^^^
  const appealDecisions = `
  appealDecisions(where: {timestamp_gte: ${start}, timestamp_lt: ${end}}) {
    registry {
      id
    }
    item {
      itemID
    }
    timestamp
  }
  `

  const lightAppealDecisions = `
  lightAppealDecisions: lappealDecisions(where: {timestamp_gte: ${start}, timestamp_lt: ${end}}) {
    registry {
      id
    }
    item {
      itemID
    }
    timestamp
  }
  `

  // rulings... ^^^
  const rulings = `
  rulings(where: {timestamp_gte: ${start}, timestamp_lt: ${end}}) {
    registry {
      id
      registrationMetaEvidence {
        URI
      }
    }
    item {
      itemID
    }
    timestamp
  }
  `

  const lightRulings = `
  lightRulings: lrulings(where: {timestamp_gte: ${start}, timestamp_lt: ${end}}) {
    registry {
      id
      registrationMetaEvidence {
        URI
      }
    }
    item {
      itemID
    }
    timestamp
  }
  `

  // ---

  // add timestamp in levidence

  const fullQuery = `
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
  `

  const response = await fetch(
    "https://api.thegraph.com/subgraphs/name/kleros/curate",
    {
      method: "POST",
      body: JSON.stringify(fullQuery),
    }
  )

  const { data } = (await response.json()) as any

  writeFileSync("testfile.json", JSON.stringify(data))

  return []
}

export default getEvents
