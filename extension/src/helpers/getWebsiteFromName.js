import { websites } from './supportedWebsites'

export const getWebsiteFromName = (name) => {
	const matchingWebsites = websites.filter((website) => website.name === name)
	
	if (matchingWebsites.length === 1) {
		return matchingWebsites[0]
	}
	return null
}