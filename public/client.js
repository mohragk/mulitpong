
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

Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };



const TAU = 6.28318530718;
let socket;
let displayText = '';

let simulator;
let state = 'idle';

let player_id;
let other_id;
let host_id;
let client_id;

let score_host;
let score_client;

var my_server_pos_y = 0;

let latency = 0;
let history = [];
let last_server_state = {};

let div;


let font;
function preload() {
  font = loadFont('assets/Square.ttf');
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
    input_seq = 0;
    div = createDiv('');
    textFont(font);
}


// ****************  
// SOCKET CALLBACKS

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
    mainLoop(); //initiate mainLoop


    let t = new Date().getTime();
    socket.emit('pingserver', {time:t})
}


const handleServerUpdate = (server_state) => {
    last_server_state = server_state;
}  
    
// END
// ************




// ************
// LOOPING FUNCTIONS

function update(dt) {
    //also, save a history
    let player_paddle = simulator.paddles[player_id];
    history.push(
        {
            vel: player_paddle.velocity.y, //only interested in y
            acc: player_paddle.acceleration,
            dir: player_paddle.direction,
            dt: dt.fixed(4) //millis!
        }
    )
    
    if(last_server_state.time) {


        // Predict player position and correct with server data
        correctPosition(last_server_state);

        // Interpolate other entities position.
        interpolateOtherEntities(last_server_state);

       //update score
       score_host =  last_server_state.score_host;
       score_client = last_server_state.score_client;
    }
}


let lastframetime = 0;

mainLoop = function() {

    let t = new Date().getTime();
    //Work out the delta time
    let dt = lastframetime ? ( (t - lastframetime)/1000.0).fixed(5) : 0.01666;

    //Store the last frame time
    lastframetime = t;

    if(state === 'running') {
        update(dt);       
        setTimeout(mainLoop, (t+dt) - new Date().getTime())
    }

};



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

    //Update the debug server position ghost
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



function interpolateOtherEntities(server_state) {

    let current_pos_y = simulator   .paddles[other_id].pos.y;
    let server_pos_y  = server_state.paddles[other_id].pos.y;

    simulator.paddles[other_id].pos.y = server_pos_y;

    simulator.ball.pos = cloneObject(server_state.ball.pos);
}

// END
// **********




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
    
    return (keyCode !== 38 && keyCode !== 40) ; //prevent default behaviour
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

    return (keyCode !== 38 && keyCode !== 40) ;
}
    

function keyTyped() {
    return (keyCode !== 38 && keyCode !== 40) ; //prevent default behaviour
}



// ***********
// DRAWING

const drawPaddle = (paddle) => {
    let col = paddle.id === player_id ? 'rgba(53, 223, 109, 1.0)' :'rgba(220, 220, 220, 1.0)' 
    noStroke();
    fill(col);
    rectMode(CENTER);
    rect(paddle.pos.x, paddle.pos.y, paddle.w, paddle.h);

}


const drawBall = (ball) => {
    fill(255);
    noStroke();
    rectMode(CENTER);
    rect(ball.pos.x, ball.pos.y, ball.radius, ball.radius);

}

const drawScores = () => {
    fill(255);
    noStroke();
    textSize(30);
    textAlign(CENTER);
    text(score_host, width/6, 50);
    text(score_client, width - (width/6), 50);
}

const drawGhost = () => {
    let ghost = simulator.ghosts[player_id];
    noFill();
    stroke(180);
    rect(ghost.pos.x, ghost.pos.y, ghost.w, ghost.h);
    noStroke();
}

// END
// **********

function draw() {
    background(10);
    if (state === 'running') {
        drawScores();

        drawPaddle(simulator.paddles[host_id] );
        drawPaddle(simulator.paddles[client_id] );

        

        drawBall(simulator.ball);

        

        
    }
  
    div.html('<p>'+displayText+'</p>');
}