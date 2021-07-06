var browser = require("webextension-polyfill");

import { PhantombusterNewSetup } from './handlers/phantombusterNewSetup'

const handlers = [
   PhantombusterNewSetup
]

// const backgroundListener = (msg) => {
//    console.log('_+_ BACKGROUND LISTENER _+_')
//    console.log("Message received", msg)

//    if (msg.restart) {
//       browser.runtime.onMessage.removeListener(backgroundListener)
//       console.log('browser.runtime.onMessage.removeListener(backgroundListener)')
//       // for (const handler of detectedHandlers) {
//       //    handler.destroy()
//       // }
//       return main()
//    } else {
//       // for (const handler of detectedHandlers) {
//       //    handler.onMessage(msg)
//       // }
//    }
// }

const runtimeMessagesListener = (detectedHandlers) => {
	console.log('runtimeMessagesListener')
	const backgroundListener = (msg) => {
		console.log('BACKGROUND LISTENER')
		console.log("Message received", msg)
		if (msg.restart) {
			browser.runtime.onMessage.removeListener(backgroundListener)
			console.log('browser.runtime.onMessage.removeListener(backgroundListener)')
			for (const handler of detectedHandlers) {
				handler.destroy()
			}
			return main()
		} else {
			for (const handler of detectedHandlers) {
				handler.onMessage(msg)
			}
		}
	}
	browser.runtime.onMessage.addListener(backgroundListener)
}

async function main() {

   console.log('main called in content.js')

   // browser.runtime.onMessage.addListener(backgroundListener)

   // const h = new PhantombusterNewSetup()

   // h.destroy()
	// h.run().catch((e) => console.error(e))

   console.log('main', handlers)
	const detectedHandlers = []

	console.log('LOOPING OVER handlers')
	for (const handler of handlers) {
		// console.log('handler', handler)
		const h = new handler()
		if (h.detect()) {
			detectedHandlers.push(h)
		}
	}

	console.log('CALLING runtimeMessagesListener', detectedHandlers)

	runtimeMessagesListener(detectedHandlers)
	for (const handler of detectedHandlers) {
		handler.destroy()
		handler.run().catch((e) => console.error(e))
	}


   // chrome.extension.sendMessage({
   //    getCookies: {
   //       websiteName: 'LinkedIn'
   //    }
   // }, async function() { /* callback */ });

}

main()


