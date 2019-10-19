
let socket;
let displayText = '';
let simulator;
let player_id;
let state = 'idle';
let host_id;
let client_id;


function setup() {
    createCanvas(800,600);
  socket = io.connect('');
  socket.on('waiting', showWaiting);
  socket.on('joinedgame', initSimulator);
  socket.on('serverupdate', forceUpdate);

  //socket.on('notification', changeNotification);

}

const showWaiting = (socket_id) => {
    displayText = 'Waiting for other players';
    console.log('connected and waiting');
    player_id = socket_id;
}



const initSimulator = (data) => {
    console.log('Joined game: ' + data.game_id);
    simulator = new Simulator(data.game_id);
   
    displayText = 'Game is running!';
    state= 'running';
    host_id = data.host_id;
    client_id = data.client_id;
    simulator.start(host_id, client_id);
}

const forceUpdate = (server_state) => {

    //if(server_state.id === player_id) return; //ignore self

    //console.log(state);
    simulator.paddles = simulator.paddles.map((paddle) => {
        if(paddle.id === server_state.id) {
            paddle.pos.y = server_state.pos.y;
        }
        return paddle;
    })
}

function keyPressed() {
    socket.emit('keypressed', {id: player_id, keyCode: keyCode});
    simulator.handleKeyPress({id: player_id, keyCode: keyCode});
 
    
}

function keyReleased() {
    socket.emit('keyreleased', {id: player_id, keyCode: keyCode});
    simulator.handleKeyReleased({id: player_id, keyCode: keyCode});    
}
function draw() {
    background(10);
    fill(255);
    textAlign(CENTER);
    text(displayText, width/2, height/2)

    if (state === 'running') {

        simulator.paddles.map((paddle) => {
            fill(255);
            rectMode(CENTER);
            rect(paddle.pos.x, paddle.pos.y, paddle.w, paddle.h);

            //debug
            text(paddle.pos.y, paddle.pos.x, 20);
        })
    }
    
    
}