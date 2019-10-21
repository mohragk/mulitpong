

const TAU = 6.28318530718;
let socket;
let displayText = '';

let simulator;
let state = 'idle';

let player_id;
let other_id;
let host_id;
let client_id;

let server_updates = [];
//let input_seq = 0; 
var my_server_pos_y = 0;

let latency = 0;
let history = [];
let server_state_buffer = [];
let net_delay = 10; //millis

let animator;


let div;
const f_lerp = (y1, y2, mu) => {
    return(y1*(1.0-mu)+y2*mu);
 }

 function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj))
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

    socket.on('pingresponse', updateLatency);

    socket.on('serverupdate', handleServerUpdate);
    socket.on('notification', handleNotification);

    //socket.on('notification', changeNotification);
    server_updates = [];
    input_seq = 0;
    div = createDiv('');
}

function updateLatency(data) {
    let original_time = data.time;
    latency = new Date().getTime() - original_time;
    console.log('Measured latency = ',latency);
    
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

    other_id = (host_id === player_id) ? client_id : host_id;
    simulator.start(host_id, client_id);

    animator = new Animate(simulator.paddles[other_id], 0, 0, 1);

    let t = new Date().getTime();
    socket.emit('pingserver', {time:t})
    //animatePlayer.actor = simulator.paddles[player_id];
}

const handleServerUpdate = (server_state) => {


    server_state_buffer.push(server_state);

     // Predict player position and correct with server data
     correctPosition(server_state);

     // Interpolate other entities position.
     interpolateOtherEntities(server_state);
    
}  
    


function correctPosition(server_state) {

    latency =  server_state.time - ( new Date().getTime() );

    // get the total time that is saved in the history,
    let history_time = (history.length) ? history.reduce((a, b) => ({dt: a.dt + b.dt})).dt : 0;
    history_time *= 1000;
    // get index to split history up to
    let index_to_delete_upto = Math.floor(history_time - latency) ;
    
    // delete entries that are too old
    if (index_to_delete_upto) {
        history = history.slice(index_to_delete_upto, history.lenght -1);
    }

    
    //Our latest server position
    my_server_pos_y = server_state.paddles[player_id].pos.y;

    //Update the debug server position block
    simulator.ghosts[player_id].pos.y = my_server_pos_y;

    // call the simulator solvePaddle function, with our actual, 
    // historical position and apply 
    let adjusted_paddle = cloneObject(simulator.paddles[player_id] );
    adjusted_paddle.pos.y = my_server_pos_y;
   
    const solveDeltaPosition = (paddle, acc, vel, dir, dt) => {
       
        let acc_y = acc * dir;
        acc_y -= vel * 10;
        paddle.velocity.y =   vel + acc_y * dt;

        let old_pos = paddle.pos.y;
        let new_pos = solvePosition(old_pos, paddle.velocity.y, acc_y, dt);
    
        let half = paddle.h /2;
        new_pos = (new_pos < half) ? half : new_pos; //check oob
        new_pos = (new_pos > height - half) ? height-half : new_pos; //check oob

        
        return  old_pos - new_pos;
    }

    // accumulate delta Pos based on history
    let new_pos_delta = 0;
    for (let i = 0; i < history.length; i++) {
    
        new_pos_delta += solveDeltaPosition(adjusted_paddle, history[i].acc, history[i].vel, adjusted_paddle.direction, history[i].dt);
        
        //displayText = new_pos_delta;
    }
    if(new_pos_delta < 1.1) {
        adjusted_paddle.pos.y += new_pos_delta;
    }
    
    simulator.paddles[player_id] =  cloneObject( adjusted_paddle );
}

const solvePosition = (pos, vel, acc, dt /*seconds*/) => {
    return pos + vel * dt + ((acc * (dt*dt)) / 2);
}

Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };




function interpolateOtherEntities(server_state) {

    let current_pos_y = simulator   .paddles[other_id].pos.y;
    let server_pos_y  = server_state.paddles[other_id].pos.y;

    simulator.paddles[other_id].pos.y = server_pos_y;

    simulator.ball.pos = cloneObject(server_state.ball.pos);
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
        let input = {
            id: player_id,
            keyCode: keyCode,
            time: new Date().getTime(),
            seq: input_seq++
        }
        socket.emit('keypressed', input);

    
        simulator.handleKeyPress(input);
    }
    
}
    

function keyReleased() {
    if (state === 'running') {

        let input = {
            id: player_id,
            keyCode: keyCode,
            time: new Date().getTime(),
            seq: input_seq++
        }
        socket.emit('keyreleased', input);

    
        simulator.handleKeyReleased(input);
        
    }
}

function update(dt) {

    if (server_state_buffer.length) {
        //shrink buffer to net delay size
        let first_t = server_state_buffer[0].time;
        let last_t = server_state_buffer[server_state_buffer.length-1].time;
        let buffer_total_time = last_t - first_t;
        let buffer_dt = buffer_total_time / server_state_buffer.length;
        net_delay = buffer_dt;

        server_state_buffer.slice(server_state_buffer.length-2,server_state_buffer.length-1 );

        console.log(server_state_buffer);
    }
    
    
    // Predict player position and correct with server data
    correctPosition(server_state);

    // Interpolate other entities position.
    interpolateOtherEntities(server_state);
    
}


const drawPaddle = (paddle) => {
    fill(255);
    rectMode(CENTER);
    rect(paddle.pos.x, paddle.pos.y, paddle.w, paddle.h);

    //debug
    text(paddle.id, paddle.pos.x, 20);
}


const drawBall = (ball) => {
    fill(255);
    rectMode(CENTER);
    rect(ball.pos.x, ball.pos.y, ball.radius, ball.radius);

}

function draw() {
    background(10);
    if (state === 'running') {



        drawPaddle(simulator.paddles[host_id] );
        drawPaddle(simulator.paddles[client_id] );

        drawBall(simulator.ball);

        //also, save a history
        let player_paddle = simulator.paddles[player_id];
        let delt = deltaTime /1000;
        history.push(
            {
                vel: player_paddle.velocity.y, //only interested in y
                acc: player_paddle.acceleration,
                dir: player_paddle.direction,
                dt: delt.fixed(4) //millis!
            }
        )
        
        

        let ghost = simulator.ghosts[player_id];
        noFill();
        stroke(180);
        rect(ghost.pos.x, ghost.pos.y, ghost.w, ghost.h);
    }
    if(animator) animator.update(60/1000)
    div.html('<p>'+displayText+'</p>');
}