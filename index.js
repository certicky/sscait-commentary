import {
  ChatGPTAPIBrowser
} from 'chatgpt'
import express from 'express'
import {
  execSync
} from 'child_process'
import {
  openAIEmail,
  openAIPassword,
  listenPort
} from './settings.js'

// GLOBAL VARS
const chatGPTAPI = new ChatGPTAPIBrowser({ email: openAIEmail, password: openAIPassword, markdown: false })
const gameIdToConversationIdMap = {}
let lastMessageId = null

// log in to ChatGPT and start a session
await chatGPTAPI.initSession()
console.log('ChatGPT session started.')

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
async function getTextDescriptionOfSituation (gameId, situation, retriesAllowed = 1) {
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
      return sanitizeStringForTTS(res.response)
    } else {
      // if we already know the ChatGPT conversationId for this gameId, use it when we send the message to ChatGPT
      const res = await chatGPTAPI.sendMessage(situationJSONToString(situation), {
        conversationId: gameIdToConversationIdMap[gameId],
        parentMessageId: lastMessageId
      })
      lastMessageId = res.messageId

      // return the response from ChatGPT
      return sanitizeStringForTTS(res.response)
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

  const situationNaturalLanguageText = await getTextDescriptionOfSituation(gameId, situation)
  console.log(situationNaturalLanguageText)

  try {
    // run TTS to create commentary.wav
    // $ tts --text "..." --out_path /tmp/commentary.wav --model_name tts_models/en/ljspeech/glow-tts
    await execSync('tts --text "'+situationNaturalLanguageText+'" --out_path /tmp/commentary.wav --model_name tts_models/en/ljspeech/glow-tts', { stdio: 'inherit' })

    // make out.wav faster using ffmpeg
    // $ ffmpeg -y -i /tmp/commentary.wav -filter:a "atempo=1.35" -vn /tmp/out.wav
    await execSync('ffmpeg -y -i /tmp/commentary.wav -filter:a "atempo=1.35" -vn /tmp/out.wav', { stdio: 'inherit' })

    // send the finished file to client
    res.set('Content-Type', 'audio/wav');
    res.sendFile('/tmp/out.wav');
  } catch (err) {
    return res.status(500).send({ error: err.message })
  }
})

app.listen(listenPort, () => {
  console.log('Server started on port', listenPort)
})


/*
Dev notes:

  How to train a model: https://tts.readthedocs.io/en/latest/training_a_model.html
  What makes a good Data Set: https://github.com/coqui-ai/TTS/wiki/What-makes-a-good-TTS-dataset#public-tts-dataset
  A tool that can get training data from YouTube: https://github.com/ryanrudes/YTTTS
*/