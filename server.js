
var LOG_PREFIX = "[Server]";
var TextStuff = require('./logger.js');

let Logger = TextStuff.Logger;
let logger = new Logger(LOG_PREFIX);
const make_yellow = TextStuff.make_yellow;
const make_green = TextStuff.make_green;
const dim = TextStuff.dim;


const UUID = require('uuid/v4');
const Simulator = require('./public/simulator.js');

const express = require('express');
const app = express();

const port = process.env.PORT || 8080;
const server = app.listen(port);
app.use(express.static('public'));



const socket = require('socket.io');
const io = socket(server);

let users = {};
let allClients = {};




let fake_latency = 32;

logger.log('Server started at port: ', port);




io.sockets.on('connection', (socket) => {
    logger.log('player: ' + dim(socket.id) ,make_green(' connected'));

    socket.on('h' ,(msg) => {
        logger.log(msg);
    })
    
    socket.emit('waiting', socket.id);
    socket.join('waiting room');

    allClients[socket.id] = socket;

    users[socket.id] = {
        player: null,
        simulator: null
    }

    socket.on('serverupdate', (msg) => {
       logger.log(msg);
    })

    socket.on('disconnect', () => {
        logger.log( 'player: ' + dim(socket.id) ,make_yellow('disconnected'));
        
        leaveGame(socket);

        delete users[socket.id];
    });

    socket.on('leave', function() {
        logger.log('Other player has left the room as wel, my dear' );
        if(users[socket.id].simulator !== null) {
         // leaveGame(socket);
            leaveGame(socket);
          socket.join('waiting room');
          createGameForWaiting();
        }
      });


      socket.on('pingserver', (data) => {
        var sim = users[socket.id].simulator; 

        logger.log('pinging the server');
        if (sim !== null) {
            sim.pingingServer(data);
        }
      })

    socket.on('keypressed', (data) => {
        var sim = users[socket.id].simulator;

        if (sim !== null ) {
            if(fake_latency > 0) {
                setTimeout(function(){
                    sim.handleKeyPress(data);
                }.bind(this), fake_latency);
            }
            else {
                sim.handleKeyPress(data);
            }
        }
    })

    socket.on('keyreleased', (data) => {
        var sim = users[socket.id].simulator;
        if (sim !== null ) {
            if(fake_latency > 0) {
                setTimeout(function(){
                    sim.handleKeyReleased(data);
                }.bind(this), fake_latency);
            }
            else {
                sim.handleKeyReleased(data);
            }
        }
    })

  
   
    createGameForWaiting();
});

function createGameForWaiting() {
    let players = getClientsForRoom('waiting room');

    // must change to support more than 2 players!
    if (players.length >= 2) {
       
        let game_uuid = UUID();
        //let game = new Game(game_uuid, players[0].id, players[1].id);
        let sim = new Simulator(game_uuid, players[0].id, players[1].id, io);
        
        
        players[0].leave('waiting room');
        players[1].leave('waiting room');
        players[0].join('game_room'+sim.id);
        players[1].join('game_room'+sim.id);

        io.to('game_room'+sim.id).emit('joinedgame', {game_id: sim.id, client_id:players[0].id, host_id:players[1].id});

        sim.start(players[0].id, players[1].id);

        users[players[0].id] = {
            player: 0,
            simulator: sim
        };

        users[players[1].id] = {
            player: 1,
            simulator: sim
        };

        logger.log('sim: ', dim(sim.id), make_green(' created'), ' and', make_green(' joined') )

       
        
    }

    
}

function leaveGame(socket) {
    if (users[socket.id].simulator !== null) {
      logger.log('player: ' + socket.id, make_yellow(' left game '), users[socket.id].simulator.id);
        
      const room = 'game_room' + users[socket.id].simulator.id;
      // Notifty opponent
      socket.broadcast.to(room).emit('notification', {
        message: 'Opponent has left the game'
      });
      socket.broadcast.to(room).emit('endgame');
     
      // leave the current room
      socket.leave(room);
      

      users[socket.id].player = null;
      users[socket.id].simulator = null;
  
      // there is no point in keeping a game and game_room running.
      // so, check if there are others and remove them from game/game_room
      let players = getClientsForRoom(room);
      let other = players.filter((player) => {
          return player.id !== socket.id
      })[0];

      //console.logger.log(other.id, ' != ', socket.id);
      if (other) leaveGame(other);
    }
  }

function getClientsForRoom(room) {
    var clients = [];
    if ( typeof io.sockets.adapter.rooms[room] !== 'undefined') {
        for(let id in io.sockets.adapter.rooms[room].sockets) {
            //clients.push(allClients[id]);
            clients.push(io.sockets.adapter.nsp.connected[id]);
        }
    }
    

    return clients;
}