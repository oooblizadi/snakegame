define([
    "config/client-config",
    "view/canvas-factory",
    "view/game-view",
    "socketio"
],

function (ClientConfig, CanvasFactory, GameView, io) {
    "use strict";
    
    class GameController {

        constructor() {
            this.gameView = new GameView(this.backgroundImageUploadCallback.bind(this),
                                         this.botChangeCallback.bind(this),
                                         this.foodChangeCallback.bind(this),
                                         this.imageUploadCallback.bind(this),
                                         this.joinGameCallback.bind(this),
                                         this.keyDownCallback.bind(this),
                                         this.playerColorChangeCallback.bind(this),
                                         this.playerNameUpdatedCallback.bind(this),
                                         this.spectateGameCallback.bind(this),
                                         this.speedChangeCallback.bind(this),
                                         this.startLengthChangeCallback.bind(this),
                                         this.toggleGridLinesCallback.bind(this)
                                         );
            this.players = {};
            this.food = {};
            this.socket = io();
            this._initializeSocketIoHandlers();
            let storedName = localStorage.getItem(ClientConfig.LOCAL_STORAGE.PLAYER_NAME);
            let storedBase64Image = localStorage.getItem(ClientConfig.LOCAL_STORAGE.PLAYER_IMAGE);
            this.socket.emit(ClientConfig.IO.OUTGOING.NEW_PLAYER, storedName, storedBase64Image);
        }
       
        renderGame() {
            this.canvasView.clear();
            for(let foodId in this.food) {
                let food = this.food[foodId];
                this.canvasView.drawSquare(food.location, food.color);
            }
            for(let playerId in this.players) {
                let player = this.players[playerId];
                if(player.segments.length === 0) {
                    continue;
                }
                // Flash around where you have just spawned
                if("/#"+this.socket.id === playerId && player.moveCounter <= ClientConfig.TURNS_TO_FLASH_AFTER_SPAWN && player.moveCounter%2 === 0) {
                    this.canvasView.drawSquareAround(player.segments[0], ClientConfig.SPAWN_FLASH_COLOR);
                }
                
                if(player.base64Image) {
                    this.canvasView.drawImages(player.segments, player.base64Image);
                } else {
                    this.canvasView.drawSquares(player.segments, player.color);
                }
            }
            
            let self = this;
            // Run in a loop
            setTimeout(function() {
                requestAnimationFrame(self.renderGame.bind(self));
            }, 1000 / ClientConfig.FPS);
        }
        
        /*******************
         *  View Callbacks *
         *******************/
        
        botChangeCallback(option) {
            this.socket.emit(ClientConfig.IO.OUTGOING.BOT_CHANGE, option);
        }
        
        foodChangeCallback(option) {
            this.socket.emit(ClientConfig.IO.OUTGOING.FOOD_CHANGE, option);
        }
        
        backgroundImageUploadCallback(image, imageType) {
            if(arguments.length === 0) {
                this.socket.emit(ClientConfig.IO.OUTGOING.CLEAR_UPLOADED_BACKGROUND_IMAGE);
                return;
            }
            let resizedBase64Image = this.canvasView.resizeUploadedBackgroundImageAndBase64(image,imageType);
            this.socket.emit(ClientConfig.IO.OUTGOING.BACKGROUND_IMAGE_UPLOAD, resizedBase64Image);
        }
        
        // optional resizedBase64Image
        imageUploadCallback(image, imageType, resizedBase64Image) {
            if(arguments.length === 0) {
                this.socket.emit(ClientConfig.IO.OUTGOING.CLEAR_UPLOADED_IMAGE);
                localStorage.removeItem(ClientConfig.LOCAL_STORAGE.PLAYER_IMAGE);
                return;
            }
            if(!resizedBase64Image) {
                resizedBase64Image = this.canvasView.resizeUploadedImageAndBase64(image,imageType);
            }
            this.socket.emit(ClientConfig.IO.OUTGOING.IMAGE_UPLOAD, resizedBase64Image);
            localStorage.setItem(ClientConfig.LOCAL_STORAGE.PLAYER_IMAGE, resizedBase64Image);
        }
        
        joinGameCallback() {
            this.socket.emit(ClientConfig.IO.OUTGOING.JOIN_GAME);
        }
        
        keyDownCallback(keyCode) {
            this.socket.emit(ClientConfig.IO.OUTGOING.KEY_DOWN, keyCode);
        }
        
        playerColorChangeCallback() {
            this.socket.emit(ClientConfig.IO.OUTGOING.COLOR_CHANGE);
        }
        
        playerNameUpdatedCallback(name) {
            this.socket.emit(ClientConfig.IO.OUTGOING.NAME_CHANGE, name);
            localStorage.setItem(ClientConfig.LOCAL_STORAGE.PLAYER_NAME, name);
        }
        
        spectateGameCallback() {
            this.socket.emit(ClientConfig.IO.OUTGOING.SPECTATE_GAME);
        }
        
        speedChangeCallback(option) {
            this.socket.emit(ClientConfig.IO.OUTGOING.SPEED_CHANGE, option);
        }
        
        startLengthChangeCallback(option) {
            this.socket.emit(ClientConfig.IO.OUTGOING.START_LENGTH_CHANGE, option);
        }
        
        toggleGridLinesCallback() {
            this.canvasView.toggleGridLines();
        }
        
        /*******************************
         *  socket.io handling methods *
         *******************************/
        
        _createBoard(board) {
            this.canvasView = CanvasFactory.createCanvasView(board.SQUARE_SIZE_IN_PIXELS, board.HORIZONTAL_SQUARES, board.VERTICAL_SQUARES);
            this.canvasView.clear();
            this.gameView.ready();
            this.renderGame();
        }
        
        _handleBackgroundImage(backgroundImage) {
            if(backgroundImage) {
                this.canvasView.setBackgroundImage(backgroundImage);
            } else {
                this.canvasView.clearBackgroundImage();
            }
        }
        
        _handleNewGameData(gameData) {
            this.players = gameData.players;
            this.food = gameData.food;
            this.gameView.showFoodAmount(Object.keys(gameData.food).length);
            this.gameView.showSpeed(gameData.speed);
            this.gameView.showStartLength(gameData.startLength);
            this.gameView.showNumberOfBots(gameData.numberOfBots);
            this.gameView.showPlayerStats(gameData.playerStats);
        }
        
        _handleNotification(notification, playerColor) {
            this.gameView.showNotification(notification, playerColor);
        }
        
        _updatePlayerName(playerName, playerColor) {
            this.gameView.updatePlayerName(playerName, playerColor);
        }
        
        _initializeSocketIoHandlers() {
            this.socket.on(ClientConfig.IO.INCOMING.NEW_PLAYER_INFO, this._updatePlayerName.bind(this));
            this.socket.on(ClientConfig.IO.INCOMING.BOARD_INFO, this._createBoard.bind(this));
            this.socket.on(ClientConfig.IO.INCOMING.NEW_STATE, this._handleNewGameData.bind(this));
            this.socket.on(ClientConfig.IO.INCOMING.NEW_BACKGROUND_IMAGE, this._handleBackgroundImage.bind(this));
            this.socket.on(ClientConfig.IO.INCOMING.NOTIFICATION, this._handleNotification.bind(this));
        }
    }
    
    return GameController;
});