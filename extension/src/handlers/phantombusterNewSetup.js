var browser = require("webextension-polyfill");
import { getWebsiteFromName } from "../helpers/getWebsiteFromName"

export class PhantombusterNewSetup {
	_fastPoll = 100
	_spinnerDelay = 1000
	_fieldInfosLength = 2
	// _hostRegex = RegExp("phantombuster\.(com|io)")
	_hostRegex = RegExp("localhost")
	_pathnameRegex = RegExp("\/static\/index.html")
	_interval
	_stepSetupSessionCookieDivSelector = "div[id^=\"formField-sessionCookie\"]"
	_stepSetupSessionCookieInnerDivSelector = "div"
	_stepSetupSessionCookieInputSelector = "input"
	_getCookieButtonClass = "pbExtensionNewSetupCookieButton"
	_phantomNameSelector1 = "header p"
	_phantomNameSelector2 = "aside header span"

	_phantomName = ""
	_foundWebsites = {}

	sendMessage = async (msg) => {
		console.log("handler.ts Message sent", msg)
		try {
			// tslint:disable-next-line:ban
			await browser.runtime.sendMessage(msg)
		} catch (err) {
			try {
				const port = browser.runtime.connect()
				port.postMessage(msg)
			} catch (err) {
				console.log(err)
				console.error("Could not send message", msg)
			}
		}
	}

	detect = () => {
		console.log('SETUP detect')
		return (
			this._hostRegex.test(window.location.host) &&
			this._pathnameRegex.test(window.location.pathname)
		)
	}

	onMessage = (msg) => {
		console.log('*** phantombusterNewSetup *** onMessage')
		
		if (msg.cookies) {
			this._onMessageCookies(msg.cookies.websiteName, msg.cookies.cookies, msg.cookies.newSession)
		}

	}

	run = async () => {
		console.log('SETUP run')

		this._interval = setInterval(this._findStepSetupFieldSessionCookies, this._fastPoll)
	}

