var PORT = process.env.PORT || 5000;
var express = require('express');
var app = express();
var path = require('path');

var http = require('http');
var server = http.Server(app);

app.use('/public', express.static(path.resolve(__dirname, 'public')));
app.get('/',function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});
server.listen(PORT);

var WebSocketServer = require('ws').Server;
var wsServer = new WebSocketServer({server: server});

var clients = {};
var games = {};
const adjs=['Quiet','Lucky','Happy','Royal','Funny','Crazy','Noble','Jolly','Bland','Shiny','Eager','Salty','Fuzzy','Whiny','Fancy','Moody'];
const animals = ['Alpaca','Ferret','Monkey','Marmot','Turtle','Walrus'];
var activeGames = 0;

wsServer.on('request', request => {
  console.log('hello');
  //connect
  const connection = request.accept(null, request.origin);
  connection.on('open', () => console.log('opened!'));
  connection.on('close', () => {
    //getGameFromPlayer();
    let id;
    for (let client in clients) {
      if (clients[client].connection === connection) {
        id = client;
        break;
      }
    }
    let game = getGameFromPlayer(id);
    if (!game) {
      delete clients[id];
    } else {
      let gonePlayer;
      //find the player that left
      for (let player in game.players) {
        if (game.players[player].clientId == id) {
          gonePlayer = player;
          break;
        }
      }
      if (game.launched == false && id != game.players[0].clientId) {
        game.players.splice(gonePlayer,1);
        //just show that player left (not launched, not leader)
        updatePlayers(game);
      } else if (game.launched == false && id == game.players[0].clientId) {
        //kick all players (not launched, but leader)
        let payLoad = {
          method: 'criticalerror',
          text: 'The leader has ended this game'
        };
        for (let person of game.players) {
          clients[person.clientId].connection.send(JSON.stringify(payLoad));
          clients[person.clientId].connection.close();
          delete clients[person.clientId];
        }
        delete game;
        activeGames--;
      } else {
        if (game.players.length > 3) { //enough players to carry on
          let gonePerson = game.players[gonePlayer];
          game.drawPile.concat(gonePerson.hand);
          for (let group of gonePerson.inSet) {
            for (let card of group) {
              game.drawPile.push(card);
            }
          }
          let index;
          for (let person in game.players) {
            if (game.players[person].name == gonePerson.name) {
              index = Number(person);
              break;
            }
          }
          let f = game.players.slice(0,index);
          let g = game.players.slice(index + 1,game.players.length)
          game.players = f.concat(g);
          updatePlayers(game);
          let announcement = {
            method: 'message',
            message: `${gonePerson.name} has left the game`
          };
          announce(game,announcement);
        } else { //not enough players to carry on
          let payLoad = {
            method: 'criticalerror',
            text: 'There are not enough players to continue the game'
          };
          for (let person of game.players) {
            clients[person.clientId].connection.send(JSON.stringify(payLoad));
            clients[person.clientId].connection.close();
            delete clients[person.clientId];
          }
          delete game;
          activeGames--;
        }
      }
    }
  });
  connection.on("message", message => {
    let result = JSON.parse(message.utf8Data);
    console.log(result.method);
    //I have received a message from the client
    if (result.method == 'create') {
      //create player object
      if (activeGames >= 3) {
        let payLoad = {
          method: 'error',
          text: 'Maximum numbers of games had been reached'
        };
        clients[result.clientId].connection.send(JSON.stringify(payLoad));
        return;
      }
      let player = {
        hand: [],
        inSet: [],
        clientId: result.clientId,
        name: `${adjs[Math.floor(Math.random() * adjs.length)]} Alpaca`
      };
      let joinCode = Math.floor(Math.random() * 1e5 * 9) + 1e5;
      while (String(joinCode).substring(2,3) == '0' || String(joinCode).substring(5,6) == '0') {
        joinCode = Math.floor(Math.random() * 1e5 * 9) + 1e5;
      }
      let joinCodeTaken = false;
      for (let group in games) {
        if (joinCode == games[group].joinCode) {
          joinCodeTaken = true;
          break;
        }
      }
      while (joinCodeTaken) {
        joinCode = Math.floor(Math.random() * 1e5 * 9) + 1e5;
        let stillTaken = false;
        for (let group in games) {
          if (joinCode == games[group].joinCode) {
            stilTaken = true;
            break;
          }
        }
        if (!stilTaken) {
          joinCodeTaken = false;
        }
      }
      let draw = [];
      for (let i = 0; i < 52; i++) {
        draw.push(i);
      }
      let newGame = {
        players: [player],
        turn: 0,
        drawPile: draw,
        launched: false,
        joinCode: joinCode,
        table: [],
        ended: false
      };
      games[guid(games)] = newGame;
      let payLoad = {
        method: 'created',
        you: player,
        game: newGame
      }
      activeGames++;
      clients[result.clientId].connection.send(JSON.stringify(payLoad));
      updatePlayers(newGame);
    } else if (result.method == 'join') {
      let joinCode = result.joinCode;
      let foundGame = false;
      let openGame;
      for (let group in games) {
        if (joinCode === games[group].joinCode) {
          openGame = games[group];
          foundGame = true;
        }
      }
      if (!foundGame) { //game was not found
        let payLoad = {
          method: 'error',
          text: 'Game was not found'
        };
        clients[result.clientId].connection.send(JSON.stringify(payLoad));
        return;
      }
      if (openGame.players.length >= 6) {
        let payLoad = {
          method: 'error',
          text: 'Game is already full'
        };
        clients[result.clientId].connection.send(JSON.stringify(payLoad));
        return;
      }
      let player = {
        hand: [],
        inSet: [],
        clientId: result.clientId,
        name: `${adjs[Math.floor(Math.random() * adjs.length)]} ${animals[openGame.players.length]}`
      };
      openGame.players.push(player);
      let payLoad = {
        method: 'joined',
        you: player,
        game: openGame
      }
      clients[result.clientId].connection.send(JSON.stringify(payLoad));
      updatePlayers(openGame);
    } else if (result.method == 'rename') {
      let game = getGameFromPlayer(result.clientId);
      if (!game) {
        let payLoad = {
          method: 'error',
          text: 'Something went wrong'
        };
        clients[result.clientId].connection.send(JSON.stringify(payLoad));
        return;
      }
      //check that name is not taken
      for (let person of game.players) {
        if (result.newName = person.name) {
          let payLoad = {
            method: 'error',
            text: 'Name is already taken'
          };
          clients[result.clientId].connection.send(JSON.stringify(payLoad));
          return;
        }
      }
      //change name and check name length
      for (let person of game.players) {
        if (person.clientId == result.clientId && result.newName.length <= 12) {
          person.name = result.newName;
          let payLoad = {
            method: 'renamed',
            you: person
          };
          clients[result.clientId].connection.send(JSON.stringify(payLoad));
        } else if (person.clientId == result.clientId) {
          let payLoad = {
            method: 'error',
            text: 'Name cannot be longer than 12 characters'
          };
          clients[result.clientId].connection.send(JSON.stringify(payLoad));
          return;
        }
      }
      updatePlayers(game);
    } else if (result.method == 'launch') {
      let game = getGameFromPlayer(result.clientId);
      if (result.clientId != game.players[0].clientId) {
        let payLoad = {
          method: 'error',
          text: 'You cannot start this game'
        };
        clients[result.clientId].connection.send(JSON.stringify(payLoad));
        return;
      }
      if (game.players.length < 3) {
        let payLoad = {
          method: 'error',
          text: 'You need at least three players to play a game'
        };
        clients[result.clientId].connection.send(JSON.stringify(payLoad));
        return;
      }
      //find table cards
      let tableCards = [];
      for (let i = 0; i < game.players.length + 1; i++) {
        let randomCard = game.drawPile[Math.floor(Math.random() * game.drawPile.length)];
        //check that card is unique value
        let unique = true;
        for (let card of game.table) {
          if (randomCard % 13 == card % 13) {
            unique = false;
            i--;
            break;
          }
        }
        if (unique) {
          game.drawPile = bubble(game.drawPile,randomCard);
          tableCards.push(randomCard);
          game.table.push(randomCard);
        }
      }
      let payLoad2 = {
        method: 'tablecards',
        cards: tableCards
      };
      announce(game,payLoad2);
      for (let person of game.players) {
        dealCards(person.clientId,2);
      }
      game.launched = true;
      let payLoad = {
        method: 'launched',
        turn: game.players[0].name
      }
      announce(game,payLoad);
    } else if (result.method == 'draw') {
      let isTurn = checkTurn(result.clientId);
      if (!isTurn) {
        return;
      }
      let game = getGameFromPlayer(result.clientId);
      let player = getPlayerFromGame(game,result.clientId);
      if (player.hand.length >= 6) {
        let payLoad = {
          method: 'error',
          message: 'You cannot draw with 6 or more cards in hand'
        };
        connection.send(JSON.stringify(payLoad));
      } else if (player.hand.length == 0) {
        dealCards(result.clientId,2);
      } else {
        dealCards(result.clientId,1);
      }
      let announcement = {
        method: 'message',
        message: `${game.players[game.turn].name} drew a card`
      }
      announce(game,announcement);
      if (game.drawPile.length == 0) {
        let announcement2 = {
          method: 'removedraw'
        };
        announce(game,announcement2);
      }
      updateScore(game);
      advanceTurn(game);
    } else if (result.method == 'makeset') {
      let isTurn = checkTurn(result.clientId);
      if (!isTurn) {
        return;
      }
      let game = getGameFromPlayer(result.clientId);
      let player = getPlayerFromGame(game,result.clientId);
      //verify that all cards are the same value
      let checkValue = result.newset[0] % 13;
      for (let val of result.newset) {
        if (val % 13 != checkValue) {
          let payLoad = {
            method: 'error',
            text: 'The cards were not of the same value'
          };
          clients[result.clientId].connection.send(JSON.stringify(payLoad));
          return;
        }
      }
      //check that cards are in play
      let cardsInPlay = player.hand.concat(game.table);
      for (let val of result.newset) {
        if (!cardsInPlay.includes(val)) {
          let payLoad = {
            method: 'error',
            text: 'One of those cards is not in play'
          };
          clients[result.clientId].connection.send(JSON.stringify(payLoad));
          return;
        }
      }
      //move cards
      let playerNewSet = [];
      let removeFromHand = [];
      let removeFromTable = [];
      for (let card of result.newset) {
        playerNewSet.push(card);
        if (player.hand.includes(card)) {
          removeFromHand.push(card);
          player.hand = bubble(player.hand,card);
        } else if (game.table.includes(card)) {
          removeFromTable.push(card);
          game.table = bubble(game.table,card);
        }
      }
      player.inSet.push(playerNewSet);
      let payLoad = {
        method: 'message',
        message: `${game.players[game.turn].name} made a set of ${getCardValue(checkValue)}`
      }
      announce(game,payLoad);
      if (removeFromHand.length > 0) { //remove card(s) from player's hand
        let payLoad = {
          method: 'removefromhand',
          cards: removeFromHand
        }
        connection.send(JSON.stringify(payLoad));
      }
      if (removeFromTable.length > 0) { //remove card(s) from game table
        let payLoad2 = {
          method: 'removefromtable',
          cards: removeFromTable
        }
        announce(game,payLoad2);
      }
      if (game.table.length > 0) {
        updateScore(game);
        advanceTurn(game);
      } else {
        endGame(game,player);
      }
    } else if (result.method == 'challenge') {
      let game = getGameFromPlayer(result.clientId);
      let player = getPlayerFromGame(game,result.clientId);
      //check that the player had the card in their hand
      let hasCardOfValue = false;
      for (let val of player.hand) {
        if (val % 13 == result.card) {
          hasCardOfValue = true;
          break;
        }
      }
      if (!hasCardOfValue) {
        let payLoad = {
          method: 'error',
          text: 'You do not have a card of that value'
        };
        connection.send(JSON.stringify(payLoad));
        return;
      }
      //get challenged player
      let challengedPlayer;
      for (let person of game.players) {
        if (person.name == result.player) {
          challengedPlayer = person;
          break;
        }
      }
      if (challengedPlayer == undefined) {
        let payLoad = {
          method: 'error',
          text: 'Player was not found'
        };
        connection.send(JSON.stringify(payLoad));
        return;
      }
      //find all cards in opponents that match challenged value
      let foundCards = [];
      for (let card of challengedPlayer.hand) {
        if (card % 13 == result.card) {
          foundCards.push(card);
        }
      }
      //find all cards that were used to challenge
      let usedCards = [];
      for (let card of player.hand) {
        if (card % 13 == result.card) {
          usedCards.push(card);
        }
      }
      if (foundCards.length == 0) { //challenge was unsuccessful
        challengedPlayer.hand = challengedPlayer.hand.concat(usedCards);
        let payLoad = {
          method: 'dealt',
          cards: usedCards
        };
        clients[challengedPlayer.clientId].connection.send(JSON.stringify(payLoad));
        for (let card of usedCards) {
          player.hand = bubble(player.hand,card);
        }
        let payLoad2 = {
          method: 'removefromhand',
          cards: usedCards
        };
        connection.send(JSON.stringify(payLoad2));
        let announcement = {
          method: 'message',
          message: `${player.name} unsuccessfully challenged ${challengedPlayer.name} for ${getCardValue(result.card)}`
        }
        announce(game,announcement);
      } else { //challenge was successful
        for (let card of foundCards) {
          challengedPlayer.hand = bubble(challengedPlayer.hand,card);
        }
        let payLoad = {
          method: 'removefromhand',
          cards: foundCards
        }
        clients[challengedPlayer.clientId].connection.send(JSON.stringify(payLoad));
        //remove cards from hand to make new set
        for (let card of usedCards) {
          player.hand = bubble(player.hand,card);
        }
        let payLoad2 = {
          method: 'removefromhand',
          cards: usedCards
        }
        connection.send(JSON.stringify(payLoad2));
        let newSet = foundCards.concat(usedCards);
        player.inSet.push(newSet);
        let announcement = {
          method: 'message',
          message: `${player.name} successfully challenged ${challengedPlayer.name} for ${getCardValue(result.card)}`
        }
        announce(game,announcement);
        updateScore(game);
      }
      advanceTurn(game);
    } else if (result.method == 'steal') {
      let game = getGameFromPlayer(result.clientId);
      let player = getPlayerFromGame(game,result.clientId);
      let stolenPlayer = false;
      for (let person of game.players) {
        if (person.name == result.name) {
          stolenPlayer = person;
          break;
        }
      }
      if (stolenPlayer == false) {
        let payLoad = {
          method: 'error',
          text: 'Player not identified'
        };
        connection.send(JSON.stringify(payLoad));
        return;
      }
      //check that player has that set
      let stolenSet = false;
      for (let group of stolenPlayer.inSet) {
        if (group[0] % 13 == result.card % 13) {
          stolenSet = group;
          break;
        }
      }
      if (stolenSet == false) {
        let payLoad = {
          method: 'error',
          text: 'Set not identified'
        };
        connection.send(JSON.stringify(payLoad));
        return;
      }
      //remove set from stolen player and add it to stealing player w/ extra cards
      stolenPlayer.inSet = bubble(stolenPlayer.inSet,stolenSet);
      let cardsToAdd = [];
      for (let card of player.hand) {
        if (card % 13 == result.card % 13) {
          player.hand = bubble(player.hand,card);
          cardsToAdd.push(card);
        }
      }
      let payLoad = {
        method: 'removefromhand',
        cards: cardsToAdd
      };
      connection.send(JSON.stringify(payLoad));
      player.inSet.push(stolenSet.concat(cardsToAdd));
      let mess;
      if (player.name != stolenPlayer.name) {
        mess = `${player.name} has stolen a set of ${getCardValue(result.card % 13)} from ${stolenPlayer.name}`
      } else {
        mess = `${player.name} has added to their set of ${getCardValue(result.card % 13)}`
      }
      let announcement = {
        method: 'message',
        message: mess
      };
      updateScore(game);
      announce(game,announcement);
      advanceTurn(game);
    }
  });

  //new clients
  let clientId = guid(clients);
  clients[clientId] = {
    connection: connection
  };
  let payLoad = {
    method: 'connected',
    clientId: clientId
  };
  connection.send(JSON.stringify(payLoad));
});

