// EXTERNAL TOOLS:
//
// ChatGPT:         https://github.com/transitive-bullshit/chatgpt-api
// Text-To-Speech:  https://github.com/coqui-ai/TTS
//

import { ChatGPTAPI } from 'chatgpt'
import express from 'express'
import http from 'http'
import fetch from 'node-fetch'
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
const chatGPTAPI = new ChatGPTAPI({ apiKey: openAIAPIKey, completionParams: 'text-chat-davinci-002' })
const gameData = {}
const fillerCooldownUntil = {}

// log in to ChatGPT and start a session
log('ChatGPT session started.')

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
log('TTS server starting at port ' + (listenPort + 1))

// custom log function that logs text in a file of max. 1000 lines and also prints it
function log (text) {
  try {
    const data = fs.readFileSync('log.txt', 'utf-8')
    let lines = data.split('\n')
    if (lines.length >= 1000) {
      lines = lines.slice(lines.length - 999)
    }
    lines.push(text)
    fs.writeFileSync('log.txt', lines.join('\n'))
    console.log(text)
  } catch (err) {
    console.error(err)
  }
}

// converts a situation in JSON array string into a string that will be sent to ChatGPT
// NOTE: if the passed situation array is empty, and we have no available time fillers, it returns null
async function situationJSONToString (situation, gameId) {
  const situationArray = JSON.parse(situation)

  // extract some game-related info (like bot names) from the initial game start messages
  const player1InfoMsg = situationArray.find(s => s.toLowerCase().replaceAll(' ','').includes('player1iscalled'))
  const player2InfoMsg = situationArray.find(s => s.toLowerCase().replaceAll(' ','').includes('player2iscalled'))
  if (player1InfoMsg) {
    const botName = player1InfoMsg.substring(player1InfoMsg.indexOf('is called') + 9, player1InfoMsg.indexOf('and plays as')).trim()
    const botRace = player1InfoMsg.substring(player1InfoMsg.indexOf('and plays as') + 12).replace('Unknown', 'Random').trim()
    if (botName && botName !== '')
    if (!Object.keys(gameData).includes(gameId)) gameData[gameId] = {}
    gameData[gameId].bot1Name = botName
    gameData[gameId].bot1Race = botRace
  }
  if (player2InfoMsg) {
    const botName = player2InfoMsg.substring(player2InfoMsg.indexOf('is called') + 9, player2InfoMsg.indexOf('and plays as')).trim()
    const botRace = player2InfoMsg.substring(player2InfoMsg.indexOf('and plays as') + 12).replace('Unknown', 'Random').trim()
    if (botName && botName !== '')
    if (!Object.keys(gameData).includes(gameId)) gameData[gameId] = {}
    gameData[gameId].bot2Name = botName
    gameData[gameId].bot2Race = botRace
  }

  // misc function that uses SSCAIT API to get stats of both bots for 'fillerPlayerStats' time filler
  const getPlayerStatsText = async () => {
    if (!gameData[gameId].bot1Name || !gameData[gameId].bot2Name) return null
    try {
      const response1 = await fetch('https://sscaitournament.com/api/bots.php?bot=' + encodeURIComponent(gameData[gameId].bot1Name))
      const json1 = await response1.json()
      const wins1 = json1[0]?.wins || 0
      const losses1 = json1[0]?.losses || 0
      if (wins1 + losses1 === 0) return null
      const winRate1 = Math.round(wins1 / (wins1 + losses1) * 100)

      const response2 = await fetch('https://sscaitournament.com/api/bots.php?bot=' + encodeURIComponent(gameData[gameId].bot2Name))
      const json2 = await response2.json()
      const wins2 = json2[0]?.wins || 0
      const losses2 = json2[0]?.losses || 0
      if (wins2 + losses2 === 0) return null
      const winRate2 = Math.round(wins2 / (wins2 + losses2) * 100)
      return '(now explain that ' + gameData[gameId].bot1Name + '\'s win rate in the tournament is ' + winRate1 + '% and ' + gameData[gameId].bot2Name + '\'s win rate is ' + winRate2 + '% and what it means for the ongoing game)'
    } catch (e) {
      log(e)
      return null
    }
  }

  if (situationArray?.length) {
    // if we got some situation events, return a situation description for ChatGPT
    return 'situation:\n' + situationArray.map(s => '- ' + s).join('\n')
  } else {
    // if the array of situation events is empty, return some time filler bs
    const timeFillers = [
      { id: 'fillerSummary', cooldownSeconds: 60, getText: async () => '(now summarize the game so far to fill some time)' },
      { id: 'fillerSummaryCasualties', cooldownSeconds: 60 * 5, getText: async () => '(now summarize how much both players lost in this game so far and who\'s in a better shape)' },
      { id: 'fillerCliche', cooldownSeconds: 60, getText: async () => '(now say some general StarCraft commentator cliche that doesn\'t relate to the current game situation.)' },
      { id: 'fillerPatreon', cooldownSeconds: 60 * 60, getText: async () => '(now remind watchers they can support "SSCAIT" on Patreon to keep alive the project that combines StarCraft and Artificial Intelligence. but keep this under 35 words.)' },
      { id: 'fillerTwitchYoutube', cooldownSeconds: 60 * 45, getText: async () => '(now remind watchers that we stream StarCraft bot games 24/7 on "SSCAIT" Twitch and also publish videos with human commentary on Youtube. but keep this under 50 words and don\'t start with word "and")' },
      { id: 'fillerAnecdote', cooldownSeconds: 60 * 20, getText: async() => '(now say some interesting anecdote from the world of professional starcraft or its pro players)' },
      { id: 'fillerPlayerStats', cooldownSeconds: 60 * 10, getText: getPlayerStatsText}
    ]

    const now = Date.now() / 1000 // current unix timestamp in seconds
    const currentlyAvailableFillers = timeFillers.filter(tf => !Object.keys(fillerCooldownUntil).includes(tf.id) || (now >= fillerCooldownUntil[tf.id]))
    const randomFiller = currentlyAvailableFillers.length ? currentlyAvailableFillers[Math.floor(Math.random() * currentlyAvailableFillers.length)] : null
    if (randomFiller) {
      fillerCooldownUntil[randomFiller.id] = now + randomFiller.cooldownSeconds
      return await randomFiller.getText()
    } else {
      return null
    }
  }
}

