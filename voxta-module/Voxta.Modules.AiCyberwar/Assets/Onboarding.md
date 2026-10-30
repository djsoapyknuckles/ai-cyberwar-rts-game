## Get the game

AI Cyberwar runs in your browser, on this computer. It needs [Node.js](https://nodejs.org) 22.18 or newer.

```sh
git clone https://github.com/djsoapyknuckles/ai-cyberwar-rts-game.git
cd ai-cyberwar-rts-game
npm install
```

## Start the game

In the game's folder, run `npm run dev` and leave it running. It serves the game at http://localhost:5173/, the address in this module's settings.

## Import the chat preset

The Model needs quick, one-line replies, or its turns run late. Download [ai-cyberwar-preset.json](/api/extensions/ai-cyberwar/ai-cyberwar-preset.json). In Voxta, under the Voxta Cloud service, open the Chat Replies presets, import it, and make it the default.

If you chat with other characters too, keep your own default instead: make a configuration that uses this preset for Chat Replies, with Summarization off, and set it as **Force Configuration** in The Model's settings under Services.

## Play

Press **Play**. Voxta installs The Model (once; your edits to it are kept), then opens the game in your browser, connected. Pick **AI General (Voxta voice)** and start.
