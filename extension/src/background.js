var browser = require("webextension-polyfill");

import { getWebsiteFromName } from './helpers/getWebsiteFromName'

import { extensionWebsiteDomains } from './helpers/websites'

const isChrome = () => {
	console.log('isChrome')
	return document.location.protocol.indexOf("chrome") !== -1
}

// Function to be used to send message instead of browser.tabs.sendMessage()
const sendMessage = async (tabId, msg) => {
	console.log('-> sendMessage', tabId, msg)
	// console.log("Message sent", msg)
	// tslint:disable-next-line:ban
	await browser.tabs.sendMessage(tabId, msg)
}

const getCookies = async (websiteName, newSession, senderTab) => {
	console.log('-> getCookies')

	if (senderTab.id) {

		if (newSession) {

			await sendMessage(senderTab.id, {
				cookies: {
					websiteName,
					cookies: [],
					newSession,
				}
			})
		} else {

			const cookiesList = getWebsiteFromName(websiteName)?.cookies
			if (cookiesList) {
				const cookies = await browser.cookies.getAll({})
				console.log('-> getCookies cookies', cookies)

				const matchingCookies = cookiesList.map((cookie) => cookies.filter((c) => c.name === cookie.name && c.domain === cookie.domain)[0])

				// Whether cookies have been found or not, we send the result to the content script.
				// The content script handles the empty|null|undefined array of cookies and asks the user to log in.
				await sendMessage(senderTab.id, {
					cookies: {
						websiteName,
						cookies: matchingCookies,
					}
				})
			}
		}
	}
}

browser.runtime.onMessage.addListener(async (msg, sender) => {
	try {

		console.log('*** *** onMessage *** **')

		if (msg.getCookies && sender.tab) {
			// const websiteName = msg && msg.getCookies && msg.getCookies.websiteName
			// const cookiesList =  getWebsiteFromName(websiteName).cookies
			// const cookies = await browser.cookies.getAll({})
			// const matchingCookies = cookiesList.map((cookie) => cookies.filter((c) => c.name === cookie.name && c.domain === cookie.domain)[0])
			// console.log('-> matchingCookies', matchingCookies)
			await getCookies(msg.getCookies.websiteName, msg.getCookies.newSession, sender.tab)
		} else {
			console.info('unknown msg type')
		}
		
	} catch(e) {
		console.error(e)
	}
});

// Here we attach an a listener to each tab url change to (re)start the extension if the domain matches
// the list of domains where we want the extension to run content scripts.
browser.tabs.onUpdated.addListener(async (id, changeInfo, tab) => {
	console.log('browser.tabs.onUpdated.addListener')
	console.log('-> extensionWebsiteDomains', extensionWebsiteDomains)

	if (tab.url && extensionWebsiteDomains.some(v => tab.url && tab.url.includes(v)) && changeInfo.status === "complete") {
		await sendMessage(id, { restart: true })
	}
})

// At the extension installation or update (or browser update) we reload/restart on each tab matching the list
// of domains where we want the extension to run content scripts
browser.runtime.onInstalled.addListener(async () => {
	console.log('browser.runtime.onInstalled.addListener')
	const tabs = await browser.tabs.query({ url: extensionWebsiteDomains.map((url) => `*://*.${url}/*`) })
	for (const t of tabs) {
		if (t.id) {
			if (isChrome()) { // Google chrome does not (re)install content scripts so we need to do a full reload of the tab
				await browser.tabs.reload(t.id)
			} else { // Firefox (re)installs content scripts directly so we just need to send the "restart" message
				await sendMessage(t.id, { restart: true })
			}
		}
	}
})

// Here we receive messages from the content scripts
browser.runtime.onMessage.addListener(async (msg, sender) => {
	console.log("-> Message received", msg, sender)
	if (msg.newTab && sender.tab) {
		// await newTab(msg.newTab.websiteName, msg.newTab.url, msg.newTab.newSession, sender.tab)
	} else if (msg.getCookies && sender.tab) {
		// await getCookies(msg.getCookies.websiteName, msg.getCookies.newSession, sender.tab)
	} else if (msg.notif) {
		// sendNotification(msg.notif.title || "Phantombuster", msg.notif.message)
	} else if (msg.restartMe && sender.tab && sender.tab.id) {
		await sendMessage(sender.tab.id, { restart: true })
	}
})