	destroy = () => {
		console.log('SETUP destroy')

		if (this._interval) {
			clearInterval(this._interval)
		}
		const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(`.${this._getCookieButtonClass}`))
		for (const button of buttons) {
			button.remove()
		}
		document.removeEventListener("keydown", this._keydownListener)
		document.removeEventListener("keyup", this._keyupListener)
	}

	_onMessageCookies = (websiteName, cookies, newSession = false) => {
		console.log('*** phantombusterNewSetup *** _onMessageCookies')
		
		const foundWebsite = this._foundWebsites[websiteName]
		if (foundWebsite) {
			if (cookies.length === 0 || !cookies[0]) {
				this._websiteLogin(foundWebsite, newSession)
			} else {
				void this._fillInputs(foundWebsite, cookies)
			}
		}
	}

	_websiteLogin = (foundWebsite, newSession = false) => {
		console.log('SETUP _websiteLogin')

		foundWebsite.login = true
		for (const element of foundWebsite.elements) {
			element.btn.textContent = `Please log in to ${foundWebsite.website.name}`
			// element.btn.classList.add("pr-10")
			// element.btn.appendChild(getSpinner())
		}
		void this.sendMessage({ notif: { message: `Please log in to ${foundWebsite.website.name}` } })
		void this.sendMessage({
			newTab: {
				websiteName: foundWebsite.website.name,
				url: foundWebsite.website.url,
				newSession,
			}
		})
	}

	_onInputChange = (elements) => {
		console.log('SETUP _onInputChange')

		for (const element of elements) {
			element.btn.disabled = false
			element.btn.textContent = element.btn.getAttribute("textContentConnect")
		}
	}

	_fillInputs = async (foundWebsite, cookies) => {
		console.log('SETUP _fillInputs')
		
		if (foundWebsite.login) {
			await new Promise((resolve) => setTimeout(resolve, this._spinnerDelay))
			foundWebsite.login = false
		}
		for (const i in cookies) {
			if (cookies[i] && foundWebsite.elements[i]) {
				foundWebsite.elements[i].btn.textContent = `Connected to ${foundWebsite.website.name}`
				foundWebsite.elements[i].btn.classList.remove("pr-10")
				foundWebsite.elements[i].btn.disabled = true
				foundWebsite.elements[i].input.value = cookies[i].value
				if (foundWebsite.elements[i].inputListener) {
					foundWebsite.elements[i].input.removeEventListener("input", foundWebsite.elements[i].inputListener)
				}
				foundWebsite.elements[i].input.dispatchEvent(new Event("input", { bubbles: true }))
				if (!foundWebsite.elements[i].inputListener) {
					foundWebsite.elements[i].inputListener = () => { this._onInputChange(foundWebsite.elements) }
				}
				foundWebsite.elements[i].input.addEventListener("input", foundWebsite.elements[i].inputListener)
			}
		}
		void this.sendMessage({ notif: { message: `${this._phantomName} is now connected to ${foundWebsite.website.name}` } })
	}

	_createGetCookieBtn(website) {
		
		console.log('SETUP _createGetCookieBtn', website)

		const el = document.createElement("button")
		el.className = `${this._getCookieButtonClass} btn br-4 bg-dark-blue text-nowrap relative f5 mx-1 my-1`
		el.type = "button"
		el.setAttribute("analyticsid", "agentSetupStepsInputGetcookieBtn")
		el.setAttribute("analyticsval1", website.name)

		el.setAttribute("textContentConnect", `Connect to ${website.name}`)
		el.setAttribute("textContentLogin", `Connect to ${website.name} (new session)`)

		el.textContent = el.getAttribute("textContentConnect")

		if (document.querySelector("body > #root > div")?.dataset.loggedAs === "true") {
			el.disabled = true
		} else {
			el.onclick = (event) => {
				void this.sendMessage({
					getCookies: {
						websiteName: website.name,
						newSession: event.shiftKey,
					}
				})
			}
			el.onmouseover = (event) => {
				if (event.target instanceof HTMLButtonElement) {
					event.target.setAttribute("hover", "true")
					if (event.shiftKey === true) {
						event.target.textContent = event.target.getAttribute("textContentLogin")
					}
				}
			}
			el.onmouseout = (event) => {
				if (event.target instanceof HTMLButtonElement) {
					event.target.removeAttribute("hover")
					event.target.textContent = event.target.getAttribute("textContentConnect")
				}
			}
		}

		return el
	}

	_handleStepSetupFieldDiv = (stepSetupDiv) => {
		console.log('SETUP _handleStepSetupFieldDiv')

		const stepSetupInnerDiv = stepSetupDiv && stepSetupDiv.querySelector(this._stepSetupSessionCookieInnerDivSelector)
		const stepSetupInput = stepSetupDiv && stepSetupDiv.querySelector(this._stepSetupSessionCookieInputSelector)
		const fieldInfos = stepSetupDiv.dataset && stepSetupDiv.dataset.fieldInfo && stepSetupDiv.dataset.fieldInfo.split("/")

		if (stepSetupInnerDiv && stepSetupInput && fieldInfos && fieldInfos.length === this._fieldInfosLength) {
			
			const websiteName = fieldInfos[0]
			const cookieName = fieldInfos[1]

			const foundWebsite = getWebsiteFromName(websiteName)
			if (!foundWebsite) {
				return
			}
			const btn = this._createGetCookieBtn(foundWebsite)
			const elements = { cookieName, div: stepSetupDiv, innerDiv: stepSetupInnerDiv, input: stepSetupInput, btn }

			if (!this._foundWebsites[foundWebsite.name]) {
				this._foundWebsites[foundWebsite.name] = { website: foundWebsite, login: false, elements: [elements] }
			} else {
				this._foundWebsites[foundWebsite.name] && this._foundWebsites[foundWebsite.name].elements.push(elements)
			}
		
		}

	}

	_setPhantomName = () => {
		console.log('SETUP _setPhantomName')

		let phantomName = document.querySelector(this._phantomNameSelector1).textContent
		if (!phantomName || phantomName.trim() === "Setup") {
			phantomName = document.querySelector(this._phantomNameSelector2).textContent
		}
		this._phantomName = phantomName || ""
	}

	_keydownListener = (event) => {
		console.log('SETUP _keydownListener')

		if (event.key === "Shift") {
			const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(`.${this._getCookieButtonClass}`))
			for (const button of buttons) {
				if (button.hasAttribute("hover")) {
					button.textContent = button.getAttribute("textContentLogin")
				}
			}
		}
	}

	_keyupListener = (event) => {
		console.log('SETUP _keyupListener')

		if (event.key === "Shift") {
			const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(`.${this._getCookieButtonClass}`))
			for (const button of buttons) {
				if (button.hasAttribute("hover")) {
					button.textContent = button.getAttribute("textContentConnect")
				}
			}
		}
	}

	_findStepSetupFieldSessionCookies = () => {
		console.log('SETUP _findStepSetupFieldSessionCookies')
		
		console.log(document.querySelectorAll(this._stepSetupSessionCookieDivSelector))

		const stepSetupDivs = Array.from(document.querySelectorAll(this._stepSetupSessionCookieDivSelector))

		if (this._interval && stepSetupDivs.length) {
			clearInterval(this._interval)
		} else {
			return
		}

		for (const stepSetupDiv of stepSetupDivs) {

			this._handleStepSetupFieldDiv(stepSetupDiv)
		}

		this._setPhantomName()

		for (const foundWebsite of Object.values(this._foundWebsites)) {
			if (foundWebsite) {
				for (const elements of foundWebsite.elements) {
					elements.innerDiv.appendChild(elements.btn)
				}

				document.addEventListener("keydown", this._keydownListener)
				document.addEventListener("keyup", this._keyupListener)
			}
		}
	}
}
