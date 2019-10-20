const TAU = 6.28318530718;
let socket;
let displayText = '';
let simulator;
let player_id;
let state = 'idle';
let host_id;
let client_id;
let server_updates = [];
let div;
let animatePlayer;
const f_lerp = (y1, y2, mu) => {
    return(y1*(1.0-mu)+y2*mu);
 }

 function Interval(fn, time) {
    var timer = false;
    this.start = function () {
        if (!this.isRunning()) {
            timer = setInterval(fn, time);
        }
    };
    this.stop = function () {
        clearInterval(timer);
        timer = false;
    };
    this.isRunning = function () {
        return timer !== false;
    };
}

function setup() {
    createCanvas(800,600);
  socket = io.connect('');
  socket.on('disconnect', endGame);
  socket.on('waiting', showWaiting);
  socket.on('joinedgame', initSimulator);
  socket.on('endgame', endGame);

  socket.on('serverupdate', handleServerUpdate);
  socket.on('notification', handleNotification);

  //socket.on('notification', changeNotification);
  server_updates = [];

  div = createDiv('');
}

const endGame = () => {
    state ='idle';
    socket = null;
    sim = null;
    removeElements();
    setup();
}

const showWaiting = (socket_id) => {
    displayText = 'Waiting for other players';
    
    console.log('connected and waiting');
    player_id = socket_id;
}


const handleNotification = (data) => {
    displayText = data.message;
    //console.log('connected and waiting');
    //player_id = socket_id;
}


const initSimulator = (data) => {
    console.log('Joined game: ' + data.game_id);
    simulator = new Simulator(data.game_id);
   
    displayText = 'Game is running, id: '+data.game_id;
    state= 'running';
    host_id = data.host_id;
    client_id = data.client_id;
    simulator.start(host_id, client_id);

    animatePlayer = new Animate(simulator.paddles[player_id], 0, 0, 1);
    //animatePlayer.actor = simulator.paddles[player_id];
}

const handleServerUpdate = (server_state) => {
    
    
    //Store the server time (this is offset by the latency in the network, by the time we get it)
    //this.server_time = server_state.t;
    
    //Update our local offset time from the last server update
    //this.client_time = this.server_time - (this.net_offset/1000);
    
    let state = server_state;
    let time_offset = 100; //millis
    let server_time = state.time - (time_offset/1000);
    //Update our local offset time from the last server update
    //this.client_time = this.server_time - (this.net_offset/1000);
    
    //if(server_state.id === player_id) return; //ignore self
    {

        //Cache the data from the server,
        //and then play the timeline
        //back to the player with a small delay (net_offset), allowing
        //interpolation between the points.
        server_updates.push(state);

        //we limit the buffer in seconds worth of updates
        //60fps*buffer seconds = number of samples
        let buffer_size = 2;
        if(server_updates.length >= ( 10 * buffer_size )) {
            server_updates.splice(0,1);
        }

        //We can see when the last tick we know of happened.
        //If client_time gets behind this due to latency, a snap occurs
        //to the last tick. Unavoidable, and a reallly bad connection here.
        //If that happens it might be best to drop the game after a period of time.
        //oldest_tick = this.server_updates[0].time;

        //Handle the latest positions from the server
        //and make sure to correct our local predictions, making the server have final say.
        processNetPredictionCorrection(server_updates);
    }
    
}
var my_server_pos = 0;
const processNetPredictionCorrection = (state_buffer) => {

    
    // No updates to be found
    if (state_buffer.length  == 0 ) return;

    //The most recent server update
    let latest_server_data = state_buffer[state_buffer.length-1];

        //Our latest server position
    my_server_pos = latest_server_data.paddles[player_id].y;

        //Update the debug server position block
    simulator.ghosts[player_id].pos.y = my_server_pos;

    /*
    simulator.paddles = simulator.paddles.map((paddle) => {
        //let the_id = paddle.id;
        paddle.pos.y = latest_server_data.paddles[paddle.id].y;
        return paddle;
    });
    */
    let other_id = player_id == host_id ? client_id : host_id;
    simulator.paddles[other_id].pos.y = latest_server_data.paddles[other_id].y;
    
    smoothlyCorrectPosition(my_server_pos);
}   

