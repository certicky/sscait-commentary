// EXTERNAL TOOLS:
//
// ChatGPT:         https://github.com/transitive-bullshit/chatgpt-api
// Text-To-Speech:  https://github.com/coqui-ai/TTS
//

import { ChatGPTAPI } from 'chatgpt'
import express from 'express'
import http from 'http'
import fs from 'fs'
import {
  execSync,
  spawn
} from 'child_process'
import process from 'process'
import {
  openAIAPIKey,
  listenPort
} from './settings.js'

// GLOBAL VARS
const chatGPTAPI = new ChatGPTAPI({ apiKey: openAIAPIKey })
const gameIdToConversationIdMap = {}
let lastMessageId = null

// log in to ChatGPT and start a session
console.log('ChatGPT session started.')

// start a TTS server in the background and let it initialize the model
// note: we could just call 'tts' CLI command without starting a server,
//       but then it would have to init the model for each call, which is
//       much slower.
await execSync('if pgrep tts-server; then pkill tts-server; fi', { stdio: 'inherit' }) // kill previous instances of tts-server
await spawn('tts-server', [
  '--model_name=tts_models/en/ljspeech/glow-tts',
  '--port=' + (listenPort + 1),
  '--use_cuda=true',
  '--debug=false'
], {
  stdio: 'ignore',
  detached: true
}).unref()
await process.on('exit', (code) => { execSync('killall tts-server', { stdio: 'ignore' }) })
console.log('TTS server starting at port', (listenPort + 1))

// converts a situation in JSON array string into a string that will be sent to ChatGPT
function situationJSONToString (situation) {
  return 'situation:\n' + JSON.parse(situation).map(s => '- ' + s).join('\n')
}

function sanitizeStringForTTS (s) {
  return s
    .replace(/Starcraft: Brood War/ig, 'Starcraft') // remove "Brood War" part from the game name, because noone says it. still, we need to include it in ChatGPT input, because it talks about Marauders and Medivacs if we don't :)
    .replaceAll(', ', ' ') // remove commas from the output, because TTS interprets them as uncomfortably long pauses
    .replaceAll('"', '') // remove the surrounding ""
    .replace(/^\s+|\s+$/g, '') // trim leading & trailing whitespaces & newlines
}

// get natural language description of a situation from ChatGPT
async function getTextDescriptionOfSituation (gameId, situation, retriesAllowed = 2) {
  try {
    // if gameId changed just now, start a new conversation for this new game
    if (!Object.keys(gameIdToConversationIdMap).includes(gameId)) {
      // send an initial message with conversationId set to null to init a new conversation
      const res = await chatGPTAPI.sendMessage(
        'Generate a live commentary of a professional StarCraft: Brood War game in a style of Tastless, Artosis or Day9.' + '\n' +
        'I will provide a brief summary of current in-game situation and you use that information to cast the game.' + '\n' +
        'Reply with 80 words or less.' + '\n' + '\n' +
        situationJSONToString(situation), {
          conversationId: null
        })
      lastMessageId = res.messageId

      // save the conversationId of this new conversation in our map
      gameIdToConversationIdMap[gameId] = res.conversationId

      // return the response from ChatGPT
      return sanitizeStringForTTS(res.text)
    } else {
      // if we already know the ChatGPT conversationId for this gameId, use it when we send the message to ChatGPT
      const res = await chatGPTAPI.sendMessage(situationJSONToString(situation), {
        conversationId: gameIdToConversationIdMap[gameId],
        parentMessageId: lastMessageId
      })
      lastMessageId = res.messageId

      // return the response from ChatGPT
      return sanitizeStringForTTS(res.text)
    }
  } catch (e) {
    console.log('There was an error:', e)
    if (retriesAllowed > 0) {
      console.log('Retrying...')
      await chatGPTAPI.refreshSession()
      return await getTextDescriptionOfSituation(gameId, situation, retriesAllowed - 1)
    }
    return ''
  }
}

// set up an API
const app = express()
app.get('/', async (req, res) => {
  const { gameId, situation } = req.query

  if (!gameId) {
    return res.status(400).send({ error: 'gameId param is required' })
  }

  if (!situation) {
    return res.status(400).send({ error: 'situation param is required' })
  }

  try {
    const situationArray = JSON.parse(situation)
    if (!Array.isArray(situationArray)) {
      return res.status(400).send({ error: 'situation should be a JSON array of strings' })
    }
    situationArray.forEach(sit => {
      if (typeof sit !== 'string') {
        return res.status(400).send({ error: 'situation should be a JSON array of strings' })
      }
    })
  } catch (err) {
    return res.status(400).send({ error: 'situation should be a valid JSON' })
  }

  console.log('========================================')
  console.log(situation)
  console.log('...')

  const situationNaturalLanguageText = await getTextDescriptionOfSituation(gameId, situation)

  console.log(situationNaturalLanguageText)
  console.log('========================================')

  try {
    // query local TTS server to get commentary.wav
    const f = await new Promise((resolve, reject) => {
      http.get('http://localhost:' + (listenPort + 1) + '/api/tts?text=' + encodeURIComponent(situationNaturalLanguageText), response => {
        if (response.statusCode === 200) {
          const file = fs.createWriteStream('/tmp/commentary.wav')
          response.pipe(file)
          file.on('finish', () => {
            file.close(resolve)
          })
        } else {
          console.error(`Couldn't download WAV file: ${response.statusCode}`)
          reject(new Error(`HTTP status code: ${response.statusCode}`))
        }
      })
    })

    // make out.wav faster and lower pitch using sox (it just sounds a bit better this way)
    await execSync('sox /tmp/commentary.wav /tmp/out.wav pitch -350 tempo -s 1.35', { stdio: 'inherit' })

    // send the finished file to client
    res.set('Content-Type', 'audio/wav')
    res.sendFile('/tmp/out.wav')
  } catch (err) {
    return res.status(500).send({ error: err.message })
  }
})

const server = app.listen(listenPort, () => {
  console.log('Server started on port', listenPort)
})
server.setTimeout(60000) // set timeout limit to 60s

/*
Dev notes:

  How to train a model: https://tts.readthedocs.io/en/latest/training_a_model.html
  What makes a good Data Set: https://github.com/coqui-ai/TTS/wiki/What-makes-a-good-TTS-dataset#public-tts-dataset
  A tool that can get training data from YouTube: https://github.com/ryanrudes/YTTTS
*/