// pre-process the input for the TTS model
function sanitizeStringForTTS (s, gameId) {
  let ret = s
    .replace(/Starcraft: Brood War/ig, 'Starcraft') // remove "Brood War" part from the game name, because noone says it. still, we need to include it in ChatGPT input, because it talks about Marauders and Medivacs if we don't :)
    .replace(/Hydralisk/ig, 'Hi-dra-lisk')
    .replace(/lead/ig, 'leed')
    .replace(/Patreon/ig, 'Pae-treon')
    .replaceAll(', ', ' ') // remove commas from the output, because TTS interprets them as uncomfortably long pauses
    .replaceAll('"', '') // remove the surrounding ""
    .replace(/^\s+|\s+$/g, '') // trim leading & trailing whitespaces & newlines

  // limit the occurences of "who will come out on top?" goddammit
  if (s.toLowerCase().includes('who will come out on top?')) {
    if (!Object.keys(gameData).includes(gameId) || !gameData[gameId].whoWillComeOutOnTopCounter) gameData[gameId].whoWillComeOutOnTopCounter = 0
    gameData[gameId].whoWillComeOutOnTopCounter = gameData[gameId].whoWillComeOutOnTopCounter + 1

    if (gameData[gameId].whoWillComeOutOnTopCounter > 2) ret = ret.replace(/who will come out on top\?/ig, '')
  }

  return ret
}