//resources

function endGame(game,player) {
  let finalScores = [];
  let index = 0;
  for (let person of game.players) {
    index++;
    let score = 0;
    for (let group of person.inSet) {
      score += group.length;
    }
    score = score - person.hand.length;
    let newObj = {name:person.name,score:score,index:index};
    finalScores.push(newObj);
  }
  finalScores.sort(compareScores);
  let payLoad = {
    method: 'endofgame',
    scores: finalScores,
    message: `${player.name} has ended the game`
  };
  announce(game,payLoad);
  for (let player of game.players) {
    clients[player.clientId].connection.close();
  }
  for (let table in games) {
    if (game == games[table]) {
      delete games[table];
      break;
    }
  }
  activeGames--;
}

function compareScores(a,b) {
  const scoreA = a.score;
  const scoreB = b.score;
  if (scoreA > scoreB) {
    return -1;
  } else if (scoreA < scoreB) {
    return 1;
  }
}

function getCardValue(val) {
  if (val == 0) {
    return 'Aces';
  } else if (val == 12) {
    return 'Kings';
  } else if (val == 11) {
    return 'Queens';
  } else if (val == 10) {
    return 'Jacks';
  } else {
    return `${val + 1}'s`;
  }
}

function updateScore(game) {
  let scoreUpdates = [];
  for (let player of game.players) {
    let totalLength = 0;
    for (let arr of player.inSet) {
      totalLength = totalLength += arr.length;
    }
    let newObject = {
      name: player.name,
      score: totalLength - player.hand.length,
      inSet: player.inSet
    }
    scoreUpdates.push(newObject);
  }
  let payLoad = {
    method: 'scoreupdate',
    scores: scoreUpdates
  };
  announce(game,payLoad);
}

