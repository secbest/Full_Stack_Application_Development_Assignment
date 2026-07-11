// Runs automatically before `npm run dev` (see package.json's "predev"). If another
// backend instance is already listening on PORT, refuse to start a second one -
// two nodemon instances watching the same files both try to rebind this port on every
// file change, and whichever loses the race crashes with EADDRINUSE. Failing fast here
// with a clear message is better than letting that happen on every save.
//
// Checks by connecting as a client rather than trying to bind a server: on Windows,
// binding a second listener to an already-used port can silently succeed (a known
// socket quirk) even though the original owner is still there, which made an earlier
// version of this check useless.
const net = require('net')
require('dotenv').config()

const PORT = Number(process.env.PORT) || 3000

const socket = net.connect({ port: PORT, host: '127.0.0.1' })
socket.setTimeout(1000)

socket.once('connect', () => {
  socket.destroy()
  console.error(`\n[predev] Port ${PORT} is already in use - a backend dev server is probably already running in another terminal.`)
  console.error(`[predev] Switch to that terminal instead of starting another one, or stop it first (Ctrl+C) if it's stuck.\n`)
  process.exit(1)
})
socket.once('timeout', () => {
  socket.destroy()
  process.exit(0)
})
socket.once('error', () => {
  // ECONNREFUSED (or similar) - nothing is listening on this port.
  process.exit(0)
})
