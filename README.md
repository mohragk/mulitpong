# Multipong
 A simple multiplayer version of Pong, with a twist.
 The game uses client-side prediction of the player position to deliver a smoother experience. 
 
## Live demo
[Run the game on heroku](https://hot-multi-pong.herokuapp.com), use a second window if there are no other players at the moment.

## Install
Simply clone this repo and execute `npm start` or `node server.js` via terminal. Open a browser windown and go to localhost:3000. Open a second screen to initiate a game.

## Architecture of the game
The game consists of 3 main elements: a server, a simulator and a client.
The simulator is a class that handles the (physics) simulation of the game depending on players' input. Both the server and all clients have their own instance of this class.
The server uses [SOCKET.IO](https://socket.io) to establish connections, create rooms, initiate games and push states around.
The client connects to the server and relays key inputs to both the server (and serverside simulator) as the simulator. 

## Client-side prediction
The game is run both on the server and the client side, using an instance of the simulator class. The server is authorative, meaning that what the server simulated is 'truth' and all clients (the two players) need to adapt their client-side simulator state to the server's.  

## Disclaimer
This project was made as a personal challenge to investigate multiplayer gaming.