function advanceTurn(game) {
  game.turn = checkArrOverflow(game.turn + 1,game.players);
  let payLoad = {
    method: 'nextturn',
    player: game.players[game.turn].name
  }
  announce(game,payLoad);
}

function checkTurn(playerId) {
  let game = getGameFromPlayer(playerId);
  let playerWithTurn = game.players[game.turn];
  if (playerWithTurn.clientId != playerId) {
    let payLoad = {
      method: 'error',
      text: 'It is not your turn'
    };
    clients[playerId].connection.send(JSON.stringify(payLoad));
    return false;
  }
  return true;
}

function checkArrOverflow(num,arr) {
  if (num >= arr.length) {
    return 0;
  } else {
    return num;
  }
}

function dealCards(playerId,quan) {
  let game = getGameFromPlayer(playerId);
  //get player object
  let player;
  for (let person of game.players) {
    if (person.clientId == playerId) {
      player = person;
      break;
    }
  }
  let cards = [];
  for (let i = 0; i < quan; i++) {
    let randomCard = game.drawPile[Math.floor(Math.random() * game.drawPile.length)];
    game.drawPile = bubble(game.drawPile,randomCard);
    cards.push(randomCard);
    player.hand.push(randomCard);
  }
  let payLoad = {
    method: 'dealt',
    cards: cards
  };
  clients[playerId].connection.send(JSON.stringify(payLoad));
}

