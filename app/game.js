class Game {
    constructor(game_ID, player1_ID, player2_ID) {
        this.game_ID = game_ID;
        this.players = [player1_ID, player2_ID];
    }
    

    getID() {
        return this.game_ID;
    }

    getPlayerID(player) {
        return this.players[player];
    }
}

module.exports = Game;