// get natural language description of a situation from ChatGPT
async function getTextDescriptionOfSituation (gameId, situation, retriesAllowed = 2) {
  try {
    const stringInputForChatGPT = await situationJSONToString(situation, gameId)
    if (stringInputForChatGPT) {
      // if gameId changed just now, start a new message chain (conversation) for this new game
      if (!Object.keys(gameData).includes(gameId) || !Object.keys(gameData[gameId]).includes('lastMessageId')) {
        // send an initial message with parentMessageId set to null to init a new message chain (conversation)
        const res = await chatGPTAPI.sendMessage(
          'Generate a live commentary of a professional StarCraft: Brood War game in a style of Tastless, Artosis or Day9.' + '\n' +
          'I will provide a brief summary of current in-game situation and you use that information to cast the game.' + '\n' +
          'Reply with 55 words or less.' + '\n\n' +
          stringInputForChatGPT)

        // save the id of this message to our map so we can continue the message chain from here
        if (!Object.keys(gameData).includes(gameId)) gameData[gameId] = {}
        gameData[gameId].lastMessageId = res.id

        // return the response from ChatGPT
        return sanitizeStringForTTS(res.text, gameId)
      } else {
        // if we already have the ChatGPT id for the previous message for this gameId, use it when we send the message to ChatGPT
        const res = await chatGPTAPI.sendMessage(stringInputForChatGPT, {
          parentMessageId: gameData[gameId].lastMessageId
        })

        // save the id of this message to our map so we can continue the message chain from here
        gameData[gameId].lastMessageId = res.id

        // return the response from ChatGPT
        return sanitizeStringForTTS(res.text, gameId)
      }
    } else {
      // if we have nothing to talk about at this moment, just return null
      return null
    }
  } catch (e) {
    log('There was an error: ' + e)
    if (retriesAllowed > 0) {
      log('Retrying...')
      return await getTextDescriptionOfSituation(gameId, situation, retriesAllowed - 1)
    }
    return null
  }
}

// set up an API
const app = express()
app.get('/', async (req, res) => {
  const { gameId, situation } = req.query

  if (!gameId) {
    log('Request error: gameId param is required')
    return res.status(400).send({ error: 'gameId param is required' })
  }

  if (!situation) {
    log('Request error: situation param is required')
    return res.status(400).send({ error: 'situation param is required' })
  }

  log('==========================================================')
  log('gameId: ' + gameId)
  log('last message in msg chain: ' + gameData[gameId]?.lastMessageId)
  log('current time filler CDs: ' + JSON.stringify(fillerCooldownUntil))
  log(req.originalUrl)
  log('==========================================================')
  log(situation)
  log('\n ...\n')

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

  const situationNaturalLanguageText = await getTextDescriptionOfSituation(gameId, situation)

  log(situationNaturalLanguageText || '(nothing to say)')
  log('==========================================================')

  try {
    if (situationNaturalLanguageText) {
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
            log(`Couldn't download WAV file: ${response.statusCode}`)
            reject(new Error(`HTTP status code: ${response.statusCode}`))
          }
        })
      })

      // make out.wav faster and lower pitch using sox (it just sounds a bit better this way)
      // await execSync('sox /tmp/commentary.wav /tmp/out.wav pitch -350 tempo -s 1.35 vol 10 dB', { stdio: 'ignore' })
      await execSync('sox /tmp/commentary.wav /tmp/out.wav tempo -s 1.35 vol 10 dB', { stdio: 'ignore' })

      // send the finished file to client
      res.set('Content-Type', 'audio/wav')
      res.sendFile('/tmp/out.wav')
    } else {
      // there was nothing to say right now, so we just wait for a few seconds and return HTTP 204 (no content)
      await new Promise(resolve => setTimeout(resolve, 5000))
      return res.status(204).send({ message: 'there was nothing to say at the moment' })
    }
  } catch (err) {
    return res.status(500).send({ error: err.message })
  }
})

// start the server
const server = app.listen(listenPort, () => {
  log('Server started on port ' + listenPort)
})
server.setTimeout(60000) // set timeout limit to 60s

/*
Dev notes:

  How to train a model: https://tts.readthedocs.io/en/latest/training_a_model.html
  What makes a good Data Set: https://github.com/coqui-ai/TTS/wiki/What-makes-a-good-TTS-dataset#public-tts-dataset
  A tool that can get training data from YouTube: https://github.com/ryanrudes/YTTTS
*/
