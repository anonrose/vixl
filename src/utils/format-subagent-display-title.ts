const formatSubagentDisplayTitle = (input: {
  name?: string
  description?: string | null
}): string => {
  const description = input.description?.trim() ?? ''
  if (description.length > 0) {
    return description
  }
  const name = input.name?.trim() ?? ''
  return name.length > 0 ? name : 'Sub-agent'
}

export default formatSubagentDisplayTitle
