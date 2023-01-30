StarCraft: Brood War Commentary Generator for SSCAIT
----------------------------------------------------

### Installation

*   Install 'TTS' command: `sudo pip3 install TTS` (follow instructions at [https://github.com/coqui-ai/TTS](https://github.com/coqui-ai/TTS))
*   Install 'ffmpeg': `sudo apt install ffmpeg`
*   Install NodeJS 18+
*   Run `npm install` to install server dependencies
*   Copy 'settings.js.example' to 'settings.js' and configure OpenAI credentials

### Usage

*   Start the server by running `npm run listen`
*   Send game situation descriptions via GET HTTP requests to receive a .WAV file of the commentary

#### GET parameters:

*   **gameId**: Unique identifier for each game
*   **situation**: JSON array of strings, each describing the current situation

#### Example:

REQUEST: `http://localhost:3000/?gameId=123456&situation=["game is starting","map name is Fighting Spirit","player 1 is Dragon and plays Terran","player 2 is Steamhammer and plays Zerg", "Dragon spawns North"]`

RESPONSE: `out.wav` file with spoken text:

> Welcome to another exciting StarCraft: Brood War match on Fighting Spirit! Dragon plays as Terran up North and Steamhammer as Zerg down South. This classic race matchup is sure to be a thrill. Will Dragon hold off Steamhammer's swarms or will Steamhammer overpower Dragon's defenses? Let's find out.

REQUEST: `http://localhost:3000/?gameId=123456&situation=["game time is: 2:00","Steamhammer builds Spawning pool","Dragon builds Supply Depot","Steamhammer sends a Drone to scout"]`

RESPONSE: `out.wav` file with spoken text:

> Two minutes into the game and both players are off to a strong start. Steamhammer builds a Spawning Pool for Zerglings and Dragon builds a Supply Depot for resources. Steamhammer also sent a drone to scout, let's see what he finds.

REQUEST: `http://localhost:3000/?gameId=123456&situation=["game time is 4:00","Dragon builds Command Center","Dragon builds Barracks at main","Steamhammer trains 6 Zerglings"]`

RESPONSE: `out.wav` file with spoken text:

> At 4 minutes in, the game is heating up. Dragon builds a Command Center and Barracks for Marines, while Steamhammer trains 6 Zerglings. Early aggression could foreshadow what's to come.