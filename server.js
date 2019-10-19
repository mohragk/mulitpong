const UUID = require('uuid/v4');
const Simulator = require('./public/simulator.js');
const Game = require('./app/game.js');

const express = require('express');
const app = express();

const port = 8080;
const server = app.listen(port);
app.use(express.static('public'));

console.log('Server started at port: ', port);

const socket = require('socket.io');
const io = socket(server);


let users = {};
let gameCounter = 0;
let allClients = {};

io.sockets.on('connection', (socket) => {
    console.log((new Date().toISOString()) + ', ID: ' + socket.id + ' connected.');

    
    socket.emit('waiting', socket.id);
    socket.join('waiting room');

    allClients[socket.id] = socket;

    users[socket.id] = {
        inGame: null,
        player: null,
        simulator: null
    }

    socket.on('serverupdate', (msg) => {
        console.log(msg);
    })

    socket.on('disconnect', () => {
        console.log((new Date().toISOString()) + ', ID: ' + socket.id + ' disconnected.');
        
        leaveGame(socket);

        delete users[socket.id];
    });

    socket.on('leave', function() {
        console.log('player has left the building');
        if(users[socket.id].inGame !== null) {
         // leaveGame(socket);
        
          socket.join('waiting room');
          createGameForWaiting();
        }
      });

    socket.on('keypressed', (data) => {
        var sim = users[socket.id].simulator;
        if (sim !== null ) {
            sim.handleKeyPress(data);
        }
    })

    socket.on('keyreleased', (data) => {
        var sim = users[socket.id].simulator;
        if (sim !== null ) {
            sim.handleKeyReleased(data);
        }
    })

  
   
    createGameForWaiting();
});

function createGameForWaiting() {
    let players = getClientsForRoom('waiting room');

    // must change to support more than 2 players!
    if (players.length >= 2) {
       
        let game_uuid = UUID();
        let game = new Game(game_uuid, players[0].id, players[1].id);
        let sim = new Simulator(game.game_ID, players[0].id, players[1].id, io);
       
        
        players[0].leave('waiting room');
        players[1].leave('waiting room');
        players[0].join('game_room'+game.game_ID);
        players[1].join('game_room'+game.game_ID);

        users[players[0].id] = {
            inGame: game,
            player: 0,
            simulator: sim
        };

        users[players[1].id] = {
            inGame: game,
            player: 1,
            simulator: sim
        };

       // io.to('game_room'+game.game_ID).emit('game started', {game_id: game.game_ID, p1: players[0].id, p2: players[1].id });
        io.to('game_room'+game.game_ID).emit('joinedgame', {game_id: game.game_ID, client_id:players[0].id, host_id:players[1].id});

        sim.start(players[0].id, players[1].id);
    }
}

function leaveGame(socket) {
    if(users[socket.id].inGame !== null) {
      console.log((new Date().toISOString()) + ' ID ' + socket.id + ' left game ID ' + users[socket.id].inGame.game_ID);
        
      const room = 'game_room' + users[socket.id].inGame.game_ID;
      // Notifty opponent
      socket.broadcast.to(room).emit('notification', {
        message: 'Opponent has left the game'
      });
  

      // leave the current room
      socket.leave(room);
  
      users[socket.id].inGame = null;
      users[socket.id].player = null;
      users[socket.id].simulator = null;
  
      io.to(socket.id).emit('leave');
    }
  }

function getClientsForRoom(room) {
    var clients = [];
    if ( io.sockets.adapter.rooms[room].sockets) {
        for(let id in io.sockets.adapter.rooms[room].sockets) {
            clients.push(allClients[id]);
        }
    }
    

    return clients;
}