function announce(game,message) {
  for (let person of game.players) {
    clients[person.clientId].connection.send(JSON.stringify(message));
  }
}

function updatePlayers(game) {
  let names = [];
  for (let person of game.players) {
    let totalLength = 0;
    for (let arr of person.inSet) {
      totalLength = totalLength += arr.length;
    }
    let playerObj = {
      name: person.name,
      score: totalLength - person.hand.length,
      inSet: person.inSet
    }
    names.push(playerObj);
  }
  let payLoad = {
    method: 'playerupdate',
    players: names
  }
  for (let person of game.players) {
    clients[person.clientId].connection.send(JSON.stringify(payLoad));
  }
}

function getGameFromPlayer(playerId) {
  for (let group in games) {
    for (let player of games[group].players) {
      if (player.clientId == playerId) {
        return games[group];
      }
    }
  }
}

function getPlayerFromGame(game,playerId) {
  for (let person of game.players) {
    if (person.clientId == playerId) {
      return person;
    }
  }
}

function bubble(arr,term) {
  if (!Array.isArray(term)) {
    if (arr.indexOf(term) == -1) {
      return arr;
    } else {
      let a = arr.indexOf(term);
      let f = arr.slice(0,a);
      let g = arr.slice(a + 1,arr.length);
      f = f.concat(g);
      return f;
    }
  } else {
    let index = -1;
    for (let item in arr) {
      if (arraysEqual(term,arr[item]) == true) {
        index = Number(item);
        break;
      }
    }
    if (index == -1) {
      return arr;
    }
    let f = arr.slice(0,index);
    let g = arr.slice(index + 1,arr.length);
    f = f.concat(g);
    return f;
  }
}

function arraysEqual(a, b) {
  if (a === b) {
    return true;
  } else if (a == null || b == null) {
    return false;
  } else if (a.length !== b.length) {
    return false;
  }
  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function guid(obj) {
  let potentional = genHexString(16) + "-" + genHexString(16);
  let guidTaken = false;
  for (let id in obj) {
    if (id === potentional) {
      guidTaken = true;
      break;
    }
  }
  while (guidTaken) {
    let stillTaken = true;
    let potentional = guid();
    for (let id in obj) {
      if (id === potentional) {
        stillTaken = true;
        break;
      }
    }
    if (!stillTaken) {
      guidTaken = false;
    }
  }
  return potentional;
}

function genHexString(len) {
    let output = '';
    for (let i = 0; i < len; ++i) {
        output += (Math.floor(Math.random() * 16)).toString(16);
    }
    return output;
}
