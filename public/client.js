
let socket;
let displayText = '';
let simulator;
let player_id;
let state = 'idle';
let host_id;
let client_id;
let server_updates = [];
let div;

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
    simulator.start(host_id, client_id);
   
    displayText = 'Game is running, id: '+data.game_id;
    state= 'running';
    host_id = data.host_id;
    client_id = data.client_id;
   
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
    let naive = false;
    if(naive) {
        //console.log(state);
        simulator.paddles = simulator.paddles.map((paddle) => {
            //let the_id = paddle.id;
            paddle.pos.y = state.paddles[paddle.id].y;
            return paddle;
        });
    }
    else {
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

const processNetPredictionCorrection = (state_buffer) => {

    
    // No updates to be found
    if (state_buffer.length  == 0 ) return;

    //The most recent server update
    let latest_server_data = state_buffer[state_buffer.length-1];

        //Our latest server position
    var my_server_pos = latest_server_data.paddles[player_id].y;

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
    
    //here we handle our local input prediction ,
    //by correcting it with the server and reconciling its differences
/*
    var my_last_input_on_server = this.players.self.host ? latest_server_data.his : latest_server_data.cis;
    if(my_last_input_on_server) {
            //The last input sequence index in my local input list
        var lastinputseq_index = -1;
            //Find this input in the list, and store the index
        for(var i = 0; i < this.players.self.inputs.length; ++i) {
            if(this.players.self.inputs[i].seq == my_last_input_on_server) {
                lastinputseq_index = i;
                break;
            }
        }

            //Now we can crop the list of any updates we have already processed
        if(lastinputseq_index != -1) {
            //so we have now gotten an acknowledgement from the server that our inputs here have been accepted
            //and that we can predict from this known position instead

                //remove the rest of the inputs we have confirmed on the server
            var number_to_clear = Math.abs(lastinputseq_index - (-1));
            this.players.self.inputs.splice(0, number_to_clear);
                //The player is now located at the new server position, authoritive server
            this.players.self.cur_state.pos = this.pos(my_server_pos);
            this.players.self.last_input_seq = lastinputseq_index;
                //Now we reapply all the inputs that we have locally that
                //the server hasn't yet confirmed. This will 'keep' our position the same,
                //but also confirm the server position at the same time.
            this.client_update_physics();
            this.client_update_local_position();

        } // if(lastinputseq_index != -1)
    } //if my_last_input_on_server
  */  
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

        let g = simulator.ghosts[player_id];
        noFill();
        stroke(180);
        rect(g.pos.x, g.pos.y, g.w, g.h);
    }
    
    div.html('<p>'+displayText+'</p>');
}