function smoothlyCorrectPosition(server_pos) {
    let client_pos = simulator.paddles[player_id].pos.y;

    let margin = 1;

    if( Math.abs(client_pos - server_pos) > margin ) {
        let client_pos = simulator.paddles[player_id].pos;
        if (animatePlayer.state !== 'animating') {
            
            
            animatePlayer.duration = 100;
            animatePlayer.resetPoints(client_pos, {x:client_pos.x, y:server_pos});
            animatePlayer.start();
        }  else if (keyIsDown(38) || keyIsDown(40) ) {
            animatePlayer.endPos = client_pos;
        }
        
         else {
            animatePlayer.endPos = {x:client_pos.x, y:server_pos};
            
        }
    }
    
}


class Animate {
    constructor(actor, startPos, endPos, duration) {
      this.actor = actor;
      this.startPos = startPos;
      this.endPos = endPos;
      this.duration = duration;
      this.state = 'idle';
      this.timer = 0;
      this.interval = new Interval(this.update, 300);
    }
    
    start() {
      if(this.state == 'idle') {
        this.state = 'animating';
        this.actor.pos.x = this.startPos.x;
        this.actor.pos.y = this.startPos.y;
        this.timer = 0;

        if (this.interval.isRunning() != false) this.interval.start();
      }
    }
    
    resetPoints(start, end) {
      if(this.state == 'idle') {
        this.startPos = start;
        this.endPos = end;
      }
    }
    
    cancel() {
      this.state = 'idle';
      this.timer = 0;
      this.actor.pos.x = this.startPos.x;
      this.actor.pos.y = this.startPos.y;
    }

    skip() {
        this.timer = this.duration;
      this.actor.pos.x = this.endPos.x;
      this.actor.pos.y = this.endPos.y;
      console.log('skipping')
    }
    
    revert() {
      let temp_x = this.startPos.x;
      let temp_y = this.startPos.y;
      this.startPos.x = this.endPos.x;
      this.startPos.y = this.endPos.y;
      this.endPos.x = temp_x;
      this.endPos.y = temp_y;
      
      this.timer = this.duration - this.timer;
      
      
    }
    
    update(dt) {
        if ( this.timer > this.duration ) {
            this.state = 'idle';
            this.interval.stop();
        }
      if (this.state === 'animating') {
        let dt = (60/1000) / 4;
        let mu = this.timer / this.duration;
        let new_x = f_lerp(this.startPos.x, this.endPos.x, mu);
        let new_y = f_lerp(this.startPos.y, this.endPos.y, mu);;
          
        this.actor.pos.x = new_x;
        this.actor.pos.y = new_y;
        
        this.timer += dt;
        
      }
      
      
       
      
     
    }
    
  }



function keyPressed() {
    if(state === 'running') {
        socket.emit('keypressed', {id: player_id, keyCode: keyCode});

    //if(simulator)
        simulator.handleKeyPress({id: player_id, keyCode: keyCode});
    }
    
}
    

function keyReleased() {
    if (state === 'running') {
        socket.emit('keyreleased', {id: player_id, keyCode: keyCode});

    //if(simulator)
        simulator.handleKeyReleased({id: player_id, keyCode: keyCode});    
    }
}


function draw() {
    background(10);
    if (state === 'running') {
        const drawPaddle = (paddle) => {
            fill(255);
            rectMode(CENTER);
            rect(paddle.pos.x, paddle.pos.y, paddle.w, paddle.h);

            //debug
            text(paddle.pos.y, paddle.pos.x, 20);
        }
        drawPaddle(simulator.paddles[host_id] );
        drawPaddle(simulator.paddles[client_id] );

        let ghost = simulator.ghosts[player_id];
        noFill();
        stroke(180);
        rect(ghost.pos.x, ghost.pos.y, ghost.w, ghost.h);
    }
    if(animatePlayer) animatePlayer.update(60/1000)
    div.html('<p>'+displayText+'</p>');
}