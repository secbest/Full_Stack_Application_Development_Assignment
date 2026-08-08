// Runs automatically before `npm run dev` (see package.json's "predev"). If another
// presentation dev server is already listening on PORT, refuse to start a second one.
// Checks by connecting as a client rather than trying to bind a server: on Windows,
// binding a second listener to an already-used port can silently succeed even though
// the original owner is still there.
const net = require('net')

const PORT = 5175

const socket = net.connect({ port: PORT, host: '127.0.0.1' })
socket.setTimeout(1000)

socket.once('connect', () => {
  socket.destroy()
  console.error(`\n[predev] Port ${PORT} is already in use - a presentation dev server is probably already running in another terminal.`)
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
