const getEvents = async (start: number, end: number): Promise<any[]> => {
  console.log(
    "Getting events from... \n",
    new Date(start * 1000),
    "\n... to...\n",
    new Date(end * 1000)
  )
  return []
}

export default getEvents
