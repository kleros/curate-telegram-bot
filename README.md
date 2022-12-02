<p align="center">
  <b style="font-size: 32px;">Curate Twitter Bot </b>
</p>

<p align="center">
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="JavaScript Style Guide"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen Friendly"></a>
  <a href="https://github.com/prettier/prettier"><img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="Styled with Prettier"></a>
</p>

Watch and tweet about things happening on Kleros Curate.

## Prerequisites

- NodeJS version 14

## Get Started

1.  Clone this repo.
2.  Duplicate `.env.example`, rename it to `.env.<networkName>` and fill in the environment variables.
3.  Run `yarn` to install dependencies.
4.  Build it. `yarn build`

> This is a script that will notify for everything that happened within a period. To do so, run `yarn start`.

You can run this script as it is, or with cron. There are also `loop:<networkName>` yarn scripts to run this process automatically with pm2. Adding them is straightforward, just create a new `.env.<networkName>` and create the loop script for it.

This is an example of how to set this loop with pm2:

`pm2 start yarn --interpreter bash --name ctb-xdai -- loop:xdai`

## Architecture

This bot purpose is to minimize RPC calls. The previous way of obtaining events was to create many event listeners for every GTCR and LightGTCR contract. Instead, this bot relies on subgraphs to obtain event information, with entities that store timestamps in some capacity.

This bot in particular needs a database, in order to remember twitter threads belonging to specific items.

## Pipeline

1. Obtain previous timestamp, and store the timestamp corresponding to the present.
2. Send a complex query to the subgraph. For each entity type, `where` clauses filter to only include entities that are relevant from `start` to `end`, which are the two timestamps that define the window of time we're interested in.
3. As each query fetches custom information, each query has all results go through a custom method, to parse the results into an standarized form that the rest of the program can consume, called `Events` (they're not actual EVM events)
4. These `Events` are sorted according to their timestamp.
5. Each `Event` is now handled. It goes through a function that acts as a router, and directs each event type to be handled on its own customized way.

## Curate Twitter Bot specifics

This bot uses a database to remember the last tweet that was posted on an specific item, in order to reply to it and form threads.

It also needs an RPC connection in order to obtain some information that is not available through the subgraph, such as some `metaEvidenceURIs`, and some amounts. But, RPC calls are only made to obtain info per handling, so it's considerably cheaper. (Currently, maximum 2 RPC calls per tweet).

## How to migrate a bot to use this architecture

TLDR: update subgraph, build queries, parsers and handlers.

### Figure out what needs to be handled

Analyze the current bot, and make a list of everything that needs to be handled. Check out how it's obtaining this information.

### Build the subgraph queries

Go to a subgraph that is indexing the relevant contract. Build a subgraph if it doesn't exist yet. If something cannot be queried, modify the subgraph to expose this information to the queries. This usually entails creating entities that map 1:1 to events, or adding some timestamps to existing entities.

In this project, these queries are strings inside the `getEvents` function in `get-events.ts`. Note timestamps matter.

You may want to use an existing library to make these queries, it may have been a mistake to write the query strings manually and fetch with `node-fetch`.

### Build the parsers

Each query will net a result that needs to be parsed into an standarized format for the handlers to consume. This is done because it makes the rest of the bot straightforward and less prone to bugs.

For example, in this bot, there's a `CurateEvent` interface that all parsers return.

### Build the handlers

This is completely dependant on the purpose of the bot. This bot purpose is making tweets, so all the handlers do is tweet and store the tweet id somewhere.

A bot could do other things as well: call intermediate transactions, such as reward withdrawals, advancing a phase or executing a request. It could send telegram messages, send mails, etc.

# Is this worth it?

## Pros

- This architecture looks more reliable, the pipeline is more modular.
- It's not vulnerable to RPC degrading their service (rate limits, timeouts...).

## Cons

- Reliant on the subgraph. If TheGraph is bugged, it will affect it. If the subgraph is not keeping up, this bot won't keep up either.
- Parsers are error prone, especially if there's a lot of information and and there are many parsers. I had to do a lot of manual debugging and I'm still not sure I found all of them.
- Usually entails indexing new information on the subgraph.
