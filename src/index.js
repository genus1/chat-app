import path from 'path'
import {fileURLToPath} from 'url'
import { createServer } from 'http'
import express from 'express'
import socketio from 'socket.io'
import Filter from 'bad-words'
import { generateMessage, generateLocationMessage } from './utils/messages.js'
import { addUser, removeUser, getUser, getUsersInRoom } from './utils/users.js'

//Set up __dirname and __filename to work with modules and es6
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)  //creating express server by http
const io = socketio(server)  //server now supports websockets

const port = process.env.PORT || 3000
const publicDirectoryPath = join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {  //this runs for each connected client
    console.log('New Websocket connection')
        //socket.emit, io.emit, socket.broadcast.emit
        //io.to.emit, socket.broadcast.to.emit

    socket.on('join', (options, callback) => {  //options = { username, room }  and spread out below ...options
        const { error, user } = addUser({ id: socket.id, ...options })  //addUser returns trimmed and lowercase

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('Admin','Welcome!'))  //sends to this client
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))  //sends to all but this one
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        } 

        io.to(user.room).emit('message', generateMessage(user.username, message))  //emits to rooms
        callback()  //can return any number of variables
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)

        io.to(user.room).emit('locationMessage', generateLocationMessage( user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user =removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin',`${user.username} has left!`))  //emits to all clients in room
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        } 
    })
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}!`)
})